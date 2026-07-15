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

Für weitere Informationen über Harvia und deren Saunasteuerungen besuche bitte die [offizielle Harvia-Website](https://www.harvia.com).

---

## Voraussetzungen

Um diesen Adapter zu nutzen, benötigst du:
1. **Node.js >= 22**
2. Ein registriertes Konto in der offiziellen **MyHarvia 2** Smartphone-App.
3. Gültige Login-Daten:
   * **E-Mail-Adresse**
   * **Passwort**

*Hinweis: Es wird ein separates Konto für ioBroker in der Harvia 2 App empfohlen und diese Zugangsdaten in der Instanz zu verwenden.*

---

## Gerätekonfiguration & Multi-Geräte-Unterstützung

### Automatische Erkennung (Discovery)
Wenn du das Feld **Geräte-ID** in den Adapter-Einstellungen leer lässt, sucht der Adapter beim Start automatisch nach Geräten, die mit deinem Konto verknüpft sind. Er verwendet das erste gefundene Gerät als aktive Einheit. Die erkannte ID wird im ioBroker-Log ausgegeben.

### Manuelle Geräte-ID
Für die meisten Benutzer mit einer einzigen Sauna ist die automatische Erkennung ausreichend. Es wird jedoch empfohlen, die erkannte ID aus dem Log zu kopieren und in die Konfiguration einzufügen, um eine stabile Verbindung zur spezifischen Hardware zu gewährleisten.

*Hinweis: Derzeit wird die Geräte-ID in der MyHarvia 2 App-Oberfläche nirgends angezeigt.*

### Mehrere Saunen
Wenn dein MyHarvia-Konto mehrere Steuereinheiten verwaltet (z. B. eine zu Hause und eine im Ferienhaus):
1. Erstelle für jede Sauna eine eigene Instanz des Adapters (z. B. `harvia-fenix.0` und `harvia-fenix.1`).
2. Gib die spezifische **Geräte-ID** für jede Einheit manuell in der jeweiligen Instanz-Konfiguration ein.
Dies ermöglicht es, beide Saunen unabhängig voneinander mit eigenen Datenpunkten zu überwachen und zu steuern.

### Geteilte / Freigegebene Konten (Gäste) & die Partner-ID

#### Was ist die Partner-ID?
Die MyHarvia-Cloud-Infrastruktur unterteilt Geräte, Benutzer und Apps in verschiedene „Partner-Organisationen“ (Partner Organizations). Beispielsweise entspricht die offizielle **MyHarvia 2** Smartphone-App der Partner-ID `ORG/prod:0:6656:0`. 

Normalerweise liest der Adapter beim Login das JSON-Web-Token (JWT) des Benutzers aus und extrahiert die Partner-ID automatisch aus dem Feld `custom:org`. Anschließend fragt er die Harvia-Cloud-API mit dieser ID ab, um verbundene Geräte zu finden.

#### Das Problem bei geteilten/freigegebenen Konten
Wenn ein anderer Benutzer (der Hauptnutzer/Besitzer) seine Sauna in der MyHarvia 2 App für dich freigegeben hat:
1. Ist dein Gast-Konto mit einer anderen Partner-ID verknüpft (z. B. `ORG/prod:0:6749` oder einer anderen individuellen ID).
2. Wenn der Adapter die Geräteabfrage mit deiner Gast-Partner-ID durchführt, liefert die Harvia-API eine leere Liste zurück (`{"devices":[]}`) und die Sauna wird nicht gefunden.
3. Um die freigegebene Sauna zu finden und zu steuern, müssen die API-Anfragen **mit der Partner-ID des Besitzers** gesendet werden.

#### Wie findet man die Partner-ID des Besitzers?
Es gibt zwei einfache Wege, die Partner-ID des Besitzers zu ermitteln:
1. **Standard-App:** Wenn der Besitzer die offizielle, normale **MyHarvia 2** Smartphone-App nutzt, lautet die Partner-ID **`ORG/prod:0:6656:0`**.
2. **Aus dem ioBroker-Log:** Wenn der Besitzer den `harvia-fenix` Adapter bereits nutzt, kann er beim Starten des Adapters in das ioBroker-Log schauen. Dort wird eine Zeile wie folgt ausgegeben:
   `Using partner ID from user token: ORG/prod:0:XXXX`
   Der Besitzer kann diese ID kopieren und dem Gast-Nutzer mitteilen.

#### So richtest du ein geteiltes/freigegebenes Konto ein:
1. Trage deine **eigenen Zugangsdaten** (deine E-Mail-Adresse und dein Passwort) in den Adapter-Einstellungen ein.
2. Trage die **Partner-ID des Hauptnutzers/Besitzers** in das Feld **Partner-ID (Optional)** ein (siehe oben, wie man diese findet).
3. Wenn du das Feld **Geräte-ID** leer lässt, sucht der Adapter automatisch mit den Gast-Anmeldedaten, aber unter Verwendung der Partner-ID des Besitzers, nach der geteilten Sauna und findet diese.

---

## Funktionen & Datenpunkte

Der Adapter bildet die Cloud-Zustände deiner Sauna in strukturierten ioBroker-Datenpunkten unter `harvia-fenix.0.*` ab.

### Verfügbare Datenpunkte
| Datenpunkt | Typ | Rolle | Zugriff | Beschreibung |
|---|---|---|---|---|
| `online` | boolean | `indicator.reachable` | Nur Lesen | Verbindungsstatus der Steuereinheit zur Cloud. |
| `doorSafety` | boolean | `indicator.safety` | Nur Lesen | Status der Türsicherung (z. B. `true`, wenn die Tür sicher geschlossen ist). |
| `remoteControl` | boolean | `indicator` | Nur Lesen | Status der Fernstart-Bereitschaft. Wenn `false`, wird ein Starten des Ofens lokal blockiert. |
| `errorMsg` | string | `text` | Nur Lesen | Aktuelle Fehlermeldungen oder Statustexte des Ofens. |
| `heatOn` | boolean | `switch.power` | Lesen/Schreiben | Hauptschalter, um den Saunaofen EIN (`true`) oder AUS (`false`) zu schalten. |
| `heaterPower` | number | `value.power` | Nur Lesen | *Hinweis:* Dieses Objekt wird von der API bereitgestellt, liefert aber derzeit oft `0 kW`. |
| `lightOn` | boolean | `switch.light` | Lesen/Schreiben | Schalter für die integrierte Saunabeleuchtung. |
| `panelTemp` | number | `value.temperature` | Nur Lesen | Temperaturmesswert direkt an der physischen Steuereinheit (Panel). |
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

## Fehlerbehebung (Troubleshooting)

### Häufige API-Fehler & Statusmeldungen in `errorMsg`:

* **`Action blocked (403 Forbidden). Remote start authorization (Safety Loop) at panel might not be active.`**
  * **Ursache:** Die europäische Sicherheitsnorm schreibt vor, dass ein Fernstart nur aktiv sein darf, wenn der Sicherheitskreis/Türsensor geschlossen ist und der Fernstart physisch am Saunapanel scharf geschaltet wurde.
  * **Lösung:** Schließe die Saunatür und drücke am physischen Harvia-Bedienfeld die **Fernstart**-Taste. Das Fernstart-Symbol auf dem Display muss leuchten. Erst danach ist die Steuerung über den Adapter freigegeben.
* **`Cloud lock: Device busy, command discarded.` (Als Debug-Log)**
  * **Ursache:** Die Harvia-API blockiert Befehle, wenn sie in zu schneller Folge gesendet werden (z. B. durch schnelles Klicken in der Vis), um die Hardware zu schützen.
  * **Lösung:** Warte einige Sekunden zwischen den Befehlen. Der Adapter verwirft zu schnelle Klicks automatisch, um eine API-Sperre zu verhindern.

---

## To-Do
* [ ] Auf offizielle Erlaubnis von Harvia zur Nutzung des Original-Logos warten
* [ ] Aufnahme des Adapters in das offizielle ioBroker `latest` Repository
* [ ] Aufnahme des Adapters in das offizielle ioBroker `stable` Repository

---

## Änderungsprotokoll (Changelog)

### **WORK IN PROGRESS**
* (meistermopper) Dokumentationsordnerstruktur (docs) und automatisches README-Synchronisationsskript hinzugefügt

### 0.2.4 (2026-07-08)
* (meistermopper) npm install im Workflow einkommentiert, um Lockfile-Sync-Probleme zu beheben

### 0.2.3 (2026-07-08)
* (meistermopper) Abhängigkeiten aktualisiert (eslint-config, commitlint) und package-lock.json korrigiert

### 0.2.2 (2026-07-05)
* (meistermopper) Deutsche Log-Nachrichten und States korrigiert (auf Englisch übersetzt)
* (meistermopper) prepare-Skript aus der package.json entfernt
* (meistermopper) Plausibilitätsprüfung für pollInterval in main.ts hinzugefügt
* (meistermopper) Inline-Übersetzungen in jsonConfig in Standard-i18n-Dateien ausgelagert und fehlende Übersetzungen behoben

### 0.2.1 (2026-06-30)
* (meistermopper) Fehler in jsonConfig.json behoben und Übersetzungen hinzugefügt
* (meistermopper) Abhängigkeiten axios und biome aktualisiert

### 0.2.0 (2026-06-25)
* (meistermopper) Manuelle Partner-ID und Unterstützung für geteilte/freigegebene Konten hinzugefügt, Entladevorgang-Prüfungen verbessert, Dokumentation aktualisiert

## [Ältere Einträge](CHANGELOG_OLD.md)

---

## Markenhinweis
Harvia und MyHarvia 2 sind eingetragene Marken der Harvia Group. Dieser Adapter ist ein unabhängiges, gemeinschaftsbasiertes Open-Source-Projekt und wird weder offiziell von Harvia unterstützt, gesponsert noch betreut.

## Lizenz
MIT License

Copyright (c) 2026 meistermopper <meister.mopper@gmail.com>
