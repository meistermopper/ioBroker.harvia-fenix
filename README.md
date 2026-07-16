![Logo](admin/harvia.png)
# ioBroker.harvia-fenix
===========================

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

## Disclaimer & Safety Warning
**Remote operation of a sauna heater is subject to strict safety regulations!** According to the European safety standard **EN 60335-2-53** in conjunction with **EN 60335-1**, fire protection measures are mandatory for remote control setups. The sauna cabin must be equipped with an approved door sensor or a safety switch-off system. This ensures that the heater cannot be started remotely or via a timer if a flammable object (e.g., a towel) has been left on or near the heater.

* **No Liability:** The developer of this adapter assumes absolutely no responsibility, warranty, or liability for any damages, fires, injuries, or legal issues resulting from the use or misconfiguration of this software. You operate this integration entirely at your own risk.
* **Trademarks:** Harvia and MyHarvia 2 are registered trademarks of Harvia Group. This adapter is an independent, community-driven open-source project and is neither officially endorsed, sponsored, nor supported by Harvia.

---

## Installation
You can either install the adapter via the ioBroker web interface or on your local machine via npm.

### Browser-based
1. Open your ioBroker web interface in a browser (e.g. `192.168.1.33:8081`)
2. Click on Tab **Adapters**
3. Type "harvia-fenix" in the Filter
4. Click on the three points and then on the "+" symbol of the **Harvia Fenix** adapter to add an instance

### Local machine
Navigate into your ioBroker folder and execute the following command: 
```bash
npm i iobroker.harvia-fenix
```

---

## Setup
Additional to the adapter installation you must configure the adapter instance with your MyHarvia account details.

### Prerequisites
1. **Node.js >= 22**
2. A registered account within the official **MyHarvia 2** smartphone application.
3. Your valid login credentials:
   - **Email Address**
   - **Password**

*Note: We recommend setting up a separate account for ioBroker in the Harvia 2 app and using those login credentials in the instance.*

### ioBroker Configuration
1. Open your ioBroker interface in a browser (e.g. `192.168.1.33:8081`).
2. Navigate to Tab **Instances** and click the settings icon of your `harvia-fenix.0` instance.
3. Enter your **Email Address** and **Password** of your MyHarvia account.
4. If you leave the **Device ID** field empty, the adapter will automatically search for devices linked to your account upon startup. It will use the first device it finds as the active unit.
5. If you also want to adjust the poll interval, adjust the **Poll Interval** settings (in seconds).
6. Click on **Save & Close**.

### Device Configuration & Multi-Device Support

#### Automatic Discovery
If you leave the **Device ID** field in the adapter settings empty, the adapter will automatically search for devices linked to your account upon startup. It will use the first device it finds as the active unit. The detected ID will be printed to the ioBroker log.

#### Manual Device ID
For most users with a single sauna, automatic discovery is sufficient. However, it is recommended to copy the detected ID from the log and paste it into the configuration to ensure a stable connection to the specific hardware.

#### Multiple Saunas
If your MyHarvia account manages multiple control units (e.g. one at home and one in a vacation cottage):
1. Create a separate instance of the adapter for each sauna (e.g. `harvia-fenix.0` and `harvia-fenix.1`).
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

#### How to find the Owner's Partner ID?
There are two ways to determine the owner's Partner ID:
1. **Standard App:** If the owner is using the official, standard **MyHarvia 2** mobile application, the Partner ID is **`ORG/prod:0:6656:0`**.
2. **From the ioBroker Log:** If the owner already runs the `harvia-fenix` adapter, they can check their ioBroker startup log. Upon startup, the adapter prints a line like:
   `Using partner ID from user token: ORG/prod:0:XXXX`
   The owner can simply copy this ID and share it with the guest user.

#### How to configure a Shared/Guest Account
1. Enter your **own Username / Email** and **Password** (the guest credentials) in the adapter settings.
2. Enter the **owner's Partner ID** in the **Partner ID (Optional)** field.
3. If you leave the **Device ID** field empty, the adapter will search for the shared device using the owner's Partner ID and find it automatically.

---

## Compatibility Note
* **Supported:** **Harvia Fenix** control units managed via the **MyHarvia 2** mobile application.
* **NOT Supported:** **Harvia Xenio** series (e.g. Xenio WiFi / CX001WIFI). The Xenio series relies on a legacy hardware ecosystem and uses the older *"MyHarvia for Xenio"* app, which is fundamentally incompatible with the API utilized by this adapter.

---

## Usage
The adapter maps your sauna's cloud states into structured ioBroker datapoints under `harvia-fenix.0.*`.

### States
Following states will be created by the adapter:

#### Channel: info

* info.connection

    |Data type|Permission|
    |:---:|:---:|
    |boolean|R|

    *Read-only boolean indicator. If the adapter is connected to the MyHarvia Cloud, the state is true, otherwise false.*

#### Root folder

* online

    |Data type|Permission|
    |:---:|:---:|
    |boolean|R|

    *Read-only boolean. Cloud connection status of the control unit to the cloud.*

* heatOn

    |Data type|Permission|
    |:---:|:---:|
    |boolean|R/W|

    *Main toggle to switch the sauna heater ON (`true`) or OFF (`false`).*

* lightOn

    |Data type|Permission|
    |:---:|:---:|
    |boolean|R/W|

    *Toggle to switch the integrated sauna lighting ON or OFF.*

* temp

    |Data type|Permission|
    |:---:|:---:|
    |number|R|

    *The current ambient temperature inside the sauna cabin (e.g. `17 °C`).*

* targetTemp

    |Data type|Permission|
    |:---:|:---:|
    |number|R/W|

    *Target temperature setpoint for the sauna cabin (e.g. `90 °C`).*

* doorSafety

    |Data type|Permission|
    |:---:|:---:|
    |boolean|R|

    *Safety loop status (e.g. `true` if the door is secure / safe to run).*

* totalBathingHours

    |Data type|Permission|
    |:---:|:---:|
    |number|R|

    *Total historical cumulative hours the sauna has been actively used (`h`).*

* totalSessions

    |Data type|Permission|
    |:---:|:---:|
    |number|R|

    *Counter for the total number of individual sauna heating sessions executed.*

* errorMsg

    |Data type|Permission|
    |:---:|:---:|
    |string|R|

    *Current error messages or status text from the heater.*

* heaterPower

    |Data type|Permission|
    |:---:|:---:|
    |number|R|

    *Current heater power (`kW`). Note: This object is provisioned by the MyHarvia API structure but is currently delivered as `0 kW` (unpopulated). It appears to be reserved for future hardware or app updates.*

* panelTemp

    |Data type|Permission|
    |:---:|:---:|
    |number|R|

    *The temperature reading measured at the physical control panel unit (`°C`).*

* totalOperatingHours

    |Data type|Permission|
    |:---:|:---:|
    |number|R|

    *Total system operational running hours (`h`).*

* readyNotified10Min

    |Data type|Permission|
    |:---:|:---:|
    |boolean|R|

    *Turns `true` when the sauna is approximately 10 minutes away from reaching the target temperature (13°C below target).*

* targetReachedNotified

    |Data type|Permission|
    |:---:|:---:|
    |boolean|R|

    *Turns `true` when the sauna has successfully reached the configured target temperature.*

* remoteControl

    |Data type|Permission|
    |:---:|:---:|
    |boolean|R|

    *Remote start readiness status. If `false`, starting the heater is blocked locally.*

---

## Notifications & Automations
The adapter automatically calculates the heating progress and provides two indicator datapoints specifically designed for triggering push notifications (e.g. via Telegram, Pushover, or Alexa).

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

## Troubleshooting

### Common API Errors & Status Messages in `errorMsg`

* **`Action blocked (403 Forbidden). Remote start authorization (Safety Loop) at panel might not be active.`**
  - **Cause:** The European safety standard requires that remote starting can only be activated if the safety loop/door sensor is closed and remote start has been physically armed at the sauna panel.
  - **Solution:** Close the sauna door and press the **Remote Start / Fernstart** button on your physical Harvia control panel. The remote icon on the screen must be active. Once done, you can control the sauna via the adapter.
* **`Cloud lock: Device busy, command discarded.` (Logged as debug)**
  - **Cause:** Harvia's API rate-limits commands if they are sent in rapid succession (e.g. rapid clicking in the UI) to protect the hardware.
  - **Solution:** Wait a few seconds between commands. The adapter automatically discards commands that are sent too quickly to prevent API blocking.

---

## To-Do
* [ ] Await official permission from Harvia to use their original logo
* [ ] Add adapter to the official ioBroker `latest` repository
* [ ] Add adapter to the official ioBroker `stable` repository

---

## Changelog
### **WORK IN PROGRESS**
* (meistermopper) Change doorSafety role to indicator.safety to prevent semantic role mismatch
* (meistermopper) Redesign README and README_de.md layout to match Denon adapter presentation
* (meistermopper) Update AI commit hook prompt to generate messages entirely in English

### 0.2.5 (2026-07-15)
* (meistermopper) Add docs folder structure and automatic README synchronization script

### 0.2.4 (2026-07-08)
* (meistermopper) Use npm install in workflow to prevent lockfile sync issues

### 0.2.3 (2026-07-08)
* (meistermopper) Update dependencies (eslint-config, commitlint) and regenerate package-lock.json

### 0.2.2 (2026-07-05)
* (meistermopper) Fix German log messages and states (translate to English)
* (meistermopper) Remove prepare script from package.json
* (meistermopper) Add boundary check validation for pollInterval in main.ts
* (meistermopper) Move inline jsonConfig translations to standard i18n files and fix missing translations

### 0.2.1 (2026-06-30)
* (meistermopper) Fix jsonConfig.json schema validation and add missing translations
* (meistermopper) Update axios and biome dependencies

[Older changelogs can be found there](CHANGELOG_OLD.md)

## [Older changelog entries](CHANGELOG_OLD.md)

---

## License
MIT License

Copyright (c) 2026 meistermopper <meister.mopper@gmail.com>
