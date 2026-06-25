<p align="center">
  <img src="https://raw.githubusercontent.com/meistermopper/ioBroker.harvia-fenix/main/admin/harvia.png" alt="Logo">
</p>

# ioBroker.harvia-fenix

**[Hier geht es zur deutschen Version der Dokumentation.](README_de.md)**

[![NPM version](https://img.shields.io/npm/v/iobroker.harvia-fenix.svg)](https://www.npmjs.com/package/iobroker.harvia-fenix)
[![Downloads](https://img.shields.io/npm/dm/iobroker.harvia-fenix.svg)](https://www.npmjs.com/package/iobroker.harvia-fenix)
[![node](https://img.shields.io/node/v/iobroker.harvia-fenix.svg)](https://www.npmjs.com/package/iobroker.harvia-fenix)
[![License](https://img.shields.io/npm/l/iobroker.harvia-fenix.svg)](https://github.com/meistermopper/ioBroker.harvia-fenix/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/meistermopper/ioBroker.harvia-fenix.svg)](https://github.com/meistermopper/ioBroker.harvia-fenix/issues)
![Test and Release](https://github.com/meistermopper/ioBroker.harvia-fenix/workflows/Test%20and%20Release/badge.svg)
![Number of Installations](https://iobroker.live/badges/harvia-fenix-installed.svg)
![Current version in latest repository](https://iobroker.live/badges/harvia-fenix-latest.svg)
![Current version in stable repository](https://iobroker.live/badges/harvia-fenix-stable.svg)


[![NPM](https://nodei.co/npm/iobroker.harvia-fenix.png?downloads=true)](https://nodei.co/npm/iobroker.harvia-fenix/)

### An ioBroker adapter to integrate and control your **Harvia Fenix** sauna control unit via the MyHarvia cloud infrastructure.

For more information about Harvia and their sauna control units, please visit the [official Harvia website](https://www.harvia.com).

---
## Prerequisites

To use this adapter, you need:
1. **Node.js >= 22**
2. A registered account within the official **MyHarvia 2** smartphone application.
3. Your valid login credentials:
   * **Email Address**
   * **Password**

*Note: We recommend setting up a separate account for ioBroker in the Harvia 2 app and using those login credentials in the instance.*

---

## Device Configuration & Multi-Device Support

### Automatic Discovery
If you leave the **Device ID** field in the adapter settings empty, the adapter will automatically search for devices linked to your account upon startup. It will use the first device it finds as the active unit. The detected ID will be printed to the ioBroker log.

### Manual Device ID
For most users with a single sauna, automatic discovery is sufficient. However, it is recommended to copy the detected ID from the log and paste it into the configuration to ensure a stable connection to the specific hardware.

*Note: Currently, the Device ID is not displayed anywhere within the MyHarvia 2 app interface.*

### Multiple Saunas
If your MyHarvia account manages multiple control units (e.g., one at home and one in a vacation cottage):
1. Create a separate instance of the adapter for each sauna (e.g., `harvia-fenix.0` and `harvia-fenix.1`).
2. Manually enter the specific **Device ID** for each unit in its respective instance configuration.
This allows you to monitor and control both saunas independently with their own set of datapoints.

### Shared / Guest Accounts & The Partner ID

#### What is the Partner ID?
The MyHarvia cloud infrastructure separates devices, users, and apps into different "partner organizations". For instance, the official **MyHarvia 2** smartphone application maps to the partner ID `ORG/prod:0:6656:0`. 

Normally, when a user logs in, the adapter decodes their JSON Web Token (JWT) payload and automatically extracts the Partner ID from the `custom:org` field. It then queries the Harvia cloud API using this ID to discover connected devices.

#### The Shared/Guest Account Issue
If another user (the owner/primary user) has shared their sauna with you in the MyHarvia 2 app:
1. Your account token is associated with a different guest Partner ID (e.g. `ORG/prod:0:6749` or a custom ID).
2. If the adapter queries the devices list under your guest Partner ID, the Harvia Cloud API will return an empty list (`{"devices":[]}`), and you will not see the sauna.
3. To discover and control the shared sauna, the API requests **must be made using the Owner's Partner ID** instead.

#### How to configure a Shared/Guest Account
1. Enter your **own Username / Email** and **Password** (the guest credentials) in the adapter settings.
2. Enter the **owner's Partner ID** in the **Partner ID (Optional)** field.
   * *If the owner uses the standard MyHarvia 2 app, enter:* `ORG/prod:0:6656:0`.
   * *If the owner uses a custom or localized partner version, ask the owner to look at their ioBroker startup logs where their detected Partner ID is printed, and copy it.*
3. If you leave the **Device ID** field empty, the adapter will search for the shared device using the owner's Partner ID and find it automatically.

---

## Features & State Points

The adapter maps your sauna's cloud states into structured ioBroker datapoints under `harvia-fenix.0.*`.

### Available Datapoints
| Datapoint | Type | Role | Access | Description |
|---|---|---|---|---|
| `online` | boolean | `indicator.reachable` | Read-only | Connection state of the control unit to the cloud. |
| `doorSafety` | boolean | `indicator.safety` | Read-only | Safety loop status (e.g., `true` if the door is secure / safe to run). |
| `remoteControl` | boolean | `indicator` | Read-only | Remote start readiness status. If `false`, starting the heater is blocked locally. |
| `errorMsg` | string | `text` | Read-only | Current error messages or status text from the heater. |
| `heatOn` | boolean | `switch.power` | Read/Write | Main toggle to switch the sauna heater ON (`true`) or OFF (`false`). |
| `heaterPower` | number | `value.power` | Read-only | *Note:* This object is provisioned by the MyHarvia API structure but is currently delivered as `0 kW` (unpopulated). It appears to be reserved for future hardware or app updates. |
| `lightOn` | boolean | `switch.light` | Read/Write | Toggle to switch the integrated sauna lighting ON or OFF. |
| `panelTemp` | number | `value.temperature` | Read-only | The temperature reading measured at the physical control panel unit. |
| `targetTemp` | number | `level.temperature` | Read/Write | Target temperature setpoint for the sauna cabin (e.g., `90 °C`). |
| `temp` | number | `value.temperature` | Read-only | The current ambient temperature inside the sauna cabin (e.g., `17 °C`). |
| `readyNotified10Min` | boolean | `indicator` | Read-only | Turns `true` when the sauna is approximately 10 minutes away from reaching the target temperature (13°C below target). |
| `targetReachedNotified` | boolean | `indicator` | Read-only | Turns `true` when the sauna has successfully reached the configured target temperature. |
| `totalBathingHours` | number | `value.number` | Read-only | Total historical cumulative hours the sauna has been actively used (`h`). |
| `totalOperatingHours`| number | `value.hours` | Read-only | Total system operational running hours (`h`). |
| `totalSessions` | number | `value.count` | Read-only | Counter for the total number of individual sauna heating sessions executed. |
---

## Notifications & Automations

The adapter automatically calculates the heating progress and provides two indicator datapoints specifically designed for triggering push notifications (e.g., via Telegram, Pushover, or Alexa).

You can simply use a basic ioBroker script (JavaScript or Blockly) that listens to these states changing to `true`:

```javascript
// Trigger for the 10-minute pre-warning
on({ id: 'harvia-fenix.0.readyNotified10Min', change: 'ne', val: true }, function () {
    const targetTemp = getState('harvia-fenix.0.targetTemp').val;
    sendTo('telegram.0', 'send', { text: `🧖 The sauna will reach its target temperature (${targetTemp}°C) in about 10 minutes.` });
});

// Trigger when the sauna is fully ready
on({ id: 'harvia-fenix.0.targetReachedNotified', change: 'ne', val: true }, function () {
    const targetTemp = getState('harvia-fenix.0.targetTemp').val;
    sendTo('telegram.0', 'send', { text: `♨️ The sauna has reached the target temperature of ${targetTemp}°C and is ready!` });
});
```

*Note: These states will automatically reset to `false` when the heater is turned off or when a new heating session starts.*

---

## ⚠️ CRITICAL SAFETY WARNING & DISCLAIMER

**Remote operation of a sauna heater is subject to strict safety regulations!** According to the European safety standard **EN 60335-2-53** in conjunction with **EN 60335-1**, fire protection measures are mandatory for remote control setups. The sauna cabin must be equipped with an approved door sensor or a safety switch-off system. This ensures that the heater cannot be started remotely or via a timer if a flammable object (e.g., a towel) has been left on or near the heater.

* **No Liability:** The developer of this adapter assumes absolutely no responsibility, warranty, or liability for any damages, fires, injuries, or legal issues resulting from the use or misconfiguration of this software. You operate this integration entirely at your own risk.
---

## Compatibility Note

* **Supported:** **Harvia Fenix** control units managed via the **MyHarvia 2** mobile application.
* **NOT Supported:** **Harvia Xenio** series (e.g., Xenio WiFi / CX001WIFI). The Xenio series relies on a legacy hardware ecosystem and uses the older *"MyHarvia for Xenio"* app, which is fundamentally incompatible with the API utilized by this adapter.
---

## To-Do
* [ ] Await official permission from Harvia to use their original logo
* [ ] Add adapter to the official ioBroker `latest` repository
* [ ] Add adapter to the official ioBroker `stable` repository

---

## Changelog
### 0.2.0 (2026-06-25)
* (meistermopper) Add manual partnerId and shared/guest accounts support, improve unloading checks, update docs

### 0.1.2 (2026-06-24)
* (meistermopper) docs: update German translation of the changelog in README_de.md

### 0.1.1 (2026-06-24)
* (meistermopper) Fixed repochecker E254 error by removing unpublished version 0.0.28 from news in io-package.json
* (meistermopper) Updated @iobroker/adapter-core dependency to ^3.4.1
* (meistermopper) Added minimum Node.js requirement to Prerequisites section of READMEs

### 0.1.0 (2026-06-23)
* (meistermopper) Initial stable beta release
* (meistermopper) Re-introduced `remoteControl` state with dynamic multi-endpoint API polling logic
* (meistermopper) Optimized polling rate limits and connection state management
* (meistermopper) Configured automated changelog rotation to keep READMEs clean
* (meistermopper) Refactored codebase using the latest adapter creator standards

### 0.0.29 (2026-06-23)
* (meistermopper) Re-introduced `remoteControl` state with reliable combined multi-endpoint API logic (latest-data & devices/state)
* (meistermopper) Fix online status to use connectionState.connected from device state

## [Older changelog entries](CHANGELOG_OLD.md)

## Trademarks
Harvia and MyHarvia 2 are registered trademarks of Harvia Group. This adapter is an independent, community-driven open-source project and is neither officially endorsed, sponsored, nor supported by Harvia.

## License
MIT License

Copyright (c) 2026 meistermopper <meister.mopper@gmail.com>
