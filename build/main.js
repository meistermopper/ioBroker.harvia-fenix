"use strict";
/*
 * Created with @iobroker/create-adapter v3.1.5
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HarviaFenix = void 0;
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = __importStar(require("@iobroker/adapter-core"));
const axios_1 = __importDefault(require("axios"));
const harvia_push_client_1 = require("./lib/harvia-push-client");
// Harvia API Constants
const CLIENT_ID = '24emhb2mm0v4sscqhbdev86b2v';
const MIN_TARGET_TEMP = 40; // Minimum allowed target temperature in C
const MAX_TARGET_TEMP = 110; // Maximum allowed target temperature in C
const MIN_MAX_DURATION = 10; // Minimum allowed maximum heating duration in minutes
const MAX_MAX_DURATION = 720; // Maximum allowed maximum heating duration in minutes (12 hours)
const LATENCY_MS = 5000;
const API_TRUE_VALUES = new Set([
    1,
    21,
    23,
    '1',
    '21',
    '23',
    true,
    'true',
    'on',
    'enabled',
    'safe',
    'ready',
    'active',
    'standby',
]);
/**
 * ioBroker adapter for Harvia Fenix Sauna Control.
 */
class HarviaFenix extends utils.Adapter {
    client;
    idToken = '';
    refreshToken = '';
    dataBaseUrl = '';
    deviceBaseUrl = '';
    usersBaseUrl = '';
    eventsBaseUrl = '';
    authUrl = '';
    authRefreshUrl = '';
    graphQlDeviceWss = '';
    graphQlDeviceHttps = '';
    graphQlDataWss = '';
    graphQlDataHttps = '';
    partnerId = 'ORG/prod:0:6656:0'; // Fallback
    activeDeviceId = '';
    loginPromise = null;
    pushClient = null;
    isPushConnected = false;
    lastProcessedEventTimestamp = 0;
    isSendingCommand = false;
    isUnloading = false;
    lastCommandTime = 0;
    firstPoll = true;
    updateInterval;
    loginInterval;
    lastEventTime = {}; // For debouncing
    lastConfirmedStates = {
        heatOn: false,
        lightOn: false,
        targetTemp: 80,
        maxDuration: 360,
    };
    lastLoginTime = 0;
    sessionStartTime = null;
    sessionStartTemp = null;
    tempHistory = [];
    /**
     * Creates an instance of the HarviaFenix adapter.
     *
     * @param options - The adapter options.
     */
    constructor(options = {}) {
        super({
            ...options,
            name: 'harvia-fenix',
        });
        this.on('ready', this.onReady);
        this.on('stateChange', this.onStateChange);
        this.on('unload', this.onUnload);
        this.client = axios_1.default.create({
            timeout: 20000,
        });
    }
    /**
     * Centralized headers for Harvia Cloud API.
     *
     * @param partnerId - The partner ID to use. Defaults to the adapter's configured partner ID.
     */
    getCloudHeaders(partnerId) {
        return {
            Authorization: `Bearer ${this.idToken}`,
            'x-harvia-partner-id': partnerId || this.partnerId,
            'x-harvia-app-id': CLIENT_ID,
        };
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady = async () => {
        // Reset status states
        await this.setState('info.connection', false, true);
        // Subscribe to writable states
        this.subscribeStates('heatOn');
        this.subscribeStates('lightOn');
        this.subscribeStates('targetTemp');
        this.subscribeStates('maxDuration');
        this.subscribeStates('activeProfile');
        // Configured limits with safe fallbacks
        const minTemp = typeof this.config.minTemp === 'number' ? this.config.minTemp : MIN_TARGET_TEMP;
        const maxTemp = typeof this.config.maxTemp === 'number' ? this.config.maxTemp : MAX_TARGET_TEMP;
        const defaultMaxDuration = typeof this.config.maxDuration === 'number' ? this.config.maxDuration : 360;
        // CLEAN START: Reset all status values to 'false' on startup
        await this.setState('online', false, true);
        await this.setState('heatOn', false, true);
        await this.setState('lightOn', false, true);
        await this.setState('doorSafety', false, true);
        await this.setState('remoteControl', false, true);
        await this.setState('errorMsg', '', true);
        await this.setState('readyNotified10Min', false, true);
        await this.setState('targetReachedNotified', false, true);
        await this.setState('estimatedHeatingTimeRemaining', 0, true);
        await this.setState('readyAt', '--:--', true);
        await this.setState('readyAtMessage', '', true);
        await this.setState('timeToTargetFormatted', '', true);
        await this.setState('heatingCurve', '[]', true);
        await this.setState('profiles', '[]', true);
        await this.setState('activeProfile', 0, true);
        await this.setState('info.heatingAnomaly', false, true);
        await this.setState('info.heatingAnomalyType', 'none', true);
        await this.setState('info.heatingAnomalyDesc', '', true);
        await this.setState('maxDuration', defaultMaxDuration, true);
        await this.setState('info.minTemp', minTemp, true);
        await this.setState('info.maxTemp', maxTemp, true);
        // Initialize event states on startup, retaining existing history if available
        await this.setState('events.lastEvent', '', true);
        await this.setState('events.lastEventType', '', true);
        await this.setState('events.lastEventSeverity', 'info', true);
        await this.setState('events.lastEventMessage', '', true);
        await this.setState('events.lastEventTime', '', true);
        await this.setState('events.safetyTripped', false, true);
        await this.setState('events.safetyReason', '', true);
        try {
            const existingHistoryState = await this.getStateAsync('events.history');
            if (!existingHistoryState?.ack ||
                typeof existingHistoryState.val !== 'string' ||
                !existingHistoryState.val.startsWith('[')) {
                await this.setState('events.history', '[]', true);
            }
        }
        catch {
            await this.setState('events.history', '[]', true);
        }
        // Clean up removed states from previous versions
        const oldRemoteReadyObj = await this.getObjectAsync('remoteReady');
        if (oldRemoteReadyObj) {
            await this.delObjectAsync('remoteReady');
        }
        // Initialize lastConfirmedStates from existing database values to prevent UI jumps on startup
        try {
            const heatOnState = await this.getStateAsync('heatOn');
            if (heatOnState?.ack) {
                this.lastConfirmedStates.heatOn = !!heatOnState.val;
            }
            const lightOnState = await this.getStateAsync('lightOn');
            if (lightOnState?.ack) {
                this.lastConfirmedStates.lightOn = !!lightOnState.val;
            }
            const targetTempState = await this.getStateAsync('targetTemp');
            if (targetTempState?.ack && typeof targetTempState.val === 'number') {
                this.lastConfirmedStates.targetTemp = targetTempState.val;
            }
        }
        catch (err) {
            this.log.error(`Error reading initial states: ${err instanceof Error ? err.message : String(err)}`);
        }
        // Start connection logic
        await this.startCloudConnection();
    };
    /**
     * Robust check for truthy values from Harvia API.
     *
     * @param val - The value to check.
     */
    static isTrue(val) {
        if (val === undefined || val === null) {
            return false;
        }
        let checkVal = val;
        if (typeof val === 'string') {
            checkVal = val.toLowerCase().trim();
        }
        return API_TRUE_VALUES.has(checkVal);
    }
    /**
     * Internal helper to calculate and format a numeric value from API data with scaling and rounding.
     *
     * @param val - The raw value to convert.
     * @param scale - The scaling factor to apply.
     * @param decimals - The number of decimal places to round to.
     */
    static calculateNumericValue(val, scale = 1, decimals = 1) {
        if (val === undefined || val === null || val === '') {
            return undefined;
        }
        const num = typeof val === 'number' ? val : Number(val);
        if (Number.isNaN(num)) {
            return undefined;
        }
        let result = num * scale;
        if (decimals >= 0) {
            const factor = 10 ** decimals;
            result = Math.round(result * factor) / factor;
        }
        return result;
    }
    /**
     * Helper to get value from multiple possible API keys.
     *
     * @param p - The raw data payload object.
     * @param keys - The keys to check in order of priority.
     */
    static getApiValue(p, keys) {
        if (!p || typeof p !== 'object' || Array.isArray(p)) {
            return undefined;
        }
        // 1. Search top level
        for (const key of keys) {
            const val = p[key];
            if (val !== undefined && val !== null) {
                return val;
            }
        }
        // 2. Search in status object (new Harvia API structure)
        const status = p.status;
        if (status && typeof status === 'object' && !Array.isArray(status)) {
            for (const key of keys) {
                const val = status[key];
                if (val != null) {
                    return val;
                }
            }
        }
        return undefined;
    }
    async fetchConfig() {
        try {
            const response = await this.client.get('https://api.harvia.io/endpoints');
            this.log.debug(`Endpoints Response: ${JSON.stringify(response.data)}`);
            const ep = response.data.RestApi || response.data.endpoints?.RestApi;
            if (!ep) {
                this.log.error('Could not find RestApi configuration in endpoints response');
                return false;
            }
            this.dataBaseUrl = ep.data.https;
            this.deviceBaseUrl = ep.device.https;
            this.usersBaseUrl = ep.users?.https || '';
            this.eventsBaseUrl = ep.events?.https || '';
            this.authUrl = `${ep.generics.https}/auth/token`;
            this.authRefreshUrl = `${ep.generics.https}/auth/refresh`;
            const gql = response.data.GraphQL || response.data.endpoints?.GraphQL;
            if (gql) {
                this.graphQlDeviceWss = gql.device?.wss || '';
                this.graphQlDeviceHttps = gql.device?.https || '';
                this.graphQlDataWss = gql.data?.wss || '';
                this.graphQlDataHttps = gql.data?.https || '';
            }
            const partnerId = response.data.Config?.PartnerOrganizationId || response.data.endpoints?.Config?.PartnerOrganizationId;
            if (this.config.partnerId) {
                this.partnerId = this.config.partnerId;
            }
            else if (partnerId) {
                this.partnerId = partnerId;
            }
            this.log.info(`API configuration loaded: Data=${this.dataBaseUrl}, Device=${this.deviceBaseUrl}, Events=${this.eventsBaseUrl}, Partner=${this.partnerId}`);
            return true;
        }
        catch (err) {
            this.log.error(`Error loading API configuration: ${err instanceof Error ? err.message : String(err)}`);
            return false;
        }
    }
    async login() {
        if (this.isUnloading) {
            return false;
        }
        if (this.loginPromise) {
            return this.loginPromise;
        }
        this.loginPromise = this.refreshToken ? this.refreshTokenAuth() : this.performLogin();
        try {
            return await this.loginPromise;
        }
        finally {
            this.loginPromise = null;
        }
    }
    async refreshTokenAuth() {
        if (!this.refreshToken || !this.authRefreshUrl) {
            return this.performLogin();
        }
        try {
            this.log.debug('Refreshing token using refresh token...');
            const response = await this.client.post(this.authRefreshUrl, {
                refreshToken: this.refreshToken,
                email: this.config.username,
            });
            if (response.data?.idToken) {
                this.idToken = response.data.idToken.trim();
                if (response.data.refreshToken) {
                    this.refreshToken = response.data.refreshToken.trim();
                }
                this.lastLoginTime = Date.now();
                this.log.info('Successfully refreshed Harvia API token via /auth/refresh');
                await this.setState('info.connection', true, true);
                return true;
            }
            this.log.warn('No idToken in refresh response, attempting full login...');
            return this.performLogin();
        }
        catch (err) {
            this.log.warn(`Token refresh failed, falling back to full login: ${err instanceof Error ? err.message : String(err)}`);
            return this.performLogin();
        }
    }
    async performLogin() {
        try {
            if (!this.authUrl && !(await this.fetchConfig())) {
                return false;
            }
            if (!this.config.username || !this.config.password) {
                this.log.error('Login failed: Username or password not configured!');
                return false;
            }
            this.log.debug(`Attempting login for user: ${this.config.username?.substring(0, 3)}...`);
            const response = await this.client.post(this.authUrl, {
                username: this.config.username,
                password: this.config.password,
                client_id: CLIENT_ID,
            });
            this.idToken = response.data.idToken.trim(); // JWT-Token trimmed
            if (response.data.refreshToken) {
                this.refreshToken = response.data.refreshToken.trim();
            }
            this.lastLoginTime = Date.now();
            // Decode JWT to extract partner ID or debug info
            try {
                const parts = this.idToken.split('.');
                if (parts.length > 1) {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                    this.log.debug(`Decoded token payload: ${JSON.stringify(payload)}`);
                    if (this.config.partnerId) {
                        this.partnerId = this.config.partnerId;
                        this.log.debug(`Using manually configured partner ID: ${this.partnerId}`);
                    }
                    else {
                        const jwtOrg = payload['custom:org'];
                        if (jwtOrg) {
                            this.partnerId = jwtOrg.startsWith('ORG/') ? jwtOrg : `ORG/${jwtOrg}`;
                            this.log.debug(`Using partner ID from user token: ${this.partnerId}`);
                        }
                    }
                }
            }
            catch {
                // Ignore
            }
            await this.setState('info.connection', true, true);
            return true;
        }
        catch (err) {
            this.log.error(`Login failed: ${err instanceof Error ? err.message : String(err)}`);
            await this.setState('info.connection', false, true);
            return false;
        }
    }
    startPushClient() {
        if (this.pushClient || this.isUnloading) {
            return;
        }
        const deviceId = this.activeDeviceId || this.config.deviceId;
        if (!deviceId) {
            this.log.debug('Push client waiting for active device ID...');
            return;
        }
        if (!this.graphQlDeviceWss || !this.graphQlDataWss) {
            this.log.warn('GraphQL WebSocket endpoints not available, running in polling-only mode.');
            return;
        }
        this.log.info(`Initializing Harvia Push Client for real-time WebSocket updates (Device: ${deviceId})...`);
        this.pushClient = new harvia_push_client_1.HarviaPushClient({
            deviceId,
            deviceWssUrl: this.graphQlDeviceWss,
            deviceHttpsUrl: this.graphQlDeviceHttps,
            dataWssUrl: this.graphQlDataWss,
            dataHttpsUrl: this.graphQlDataHttps,
            getIdToken: async () => {
                if (!this.idToken || Date.now() - this.lastLoginTime > 50 * 60 * 1000) {
                    await this.login();
                }
                return this.idToken;
            },
            log: {
                debug: (msg) => this.log.debug(msg),
                info: (msg) => this.log.info(msg),
                warn: (msg) => this.log.warn(msg),
                error: (msg) => this.log.error(msg),
            },
        });
        this.pushClient.on('connectionStatus', (connected) => {
            this.isPushConnected = connected;
            this.log.info(`Harvia Real-Time Push connection status: ${connected ? 'CONNECTED (Push active)' : 'DISCONNECTED (Falling back to poll)'}`);
        });
        this.pushClient.on('deviceState', (data) => {
            void this.handlePushDeviceState(data);
        });
        this.pushClient.on('measurement', (data) => {
            void this.handlePushMeasurement(data);
        });
        this.pushClient.start();
    }
    async startCloudConnection() {
        if (this.isUnloading) {
            return;
        }
        if (await this.login()) {
            if (this.isUnloading) {
                return;
            }
            await this.discoverDevices();
            if (this.isUnloading) {
                return;
            }
            this.startPushClient();
            void this.updateStatus(); // Start first poll
            this.loginInterval = this.setInterval(() => void this.login(), 50 * 60 * 1000);
        }
        else {
            if (this.isUnloading) {
                return;
            }
            this.log.warn('Initial login failed. Retrying in 5 minutes...');
            this.updateInterval = this.setTimeout(() => this.startCloudConnection(), 5 * 60 * 1000);
        }
    }
    async discoverDevices() {
        try {
            if (!this.idToken || !this.deviceBaseUrl) {
                return;
            }
            const endpointsToTry = [];
            const devBase = this.deviceBaseUrl.replace(/\/$/, '');
            endpointsToTry.push(devBase.endsWith('/devices') ? devBase : `${devBase}/devices`);
            if (this.usersBaseUrl) {
                const userBase = this.usersBaseUrl.replace(/\/$/, '');
                endpointsToTry.push(userBase.endsWith('/devices') ? userBase : `${userBase}/devices`);
            }
            const partnerIdsToTry = [this.partnerId];
            if (this.partnerId !== 'ORG/prod:0:6656:0') {
                partnerIdsToTry.push('ORG/prod:0:6656:0');
            }
            let devices = [];
            for (const partnerId of partnerIdsToTry) {
                for (const url of endpointsToTry) {
                    this.log.info(`Searching for devices at: ${url} (Partner: ${partnerId})`);
                    try {
                        const response = await this.client.get(url, {
                            headers: this.getCloudHeaders(partnerId),
                        });
                        this.log.debug(`Discovery Response: ${JSON.stringify(response.data)}`);
                        const rawData = response.data;
                        const discoveryData = rawData.data ?? rawData;
                        if (Array.isArray(discoveryData)) {
                            devices = discoveryData;
                        }
                        else if (discoveryData &&
                            typeof discoveryData === 'object' &&
                            !Array.isArray(discoveryData) && // Ensure it's not an array mistakenly cast to object
                            'devices' in discoveryData &&
                            Array.isArray(discoveryData.devices)) {
                            devices = discoveryData.devices;
                        }
                        if (devices.length > 0) {
                            this.partnerId = partnerId;
                            break;
                        }
                    }
                    catch {
                        this.log.debug(`Discovery at ${url} with partner ${partnerId} failed, trying next...`);
                    }
                }
                if (devices.length > 0) {
                    break;
                }
            }
            if (devices.length > 0) {
                this.log.info(`Harvia Cloud: ${devices.length} device(s) found.`);
                if (devices.length > 1 && !this.config.deviceId) {
                    this.log.warn(`Multiple devices (${devices.length}) found in your Harvia account, but no Device ID is specified in the adapter configuration! The adapter will default to the first discovered device. Please configure a specific Device ID for each instance to avoid control conflicts.`);
                }
                for (const d of devices) {
                    const actualId = d.deviceId || d.id || d.name;
                    this.log.info(`Found device: ${d.name} (ID: ${actualId}, Type: ${d.type ?? 'Fenix'})`);
                    // Use the configured ID if available, otherwise fall back to discovered ID
                    if (!this.activeDeviceId && !this.config.deviceId && actualId) {
                        this.log.warn(`Device ID not set in adapter configuration. Using found ID: ${actualId}`);
                        this.activeDeviceId = actualId;
                    }
                    else if (this.config.deviceId && this.config.deviceId !== actualId) {
                        this.log.info(`Configured Device ID (${this.config.deviceId}) does not match found ID (${actualId}). Please check settings.`);
                    }
                    // Read static attributes directly at startup
                    const attributes = {};
                    if (Array.isArray(d.attr)) {
                        for (const a of d.attr) {
                            if (a.key && a.value !== undefined) {
                                attributes[a.key] = a.value;
                            }
                        }
                        for (const [key, val] of Object.entries(attributes)) {
                            switch (key) {
                                case 'connected':
                                    await this.setState('online', HarviaFenix.isTrue(val), true);
                                    break;
                                case 'stats.totalSessions.C1':
                                    {
                                        const result = HarviaFenix.calculateNumericValue(val, 1, 0);
                                        if (result !== undefined) {
                                            await this.setState('totalSessions', result, true);
                                        }
                                    }
                                    break;
                                case 'stats.totalBathingHours.C1':
                                    {
                                        const result = HarviaFenix.calculateNumericValue(val, 1, 2);
                                        if (result !== undefined) {
                                            await this.setState('totalBathingHours', result, true);
                                        }
                                    }
                                    break;
                                case 'stats.totalOperatingHours.C1':
                                    {
                                        const result = HarviaFenix.calculateNumericValue(val, 1, 2);
                                        if (result !== undefined) {
                                            await this.setState('totalOperatingHours', result, true);
                                        }
                                    }
                                    break;
                                case 'BT_MAC':
                                    this.log.debug(`Bluetooth MAC: ${val}`);
                                    break;
                            }
                        }
                    }
                }
            }
            else {
                if (this.config.deviceId) {
                    this.log.info(`No devices found via discovery, using manually configured Device ID: ${this.config.deviceId}`);
                }
                else {
                    this.log.warn('Login successful, but no devices found in Harvia account.');
                }
            }
        }
        catch (err) {
            this.log.error(`Error during device discovery: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    async updateStatus() {
        if (this.isUnloading) {
            return;
        }
        try {
            if (!this.idToken || !this.dataBaseUrl) {
                return;
            }
            const url = `${this.dataBaseUrl.replace(/\/$/, '')}/data/latest-data`;
            const baseUrl = this.deviceBaseUrl.replace(/\/$/, '');
            const devicesUrl = baseUrl.endsWith('/devices') ? baseUrl : `${baseUrl}/devices`;
            const deviceId = this.activeDeviceId || this.config.deviceId;
            if (!deviceId) {
                return;
            }
            if (this.firstPoll) {
                this.log.info(`Starting status polling for device ID: ${deviceId}`);
                this.firstPoll = false;
            }
            this.log.debug(`Poll Status: ${url} (ID: ${deviceId})`);
            const [response, deviceStateResponse] = await Promise.all([
                this.client.get(url, {
                    params: { deviceId },
                    headers: {
                        ...this.getCloudHeaders(),
                        Accept: 'application/json',
                    },
                }),
                this.client.get(`${devicesUrl}/state`, {
                    params: { deviceId },
                    headers: {
                        ...this.getCloudHeaders(),
                        Accept: 'application/json',
                    },
                }),
            ]);
            if (this.isUnloading) {
                return;
            } // Prevent ghost execution if adapter stopped during request
            let p;
            if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
                this.log.debug(`Poll Response: ${JSON.stringify(response.data)}`);
                if (response.data.data &&
                    typeof response.data.data === 'object' &&
                    !Array.isArray(response.data.data)) {
                    p = response.data.data;
                }
                else {
                    p = response.data;
                }
            }
            let deviceState;
            if (deviceStateResponse.data &&
                typeof deviceStateResponse.data === 'object' &&
                !Array.isArray(deviceStateResponse.data)) {
                this.log.debug(`Device State Response: ${JSON.stringify(deviceStateResponse.data)}`);
                if (deviceStateResponse.data.data &&
                    typeof deviceStateResponse.data.data === 'object' &&
                    !Array.isArray(deviceStateResponse.data.data)) {
                    deviceState = deviceStateResponse.data.data;
                }
                else {
                    deviceState = deviceStateResponse.data;
                }
            }
            if (p && (p.online !== undefined || HarviaFenix.getApiValue(p, ['temperature', 'temp']) !== undefined)) {
                await this.processStatusPayload(p, deviceState);
            }
            else {
                this.log.warn(`Unexpected data structure during status poll: ${JSON.stringify(response.data)}`);
            }
            // Fetch recent events and check safety status
            await this.fetchEvents();
        }
        catch (err) {
            if (axios_1.default.isAxiosError(err)) {
                if (err.response?.status === 401 || err.response?.status === 403) {
                    this.log.info('Token expired or unauthorized, attempting re-login...');
                    void this.login();
                }
                else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
                    this.log.debug('Cloud connection timeout during status poll, will retry in next interval.');
                }
                else if (err.response?.status === 429) {
                    this.log.warn('Cloud rate limit reached. Slowing down...');
                }
                else {
                    this.log.error(`Status poll failed (${err.response?.status}): ${err.message}. Response Data: ${JSON.stringify(err.response?.data)}`);
                }
            }
            else {
                this.log.error(`Status poll failed: ${err instanceof Error ? err.message : String(err)}`);
            }
            // Avoid flapping: only set to offline if it's currently online
            const currentOnline = await this.getStateAsync('online');
            if (currentOnline?.val !== false) {
                await this.setState('online', false, true);
            }
        }
        finally {
            // Only schedule next poll if adapter is not unloading
            if (!this.isUnloading) {
                const rawInterval = this.config.pollInterval || 60;
                const standardInterval = Math.max(30, Math.min(600, rawInterval)) * 1000;
                // If push is active and connected, relax polling interval to 5 minutes as safety heartbeat
                const interval = this.isPushConnected ? 300 * 1000 : standardInterval;
                this.updateInterval = this.setTimeout(() => this.updateStatus(), interval);
            }
        }
    }
    async handlePushDeviceState(pushData) {
        if (this.isUnloading) {
            return;
        }
        this.log.debug(`[Push] Received device state update: ${JSON.stringify(pushData)}`);
        const statusPayload = {};
        const reported = pushData.reported || {};
        const desired = pushData.desired || {};
        const merged = { ...desired, ...reported };
        // Flatten nested heater or light if needed
        if (merged.heater && typeof merged.heater === 'object' && !Array.isArray(merged.heater)) {
            const h = merged.heater;
            if (h.on !== undefined && h.on !== null) {
                statusPayload.heatOn = h.on;
            }
        }
        if (merged.light && typeof merged.light === 'object' && !Array.isArray(merged.light)) {
            const l = merged.light;
            if (l.on !== undefined && l.on !== null) {
                statusPayload.lightOn = l.on;
            }
        }
        Object.assign(statusPayload, merged);
        if (pushData.connectionState?.connected !== undefined) {
            statusPayload.online = pushData.connectionState.connected;
        }
        const deviceState = {
            state: {
                ...merged,
                remoteAllowed: merged.remoteAllowed,
            },
            connectionState: pushData.connectionState,
        };
        await this.processStatusPayload(statusPayload, deviceState);
    }
    async handlePushMeasurement(pushData) {
        if (this.isUnloading) {
            return;
        }
        this.log.debug(`[Push] Received measurement update: ${JSON.stringify(pushData)}`);
        const statusPayload = { ...pushData.data };
        await this.processStatusPayload(statusPayload);
    }
    async processStatusPayload(p, deviceState) {
        if (Date.now() - this.lastCommandTime < LATENCY_MS) {
            this.log.debug(`Status update ignored due to latency protection (${LATENCY_MS}ms). Last command ${Date.now() - this.lastCommandTime}ms ago.`);
            return;
        }
        // Merge deviceState settings (e.g. maxOnTime: 300, maxTemp: 110) into status payload
        const statusPayload = { ...p };
        if (deviceState?.state?.settings) {
            const settings = deviceState.state.settings;
            if (settings.maxOnTime !== undefined) {
                statusPayload.maxOnTime = settings.maxOnTime;
            }
            if (settings.maxTemp !== undefined) {
                statusPayload.maxTemp = settings.maxTemp;
            }
        }
        // Update Numeric States
        await this.updateNumericState('temp', ['temperature', 'temp', 'current_temperature', 'ambient_temperature'], statusPayload, 1, 1);
        await this.updateNumericState('panelTemp', ['panelTemp', 'panelTemperature', 'panel_temperature'], statusPayload, 1, 1);
        await this.updateNumericState('heaterPower', ['heaterPower', 'power', 'heater_power'], statusPayload, 0.001, 2);
        await this.updateNumericState('totalBathingHours', ['totalBathingHours', 'total_bathing_hours', 'bathing_hours'], statusPayload, 1, 2);
        await this.updateNumericState('totalSessions', ['totalSessions', 'total_sessions', 'sessions'], statusPayload, 1, 0);
        await this.updateNumericState('totalOperatingHours', ['totalOperatingHours', 'totalHours', 'total_hours', 'operating_hours'], statusPayload, 1, 2);
        await this.updateNumericState('targetTemp', ['targetTemperature', 'targetTemp', 'target_temperature', 'setpoint_temperature'], statusPayload);
        await this.updateNumericState('maxDuration', [
            'maxDuration',
            'targetDuration',
            'maxOnTime',
            'max_duration',
            'duration',
            'maxBathingTime',
            'max_bathing_time',
            'setpoint_duration',
        ], statusPayload, 1, 0);
        await this.updateNumericState('info.minTemp', ['minTemperature', 'minTemp', 'min_temperature'], statusPayload, 1, 0);
        await this.updateNumericState('info.maxTemp', ['maxTemperature', 'maxTemp', 'max_temperature'], statusPayload, 1, 0);
        // --- HEATING CURVE, PROFILES & TARGET PREDICTIONS ---
        const stateReported = deviceState?.state && typeof deviceState.state === 'object' && 'reported' in deviceState.state
            ? deviceState.state.reported
            : undefined;
        const cabinReported = deviceState?.cabinState &&
            typeof deviceState.cabinState === 'object' &&
            'reported' in deviceState.cabinState
            ? deviceState.cabinState.reported
            : undefined;
        const rawHeatingCurve = statusPayload.heatingCurve ||
            deviceState?.state?.heatingCurve ||
            stateReported?.heatingCurve ||
            deviceState?.cabinState?.heatingCurve ||
            cabinReported?.heatingCurve;
        let validHeatingCurve = null;
        if (Array.isArray(rawHeatingCurve) && rawHeatingCurve.length === HarviaFenix.HARVIA_INTERVALS.length) {
            validHeatingCurve = rawHeatingCurve.map(v => Number(v) || 0);
            await this.setState('heatingCurve', JSON.stringify(validHeatingCurve), true);
        }
        const rawProfiles = statusPayload.profiles ??
            deviceState?.state?.profiles ??
            stateReported?.profiles ??
            deviceState?.cabinState?.profiles ??
            cabinReported?.profiles;
        if (rawProfiles !== undefined) {
            await this.setState('profiles', typeof rawProfiles === 'string' ? rawProfiles : JSON.stringify(rawProfiles), true);
        }
        const rawActiveProfile = statusPayload.activeProfile ??
            deviceState?.state?.activeProfile ??
            stateReported?.activeProfile ??
            deviceState?.cabinState?.activeProfile ??
            cabinReported?.activeProfile;
        if (rawActiveProfile !== undefined) {
            const activeProfileNum = typeof rawActiveProfile === 'number'
                ? rawActiveProfile
                : typeof rawActiveProfile === 'string'
                    ? Number.parseInt(rawActiveProfile, 10)
                    : Number.NaN;
            if (!Number.isNaN(activeProfileNum)) {
                await this.setState('activeProfile', activeProfileNum, true);
                this.lastConfirmedStates.activeProfile = activeProfileNum;
            }
        }
        const rawTimeToTarget = statusPayload.timeToTarget ??
            deviceState?.state?.timeToTarget ??
            stateReported?.timeToTarget ??
            deviceState?.cabinState?.timeToTarget ??
            cabinReported?.timeToTarget;
        const reportedTimeToTarget = rawTimeToTarget !== undefined
            ? typeof rawTimeToTarget === 'number'
                ? rawTimeToTarget
                : typeof rawTimeToTarget === 'string'
                    ? Number(rawTimeToTarget)
                    : undefined
            : undefined;
        // --- CUSTOM BOOLEAN & LOGIC STATES ---
        const rawDoor = HarviaFenix.getApiValue(p, [
            'doorSafetyState',
            'doorSafety',
            'door',
            'door_closed',
            'door_safety_state',
            'door_safety',
        ]);
        let isDoorSafe = true;
        if (rawDoor !== undefined) {
            isDoorSafe = HarviaFenix.isTrue(rawDoor);
            await this.setState('doorSafety', isDoorSafe, true);
        }
        else {
            const dsState = await this.getStateAsync('doorSafety');
            if (dsState) {
                isDoorSafe = !!dsState.val;
            }
        }
        const rawHeat = HarviaFenix.getApiValue(p, ['heatOn', 'heatState', 'heat', 'heater', 'heat_on', 'is_heating']);
        if (rawHeat !== undefined) {
            const isHeatOn = HarviaFenix.isTrue(rawHeat);
            const prevHeatOnState = await this.getStateAsync('heatOn');
            if (prevHeatOnState && !!prevHeatOnState.val !== isHeatOn) {
                await this.setState('readyNotified10Min', false, true);
                await this.setState('targetReachedNotified', false, true);
                await this.setState('estimatedHeatingTimeRemaining', 0, true);
                await this.setState('info.heatingAnomaly', false, true);
                await this.setState('info.heatingAnomalyType', 'none', true);
                await this.setState('info.heatingAnomalyDesc', '', true);
                if (!isHeatOn) {
                    this.sessionStartTime = null;
                    this.sessionStartTemp = null;
                    this.tempHistory = [];
                }
            }
            await this.setState('heatOn', isHeatOn, true);
            this.lastConfirmedStates.heatOn = isHeatOn;
        }
        await this.updateBooleanState('lightOn', ['lightOn', 'lightState', 'light', 'light_on'], p);
        // --- REMOTECONTROL & ONLINE LOGIC ---
        let isRemoteReady = false;
        if (deviceState && deviceState.state && deviceState.state.remoteAllowed !== undefined) {
            isRemoteReady =
                deviceState.state.remoteAllowed === 1 ||
                    deviceState.state.remoteAllowed === true ||
                    deviceState.state.remoteAllowed === '1' ||
                    deviceState.state.remoteAllowed === 'true';
        }
        // Fallback safety link: open door blocks remote start
        if (!isDoorSafe) {
            isRemoteReady = false;
        }
        await this.setState('remoteControl', isRemoteReady, true);
        // Online status: from deviceState connectionState or statusPayload online flag
        if (deviceState?.connectionState?.connected !== undefined) {
            await this.setState('online', !!deviceState.connectionState.connected, true);
        }
        else if (statusPayload.online !== undefined) {
            await this.setState('online', HarviaFenix.isTrue(statusPayload.online), true);
        }
        // --- NOTIFICATION LOGIC ---
        const heatOnState = await this.getStateAsync('heatOn');
        const heatOn = heatOnState ? !!heatOnState.val : false;
        const currentTempState = await this.getStateAsync('temp');
        const currentTemp = currentTempState && typeof currentTempState.val === 'number' ? currentTempState.val : 0;
        const targetTempState = await this.getStateAsync('targetTemp');
        const targetTemp = targetTempState && typeof targetTempState.val === 'number' ? targetTempState.val : 90;
        if (heatOn && currentTemp > 20) {
            const notified10MinState = await this.getStateAsync('readyNotified10Min');
            const notified10Min = notified10MinState ? !!notified10MinState.val : false;
            const notifiedReadyState = await this.getStateAsync('targetReachedNotified');
            const notifiedReady = notifiedReadyState ? !!notifiedReadyState.val : false;
            if (!notified10Min && currentTemp >= targetTemp - 13 && currentTemp < targetTemp) {
                await this.setState('readyNotified10Min', true, true);
                this.log.info(`🧖 The sauna will reach its target temperature (${targetTemp}°C) in approximately 10 minutes.`);
            }
            if (!notifiedReady && currentTemp >= targetTemp) {
                if (!notified10Min) {
                    await this.setState('readyNotified10Min', true, true);
                }
                await this.setState('targetReachedNotified', true, true);
                this.log.info(`♨️ The sauna has reached its target temperature of ${targetTemp}°C and is ready!`);
            }
        }
        await this.calculateHeatingPrognosis(heatOn, currentTemp, targetTemp, reportedTimeToTarget, validHeatingCurve);
    }
    /**
     * Internal helper to update a numeric state from API data with scaling and rounding.
     *
     * @param stateId - The ioBroker state ID to update.
     * @param keys - The potential keys to find in the API data.
     * @param data - The API data payload.
     * @param scale - The scaling factor.
     * @param decimals - The decimal places to round to.
     */
    async updateNumericState(stateId, keys, data, scale = 1, decimals = 1) {
        const raw = HarviaFenix.getApiValue(data, keys);
        const result = HarviaFenix.calculateNumericValue(raw, scale, decimals);
        if (result !== undefined) {
            await this.setState(stateId, result, true);
            if (stateId === 'targetTemp') {
                this.lastConfirmedStates.targetTemp = result;
            }
            else if (stateId === 'maxDuration') {
                this.lastConfirmedStates.maxDuration = result;
            }
        }
    }
    /**
     * Internal helper to update a boolean state from API data.
     *
     * @param stateId - The ioBroker state ID to update.
     * @param keys - The potential keys to find in the API data.
     * @param data - The API data payload.
     */
    async updateBooleanState(stateId, keys, data) {
        const raw = HarviaFenix.getApiValue(data, keys);
        if (raw !== undefined) {
            const val = HarviaFenix.isTrue(raw);
            await this.setState(stateId, val, true);
            if (stateId === 'lightOn') {
                this.lastConfirmedStates.lightOn = val;
            }
        }
    }
    /**
     * Fetches events and safety records for the active device.
     */
    async fetchEvents() {
        if (this.isUnloading || !this.idToken || !this.eventsBaseUrl) {
            return;
        }
        const deviceId = this.activeDeviceId || this.config.deviceId;
        if (!deviceId) {
            return;
        }
        try {
            const baseUrl = this.eventsBaseUrl.replace(/\/$/, '');
            const url = baseUrl.endsWith('/events/events')
                ? baseUrl
                : baseUrl.endsWith('/events')
                    ? `${baseUrl}/events`
                    : `${baseUrl}/events/events`;
            this.log.debug(`Fetching device events from: ${url} (ID: ${deviceId})`);
            const now = Date.now();
            const startTimestamp = now - 24 * 60 * 60 * 1000;
            const endTimestamp = now;
            const response = await this.client.get(url, {
                params: {
                    deviceId,
                    startTimestamp,
                    endTimestamp,
                },
                headers: {
                    ...this.getCloudHeaders(),
                    Accept: 'application/json',
                },
                timeout: 10000,
            });
            if (this.isUnloading || !response.data) {
                return;
            }
            await this.processEventsResponse(response.data);
        }
        catch (err) {
            let detail = '';
            if (axios_1.default.isAxiosError(err) && err.response?.data) {
                detail = ` Body: ${JSON.stringify(err.response.data)}`;
            }
            const errMsg = err instanceof Error ? err.message : String(err);
            this.log.debug(`Events request note: ${errMsg}${detail}`);
        }
    }
    /**
     * Processes the raw API events response and updates the ioBroker events states.
     *
     * @param data - Raw response from the events endpoint.
     */
    async processEventsResponse(data) {
        const rawEvents = HarviaFenix.parseEvents(data);
        if (!rawEvents || rawEvents.length === 0) {
            return;
        }
        // Sort events descending (newest first)
        const sorted = [...rawEvents].sort((a, b) => {
            const timeA = HarviaFenix.getEventTimestamp(a);
            const timeB = HarviaFenix.getEventTimestamp(b);
            return timeB - timeA;
        });
        const latest = sorted[0];
        const latestTimestamp = HarviaFenix.getEventTimestamp(latest);
        const eventCode = String(latest.code ?? latest.event ?? latest.name ?? latest.id ?? latest.eventId ?? 'EVENT');
        const rawType = latest.type || latest.eventType || latest.category || 'SYSTEM';
        const eventType = typeof rawType === 'string' ? rawType.toUpperCase() : 'SYSTEM';
        const severity = HarviaFenix.determineEventSeverity(latest);
        const rawMsg = latest.message || latest.desc || latest.description || latest.text || eventCode;
        const message = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg);
        const timeIso = latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : new Date().toISOString();
        const isNewEvent = latestTimestamp > this.lastProcessedEventTimestamp;
        if (isNewEvent || this.lastProcessedEventTimestamp === 0) {
            this.lastProcessedEventTimestamp = latestTimestamp;
            await this.setState('events.lastEvent', eventCode, true);
            await this.setState('events.lastEventType', eventType, true);
            await this.setState('events.lastEventSeverity', severity, true);
            await this.setState('events.lastEventMessage', message, true);
            await this.setState('events.lastEventTime', timeIso, true);
            if (isNewEvent && this.lastProcessedEventTimestamp !== 0) {
                this.log.info(`[Harvia Event] [${severity.toUpperCase()}] ${eventType}: ${message} (${eventCode})`);
            }
        }
        // Evaluate safety circuit status
        const safetyEvaluation = HarviaFenix.evaluateSafetyStatus(sorted);
        await this.setState('events.safetyTripped', safetyEvaluation.tripped, true);
        await this.setState('events.safetyReason', safetyEvaluation.reason, true);
        if (safetyEvaluation.tripped && isNewEvent) {
            this.log.warn(`🚨 [SAFETY TRIP] ${safetyEvaluation.reason}`);
        }
        // Update sliding window history (up to 15 events)
        const formattedHistory = sorted.slice(0, 15).map(e => ({
            id: String(e.id || e.eventId || e.code || 'event'),
            type: String(e.type || e.eventType || 'SYSTEM'),
            code: String(e.code || e.event || ''),
            severity: HarviaFenix.determineEventSeverity(e),
            message: String(e.message || e.desc || e.description || ''),
            time: HarviaFenix.getEventTimestamp(e) > 0 ? new Date(HarviaFenix.getEventTimestamp(e)).toISOString() : '',
        }));
        await this.setState('events.history', JSON.stringify(formattedHistory), true);
    }
    /**
     * Parses a generic events response payload into a normalized array of HarviaEventItem.
     *
     * @param data - Raw response object or array.
     */
    static parseEvents(data) {
        if (!data) {
            return [];
        }
        if (Array.isArray(data)) {
            return data;
        }
        if (typeof data === 'object') {
            const obj = data;
            if (Array.isArray(obj.events)) {
                return obj.events;
            }
            if (Array.isArray(obj.items)) {
                return obj.items;
            }
            if (Array.isArray(obj.data)) {
                return obj.data;
            }
            if (obj.data && typeof obj.data === 'object') {
                const nested = obj.data;
                if (Array.isArray(nested.events)) {
                    return nested.events;
                }
                if (Array.isArray(nested.items)) {
                    return nested.items;
                }
            }
            if (obj.id || obj.eventId || obj.type || obj.event || obj.code) {
                return [obj];
            }
        }
        return [];
    }
    /**
     * Extracts an epoch millisecond timestamp from an event item.
     *
     * @param e - The Harvia event item.
     */
    static getEventTimestamp(e) {
        const raw = e.timestamp ?? e.createdAt ?? e.time ?? e.created;
        if (typeof raw === 'number') {
            return raw > 1e12 ? raw : raw * 1000;
        }
        if (typeof raw === 'string') {
            const parsed = Date.parse(raw);
            if (!Number.isNaN(parsed)) {
                return parsed;
            }
            const num = Number(raw);
            if (!Number.isNaN(num)) {
                return num > 1e12 ? num : num * 1000;
            }
        }
        return 0;
    }
    /**
     * Infers or standardizes the severity level for a given event.
     *
     * @param e - The Harvia event item.
     */
    static determineEventSeverity(e) {
        const raw = String(e.severity || e.level || '').toLowerCase();
        if (['critical', 'fatal', 'alarm'].includes(raw)) {
            return 'critical';
        }
        if (['error', 'err', 'fault'].includes(raw)) {
            return 'error';
        }
        if (['warn', 'warning'].includes(raw)) {
            return 'warn';
        }
        if (['info', 'notice'].includes(raw)) {
            return 'info';
        }
        // Infer severity from type, code, or message text
        const str = `${e.type || ''} ${e.code || ''} ${e.message || ''}`.toUpperCase();
        if (str.includes('OVERHEAT') || str.includes('FIRE') || str.includes('EMERGENCY')) {
            return 'critical';
        }
        if (str.includes('FAULT') || str.includes('ERROR') || str.includes('TRIP')) {
            return 'error';
        }
        if (str.includes('DOOR') || str.includes('WARN') || str.includes('TIMEOUT')) {
            return 'warn';
        }
        return 'info';
    }
    /**
     * Evaluates whether any recent event indicates an active safety shutoff or interlock trip.
     *
     * @param events - List of event items sorted by timestamp descending.
     */
    static evaluateSafetyStatus(events) {
        if (!events || events.length === 0) {
            return { tripped: false, reason: '' };
        }
        const now = Date.now();
        for (const e of events) {
            const ts = HarviaFenix.getEventTimestamp(e);
            // Ignore events older than 2 hours for active safety latching
            if (ts > 0 && now - ts > 2 * 60 * 60 * 1000) {
                continue;
            }
            const typeStr = String(e.type || e.eventType || '').toUpperCase();
            const codeStr = String(e.code || e.event || '').toUpperCase();
            const msgStr = String(e.message || e.desc || '').toLowerCase();
            const severity = HarviaFenix.determineEventSeverity(e);
            if (severity === 'critical' ||
                typeStr.includes('SAFETY') ||
                typeStr.includes('INTERLOCK') ||
                codeStr.includes('OVERHEAT') ||
                codeStr.includes('SAFETY_TRIP') ||
                codeStr.includes('THERMAL') ||
                msgStr.includes('overheat') ||
                msgStr.includes('safety switch') ||
                msgStr.includes('interlock open')) {
                return {
                    tripped: true,
                    reason: String(e.message || e.desc || e.code || 'Safety interlock triggered'),
                };
            }
        }
        return { tripped: false, reason: '' };
    }
    /**
     * Checks if the error or response indicates that the Harvia device is unavailable.
     *
     * @param err - The thrown error, if any.
     * @param respData - The response payload, if any.
     */
    isDeviceUnavailableError(err, respData) {
        if (respData && typeof respData === 'object') {
            const dataObj = respData;
            const reason = dataObj.failureReason || '';
            if (typeof reason === 'string' && reason.includes('Device unavailable')) {
                return true;
            }
            const dataStr = JSON.stringify(respData);
            if (dataStr.includes('Device unavailable')) {
                return true;
            }
        }
        if (err) {
            let detail = '';
            if (axios_1.default.isAxiosError(err) && err.response?.data) {
                detail = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
            }
            else if (err instanceof Error) {
                detail = err.message;
            }
            else {
                detail = typeof err === 'string' ? err : JSON.stringify(err);
            }
            if (detail.includes('Device unavailable')) {
                return true;
            }
        }
        return false;
    }
    async setSaunaState(stateName, value) {
        if (this.isUnloading) {
            return;
        }
        if (!this.idToken || !this.deviceBaseUrl) {
            return;
        }
        // Lock-Check: Only block if already sending a command
        if (this.isSendingCommand) {
            return;
        }
        // Proactive token refresh if token is older than 45 minutes
        if (Date.now() - this.lastLoginTime > 45 * 60 * 1000) {
            this.log.info('Token is older than 45 minutes, refreshing token proactively...');
            const success = await this.login();
            if (!success) {
                this.log.warn('Proactive token refresh failed. Proceeding with current token.');
            }
        }
        // RACE-CONDITION PROTECTION
        const baseUrl = this.deviceBaseUrl.replace(/\/$/, '');
        const devicesUrl = baseUrl.endsWith('/devices') ? baseUrl : `${baseUrl}/devices`;
        this.isSendingCommand = true;
        let success = false;
        let lastError = null;
        let lastFailureReason = '';
        const maxAttempts = 3;
        const delayMs = 1500;
        try {
            const deviceId = this.activeDeviceId || this.config.deviceId;
            if (!deviceId) {
                this.log.error(`Cannot send command ${stateName}: No Device ID available. Please check the adapter configuration.`);
                return;
            }
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                if (this.isUnloading) {
                    return;
                }
                this.log.debug(`Sending command ${stateName} -> ${value} (Attempt ${attempt}/${maxAttempts})`);
                try {
                    if (stateName === 'heatOn' || stateName === 'lightOn') {
                        const commandType = stateName === 'heatOn' ? 'SAUNA' : 'LIGHTS';
                        const stateStr = value ? 'on' : 'off';
                        const payload = {
                            deviceId,
                            cabin: { id: 'C1' },
                            command: { type: commandType, state: stateStr },
                        };
                        const url = `${devicesUrl}/command`;
                        const resp = await this.client.post(url, payload, {
                            headers: {
                                ...this.getCloudHeaders(),
                                'Content-Type': 'application/json',
                            },
                        });
                        if (resp.data?.handled) {
                            this.log.info(`${commandType} -> ${stateStr}`);
                            // CONFIRMATION: Set ack: true immediately to prevent UI "jumping"
                            const targetVal = stateName === 'heatOn' ? !!value : HarviaFenix.isTrue(value);
                            await this.setState(stateName, targetVal, true);
                            this.lastConfirmedStates[stateName] = targetVal;
                            this.lastCommandTime = Date.now();
                            if (stateName === 'heatOn') {
                                await this.setState('errorMsg', '', true);
                            }
                            success = true;
                            break;
                        }
                        else {
                            const reason = resp.data.failureReason || 'Unknown';
                            lastFailureReason = reason;
                            if (reason.includes('Device unavailable')) {
                                this.log.warn(`Cloud rejected command (Device unavailable) on attempt ${attempt}/${maxAttempts}.`);
                                if (attempt < maxAttempts) {
                                    this.log.info(`Waiting ${delayMs}ms before retrying...`);
                                    await new Promise(resolve => {
                                        this.setTimeout(() => resolve(), delayMs);
                                    });
                                    continue;
                                }
                            }
                            // Other error (not Device unavailable) -> fail immediately without retry
                            break;
                        }
                    }
                    else if (stateName === 'targetTemp') {
                        const tempVal = typeof value === 'number' ? value : Number.parseFloat(String(value));
                        const payload = {
                            deviceId,
                            cabin: { id: 'C1' },
                            temperature: tempVal,
                        };
                        const url = `${devicesUrl}/target`;
                        await this.client.patch(url, payload, {
                            headers: {
                                ...this.getCloudHeaders(),
                                'Content-Type': 'application/json',
                            },
                        });
                        this.log.info(`Target temperature -> ${tempVal}°C`);
                        // Immediate confirmation in ioBroker
                        await this.setState('targetTemp', tempVal, true);
                        this.lastConfirmedStates.targetTemp = tempVal;
                        this.lastCommandTime = Date.now();
                        success = true;
                        break;
                    }
                    else if (stateName === 'maxDuration') {
                        const durationVal = typeof value === 'number' ? value : Number.parseFloat(String(value));
                        const payload = {
                            deviceId,
                            cabin: { id: 'C1' },
                            maxDuration: durationVal,
                            targetDuration: durationVal,
                        };
                        const url = `${devicesUrl}/target`;
                        await this.client.patch(url, payload, {
                            headers: {
                                ...this.getCloudHeaders(),
                                'Content-Type': 'application/json',
                            },
                        });
                        this.log.info(`Maximum heating duration -> ${durationVal} min`);
                        // Immediate confirmation in ioBroker
                        await this.setState('maxDuration', durationVal, true);
                        this.lastConfirmedStates.maxDuration = durationVal;
                        this.lastCommandTime = Date.now();
                        success = true;
                        break;
                    }
                    else if (stateName === 'activeProfile') {
                        const profileIdx = typeof value === 'number'
                            ? value
                            : typeof value === 'string'
                                ? Number.parseInt(value, 10)
                                : Number.NaN;
                        const payload = {
                            deviceId,
                            cabin: { id: 'C1' },
                            activeProfile: profileIdx,
                        };
                        const url = `${devicesUrl}/profile`;
                        await this.client.patch(url, payload, {
                            headers: {
                                ...this.getCloudHeaders(),
                                'Content-Type': 'application/json',
                            },
                        });
                        this.log.info(`Active profile -> ${profileIdx}`);
                        await this.setState('activeProfile', profileIdx, true);
                        this.lastConfirmedStates.activeProfile = profileIdx;
                        this.lastCommandTime = Date.now();
                        success = true;
                        break;
                    }
                }
                catch (err) {
                    lastError = err;
                    // Check if token expired (HTTP 401 / 403)
                    let isAuthError = false;
                    if (axios_1.default.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
                        isAuthError = true;
                    }
                    if (isAuthError) {
                        this.log.warn(`Token expired or unauthorized during control (Attempt ${attempt}/${maxAttempts}), triggering re-login...`);
                        const loginSuccess = await this.login();
                        if (loginSuccess) {
                            this.log.info('Re-login successful. Retrying current attempt with new token...');
                            attempt--; // Reset attempt counter for this iteration
                            continue;
                        }
                    }
                    if (axios_1.default.isAxiosError(err) && err.response?.status === 403) {
                        this.log.error('Action blocked (403 Forbidden). Remote start authorization (Safety Loop) at panel might not be active.');
                    }
                    // Check if error is "Device unavailable"
                    if (this.isDeviceUnavailableError(err)) {
                        this.log.warn(`Cloud error (Device unavailable) on attempt ${attempt}/${maxAttempts}.`);
                        if (attempt < maxAttempts) {
                            this.log.info(`Waiting ${delayMs}ms before retrying...`);
                            await new Promise(resolve => {
                                this.setTimeout(() => resolve(), delayMs);
                            });
                            continue;
                        }
                    }
                    // If non-retryable or max attempts reached, fail immediately
                    break;
                }
            }
            if (!success) {
                this.log.warn(`Command ${stateName} failed permanently after ${maxAttempts} attempts.`);
                // Revert state to last known good value to prevent bouncing
                const oldVal = this.lastConfirmedStates[stateName];
                if (oldVal !== undefined) {
                    this.log.info(`Reverting state ${stateName} to last confirmed value: ${oldVal}`);
                    await this.setState(stateName, oldVal, true);
                }
                else {
                    this.log.warn(`No confirmed value found for ${stateName}. Reverting to default.`);
                    if (stateName === 'targetTemp') {
                        await this.setState(stateName, 80, true);
                    }
                    else if (stateName === 'maxDuration') {
                        await this.setState(stateName, 360, true);
                    }
                    else {
                        await this.setState(stateName, false, true);
                    }
                }
                // Set error message state
                let msg = 'Unknown error';
                if (lastFailureReason) {
                    msg = `Cloud error: ${lastFailureReason}`;
                }
                else if (lastError) {
                    msg =
                        lastError instanceof Error
                            ? lastError.message
                            : typeof lastError === 'string'
                                ? lastError
                                : JSON.stringify(lastError);
                }
                await this.setState('errorMsg', msg, true);
                if (stateName === 'heatOn') {
                    await this.setState('remoteControl', false, true);
                }
            }
        }
        catch (outerErr) {
            const errMsg = outerErr instanceof Error ? outerErr.message : String(outerErr);
            this.log.error(`Unexpected error in setSaunaState: ${errMsg}`);
        }
        finally {
            this.isSendingCommand = false;
        }
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback - Callback to be called after shutdown logic
     */
    onUnload = (callback) => {
        try {
            this.isUnloading = true;
            this.updateInterval && this.clearTimeout(this.updateInterval);
            this.loginInterval && this.clearInterval(this.loginInterval);
            if (this.pushClient) {
                this.pushClient.stop();
                this.pushClient = null;
            }
            callback();
        }
        catch {
            callback();
        }
    };
    /**
     * Formats a Date object to "HH:mm" in local time.
     *
     * @param date - The Date instance to format.
     */
    static formatTime(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    /**
     * Formats minutes (and optional seconds) into a readable duration string.
     *
     * @param minutes - Total minutes.
     * @param totalSeconds - Optional precise seconds.
     */
    static formatDuration(minutes, totalSeconds) {
        if (typeof totalSeconds === 'number' && totalSeconds > 0) {
            const m = Math.floor(totalSeconds / 60);
            const s = Math.round(totalSeconds % 60);
            if (m > 0 && s > 0) {
                return `${m} min ${s} sec`;
            }
            if (m > 0) {
                return `${m} min`;
            }
            return `${s} sec`;
        }
        if (minutes <= 0) {
            return '0 min';
        }
        return `${Math.round(minutes)} min`;
    }
    /**
     * 13 Temperature intervals used by Harvia heating curves (-20°C to 110°C in 10°C steps).
     */
    static HARVIA_INTERVALS = [
        { from: -20, to: -10 },
        { from: -10, to: 0 },
        { from: 0, to: 10 },
        { from: 10, to: 20 },
        { from: 20, to: 30 },
        { from: 30, to: 40 },
        { from: 40, to: 50 },
        { from: 50, to: 60 },
        { from: 60, to: 70 },
        { from: 70, to: 80 },
        { from: 80, to: 90 },
        { from: 90, to: 100 },
        { from: 100, to: 110 },
    ];
    /**
     * Calculates estimated heating seconds and minutes using Harvia's native heating curve.
     *
     * @param heatingCurve - 13 elements array of seconds per 10°C interval.
     * @param currentTemp - Current measured temperature.
     * @param targetTemp - Target temperature.
     */
    static calculateTimeFromHeatingCurve(heatingCurve, currentTemp, targetTemp) {
        if (!Array.isArray(heatingCurve) ||
            heatingCurve.length !== HarviaFenix.HARVIA_INTERVALS.length ||
            currentTemp >= targetTemp) {
            return null;
        }
        const startT = Math.max(-20, Math.min(110, currentTemp));
        const targetT = Math.max(-20, Math.min(110, targetTemp));
        let totalSeconds = 0;
        for (let i = 0; i < HarviaFenix.HARVIA_INTERVALS.length; i++) {
            const interval = HarviaFenix.HARVIA_INTERVALS[i];
            if (interval.to <= startT) {
                continue;
            }
            if (interval.from >= targetT) {
                break;
            }
            const segStart = Math.max(interval.from, startT);
            const segEnd = Math.min(interval.to, targetT);
            const delta = segEnd - segStart;
            if (delta > 0 && typeof heatingCurve[i] === 'number') {
                totalSeconds += heatingCurve[i] * (delta / 10);
            }
        }
        if (totalSeconds <= 0) {
            return null;
        }
        return {
            minutes: Math.max(1, Math.round(totalSeconds / 60)),
            totalSeconds: Math.round(totalSeconds),
        };
    }
    /**
     * Calculates self-learning estimated remaining heating time, ready time, and detects heating performance anomalies.
     *
     * @param heatOn - Whether the sauna heating is currently turned on.
     * @param currentTemp - The current measured sauna cabin temperature in °C.
     * @param targetTemp - The target sauna cabin temperature in °C.
     * @param reportedTimeToTarget - Optional time to target in minutes directly reported by Harvia cloud/device.
     * @param heatingCurve - Optional 13-element heating curve seconds array.
     */
    calculateHeatingPrognosis = async (heatOn, currentTemp, targetTemp, reportedTimeToTarget, heatingCurve) => {
        const now = Date.now();
        if (currentTemp >= targetTemp) {
            // Target temperature reached
            if (this.sessionStartTime !== null && this.sessionStartTemp !== null && heatOn) {
                const totalMinutes = (now - this.sessionStartTime) / 60000;
                const tempDiff = currentTemp - this.sessionStartTemp;
                if (totalMinutes >= 5 && tempDiff > 5) {
                    const sessionRate = tempDiff / totalMinutes;
                    const avgRateState = await this.getStateAsync('info.avgHeatingRate');
                    const currentAvgRate = typeof avgRateState?.val === 'number' && avgRateState.val > 0 ? avgRateState.val : 1.5;
                    // Exponential Moving Average (EMA) with alpha = 0.3
                    const newAvgRate = parseFloat((0.3 * sessionRate + 0.7 * currentAvgRate).toFixed(2));
                    await this.setState('info.avgHeatingRate', newAvgRate, true);
                    this.log.info(`📊 Updated learned average heating rate to ${newAvgRate} °C/min (this session: ${sessionRate.toFixed(2)} °C/min).`);
                }
            }
            this.sessionStartTime = null;
            this.sessionStartTemp = null;
            this.tempHistory = [];
            await this.setState('estimatedHeatingTimeRemaining', 0, true);
            await this.setState('readyAt', '--:--', true);
            await this.setState('readyAtMessage', 'Ready', true);
            await this.setState('timeToTargetFormatted', '0 min', true);
            await this.setState('info.heatingAnomaly', false, true);
            await this.setState('info.heatingAnomalyType', 'none', true);
            await this.setState('info.heatingAnomalyDesc', '', true);
            return;
        }
        // Read historical average rate (default 1.5 °C/min)
        const avgRateState = await this.getStateAsync('info.avgHeatingRate');
        let historicalRate = 1.5;
        if (typeof avgRateState?.val === 'number' && avgRateState.val > 0) {
            historicalRate = avgRateState.val;
        }
        if (!heatOn) {
            // Finalize historical learning if any
            this.sessionStartTime = null;
            this.sessionStartTemp = null;
            this.tempHistory = [];
            await this.setState('estimatedHeatingTimeRemaining', 0, true);
            await this.setState('info.heatingAnomaly', false, true);
            await this.setState('info.heatingAnomalyType', 'none', true);
            await this.setState('info.heatingAnomalyDesc', '', true);
            // PROGNOSIS IF TURNED ON NOW (STANDBY PREDICTION)
            let prognosisMinutes = 0;
            let totalSec;
            if (heatingCurve && heatingCurve.length === HarviaFenix.HARVIA_INTERVALS.length) {
                const curveRes = HarviaFenix.calculateTimeFromHeatingCurve(heatingCurve, currentTemp, targetTemp);
                if (curveRes) {
                    prognosisMinutes = curveRes.minutes;
                    totalSec = curveRes.totalSeconds;
                }
            }
            if (prognosisMinutes <= 0) {
                prognosisMinutes = Math.max(1, Math.round((targetTemp - currentTemp) / historicalRate));
            }
            const readyDate = new Date(now + prognosisMinutes * 60 * 1000);
            const readyTimeStr = HarviaFenix.formatTime(readyDate);
            await this.setState('readyAt', readyTimeStr, true);
            await this.setState('readyAtMessage', `Ready at ${readyTimeStr} if turned on now`, true);
            await this.setState('timeToTargetFormatted', HarviaFenix.formatDuration(prognosisMinutes, totalSec), true);
            return;
        }
        // --- ACTIVE HEATING PHASE ---
        if (this.sessionStartTime === null) {
            this.sessionStartTime = now;
            this.sessionStartTemp = currentTemp;
            this.tempHistory = [];
        }
        // Add sample and prune samples older than 15 minutes
        this.tempHistory.push({ time: now, temp: currentTemp });
        this.tempHistory = this.tempHistory.filter(sample => now - sample.time <= 15 * 60 * 1000);
        // Calculate live heating rate from sliding window (last 3 to 15 minutes)
        let liveRate = 0;
        let windowMinutes = 0;
        if (this.tempHistory.length >= 2) {
            const oldestSample = this.tempHistory[0];
            windowMinutes = (now - oldestSample.time) / 60000;
            if (windowMinutes >= 2) {
                liveRate = (currentTemp - oldestSample.temp) / windowMinutes;
            }
        }
        // Blend rate: 0-3 min (weight = 0), 3-10 min (weight scales linearly 0 -> 0.8)
        let weight = 0;
        if (windowMinutes >= 3) {
            weight = Math.min(0.8, ((windowMinutes - 3) / 7) * 0.8);
        }
        let effectiveRate = historicalRate;
        if (weight > 0 && liveRate > 0) {
            effectiveRate = (1 - weight) * historicalRate + weight * liveRate;
        }
        if (effectiveRate <= 0) {
            effectiveRate = historicalRate;
        }
        let remainingMinutes = 0;
        let totalSec;
        if (typeof reportedTimeToTarget === 'number' && reportedTimeToTarget > 0) {
            remainingMinutes = Math.round(reportedTimeToTarget);
        }
        else if (heatingCurve && heatingCurve.length === HarviaFenix.HARVIA_INTERVALS.length) {
            const curveRes = HarviaFenix.calculateTimeFromHeatingCurve(heatingCurve, currentTemp, targetTemp);
            if (curveRes) {
                remainingMinutes = curveRes.minutes;
                totalSec = curveRes.totalSeconds;
            }
        }
        if (remainingMinutes <= 0) {
            remainingMinutes = Math.max(1, Math.round((targetTemp - currentTemp) / effectiveRate));
        }
        await this.setState('estimatedHeatingTimeRemaining', remainingMinutes, true);
        const readyDate = new Date(now + remainingMinutes * 60 * 1000);
        const readyTimeStr = HarviaFenix.formatTime(readyDate);
        await this.setState('readyAt', readyTimeStr, true);
        await this.setState('readyAtMessage', `Ready at ${readyTimeStr}`, true);
        await this.setState('timeToTargetFormatted', HarviaFenix.formatDuration(remainingMinutes, totalSec), true);
        // --- ANOMALY DETECTION ---
        const activeHeatingMinutes = (now - this.sessionStartTime) / 60000;
        if (activeHeatingMinutes >= 10 && windowMinutes >= 3) {
            if (liveRate < 0.5 * historicalRate) {
                const currentType = (await this.getStateAsync('info.heatingAnomalyType'))?.val;
                if (currentType !== 'too_slow') {
                    const desc = `⚠️ Heating rate (${liveRate.toFixed(2)} °C/min) is significantly below historical average (${historicalRate.toFixed(2)} °C/min). Check sauna door or heater element.`;
                    await this.setState('info.heatingAnomaly', true, true);
                    await this.setState('info.heatingAnomalyType', 'too_slow', true);
                    await this.setState('info.heatingAnomalyDesc', desc, true);
                    this.log.info(desc);
                }
            }
            else if (liveRate > 1.8 * historicalRate) {
                const currentType = (await this.getStateAsync('info.heatingAnomalyType'))?.val;
                if (currentType !== 'too_fast') {
                    const desc = `🚨 Heating rate (${liveRate.toFixed(2)} °C/min) is significantly above historical average (${historicalRate.toFixed(2)} °C/min). Check temperature sensor or heater controller.`;
                    await this.setState('info.heatingAnomaly', true, true);
                    await this.setState('info.heatingAnomalyType', 'too_fast', true);
                    await this.setState('info.heatingAnomalyDesc', desc, true);
                    this.log.info(desc);
                }
            }
            else {
                const anomalyState = await this.getStateAsync('info.heatingAnomaly');
                if (anomalyState?.val) {
                    await this.setState('info.heatingAnomaly', false, true);
                    await this.setState('info.heatingAnomalyType', 'none', true);
                    await this.setState('info.heatingAnomalyDesc', '', true);
                    this.log.info(`✅ Heating performance normalized (${liveRate.toFixed(2)} °C/min, historical: ${historicalRate.toFixed(2)} °C/min).`);
                }
            }
        }
    };
    // Internal helper function for debouncing ioBroker events (Race Condition protection)
    shouldProcess(id) {
        const now = Date.now();
        if (this.lastEventTime[id] && now - this.lastEventTime[id] < 1500) {
            return false; // Ignore events within 1500ms (VIS bouncing)
        }
        this.lastEventTime[id] = now;
        return true;
    }
    onStateChange = async (id, state) => {
        if (!state || state.ack) {
            return;
        }
        const stateId = id.split('.').pop();
        if (!stateId || !this.shouldProcess(id)) {
            return;
        }
        switch (stateId) {
            case 'heatOn': {
                const val = HarviaFenix.isTrue(state.val);
                if (val) {
                    const remoteControlState = await this.getStateAsync('remoteControl');
                    if (!remoteControlState?.val) {
                        this.log.warn('Remote start not ready. Command will not be sent to the cloud.');
                        await this.setState('heatOn', false, true);
                        await this.setState('errorMsg', 'Remote start not enabled on panel!', true);
                        return;
                    }
                }
                await this.setState('readyNotified10Min', false, true);
                await this.setState('targetReachedNotified', false, true);
                await this.setSaunaState('heatOn', val);
                break;
            }
            case 'lightOn':
                await this.setSaunaState('lightOn', HarviaFenix.isTrue(state.val));
                break;
            case 'targetTemp': {
                const minTemp = typeof this.config.minTemp === 'number' ? this.config.minTemp : MIN_TARGET_TEMP;
                const maxTemp = typeof this.config.maxTemp === 'number' ? this.config.maxTemp : MAX_TARGET_TEMP;
                const val = typeof state.val === 'number' ? state.val : Number.parseFloat(String(state.val));
                if (Number.isNaN(val) || val < minTemp || val > maxTemp) {
                    this.log.error(`Invalid target temperature (${state.val}°C) received. Range: ${minTemp}-${maxTemp}°C.`);
                    await this.setState('errorMsg', `Invalid target temperature: ${state.val}°C`, true);
                    return;
                }
                await this.setSaunaState('targetTemp', val);
                break;
            }
            case 'maxDuration': {
                const configuredMaxDuration = typeof this.config.maxDuration === 'number' ? this.config.maxDuration : MAX_MAX_DURATION;
                const val = typeof state.val === 'number' ? state.val : Number.parseFloat(String(state.val));
                if (Number.isNaN(val) || val < MIN_MAX_DURATION || val > configuredMaxDuration) {
                    this.log.error(`Invalid max duration (${state.val} min) received. Range: ${MIN_MAX_DURATION}-${configuredMaxDuration} min.`);
                    await this.setState('errorMsg', `Invalid max duration: ${state.val} min`, true);
                    return;
                }
                await this.setSaunaState('maxDuration', val);
                break;
            }
            case 'activeProfile': {
                const val = typeof state.val === 'number'
                    ? state.val
                    : typeof state.val === 'string'
                        ? Number.parseInt(state.val, 10)
                        : Number.NaN;
                if (Number.isNaN(val) || val < 0) {
                    this.log.error(`Invalid active profile index (${state.val}) received.`);
                    return;
                }
                await this.setSaunaState('activeProfile', val);
                break;
            }
        }
    };
}
exports.HarviaFenix = HarviaFenix;
if (require.main !== module) {
    // Export the constructor in compact mode
    const adapterExport = ((options) => new HarviaFenix(options));
    // Add the class to the export for testing purposes
    adapterExport.HarviaFenix = HarviaFenix;
    module.exports = adapterExport;
}
else {
    // otherwise start the instance directly
    (() => new HarviaFenix())();
}
//# sourceMappingURL=main.js.map