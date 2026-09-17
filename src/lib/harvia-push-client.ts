import EventEmitter from 'node:events';

/**
 * Configuration options for HarviaPushClient.
 */
export interface HarviaPushClientOptions {
	/** Active Harvia device ID. */
	deviceId: string;
	/** Device feed WebSocket URL. */
	deviceWssUrl: string;
	/** Device feed HTTPS URL. */
	deviceHttpsUrl: string;
	/** Measurements feed WebSocket URL. */
	dataWssUrl: string;
	/** Measurements feed HTTPS URL. */
	dataHttpsUrl: string;
	/** Async callback to obtain a valid JWT ID token. */
	getIdToken: () => Promise<string>;
	/** Adapter logger. */
	log: {
		debug: (msg: string) => void;
		info: (msg: string) => void;
		warn: (msg: string) => void;
		error: (msg: string) => void;
	};
}

/**
 * Push payload for device state updates.
 */
export interface PushDeviceStateData {
	/** Target device ID. */
	deviceId: string;
	/** Reported state attributes. */
	reported?: Record<string, unknown>;
	/** Desired state attributes. */
	desired?: Record<string, unknown>;
	/** Cloud connection state. */
	connectionState?: {
		connected?: boolean;
		updatedTimestamp?: number | string;
	};
	/** Timestamp of event. */
	timestamp?: number | string;
}

/**
 * Push payload for device telemetry measurements.
 */
export interface PushMeasurementData {
	/** Target device ID. */
	deviceId: string;
	/** Measurement data object. */
	data: Record<string, unknown>;
	/** Timestamp of measurement. */
	timestamp?: number | string;
	/** Measurement type. */
	type?: string;
}

const DEVICE_STATE_SUBSCRIPTION = `
subscription DeviceStateUpdates($receiver: ID!) {
  devicesStatesUpdateFeed(receiver: $receiver) {
    receiver
    item {
      deviceId
      desired
      reported
      timestamp
      connectionState {
        connected
        updatedTimestamp
      }
    }
  }
}
`.trim();

const MEASUREMENTS_SUBSCRIPTION = `
subscription MeasurementsFeed($receiver: ID!) {
  devicesMeasurementsUpdateFeed(receiver: $receiver) {
    receiver
    item {
      deviceId
      subId
      timestamp
      sessionId
      type
      data
    }
  }
}
`.trim();

/**
 * Manages an individual AppSync real-time WebSocket subscription feed.
 */
class AppSyncFeedConnection extends EventEmitter {
	private name: string;
	private wssUrl: string;
	private httpsHost: string;
	private query: string;
	private getDeviceId: () => string;
	private getIdToken: () => Promise<string>;
	private log: HarviaPushClientOptions['log'];

	private ws: WebSocket | null = null;
	private isRunning = false;
	private isSubscribed = false;
	private subscriptionId: string;
	private reconnectAttempts = 0;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private keepAliveTimer: NodeJS.Timeout | null = null;
	private keepAliveTimeoutMs = 300000;

	/**
	 * Creates an instance of AppSyncFeedConnection.
	 *
	 * @param name - Feed identifier name.
	 * @param wssUrl - WebSocket endpoint URL.
	 * @param httpsUrl - HTTPS endpoint URL to extract host header from.
	 * @param query - GraphQL subscription query.
	 * @param getDeviceId - Callback to fetch current device ID.
	 * @param getIdToken - Callback to fetch valid JWT token.
	 * @param log - Logger.
	 */
	public constructor(
		name: string,
		wssUrl: string,
		httpsUrl: string,
		query: string,
		getDeviceId: () => string,
		getIdToken: () => Promise<string>,
		log: HarviaPushClientOptions['log'],
	) {
		super();
		this.name = name;
		this.wssUrl = wssUrl;
		try {
			this.httpsHost = new URL(httpsUrl).host;
		} catch {
			this.httpsHost = httpsUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
		}
		this.query = query;
		this.getDeviceId = getDeviceId;
		this.getIdToken = getIdToken;
		this.log = log;
		this.subscriptionId = `sub-${name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
	}

	/**
	 * Returns whether this feed connection is actively subscribed.
	 */
	public get isConnected(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.isSubscribed;
	}

	/**
	 * Starts the WebSocket feed connection.
	 */
	public start(): void {
		if (this.isRunning) {
			return;
		}
		this.isRunning = true;
		void this.connect();
	}

	/**
	 * Stops the WebSocket feed connection and cleans up timers.
	 */
	public stop(): void {
		this.isRunning = false;
		this.isSubscribed = false;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.keepAliveTimer) {
			clearTimeout(this.keepAliveTimer);
			this.keepAliveTimer = null;
		}
		if (this.ws) {
			try {
				if (this.ws.readyState === WebSocket.OPEN) {
					this.ws.send(JSON.stringify({ id: this.subscriptionId, type: 'stop' }));
				}
				this.ws.close();
			} catch {
				// Ignore close errors
			}
			this.ws = null;
		}
	}

	private async connect(): Promise<void> {
		if (!this.isRunning) {
			return;
		}

		try {
			const deviceId = this.getDeviceId();
			if (!deviceId) {
				this.log.debug(`[Push ${this.name}] Waiting for active device ID before connecting...`);
				this.scheduleReconnect(5000);
				return;
			}

			const idToken = await this.getIdToken();
			if (!idToken) {
				this.log.warn(`[Push ${this.name}] Cannot connect: no authentication token available.`);
				this.scheduleReconnect(10000);
				return;
			}

			const authHeader = {
				Authorization: `Bearer ${idToken}`,
				host: this.httpsHost,
			};
			const encodedHeader = Buffer.from(JSON.stringify(authHeader)).toString('base64');
			const fullUrl = `${this.wssUrl}?header=${encodeURIComponent(encodedHeader)}&payload=e30=`;

			this.log.info(`[Push ${this.name}] Opening WebSocket connection to AppSync...`);
			const ws = new WebSocket(fullUrl, ['graphql-ws']);
			this.ws = ws;

			ws.onopen = () => {
				if (this.ws !== ws) {
					return;
				}
				this.log.debug(`[Push ${this.name}] WebSocket opened, sending connection_init`);
				try {
					ws.send(JSON.stringify({ type: 'connection_init' }));
				} catch (err) {
					this.log.warn(`[Push ${this.name}] Failed to send connection_init: ${String(err)}`);
				}
			};

			ws.onmessage = (event: MessageEvent) => {
				if (this.ws !== ws) {
					return;
				}
				this.handleMessage(event.data, idToken);
			};

			ws.onerror = (err: Event) => {
				if (this.ws !== ws) {
					return;
				}
				const errMsg =
					err &&
					typeof err === 'object' &&
					'message' in err &&
					typeof (err as { message: unknown }).message === 'string'
						? (err as { message: string }).message
						: 'Unknown error';
				this.log.warn(`[Push ${this.name}] WebSocket error: ${errMsg}`);
			};

			ws.onclose = (event: { code: number; reason?: string }) => {
				if (this.ws !== ws) {
					return;
				}
				this.log.info(
					`[Push ${this.name}] WebSocket closed (Code: ${event.code}, Reason: ${event.reason || 'None'})`,
				);
				this.ws = null;
				this.isSubscribed = false;
				this.emit('connectionStatus', false);
				this.scheduleReconnect();
			};
		} catch (err) {
			this.log.error(`[Push ${this.name}] Connection error: ${err instanceof Error ? err.message : String(err)}`);
			this.scheduleReconnect();
		}
	}

	private handleMessage(rawData: unknown, idToken: string): void {
		try {
			const text = typeof rawData === 'string' ? rawData : String(rawData);
			const msg = JSON.parse(text);

			switch (msg.type) {
				case 'connection_ack': {
					if (msg.payload?.connectionTimeoutMs) {
						this.keepAliveTimeoutMs = msg.payload.connectionTimeoutMs;
					}
					this.resetKeepAliveWatchdog();
					this.log.info(`[Push ${this.name}] Connection acknowledged. Starting subscription for device...`);
					this.sendSubscriptionStart(idToken);
					break;
				}
				case 'start_ack': {
					this.isSubscribed = true;
					this.reconnectAttempts = 0;
					this.log.info(`[Push ${this.name}] Subscription active! Listening for real-time push updates.`);
					this.emit('connectionStatus', true);
					break;
				}
				case 'ka': {
					this.resetKeepAliveWatchdog();
					break;
				}
				case 'data': {
					this.resetKeepAliveWatchdog();
					if (msg.payload?.data) {
						this.emit('data', msg.payload.data);
					}
					break;
				}
				case 'error': {
					this.log.warn(`[Push ${this.name}] AppSync error: ${JSON.stringify(msg.payload || msg)}`);
					break;
				}
				case 'complete': {
					this.log.debug(`[Push ${this.name}] Subscription completed by server.`);
					break;
				}
				default:
					this.log.debug(`[Push ${this.name}] Unhandled message type: ${msg.type}`);
					break;
			}
		} catch (err) {
			this.log.debug(`[Push ${this.name}] Error parsing incoming message: ${String(err)}`);
		}
	}

	private sendSubscriptionStart(idToken: string): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			return;
		}

		const deviceId = this.getDeviceId();
		const payload = {
			id: this.subscriptionId,
			type: 'start',
			payload: {
				data: JSON.stringify({
					query: this.query,
					variables: { receiver: deviceId },
				}),
				extensions: {
					authorization: {
						Authorization: `Bearer ${idToken}`,
						host: this.httpsHost,
					},
				},
			},
		};

		try {
			this.ws.send(JSON.stringify(payload));
		} catch (err) {
			this.log.error(`[Push ${this.name}] Failed to send subscription start: ${String(err)}`);
		}
	}

	private resetKeepAliveWatchdog(): void {
		if (this.keepAliveTimer) {
			clearTimeout(this.keepAliveTimer);
		}
		// If no keep-alive or data received within timeout + 15s grace period, reconnect
		const timeout = Math.max(30000, this.keepAliveTimeoutMs + 15000);
		this.keepAliveTimer = setTimeout(() => {
			this.log.warn(
				`[Push ${this.name}] Keep-alive timeout (${timeout}ms elapsed without signal). Reconnecting...`,
			);
			if (this.ws) {
				try {
					this.ws.close();
				} catch {
					// Ignore
				}
				this.ws = null;
			}
			this.scheduleReconnect(1000);
		}, timeout);
	}

	private scheduleReconnect(explicitDelayMs?: number): void {
		if (!this.isRunning || this.reconnectTimer) {
			return;
		}

		let delay: number;
		if (explicitDelayMs !== undefined) {
			delay = explicitDelayMs;
		} else {
			this.reconnectAttempts += 1;
			delay = Math.min(60000, 2 ** this.reconnectAttempts * 1000 + Math.random() * 1000);
		}

		this.log.debug(
			`[Push ${this.name}] Reconnecting in ${(delay / 1000).toFixed(1)} seconds (Attempt ${this.reconnectAttempts})`,
		);
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			void this.connect();
		}, delay);
	}
}

/**
 * HarviaPushClient coordinates AppSync real-time subscriptions for device state and telemetry data.
 */
export class HarviaPushClient extends EventEmitter {
	private deviceFeed: AppSyncFeedConnection;
	private dataFeed: AppSyncFeedConnection;
	private currentDeviceId: string;
	private log: HarviaPushClientOptions['log'];

	/**
	 * Creates an instance of HarviaPushClient.
	 *
	 * @param options - Configuration options.
	 */
	public constructor(options: HarviaPushClientOptions) {
		super();
		this.currentDeviceId = options.deviceId;
		this.log = options.log;

		this.deviceFeed = new AppSyncFeedConnection(
			'DeviceState',
			options.deviceWssUrl,
			options.deviceHttpsUrl,
			DEVICE_STATE_SUBSCRIPTION,
			() => this.currentDeviceId,
			options.getIdToken,
			options.log,
		);

		this.dataFeed = new AppSyncFeedConnection(
			'Measurements',
			options.dataWssUrl,
			options.dataHttpsUrl,
			MEASUREMENTS_SUBSCRIPTION,
			() => this.currentDeviceId,
			options.getIdToken,
			options.log,
		);

		this.deviceFeed.on('data', (data: Record<string, unknown>) => this.handleDeviceStateData(data));
		this.dataFeed.on('data', (data: Record<string, unknown>) => this.handleMeasurementsData(data));

		this.deviceFeed.on('connectionStatus', () => this.evaluateConnectionStatus());
		this.dataFeed.on('connectionStatus', () => this.evaluateConnectionStatus());
	}

	/**
	 * Returns true if at least one push feed is connected and active.
	 */
	public get isConnected(): boolean {
		return this.deviceFeed.isConnected || this.dataFeed.isConnected;
	}

	/**
	 * Updates the active device ID and restarts feeds if necessary.
	 *
	 * @param deviceId - The new device ID.
	 */
	public setDeviceId(deviceId: string): void {
		if (this.currentDeviceId !== deviceId) {
			this.currentDeviceId = deviceId;
			if (this.isConnected) {
				this.log.info(`[PushClient] Active device ID changed to ${deviceId}. Restarting push feeds...`);
				this.stop();
				this.start();
			}
		}
	}

	/**
	 * Starts all AppSync real-time push subscriptions.
	 */
	public start(): void {
		this.deviceFeed.start();
		this.dataFeed.start();
	}

	/**
	 * Stops all AppSync real-time push subscriptions.
	 */
	public stop(): void {
		this.deviceFeed.stop();
		this.dataFeed.stop();
	}

	private evaluateConnectionStatus(): void {
		const connected = this.isConnected;
		this.emit('connectionStatus', connected);
	}

	private handleDeviceStateData(data: Record<string, unknown>): void {
		try {
			const feed = data.devicesStatesUpdateFeed as { item?: Record<string, unknown> } | undefined;
			const item = feed?.item;
			if (!item) {
				return;
			}

			const reported = this.parseJsonField(item.reported);
			const desired = this.parseJsonField(item.desired);
			const connectionState = item.connectionState as PushDeviceStateData['connectionState'];
			const resolvedDeviceId =
				typeof item.deviceId === 'string' && item.deviceId ? item.deviceId : this.currentDeviceId;

			const payload: PushDeviceStateData = {
				deviceId: resolvedDeviceId,
				reported,
				desired,
				connectionState,
				timestamp: item.timestamp as number | string | undefined,
			};

			this.emit('deviceState', payload);
		} catch (err) {
			this.log.warn(`[PushClient] Error processing device state push data: ${String(err)}`);
		}
	}

	private handleMeasurementsData(data: Record<string, unknown>): void {
		try {
			const feed = data.devicesMeasurementsUpdateFeed as { item?: Record<string, unknown> } | undefined;
			const item = feed?.item;
			if (!item) {
				return;
			}

			const measurementData = this.parseJsonField(item.data);
			if (!measurementData) {
				return;
			}

			const resolvedDeviceId =
				typeof item.deviceId === 'string' && item.deviceId ? item.deviceId : this.currentDeviceId;

			const payload: PushMeasurementData = {
				deviceId: resolvedDeviceId,
				data: measurementData,
				timestamp: item.timestamp as number | string | undefined,
				type: item.type as string | undefined,
			};

			this.emit('measurement', payload);
		} catch (err) {
			this.log.warn(`[PushClient] Error processing measurement push data: ${String(err)}`);
		}
	}

	private parseJsonField(val: unknown): Record<string, unknown> | undefined {
		if (!val) {
			return undefined;
		}
		if (typeof val === 'object' && !Array.isArray(val)) {
			return val as Record<string, unknown>;
		}
		if (typeof val === 'string') {
			try {
				const parsed = JSON.parse(val);
				if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
					return parsed as Record<string, unknown>;
				}
			} catch {
				// Not valid JSON string
			}
		}
		return undefined;
	}
}
