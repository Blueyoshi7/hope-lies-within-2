# Hope lies Within 2.0 Foundry System

Dies ist der V1-Prototyp des Foundry-VTT-Systems fuer **Hope lies Within 2.0**.

## Was V1 kann

- Foundry-Systemmanifest laden
- Charaktere, NSCs und Monster als Actor-Typen anlegen
- Attribute und Ressourcen im Character Sheet pflegen
- World-Skills automatisch aus je drei Attributen plus Bonus berechnen
- World-Skill-Checks in den Chat wuerfeln
- Skills, Waffen, Ruestung, Ausruestung, Verbrauchsitems und Materialien als Items anlegen
- einfache Skill- und Item-Sheets nutzen
- Aktionspunkte als echte Combat-Ressource verwenden
- Items, Waffen, Ruestungen und Skills aus JSON-Dateien importieren
- Import-Ordner automatisch nach Kategorie und Tier erstellen
- Accessories mit maximal 3 ausgeruesteten Plaetzen und Inventarlimit testen

## Installation zum lokalen Testen

1. Den gesamten Ordner `Foundry Game System HLW` in Foundrys Systemordner kopieren oder verlinken.
2. Der Ordnername sollte fuer den ersten Test `hope-lies-within-2` sein, weil die Templates unter diesem Systempfad referenziert werden.
3. Foundry starten.
4. Beim Erstellen einer Welt das System **Hope lies Within 2.0** auswaehlen.
5. Einen Actor vom Typ `character` erstellen und das Sheet testen.

## Installation per Manifest-URL

Sobald das System auf GitHub liegt, kannst du in Foundry diese Manifest-URL verwenden:

```text
https://raw.githubusercontent.com/Blueyoshi7/hope-lies-within-2/main/system.json
```

Die genaue Anleitung steht in [MANIFEST_URL_ANLEITUNG.md](MANIFEST_URL_ANLEITUNG.md).

## JSON-Import

Die Importdateien liegen unter `import/`. Als GM kannst du in der Foundry-Konsole importieren:

```js
await game.hlw.importAllJson()
```

Details und Beispielstrukturen stehen in [IMPORT_JSON_ANLEITUNG.md](IMPORT_JSON_ANLEITUNG.md).

Typische Foundry-Systempfade:

- macOS: `~/Library/Application Support/FoundryVTT/Data/systems/hope-lies-within-2`
- Windows: `%LOCALAPPDATA%/FoundryVTT/Data/systems/hope-lies-within-2`
- Linux: `~/.local/share/FoundryVTT/Data/systems/hope-lies-within-2`

## V1-Regelbasis

```text
World-Skill-Check = 1W20 + Attribut 1 + Attribut 2 + Attribut 3 + Bonus
```

Der Bonus ist in V1 manuell. Automatische Boni aus Jobs, Titeln, Insignien, Ausruestung, Sets und temporaeren Effekten kommen spaeter.

## Naechste sinnvolle Schritte

1. System in Foundry laden und den ersten Charakter erstellen.
2. World-Skill-Wurf im Chat testen.
3. Einen Spieler-Skill und eine Waffe als Item anlegen.
4. Combat Tracker mit einem Charakter und einem Monster testen.
5. Danach entscheiden, ob als naechstes Cooldown-Automation, Item-Import oder Sheet-Polish kommt.
