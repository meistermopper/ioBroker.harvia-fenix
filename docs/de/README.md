<p align="center">
  <img src="admin/harvia.png" alt="Logo" width="100" />
</p>

# ioBroker.harvia-fenix

**[Click here for the English version of the documentation.](../en/README.md)**

[![Downloads](https://img.shields.io/npm/dm/iobroker.harvia-fenix.svg)](https://www.npmjs.com/package/iobroker.harvia-fenix)
[![node](https://img.shields.io/node/v/iobroker.harvia-fenix.svg)](https://www.npmjs.com/package/iobroker.harvia-fenix)
[![License](https://img.shields.io/npm/l/iobroker.harvia-fenix.svg)](https://github.com/meistermopper/ioBroker.harvia-fenix/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/meistermopper/ioBroker.harvia-fenix.svg)](https://github.com/meistermopper/ioBroker.harvia-fenix/issues)
![Number of Installations](https://iobroker.live/badges/harvia-fenix-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/harvia-fenix-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.harvia-fenix.png?downloads=true)](https://nodei.co/npm/iobroker.harvia-fenix/)
![Test and Release](https://github.com/meistermopper/ioBroker.harvia-fenix/workflows/Test%20and%20Release/badge.svg)

### Ein ioBroker-Adapter zur Integration und Steuerung der **Harvia Fenix** Saunasteuerung über die MyHarvia Cloud-Infrastruktur.

Für weitere Informationen über Harvia und deren Saunasteuerungen besuche bitte die [offizielle Harvia-Website](https://www.harvia.com).

---

## ⚠️ KRITISCHER SICHERHEITSHINWEIS & HAFTUNGSAUSSCHLUSS
**Der Fernbetrieb eines Saunaofens unterliegt strengen Sicherheitsvorschriften!** Gemäß der europäischen Sicherheitsnorm **EN 60335-2-53** in Verbindung mit **EN 60335-1** sind Brandschutzmaßnahmen für Fernsteuerungssysteme zwingend erforderlich. Die Saunakabine muss mit einem zugelassenen Türsensor oder einem Sicherheits-Abschaltsystem ausgestattet sein. Dies stellt sicher, dass der Ofen nicht aus der Ferne oder per Timer gestartet werden kann, wenn ein brennbarer Gegenstand (z. B. ein Handtuch) auf oder in der Nähe des Ofens vergessen wurde.

* **Keine Haftung:** Der Entwickler dieses Adapters übernimmt absolut keine Verantwortung, Gewährleistung oder Haftung für Schäden, Brände, Verletzungen oder rechtliche Probleme, die aus der Nutzung oder Fehlkonfiguration dieser Software resultieren. Sie betreiben diese Integration vollständig auf eigenes Risiko.
* **Markenhinweis:** Harvia und MyHarvia 2 sind eingetragene Marken der Harvia Group. Dieser Adapter ist ein unabhängiges, gemeinschaftsbasiertes Open-Source-Projekt und wird weder offiziell von Harvia unterstützt, gesponsert noch betreut.

---

## Installation
Der Adapter ist im offiziellen ioBroker-Repository verfügbar. Du kannst ihn direkt über die ioBroker Admin-Weboberfläche installieren.

### Über ioBroker Admin
1. Öffne deine ioBroker-Weboberfläche in einem Browser (z. B. `192.168.1.33:8081`).
2. Klicke auf den Reiter **Adapter**.
3. Gib "harvia-fenix" in den Filter ein.
4. Klicke auf die drei Punkte und dann auf das "+"-Symbol des **Harvia Fenix** Adapters, um eine Instanz hinzuzufügen.

---

## Einrichtung (Setup)
Zusätzlich zur Adapterinstallation musst du die Adapterinstanz mit deinen MyHarvia-Kontodaten konfigurieren.

### Voraussetzungen
1. **Node.js >= 22**
2. Ein registriertes Konto in der offiziellen **MyHarvia 2** Smartphone-App.
3. Gültige Login-Daten:
   - **E-Mail-Adresse**
   - **Passwort**

*Hinweis: Es wird ein separates Konto für ioBroker in der Harvia 2 App empfohlen und diese Zugangsdaten in der Instanz zu verwenden.*

### ioBroker-Konfiguration
1. Öffne deine ioBroker-Oberfläche in einem Browser (z. B. `192.168.1.33:8081`).
2. Navigiere zum Reiter **Instanzen** und klicke auf das Einstellungs-Symbol deiner `harvia-fenix.0`-Instanz.
3. Gib die **E-Mail-Adresse** und das **Passwort** deines MyHarvia-Kontos ein.
4. Wenn du das Feld **Geräte-ID** leer lässt, sucht der Adapter beim Start automatisch nach Geräten, die mit deinem Konto verknüpft sind. Er verwendet das erste gefundene Gerät als aktive Einheit.
5. Passe bei Bedarf optionale Parameter an: **Abfrageintervall** (Sekunden), **Mindest-/Maximal-Zieltemperatur** (°C) und **Maximale Heizdauer** (Minuten).
6. Klicke auf **Speichern & Schließen**.

---

## Gerätekonfiguration & Multi-Geräte-Unterstützung

#### Automatische Erkennung (Discovery)
Wenn du das Feld **Geräte-ID** in den Adapter-Einstellungen leer lässt, sucht der Adapter beim Start automatisch nach Geräten, die mit deinem Konto verknüpft sind. Er verwendet das erste gefundene Gerät als aktive Einheit. Die erkannte ID wird im ioBroker-Log ausgegeben.

#### Manuelle Geräte-ID
Für die meisten Benutzer mit einer einzelnen Sauna ist die automatische Erkennung ausreichend. Es wird jedoch empfohlen, die erkannte ID aus dem Log zu kopieren und in die Konfiguration einzufügen, um eine dauerhaft stabile Verbindung zur spezifischen Hardware zu gewährleisten.

#### Mehrere Saunen
Wenn dein MyHarvia-Konto meherere Steuereinheiten verwaltet (z. B. eine zu Hause und eine im Ferienhaus):
1. Erstelle für jede Sauna eine eigene Instanz des Adapters (z. B. `harvia-fenix.0` und `harvia-fenix.1`).
2. Trage die jeweilige **Device ID** manuell in der Konfiguration der entsprechenden Instanz ein.
Dadurch kannst du beide Saunen unabhängig voneinander mit eigenen Datenpunkten überwachen und steuern.

### Geteilte Konten / Gast-Zugänge & Die Partner-ID

#### Was ist die Partner-ID?
Die MyHarvia-Cloud-Infrastruktur unterteilt Geräte, Benutzer und Apps in verschiedene "Partner-Organisationen". Die offizielle **MyHarvia 2** Smartphone-App nutzt beispielsweise die Partner-ID `ORG/prod:0:6656:0`.

Normalerweise liest der Adapter beim Login den JSON Web Token (JWT) aus und ermittelt die Partner-ID automatisch aus dem Feld `custom:org`. Anschließend werden die verknüpften Geräte über diese ID bei der Harvia Cloud API abgefragt.

#### Das Problem bei geteilten Konten (Gast-Zugang)
Wenn ein anderer Benutzer (der Eigentümer) seine Sauna in der MyHarvia 2 App mit dir geteilt hat:
1. Dein Konto-Token ist mit einer anderen Gast-Partner-ID verknüpft (z. B. `ORG/prod:0:6749` oder einer benutzerdefinierten ID).
2. Fragt der Adapter die Geräteliste mit deiner Gast-Partner-ID ab, liefert die Harvia Cloud API eine leere Liste (`{"devices":[]}`) zurück und die Sauna wird nicht gefunden.
3. Um die geteilte Sauna zu steuern, **müssen die API-Anfragen mit der Partner-ID des Eigentümers durchgeführt werden**.

#### Wie finde ich die Partner-ID des Eigentümers?
Es gibt zwei Wege, die Partner-ID des Eigentümers zu ermitteln:
1. **Standard-App:** Verwendet der Eigentümer die offizielle **MyHarvia 2** Mobile-App, lautet die Partner-ID **`ORG/prod:0:6656:0`**.
2. **Aus the ioBroker-Log:** Betreibt der Eigentümer bereits den `harvia-fenix` Adapter, kann er in seinem ioBroker-Startup-Log nachsehen. Beim Start gibt der Adapter eine Zeile wie folgt aus:
   `Using partner ID from user token: ORG/prod:0:XXXX`
   Der Eigentümer kann diese ID kopieren und dem Gast-Nutzer mitteilen.

#### So richtest du ein geteiltes/freigegebenes Konto ein:
1. Trage deine **eigenen Zugangsdaten** (deine E-Mail-Adresse und dein Passwort) in den Adapter-Einstellungen ein.
2. Trage die **Partner-ID des Hauptnutzers/Besitzers** in das Feld **Partner-ID (Optional)** ein.
3. Wenn du das Feld **Geräte-ID** leer lässt, sucht der Adapter automatisch mit den Gast-Anmeldedaten, aber unter Verwendung der Partner-ID des Besitzers, nach der geteilten Sauna und findet diese.

---

## Kompatibilitätshinweis
* **Unterstützt:** **Harvia Fenix** Steuereinheiten, die über die **MyHarvia 2** App verwaltet werden.
* **NICHT unterstützt:** **Harvia Xenio** Serie (z. B. Xenio WiFi / CX001WIFI). Die Xenio-Serie basiert auf einem älteren Hardware-Ökosystem und verwendet die ältere *"MyHarvia for Xenio"* App, die grundlegend inkompatibel mit der von diesem Adapter verwendeten API ist.

---

## Verwendung (Usage)
### Verfügbare Datenpunkte
| Datenpunkt | Typ | Rolle | Zugriff | Beschreibung |
|---|---|---|---|---|
| `info.connection` | boolean | `indicator` | Nur Lesen | Verbindungsstatus des Adapters zur MyHarvia-Cloud. |
| `info.minTemp` | number | `value.temperature` | Nur Lesen | Mindest-Zieltemperaturgrenze (`40 °C`). |
| `info.maxTemp` | number | `value.temperature` | Nur Lesen | Maximal-Zieltemperaturgrenze (`110 °C`). |
| `online` | boolean | `indicator.reachable` | Nur Lesen | Verbindungsstatus der Steuereinheit zur Cloud. |
| `doorSafety` | boolean | `indicator.safety` | Nur Lesen | Status der Türsicherung (z. B. `true`, wenn die Tür sicher geschlossen ist). |
| `remoteControl` | boolean | `indicator` | Nur Lesen | Status der Fernstart-Bereitschaft. Wenn `false`, ist das Starten des Ofens aus der Ferne (über den Adapter) blockiert. |
| `errorMsg` | string | `text` | Nur Lesen | Aktuelle Fehlermeldungen oder Statustexte des Ofens. |
| `heatOn` | boolean | `switch.power` | Lesen/Schreiben | Hauptschalter, um den Saunaofen EIN (`true`) oder AUS (`false`) zu schalten. |
| `heaterPower` | number | `value.power` | Nur Lesen | *Hinweis:* Dieses Objekt wird von der API bereitgestellt, liefert aber derzeit oft `0 kW` (nicht ausgefüllt). Es ist vermutlich für zukünftige Updates reserviert. |
| `lightOn` | boolean | `switch.light` | Lesen/Schreiben | Schalter für die integrierte Saunabeleuchtung. |
| `maxDuration` | number | `level.timer` | Lesen/Schreiben | Maximale Heizdauer für die Saunasitzung in Minuten (`min`). |
| `panelTemp` | number | `value.temperature` | Nur Lesen | Temperaturmesswert direkt an der physischen Steuereinheit / Panel. |
| `targetTemp` | number | `level.temperature` | Lesen/Schreiben | Zieltemperatur-Sollwert für die Saunakabine (z. B. `90 °C`). |
| `temp` | number | `value.temperature` | Nur Lesen | Die aktuelle Umgebungstemperatur in der Saunakabine (z. B. `17 °C`). |
| `readyNotified10Min` | boolean | `indicator` | Nur Lesen | Wird `true`, wenn die Sauna noch ca. 10 Minuten von der Zieltemperatur entfernt ist (13°C unter Ziel). |
| `targetReachedNotified` | boolean | `indicator` | Nur Lesen | Wird `true`, wenn die Sauna die eingestellte Zieltemperatur erfolgreich erreicht hat. |
| `totalBathingHours` | number | `value.number` | Nur Lesen | Historische kumulierte Betriebsstunden der Saunanutzung (`h`). |
| `totalOperatingHours` | number | `value.hours` | Nur Lesen | Gesamte Betriebsstunden des Systems (`h`). |
| `totalSessions` | number | `value.count` | Nur Lesen | Zähler für die Gesamtzahl der durchgeführten Heizvorgänge. |

---

## Benachrichtigungen & Automatisierungen
Der Adapter berechnet automatisch den Heizfortschritt und stellt zwei Indikator-Datenpunkte zur Verfügung, die speziell für das Auslösen von Push-Benachrichtigungen (z. B. via Telegram, Pushover oder Alexa) konzipiert wurden.

Du kannst einfach ein kurzes ioBroker-Skript (JavaScript oder Blockly) verwenden, das auf die Änderung dieser Zustände zu `true` reagiert:

```javascript
// Trigger für die 10-Minuten-Vorwarnung
on({ id: 'harvia-fenix.0.readyNotified10Min', change: 'ne', val: true }, function () {
    const targetTemp = getState('harvia-fenix.0.targetTemp').val;
    sendTo('telegram.0', 'send', { text: `🧖 Die Sauna erreicht in ca. 10 Minuten ihre Zieltemperatur (${targetTemp}°C).` });
});

// Trigger wenn die Sauna vollständig bereit ist
on({ id: 'harvia-fenix.0.targetReachedNotified', change: 'ne', val: true }, function () {
    const targetTemp = getState('harvia-fenix.0.targetTemp').val;
    sendTo('telegram.0', 'send', { text: `♨️ Die Sauna hat ihre Zieltemperatur von ${targetTemp}°C erreicht und ist bereit!` });
});
```

*Hinweis: Diese Zustände werden automatisch auf `false` zurückgesetzt, wenn der Ofen ausgeschaltet wird oder ein neuer Heizvorgang beginnt.*

---

## Fehlerbehebung (Troubleshooting)

### Häufige API-Fehler & Statusmeldungen in `errorMsg`

* **`Action blocked (403 Forbidden). Remote start authorization (Safety Loop) at panel might not be active.`**
  - **Ursache:** Die europäische Sicherheitsnorm schreibt vor, dass ein Fernstart nur aktiv sein darf, wenn der Sicherheitskreis/Türsensor geschlossen ist und der Fernstart physisch am Saunapanel scharf geschaltet wurde.
  - **Lösung:** Schließe die Saunatür und drücke am physischen Harvia-Bedienfeld die **Fernstart**-Taste. Das Fernstart-Symbol auf dem Display muss leuchten. Erst danach ist die Steuerung über den Adapter freigegeben.
* **`Cloud lock: Device busy, command discarded.` (Als Debug-Log)**
  - **Ursache:** Die Harvia-API blockiert Befehle, wenn sie in zu schneller Folge gesendet werden (z. B. durch schnelles Klicken in der Vis), um die Hardware zu schützen.
  - **Lösung:** Warte einige Sekunden zwischen den Befehlen. Der Adapter verwirft zu schnelle Klicks automatisch, um eine API-Sperre zu verhindern.

---

## To-Do
* [ ] Auf offizielle Erlaubnis von Harvia zur Nutzung des Original-Logos warten
* [x] Aufnahme des Adapters in das offizielle ioBroker `latest` Repository
* [x] Aufnahme des Adapters in das offizielle ioBroker `stable` Repository

---

## Änderungsprotokoll (Changelog)

### **WORK IN PROGRESS**
* (meistermopper) Remove latest repository and translation badges from README files
* (meistermopper) Mark stable repository addition as completed in To-Do list
* (meistermopper) Remove direct npm installation instructions from README files
* (dependabot) Bump axios from 1.18.1 to 1.19.0
* (meistermopper) Center adapter logo in README files
* (meistermopper) Add Weblate translation status badge to README files
* (meistermopper) Add npm run translate step to release-before-commit script
* (meistermopper) Replace static latest badge with dynamic iobroker.live badge

### 0.3.1 (2026-08-04)
* (meistermopper) Update GitHub Actions in auto-translate workflow to v7
* (meistermopper) Add Git commit and push authorization rule to AGENTS.md
* (meistermopper) Add auto-translate workflow for automatic i18n translations
* (meistermopper) Add missing CHANGELOG_OLD link to README files
* (meistermopper) Fix untranslated news entries for 0.2.8 in io-package.json
* (meistermopper) Add common.news translation rule to AGENTS.md
* (meistermopper) Remove redundant npm badge and move Test and Release badge after NPM banner

### 0.3.0 (2026-07-29)
* (meistermopper) Add configurable min/max temperature limits and maxDuration in Admin UI

### 0.2.8 (2026-07-26)
* (meistermopper) Note latest repository availability in README installation section
* (meistermopper) Fix doorSafety role to sensor.door for repochecker compliance
* (meistermopper) Add missing CHANGELOG_OLD link to README.md (repochecker S6022)
* (meistermopper) Fix changelog rotation in README_de.md to enforce 5 entries limit

### 0.2.7 (2026-07-17)
* (meistermopper) Implement retry for "Device unavailable" and proactive token refresh
* (meistermopper) Restore clean datapoint table and safety warnings in README files
* (meistermopper) Mark latest repository item as completed in To-Do list
* (meistermopper) Clarify remoteControl description in README files
* (meistermopper) Remove redundant ==== underlines from header in README files
* (meistermopper) Remove duplicate changelog link and format it consistently in README files
* (meistermopper) Update Biome schema version to 2.5.3 to match CLI version

### 0.2.6 (2026-07-16)
* (meistermopper) Change doorSafety role to indicator.safety to prevent semantic role mismatch
* (meistermopper) Redesign README and README_de.md layout to match Denon adapter presentation
* (meistermopper) Update AI commit hook prompt to generate messages entirely in English

[Ältere Einträge können hier gefunden werden](../../CHANGELOG_OLD.md)

---

## Lizenz
MIT License

Copyright (c) 2026 meistermopper <meister.mopper@gmail.com>
