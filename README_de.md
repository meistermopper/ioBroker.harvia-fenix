<p align="center">
  <img src="https://raw.githubusercontent.com/meistermopper/ioBroker.harvia-fenix/main/admin/harvia.png" alt="Logo">
</p>

# ioBroker.harvia-fenix

**[Click here for the English version of the documentation.](README.md)**

[![NPM version](https://img.shields.io/npm/v/iobroker.harvia-fenix.svg)](https://www.npmjs.com/package/iobroker.harvia-fenix)
[![Downloads](https://img.shields.io/npm/dm/iobroker.harvia-fenix.svg)](https://www.npmjs.com/package/iobroker.harvia-fenix)
[![node](https://img.shields.io/node/v/iobroker.harvia-fenix.svg)](https://www.npmjs.com/package/iobroker.harvia-fenix)
[![License](https://img.shields.io/npm/l/iobroker.harvia-fenix.svg)](https://github.com/meistermopper/ioBroker.harvia-fenix/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/meistermopper/ioBroker.harvia-fenix.svg)](https://github.com/meistermopper/ioBroker.harvia-fenix/issues)
![Test and Release](https://github.com/meistermopper/ioBroker.harvia-fenix/workflows/Test%20and%20Release/badge.svg)
![Number of Installations](https://iobroker.live/badges/harvia-fenix-installed.svg)
![Current version in latest repository](https://iobroker.live/badges/harvia-fenix-latest.svg)
![Current version in stable repository](https://iobroker.live/badges/harvia-fenix-stable.svg)


### Ein ioBroker-Adapter zur Integration und Steuerung der **Harvia Fenix** Saunasteuerung über die MyHarvia Cloud-Infrastruktur.

Für weitere Informationen über Harvia und deren Saunasteuerungen besuchen Sie bitte die [offizielle Harvia-Website](https://www.harvia.com).

---

## Voraussetzungen

Um diesen Adapter zu nutzen, benötigen Sie:
1. Ein registriertes Konto in der offiziellen **MyHarvia 2** Smartphone-App.
2. Ihre gültigen Login-Daten:
   * **E-Mail-Adresse**
   * **Passwort**

*Hinweis: Wir empfehlen, ein separates Konto für ioBroker in der Harvia 2 App einzurichten und diese Zugangsdaten in der Instanz zu verwenden.*

---

## Gerätekonfiguration & Multi-Geräte-Unterstützung

### Automatische Erkennung (Discovery)
Wenn Sie das Feld **Geräte-ID** in den Adapter-Einstellungen leer lassen, sucht der Adapter beim Start automatisch nach Geräten, die mit Ihrem Konto verknüpft sind. Er verwendet das erste gefundene Gerät als aktive Einheit. Die erkannte ID wird im ioBroker-Log ausgegeben.

### Manuelle Geräte-ID
Für die meisten Benutzer mit einer einzigen Sauna ist die automatische Erkennung ausreichend. Es wird jedoch empfohlen, die erkannte ID aus dem Log zu kopieren und in die Konfiguration einzufügen, um eine stabile Verbindung zur spezifischen Hardware zu gewährleisten.

*Hinweis: Derzeit wird die Geräte-ID in der MyHarvia 2 App-Oberfläche nirgends angezeigt.*

### Mehrere Saunen
Wenn Ihr MyHarvia-Konto mehrere Steuereinheiten verwaltet (z. B. eine zu Hause und eine im Ferienhaus):
1. Erstellen Sie für jede Sauna eine eigene Instanz des Adapters (z. B. `harvia-fenix.0` und `harvia-fenix.1`).
2. Geben Sie die spezifische **Geräte-ID** für jede Einheit manuell in der jeweiligen Instanz-Konfiguration ein.
Dies ermöglicht es Ihnen, beide Saunen unabhängig voneinander mit eigenen Datenpunkten zu überwachen und zu steuern.

---

## Funktionen & Datenpunkte

Der Adapter bildet die Cloud-Zustände Ihrer Sauna in strukturierten ioBroker-Datenpunkten unter `harvia-fenix.0.*` ab.

### Verfügbare Datenpunkte
| Datenpunkt | Typ | Rolle | Zugriff | Beschreibung |
|---|---|---|---|---|
| `online` | boolean | `indicator.reachable` | Nur Lesen | Verbindungsstatus der Steuereinheit zur Cloud. |
| `doorSafety` | boolean | `indicator.safety` | Nur Lesen | Status der Türsicherung (z. B. `true`, wenn die Tür sicher geschlossen ist). |
| `errorMsg` | string | `text` | Nur Lesen | Aktuelle Fehlermeldungen oder Statustexte des Ofens. |
| `heatOn` | boolean | `switch.power` | Lesen/Schreiben | Hauptschalter, um den Saunaofen EIN (`true`) oder AUS (`false`) zu schalten. |
| `heaterPower` | number | `value.power` | Nur Lesen | *Hinweis:* Dieses Objekt wird von der API bereitgestellt, liefert aber derzeit oft `0 kW`. |
| `lightOn` | boolean | `switch.light` | Lesen/Schreiben | Schalter für die integrierte Saunabeleuchtung. |
| `panelTemp` | number | `value.temperature` | Nur Lesen | Temperaturmesswert direkt an der physischen Steuereinheit (Panel). |
| `remoteControl` | boolean | `indicator.state` | Nur Lesen | Zeigt an, ob die Fernstartfreigabe am Gerät aktuell aktiv ist. |
| `targetTemp` | number | `level.temperature` | Lesen/Schreiben | Zieltemperatur-Sollwert für die Saunakabine (z. B. `90 °C`). |
| `temp` | number | `value.temperature` | Nur Lesen | Die aktuelle Umgebungstemperatur in der Saunakabine (z. B. `17 °C`). |
| `readyNotified10Min` | boolean | `indicator` | Nur Lesen | Wird `true`, wenn die Sauna noch ca. 10 Minuten von der Zieltemperatur entfernt ist (13°C unter Ziel). |
| `targetReachedNotified` | boolean | `indicator` | Nur Lesen | Wird `true`, wenn die Sauna die eingestellte Zieltemperatur erfolgreich erreicht hat. |
| `totalBathingHours` | number | `value.number` | Nur Lesen | Historische kumulierte Betriebsstunden der Saunanutzung (`h`). |
| `totalOperatingHours`| number | `value.hours` | Nur Lesen | Gesamte Betriebsstunden des Systems (`h`). |
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

## ⚠️ KRITISCHER SICHERHEITSHINWEIS & HAFTUNGSAUSSCHLUSS

**Der Fernbetrieb eines Saunaofens unterliegt strengen Sicherheitsvorschriften!** Gemäß der europäischen Sicherheitsnorm **EN 60335-2-53** in Verbindung mit **EN 60335-1** sind Brandschutzmaßnahmen für Fernsteuerungssysteme zwingend erforderlich. Die Saunakabine muss mit einem zugelassenen Türsensor oder einem Sicherheits-Abschaltsystem ausgestattet sein. Dies stellt sicher, dass der Ofen nicht aus der Ferne oder per Timer gestartet werden kann, wenn ein brennbarer Gegenstand (z. B. ein Handtuch) auf oder in der Nähe des Ofens vergessen wurde.

* **Keine Haftung:** Der Entwickler dieses Adapters übernimmt absolut keine Verantwortung, Gewährleistung oder Haftung für Schäden, Brände, Verletzungen oder rechtliche Probleme, die aus der Nutzung oder Fehlkonfiguration dieser Software resultieren. Sie betreiben diese Integration vollständig auf eigenes Risiko.

---

## Kompatibilitätshinweis

* **Unterstützt:** **Harvia Fenix** Steuereinheiten, die über die **MyHarvia 2** App verwaltet werden.
* **NICHT unterstützt:** **Harvia Xenio** Serie (z. B. Xenio WiFi / CX001WIFI). Die Xenio-Serie basiert auf einem älteren Hardware-Ökosystem und verwendet die ältere *"MyHarvia for Xenio"* App, die grundlegend inkompatibel mit der von diesem Adapter verwendeten API ist.

---

## To-Do
* [ ] Auf offizielle Erlaubnis von Harvia zur Nutzung des Original-Logos warten
* [ ] Aufnahme des Adapters in das offizielle ioBroker `latest` Repository
* [ ] Aufnahme des Adapters in das offizielle ioBroker `stable` Repository

---

## Änderungsprotokoll (Changelog)
### **WORK IN PROGRESS**
* (meistermopper) Benachrichtigungs-Datenpunkte für Vorheizen und Ziel-Erreicht hinzugefügt
* (meistermopper) Logik für `remoteControl` korrigiert, sodass sie von `doorSafety` abhängt
* (meistermopper) Eine robuste und stabile lokale Test-Pipeline implementiert

## [Ältere Einträge](CHANGELOG_OLD.md)

---

## Markenhinweis
Harvia und MyHarvia 2 sind eingetragene Marken der Harvia Group. Dieser Adapter ist ein unabhängiges, gemeinschaftsbasiertes Open-Source-Projekt und wird weder offiziell von Harvia unterstützt, gesponsert noch betreut.

## Lizenz
MIT License

Copyright (c) 2026 meistermopper <meister.mopper@gmail.com>
