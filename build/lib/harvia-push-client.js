"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HarviaPushClient = void 0;
const node_events_1 = __importDefault(require("node:events"));
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
class AppSyncFeedConnection extends node_events_1.default {
    name;
    wssUrl;
    httpsHost;
    query;
    getDeviceId;
    getIdToken;
    log;
    ws = null;
    isRunning = false;
    isSubscribed = false;
    subscriptionId;
    reconnectAttempts = 0;
    reconnectTimer = null;
    keepAliveTimer = null;
    keepAliveTimeoutMs = 300000;
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
    constructor(name, wssUrl, httpsUrl, query, getDeviceId, getIdToken, log) {
        super();
        this.name = name;
        this.wssUrl = wssUrl;
        try {
            this.httpsHost = new URL(httpsUrl).host;
        }
        catch {
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
    get isConnected() {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.isSubscribed;
    }
    /**
     * Starts the WebSocket feed connection.
     */
    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        void this.connect();
    }
    /**
     * Stops the WebSocket feed connection and cleans up timers.
     */
    stop() {
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
            }
            catch {
                // Ignore close errors
            }
            this.ws = null;
        }
    }
    async connect() {
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
                }
                catch (err) {
                    this.log.warn(`[Push ${this.name}] Failed to send connection_init: ${String(err)}`);
                }
            };
            ws.onmessage = (event) => {
                if (this.ws !== ws) {
                    return;
                }
                this.handleMessage(event.data, idToken);
            };
            ws.onerror = (err) => {
                if (this.ws !== ws) {
                    return;
                }
                const errMsg = err &&
                    typeof err === 'object' &&
                    'message' in err &&
                    typeof err.message === 'string'
                    ? err.message
                    : 'Unknown error';
                this.log.warn(`[Push ${this.name}] WebSocket error: ${errMsg}`);
            };
            ws.onclose = (event) => {
                if (this.ws !== ws) {
                    return;
                }
                this.log.info(`[Push ${this.name}] WebSocket closed (Code: ${event.code}, Reason: ${event.reason || 'None'})`);
                this.ws = null;
                this.isSubscribed = false;
                this.emit('connectionStatus', false);
                this.scheduleReconnect();
            };
        }
        catch (err) {
            this.log.error(`[Push ${this.name}] Connection error: ${err instanceof Error ? err.message : String(err)}`);
            this.scheduleReconnect();
        }
    }
    handleMessage(rawData, idToken) {
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
        }
        catch (err) {
            this.log.debug(`[Push ${this.name}] Error parsing incoming message: ${String(err)}`);
        }
    }
    sendSubscriptionStart(idToken) {
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
        }
        catch (err) {
            this.log.error(`[Push ${this.name}] Failed to send subscription start: ${String(err)}`);
        }
    }
    resetKeepAliveWatchdog() {
        if (this.keepAliveTimer) {
            clearTimeout(this.keepAliveTimer);
        }
        // If no keep-alive or data received within timeout + 15s grace period, reconnect
        const timeout = Math.max(30000, this.keepAliveTimeoutMs + 15000);
        this.keepAliveTimer = setTimeout(() => {
            this.log.warn(`[Push ${this.name}] Keep-alive timeout (${timeout}ms elapsed without signal). Reconnecting...`);
            if (this.ws) {
                try {
                    this.ws.close();
                }
                catch {
                    // Ignore
                }
                this.ws = null;
            }
            this.scheduleReconnect(1000);
        }, timeout);
    }
    scheduleReconnect(explicitDelayMs) {
        if (!this.isRunning || this.reconnectTimer) {
            return;
        }
        let delay;
        if (explicitDelayMs !== undefined) {
            delay = explicitDelayMs;
        }
        else {
            this.reconnectAttempts += 1;
            delay = Math.min(60000, 2 ** this.reconnectAttempts * 1000 + Math.random() * 1000);
        }
        this.log.debug(`[Push ${this.name}] Reconnecting in ${(delay / 1000).toFixed(1)} seconds (Attempt ${this.reconnectAttempts})`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            void this.connect();
        }, delay);
    }
}
/**
 * HarviaPushClient coordinates AppSync real-time subscriptions for device state and telemetry data.
 */
class HarviaPushClient extends node_events_1.default {
    deviceFeed;
    dataFeed;
    currentDeviceId;
    log;
    /**
     * Creates an instance of HarviaPushClient.
     *
     * @param options - Configuration options.
     */
    constructor(options) {
        super();
        this.currentDeviceId = options.deviceId;
        this.log = options.log;
        this.deviceFeed = new AppSyncFeedConnection('DeviceState', options.deviceWssUrl, options.deviceHttpsUrl, DEVICE_STATE_SUBSCRIPTION, () => this.currentDeviceId, options.getIdToken, options.log);
        this.dataFeed = new AppSyncFeedConnection('Measurements', options.dataWssUrl, options.dataHttpsUrl, MEASUREMENTS_SUBSCRIPTION, () => this.currentDeviceId, options.getIdToken, options.log);
        this.deviceFeed.on('data', (data) => this.handleDeviceStateData(data));
        this.dataFeed.on('data', (data) => this.handleMeasurementsData(data));
        this.deviceFeed.on('connectionStatus', () => this.evaluateConnectionStatus());
        this.dataFeed.on('connectionStatus', () => this.evaluateConnectionStatus());
    }
    /**
     * Returns true if at least one push feed is connected and active.
     */
    get isConnected() {
        return this.deviceFeed.isConnected || this.dataFeed.isConnected;
    }
    /**
     * Updates the active device ID and restarts feeds if necessary.
     *
     * @param deviceId - The new device ID.
     */
    setDeviceId(deviceId) {
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
    start() {
        this.deviceFeed.start();
        this.dataFeed.start();
    }
    /**
     * Stops all AppSync real-time push subscriptions.
     */
    stop() {
        this.deviceFeed.stop();
        this.dataFeed.stop();
    }
    evaluateConnectionStatus() {
        const connected = this.isConnected;
        this.emit('connectionStatus', connected);
    }
    handleDeviceStateData(data) {
        try {
            const feed = data.devicesStatesUpdateFeed;
            const item = feed?.item;
            if (!item) {
                return;
            }
            const reported = this.parseJsonField(item.reported);
            const desired = this.parseJsonField(item.desired);
            const connectionState = item.connectionState;
            const resolvedDeviceId = typeof item.deviceId === 'string' && item.deviceId ? item.deviceId : this.currentDeviceId;
            const payload = {
                deviceId: resolvedDeviceId,
                reported,
                desired,
                connectionState,
                timestamp: item.timestamp,
            };
            this.emit('deviceState', payload);
        }
        catch (err) {
            this.log.warn(`[PushClient] Error processing device state push data: ${String(err)}`);
        }
    }
    handleMeasurementsData(data) {
        try {
            const feed = data.devicesMeasurementsUpdateFeed;
            const item = feed?.item;
            if (!item) {
                return;
            }
            const measurementData = this.parseJsonField(item.data);
            if (!measurementData) {
                return;
            }
            const resolvedDeviceId = typeof item.deviceId === 'string' && item.deviceId ? item.deviceId : this.currentDeviceId;
            const payload = {
                deviceId: resolvedDeviceId,
                data: measurementData,
                timestamp: item.timestamp,
                type: item.type,
            };
            this.emit('measurement', payload);
        }
        catch (err) {
            this.log.warn(`[PushClient] Error processing measurement push data: ${String(err)}`);
        }
    }
    parseJsonField(val) {
        if (!val) {
            return undefined;
        }
        if (typeof val === 'object' && !Array.isArray(val)) {
            return val;
        }
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
                    return parsed;
                }
            }
            catch {
                // Not valid JSON string
            }
        }
        return undefined;
    }
}
exports.HarviaPushClient = HarviaPushClient;
//# sourceMappingURL=harvia-push-client.js.map