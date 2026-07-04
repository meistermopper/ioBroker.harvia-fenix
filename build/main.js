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
// Harvia API Constants
const CLIENT_ID = "24emhb2mm0v4sscqhbdev86b2v";
const MIN_TARGET_TEMP = 40; // Minimum allowed target temperature in C
const MAX_TARGET_TEMP = 110; // Maximum allowed target temperature in C
const LATENCY_MS = 5000;
const API_TRUE_VALUES = new Set([
    1,
    21,
    23,
    "1",
    "21",
    "23",
    true,
    "true",
    "on",
    "enabled",
    "safe",
    "ready",
    "active",
    "standby",
]);
class HarviaFenix extends utils.Adapter {
    client;
    idToken = "";
    dataBaseUrl = "";
    deviceBaseUrl = "";
    usersBaseUrl = "";
    authUrl = "";
    partnerId = "ORG/prod:0:6656:0"; // Fallback
    activeDeviceId = "";
    loginPromise = null;
    isSendingCommand = false;
    isUnloading = false;
    lastCommandTime = 0;
    firstPoll = true;
    updateInterval;
    loginInterval;
    lastEventTime = {}; // For debouncing
    constructor(options = {}) {
        super({
            ...options,
            name: "harvia-fenix",
        });
        this.on("ready", this.onReady);
        this.on("stateChange", this.onStateChange);
        this.on("unload", this.onUnload);
        this.client = axios_1.default.create({
            timeout: 20000,
        });
    }
    /**
     * Centralized headers for Harvia Cloud API
     */
    getCloudHeaders(partnerId) {
        return {
            Authorization: `Bearer ${this.idToken}`,
            "x-harvia-partner-id": partnerId || this.partnerId,
            "x-harvia-app-id": CLIENT_ID,
        };
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady = async () => {
        // Reset status states
        await this.setState("info.connection", false, true);
        // Subscribe to writable states
        this.subscribeStates("heatOn");
        this.subscribeStates("lightOn");
        this.subscribeStates("targetTemp");
        // CLEAN START: Reset all status values to 'false' on startup
        await this.setState("online", false, true);
        await this.setState("heatOn", false, true);
        await this.setState("lightOn", false, true);
        await this.setState("doorSafety", false, true);
        await this.setState("remoteControl", false, true);
        await this.setState("errorMsg", "", true);
        await this.setState("readyNotified10Min", false, true);
        await this.setState("targetReachedNotified", false, true);
        // Clean up removed states from previous versions
        const oldRemoteReadyObj = await this.getObjectAsync("remoteReady");
        if (oldRemoteReadyObj) {
            await this.delObjectAsync("remoteReady");
        }
        // Start connection logic
        await this.startCloudConnection();
    };
    /**
     * Robust check for truthy values from Harvia API
     */
    static isTrue(val) {
        if (val === undefined || val === null)
            return false;
        let checkVal = val;
        if (typeof val === "string") {
            checkVal = val.toLowerCase().trim();
        }
        return API_TRUE_VALUES.has(checkVal);
    }
    /**
     * Internal helper to calculate and format a numeric value from API data with scaling and rounding.
     */
    static calculateNumericValue(val, scale = 1, decimals = 1) {
        if (val === undefined || val === null || val === "")
            return undefined;
        const num = typeof val === "number" ? val : Number(val);
        if (Number.isNaN(num))
            return undefined;
        let result = num * scale;
        if (decimals >= 0) {
            const factor = 10 ** decimals;
            result = Math.round(result * factor) / factor;
        }
        return result;
    }
    /**
     * Helper to get value from multiple possible API keys
     */
    static getApiValue(p, keys) {
        if (!p || typeof p !== "object" || Array.isArray(p))
            return undefined;
        // 1. Search top level
        for (const key of keys) {
            const val = p[key];
            if (val !== undefined && val !== null) {
                return val;
            }
        }
        // 2. Search in status object (new Harvia API structure)
        const status = p.status;
        if (status && typeof status === "object" && !Array.isArray(status)) {
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
            const response = await this.client.get("https://api.harvia.io/endpoints");
            this.log.debug(`Endpoints Response: ${JSON.stringify(response.data)}`);
            const ep = response.data.RestApi || response.data.endpoints?.RestApi;
            if (!ep) {
                this.log.error("Could not find RestApi configuration in endpoints response");
                return false;
            }
            this.dataBaseUrl = ep.data.https;
            this.deviceBaseUrl = ep.device.https;
            this.usersBaseUrl = ep.users?.https || "";
            this.authUrl = `${ep.generics.https}/auth/token`;
            const partnerId = response.data.Config?.PartnerOrganizationId ||
                response.data.endpoints?.Config?.PartnerOrganizationId;
            if (this.config.partnerId) {
                this.partnerId = this.config.partnerId;
            }
            else if (partnerId) {
                this.partnerId = partnerId;
            }
            this.log.info(`API configuration loaded: Data=${this.dataBaseUrl}, Device=${this.deviceBaseUrl}, Partner=${this.partnerId}`);
            return true;
        }
        catch (err) {
            this.log.error(`Error loading API configuration: ${err instanceof Error ? err.message : String(err)}`);
            return false;
        }
    }
    async login() {
        if (this.isUnloading)
            return false;
        if (this.loginPromise) {
            return this.loginPromise;
        }
        this.loginPromise = this.performLogin();
        try {
            return await this.loginPromise;
        }
        finally {
            this.loginPromise = null;
        }
    }
    async performLogin() {
        try {
            if (!this.authUrl && !(await this.fetchConfig())) {
                return false;
            }
            if (!this.config.username || !this.config.password) {
                this.log.error("Login failed: Username or password not configured!");
                return false;
            }
            this.log.debug(`Attempting login for user: ${this.config.username?.substring(0, 3)}...`);
            const response = await this.client.post(this.authUrl, {
                username: this.config.username,
                password: this.config.password,
                client_id: CLIENT_ID,
            });
            this.idToken = response.data.idToken.trim(); // JWT-Token trimmed
            // Decode JWT to extract partner ID or debug info
            try {
                const parts = this.idToken.split(".");
                if (parts.length > 1) {
                    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
                    this.log.debug(`Decoded token payload: ${JSON.stringify(payload)}`);
                    if (this.config.partnerId) {
                        this.partnerId = this.config.partnerId;
                        this.log.debug(`Using manually configured partner ID: ${this.partnerId}`);
                    }
                    else {
                        const jwtOrg = payload["custom:org"];
                        if (jwtOrg) {
                            this.partnerId = jwtOrg.startsWith("ORG/")
                                ? jwtOrg
                                : `ORG/${jwtOrg}`;
                            this.log.debug(`Using partner ID from user token: ${this.partnerId}`);
                        }
                    }
                }
            }
            catch (_e) {
                // Ignore
            }
            await this.setState("info.connection", true, true);
            return true;
        }
        catch (err) {
            this.log.error(`Login failed: ${err instanceof Error ? err.message : String(err)}`);
            await this.setState("info.connection", false, true);
            return false;
        }
    }
    async startCloudConnection() {
        if (this.isUnloading)
            return;
        if (await this.login()) {
            if (this.isUnloading)
                return;
            await this.discoverDevices();
            if (this.isUnloading)
                return;
            void this.updateStatus(); // Start first poll
            this.loginInterval = this.setInterval(() => void this.login(), 50 * 60 * 1000);
        }
        else {
            if (this.isUnloading)
                return;
            this.log.warn("Initial login failed. Retrying in 5 minutes...");
            this.updateInterval = this.setTimeout(() => this.startCloudConnection(), 5 * 60 * 1000);
        }
    }
    async discoverDevices() {
        try {
            if (!this.idToken || !this.deviceBaseUrl) {
                return;
            }
            const endpointsToTry = [];
            const devBase = this.deviceBaseUrl.replace(/\/$/, "");
            endpointsToTry.push(devBase.endsWith("/devices") ? devBase : `${devBase}/devices`);
            if (this.usersBaseUrl) {
                const userBase = this.usersBaseUrl.replace(/\/$/, "");
                endpointsToTry.push(userBase.endsWith("/devices") ? userBase : `${userBase}/devices`);
            }
            const partnerIdsToTry = [this.partnerId];
            if (this.partnerId !== "ORG/prod:0:6656:0") {
                partnerIdsToTry.push("ORG/prod:0:6656:0");
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
                            typeof discoveryData === "object" &&
                            !Array.isArray(discoveryData) && // Ensure it's not an array mistakenly cast to object
                            "devices" in discoveryData &&
                            Array.isArray(discoveryData.devices)) {
                            devices = discoveryData
                                .devices;
                        }
                        if (devices.length > 0) {
                            this.partnerId = partnerId;
                            break;
                        }
                    }
                    catch (_e) {
                        this.log.debug(`Discovery at ${url} with partner ${partnerId} failed, trying next...`);
                    }
                }
                if (devices.length > 0)
                    break;
            }
            if (devices.length > 0) {
                this.log.info(`Harvia Cloud: ${devices.length} device(s) found.`);
                if (devices.length > 1 && !this.config.deviceId) {
                    this.log.warn(`Multiple devices (${devices.length}) found in your Harvia account, but no Device ID is specified in the adapter configuration! The adapter will default to the first discovered device. Please configure a specific Device ID for each instance to avoid control conflicts.`);
                }
                for (const d of devices) {
                    const actualId = d.deviceId || d.id || d.name;
                    this.log.info(`Found device: ${d.name} (ID: ${actualId}, Type: ${d.type ?? "Fenix"})`);
                    // Use the configured ID if available, otherwise fall back to discovered ID
                    if (!this.activeDeviceId && !this.config.deviceId && actualId) {
                        this.log.warn(`Device ID not set in adapter configuration. Using found ID: ${actualId}`);
                        this.activeDeviceId = actualId;
                    }
                    else if (this.config.deviceId &&
                        this.config.deviceId !== actualId) {
                        this.log.info(`Configured Device ID (${this.config.deviceId}) does not match found ID (${actualId}). Please check settings.`);
                    }
                    // Read static attributes directly at startup
                    const attributes = {};
                    if (Array.isArray(d.attr)) {
                        for (const a of d.attr) {
                            if (a.key && a.value !== undefined)
                                attributes[a.key] = a.value;
                        }
                        for (const [key, val] of Object.entries(attributes)) {
                            switch (key) {
                                case "connected":
                                    await this.setState("online", HarviaFenix.isTrue(val), true);
                                    break;
                                case "stats.totalSessions.C1":
                                    {
                                        const result = HarviaFenix.calculateNumericValue(val, 1, 0);
                                        if (result !== undefined) {
                                            await this.setState("totalSessions", result, true);
                                        }
                                    }
                                    break;
                                case "stats.totalBathingHours.C1":
                                    {
                                        const result = HarviaFenix.calculateNumericValue(val, 1, 2);
                                        if (result !== undefined) {
                                            await this.setState("totalBathingHours", result, true);
                                        }
                                    }
                                    break;
                                case "stats.totalOperatingHours.C1":
                                    {
                                        const result = HarviaFenix.calculateNumericValue(val, 1, 2);
                                        if (result !== undefined) {
                                            await this.setState("totalOperatingHours", result, true);
                                        }
                                    }
                                    break;
                                case "BT_MAC":
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
                    this.log.warn("Login successful, but no devices found in Harvia account.");
                }
            }
        }
        catch (err) {
            this.log.error(`Error during device discovery: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    async updateStatus() {
        if (this.isUnloading)
            return;
        try {
            if (!this.idToken || !this.dataBaseUrl) {
                return;
            }
            const url = `${this.dataBaseUrl.replace(/\/$/, "")}/data/latest-data`;
            const baseUrl = this.deviceBaseUrl.replace(/\/$/, "");
            const devicesUrl = baseUrl.endsWith("/devices")
                ? baseUrl
                : `${baseUrl}/devices`;
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
                    headers: { ...this.getCloudHeaders(), Accept: "application/json" },
                }),
                this.client.get(`${devicesUrl}/state`, {
                    params: { deviceId },
                    headers: { ...this.getCloudHeaders(), Accept: "application/json" },
                }),
            ]);
            if (this.isUnloading)
                return; // Prevent ghost execution if adapter stopped during request
            let p;
            if (response.data &&
                typeof response.data === "object" &&
                !Array.isArray(response.data)) {
                this.log.debug(`Poll Response: ${JSON.stringify(response.data)}`);
                if (response.data.data &&
                    typeof response.data.data === "object" &&
                    !Array.isArray(response.data.data)) {
                    p = response.data.data;
                }
                else {
                    p = response.data;
                }
            }
            let deviceState;
            if (deviceStateResponse.data &&
                typeof deviceStateResponse.data === "object" &&
                !Array.isArray(deviceStateResponse.data)) {
                this.log.debug(`Device State Response: ${JSON.stringify(deviceStateResponse.data)}`);
                if (deviceStateResponse.data.data &&
                    typeof deviceStateResponse.data.data === "object" &&
                    !Array.isArray(deviceStateResponse.data.data)) {
                    deviceState = deviceStateResponse.data.data;
                }
                else {
                    deviceState = deviceStateResponse.data;
                }
            }
            if (p &&
                (p.online !== undefined ||
                    HarviaFenix.getApiValue(p, ["temperature", "temp"]) !== undefined)) {
                if (Date.now() - this.lastCommandTime < LATENCY_MS) {
                    this.log.debug(`Polling ignored due to latency protection (${LATENCY_MS}ms). Last command ${Date.now() - this.lastCommandTime}ms ago.`);
                    return;
                }
                // Update Numeric States
                await this.updateNumericState("temp", ["temperature", "temp", "current_temperature", "ambient_temperature"], p, 1, 1);
                await this.updateNumericState("panelTemp", ["panelTemp", "panelTemperature", "panel_temperature"], p, 1, 1);
                await this.updateNumericState("heaterPower", ["heaterPower", "power", "heater_power"], p, 0.001, 2);
                await this.updateNumericState("totalBathingHours", ["totalBathingHours", "total_bathing_hours", "bathing_hours"], p, 1, 2);
                await this.updateNumericState("totalSessions", ["totalSessions", "total_sessions", "sessions"], p, 1, 0);
                await this.updateNumericState("totalOperatingHours", [
                    "totalOperatingHours",
                    "totalHours",
                    "total_hours",
                    "operating_hours",
                ], p, 1, 2);
                await this.updateNumericState("targetTemp", [
                    "targetTemperature",
                    "targetTemp",
                    "target_temperature",
                    "setpoint_temperature",
                ], p);
                // --- CUSTOM BOOLEAN & LOGIC STATES ---
                const rawDoor = HarviaFenix.getApiValue(p, [
                    "doorSafetyState",
                    "doorSafety",
                    "door",
                    "door_closed",
                    "door_safety_state",
                    "door_safety",
                ]);
                let isDoorSafe = true;
                if (rawDoor !== undefined) {
                    isDoorSafe = HarviaFenix.isTrue(rawDoor);
                    await this.setState("doorSafety", isDoorSafe, true);
                }
                else {
                    const dsState = await this.getStateAsync("doorSafety");
                    if (dsState)
                        isDoorSafe = !!dsState.val;
                }
                const rawHeat = HarviaFenix.getApiValue(p, [
                    "heatOn",
                    "heatState",
                    "heat",
                    "heater",
                    "heat_on",
                    "is_heating",
                ]);
                if (rawHeat !== undefined) {
                    const isHeatOn = HarviaFenix.isTrue(rawHeat);
                    const prevHeatOnState = await this.getStateAsync("heatOn");
                    if (prevHeatOnState && !!prevHeatOnState.val !== isHeatOn) {
                        await this.setState("readyNotified10Min", false, true);
                        await this.setState("targetReachedNotified", false, true);
                    }
                    await this.setState("heatOn", isHeatOn, true);
                }
                await this.updateBooleanState("lightOn", ["lightOn", "lightState", "light", "light_on"], p);
                // --- REMOTECONTROL & ONLINE LOGIC ---
                let isRemoteReady = false;
                if (deviceState &&
                    deviceState.state &&
                    deviceState.state.remoteAllowed !== undefined) {
                    isRemoteReady =
                        deviceState.state.remoteAllowed === 1 ||
                            deviceState.state.remoteAllowed === true ||
                            deviceState.state.remoteAllowed === "1" ||
                            deviceState.state.remoteAllowed === "true";
                }
                // Fallback safety link: open door blocks remote start
                if (!isDoorSafe) {
                    isRemoteReady = false;
                }
                await this.setState("remoteControl", isRemoteReady, true);
                // Online status from deviceState.connectionState.connected
                const isOnline = !!deviceState?.connectionState?.connected;
                await this.setState("online", isOnline, true);
                // --- NOTIFICATION LOGIC ---
                const heatOnState = await this.getStateAsync("heatOn");
                const heatOn = heatOnState ? !!heatOnState.val : false;
                const currentTempState = await this.getStateAsync("temp");
                const currentTemp = currentTempState && typeof currentTempState.val === "number"
                    ? currentTempState.val
                    : 0;
                const targetTempState = await this.getStateAsync("targetTemp");
                const targetTemp = targetTempState && typeof targetTempState.val === "number"
                    ? targetTempState.val
                    : 90;
                if (heatOn && currentTemp > 20) {
                    const notified10MinState = await this.getStateAsync("readyNotified10Min");
                    const notified10Min = notified10MinState
                        ? !!notified10MinState.val
                        : false;
                    const notifiedReadyState = await this.getStateAsync("targetReachedNotified");
                    const notifiedReady = notifiedReadyState
                        ? !!notifiedReadyState.val
                        : false;
                    if (!notified10Min &&
                        currentTemp >= targetTemp - 13 &&
                        currentTemp < targetTemp) {
                        await this.setState("readyNotified10Min", true, true);
                        this.log.info(`🧖 The sauna will reach its target temperature (${targetTemp}°C) in approximately 10 minutes.`);
                    }
                    if (!notifiedReady && currentTemp >= targetTemp) {
                        if (!notified10Min) {
                            await this.setState("readyNotified10Min", true, true);
                        }
                        await this.setState("targetReachedNotified", true, true);
                        this.log.info(`♨️ The sauna has reached its target temperature of ${targetTemp}°C and is ready!`);
                    }
                }
            }
            else {
                this.log.warn(`Unexpected data structure during status poll: ${JSON.stringify(response.data)}`);
            }
        }
        catch (err) {
            if (axios_1.default.isAxiosError(err)) {
                if (err.response?.status === 401 || err.response?.status === 403) {
                    this.log.info("Token expired or unauthorized, attempting re-login...");
                    void this.login();
                }
                else if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
                    this.log.debug("Cloud connection timeout during status poll, will retry in next interval.");
                }
                else if (err.response?.status === 429) {
                    this.log.warn("Cloud rate limit reached. Slowing down...");
                }
                else {
                    this.log.error(`Status poll failed (${err.response?.status}): ${err.message}. Response Data: ${JSON.stringify(err.response?.data)}`);
                }
            }
            else {
                this.log.error(`Status poll failed: ${err instanceof Error ? err.message : String(err)}`);
            }
            // Avoid flapping: only set to offline if it's currently online
            const currentOnline = await this.getStateAsync("online");
            if (currentOnline?.val !== false) {
                await this.setState("online", false, true);
            }
        }
        finally {
            // Only schedule next poll if adapter is not unloading
            if (!this.isUnloading) {
                const rawInterval = this.config.pollInterval || 60;
                const interval = Math.max(30, Math.min(600, rawInterval)) * 1000;
                this.updateInterval = this.setTimeout(() => this.updateStatus(), interval);
            }
        }
    }
    /**
     * Internal helper to update a numeric state from API data with scaling and rounding.
     */
    async updateNumericState(stateId, keys, data, scale = 1, decimals = 1) {
        const raw = HarviaFenix.getApiValue(data, keys);
        const result = HarviaFenix.calculateNumericValue(raw, scale, decimals);
        if (result !== undefined) {
            await this.setState(stateId, result, true);
        }
    }
    /**
     * Internal helper to update a boolean state from API data.
     */
    async updateBooleanState(stateId, keys, data) {
        const raw = HarviaFenix.getApiValue(data, keys);
        if (raw !== undefined) {
            await this.setState(stateId, HarviaFenix.isTrue(raw), true);
        }
    }
    async setSaunaState(stateName, value, isRetry = false) {
        if (this.isUnloading)
            return;
        if (!this.idToken || !this.deviceBaseUrl) {
            return;
        }
        // Lock-Check: Only block if not an internal retry
        if (this.isSendingCommand && !isRetry) {
            return;
        }
        // RACE-CONDITION PROTECTION
        const baseUrl = this.deviceBaseUrl.replace(/\/$/, "");
        const devicesUrl = baseUrl.endsWith("/devices")
            ? baseUrl
            : `${baseUrl}/devices`;
        this.isSendingCommand = true;
        try {
            const deviceId = this.activeDeviceId || this.config.deviceId;
            if (!deviceId) {
                this.log.error(`Cannot send command ${stateName}: No Device ID available. Please check the adapter configuration.`);
                return;
            }
            if (stateName === "heatOn" || stateName === "lightOn") {
                const commandType = stateName === "heatOn" ? "SAUNA" : "LIGHTS";
                const stateStr = value ? "on" : "off";
                const payload = {
                    deviceId,
                    cabin: { id: "C1" },
                    command: { type: commandType, state: stateStr },
                };
                const url = `${devicesUrl}/command`;
                const resp = await this.client.post(url, payload, {
                    headers: {
                        ...this.getCloudHeaders(),
                        "Content-Type": "application/json",
                    },
                });
                if (resp.data?.handled) {
                    this.log.info(`${commandType} -> ${stateStr}`);
                    // CONFIRMATION: Set ack: true immediately to prevent UI "jumping"
                    await this.setState(stateName, !!value, true);
                    this.lastCommandTime = Date.now();
                    if (stateName === "heatOn") {
                        await this.setState("errorMsg", "", true);
                    }
                }
                else {
                    const reason = resp.data.failureReason || "Unknown";
                    this.log.warn(`Cloud rejected command: ${reason}`);
                    await this.setState("errorMsg", `Cloud error: ${reason}`, true);
                    if (stateName === "heatOn") {
                        await this.setState("heatOn", false, true);
                        if (value) {
                            await this.setState("remoteControl", false, true);
                        }
                    }
                }
            }
            else if (stateName === "targetTemp") {
                const payload = {
                    deviceId,
                    cabin: { id: "C1" },
                    temperature: typeof value === "number"
                        ? value
                        : Number.parseFloat(String(value)),
                };
                const url = `${devicesUrl}/target`;
                await this.client.patch(url, payload, {
                    headers: {
                        ...this.getCloudHeaders(),
                        "Content-Type": "application/json",
                    },
                });
                this.log.info(`Target temperature -> ${value}°C`);
                // Immediate confirmation in ioBroker
                await this.setState("targetTemp", typeof value === "number" ? value : Number.parseFloat(String(value)), true);
                this.lastCommandTime = Date.now();
            }
        }
        catch (err) {
            let detail;
            if (axios_1.default.isAxiosError(err) && err.response?.data) {
                detail = JSON.stringify(err.response.data);
            }
            else if (err instanceof Error) {
                detail = err.message;
            }
            else {
                detail = String(err);
            }
            // "Device unavailable" is a cloud lock effect during rapid clicking.
            // Log as debug to keep the info log clean.
            if (detail.includes("Device unavailable")) {
                this.log.debug("Cloud lock: Device busy, command discarded.");
            }
            else {
                this.log.error(`Control error: ${detail}`);
                const msg = err instanceof Error ? err.message : String(err);
                await this.setState("errorMsg", `Error: ${msg}`, true);
            }
            let willRetry = false;
            if (!isRetry &&
                axios_1.default.isAxiosError(err) &&
                (err.response?.status === 401 || err.response?.status === 403)) {
                willRetry = true;
            }
            if (axios_1.default.isAxiosError(err) && err.response?.status === 403) {
                this.log.error("Action blocked (403 Forbidden). Remote start authorization (Safety Loop) at panel might not be active.");
            }
            if (stateName === "heatOn" && value && !willRetry) {
                await this.setState("heatOn", false, true);
                await this.setState("remoteControl", false, true);
            }
            // RE-LOGIN LOGIC: If token became invalid during runtime
            // Automatic re-login on expired token (HTTP 401)
            if (willRetry) {
                this.log.warn("Token expired or unauthorized during control, triggering re-login...");
                if (await this.login()) {
                    // Repeat command once after successful login
                    await this.setSaunaState(stateName, value, true);
                }
                else {
                    if (stateName === "heatOn" && value) {
                        await this.setState("heatOn", false, true);
                        await this.setState("remoteControl", false, true);
                    }
                }
            }
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
            callback();
        }
        catch (_e) {
            callback();
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
        if (!state || state.ack)
            return;
        const stateId = id.split(".").pop();
        if (!stateId || !this.shouldProcess(id))
            return;
        switch (stateId) {
            case "heatOn": {
                const val = HarviaFenix.isTrue(state.val);
                if (val) {
                    const remoteControlState = await this.getStateAsync("remoteControl");
                    if (!remoteControlState?.val) {
                        this.log.warn("Remote start not ready. Command will not be sent to the cloud.");
                        await this.setState("heatOn", false, true);
                        await this.setState("errorMsg", "Remote start not enabled on panel!", true);
                        return;
                    }
                }
                await this.setState("readyNotified10Min", false, true);
                await this.setState("targetReachedNotified", false, true);
                await this.setSaunaState("heatOn", val);
                break;
            }
            case "lightOn":
                await this.setSaunaState("lightOn", HarviaFenix.isTrue(state.val));
                break;
            case "targetTemp": {
                const val = typeof state.val === "number"
                    ? state.val
                    : Number.parseFloat(String(state.val));
                if (Number.isNaN(val) ||
                    val < MIN_TARGET_TEMP ||
                    val > MAX_TARGET_TEMP) {
                    this.log.error(`Invalid target temperature (${state.val}°C) received. Range: ${MIN_TARGET_TEMP}-${MAX_TARGET_TEMP}°C.`);
                    await this.setState("errorMsg", `Invalid target temperature: ${state.val}°C`, true);
                    return;
                }
                await this.setSaunaState("targetTemp", val);
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