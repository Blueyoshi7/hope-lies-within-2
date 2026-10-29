# Hope lies Within 2.0 – Foundry VTT System

Foundry-VTT-System (Version 14) für das Pen-&-Paper **Hope lies Within**, Regelstand **Kanon 2.0**.

## Installation

In Foundry unter *Game Systems → Install System* diese Manifest-URL eintragen:

```text
https://raw.githubusercontent.com/Blueyoshi7/hope-lies-within-2/main/system.json
```

## Regeln (Kanon 2.0)

- **Werte:** STR, DEX, CON, INT, WIS, CHA, AGL, SPE, EDU, SOU. Jeder Wert startet bei 1. Level 1: 5 freie Punkte + 1 Herkunftspunkt, bis Level 10 +1 pro Level, ab Level 11 +2 pro Level. Der Bogen zeigt verteilte und erlaubte Punkte.
- **Klasse:** ergibt sich aus der Verteilung der Werte (Basic ab 10 verteilten Punkten, T1 ab 20, T2 ab 40, T3 ab 60). Der GM wählt sie im Bogen aus einem Dropdown mit allen Klassen; der Vorschlag aus der Wertverteilung ist mit ★ markiert (Story- und Sonderklassen sind ebenfalls wählbar). Beim Wählen bekommt der Charakter den Klassen-Skill; Skills früherer Klassen bleiben erhalten.
- **Kampfwerte:** HP = 20 + 2 × Level + 3 × CON + Rüstungs-HP · Rüstwert = 8 + ⌊(AGL + DEX) ÷ 4⌋ · Magieresistenz = 8 + ⌊(WIS + SOU) ÷ 4⌋ · Blockwert höchstens 8 · Bewegung = 3 + ⌊SPE ÷ 6⌋ · Initiative = 1W20 + ⌊SPE ÷ 2⌋ · Inventar = 10 + STR.
- **Angriff:** 1W20 + Genauigkeit (⌊Primärwert ÷ 3⌋) gegen Rüstwert (physisch) oder Magieresistenz (magisch). Natürliche 20 verdoppelt die Schadenswürfel, natürliche 1 verfehlt. Schaden = Skill + ausgerüstete Waffe + ⌊Primär ÷ 4⌋ + ⌊Sekundär ÷ 8⌋ − Blockwert, mindestens 1. Heil-Skills heilen ohne Trefferwurf.
- **Zug:** Bewegung + 1 Aktion + 1 Schnellaktion + 1 Reaktion. Skills mit Einsatz „Schnellaktion“ verbrauchen die Schnellaktion. Abwehrhaltung: RW und MR +2 bis zum nächsten eigenen Zug.
- **World-Skills (11):** 1W20 + Summe der drei Werte gegen eine Schwierigkeit. Natürliche 20 gelingt immer, natürliche 1 misslingt immer.
- **Währung:** Kes. 100 Silber-Kes (SK) = 1 Gold-Kes (GK). Eingaben wie „1 GK 20 SK“ funktionieren.
- **Korruption:** 0–100, Stufen bei 25, 50, 75; 100 ist der Kipppunkt.

Die vollständigen Regeltabellen liegen unter [`docs/regeln`](docs/regeln), die Spielerbücher unter [`docs/spieler`](docs/spieler).

## Daten importieren

Als GM in der Item-Sidebar auf **HLW JSON Import** klicken (oder im Inventar auf „JSON importieren“). Importiert werden in Ordnern nach Kategorie und Rang:

| Datei | Inhalt |
|---|---|
| `import/weapons.json`, `armor.json`, `accessories.json` | Ausrüstung mit Schadenswürfel, HP-Würfel und Boni |
| `import/equipment.json`, `consumables.json`, `food-drink.json`, `materials.json`, `junk.json` | Abenteurerbedarf, Tränke, Gerichte, Grundmaterialien, Abyss-Steine, Müll |
| `import/natural.json`, `minerals.json` | Pflanzen und Mineralien mit Fundgebiet |
| `import/skills.json`, `class-skills.json` | Skills und Klassen-Skills |
| `import/monsters.json` | Bestiarium als Monster-Actors (Werte nach Rang, Rolle und Größe) |

Alle Preise sind in Kes (`priceSk` in Silber-Kes), Ränge E bis SS. Rüstungs-HP werden beim Appraisal gewürfelt: im Item-Bogen auf „Würfeln“ klicken.

**Bilder:** Alle Skills, Klassen-Skills, Waffen, Rüstungen und Accessoires haben eigene Bilder im Stil der Charakterporträts (`assets/icons`), alle übrigen Gegenstände ein passendes Symbol aus Foundrys Bibliothek. Beim ersten Start einer Welt mit dieser Version ersetzt das System als GM einmalig die alten Foundry-Symbole durch die eigenen Bilder (Item-Sidebar, Charaktere und nicht verknüpfte Figuren auf Szenen); selbst gewählte Bilder bleiben. Von Hand: `game.hlw.aktualisiereBilder()`, `game.hlw.aktualisiereBilder({ alle: true })` ersetzt auch schon gesetzte Foundry-Symbole.

## Charakterbogen und Kampfleiste

- **Charakter:** Figur mit Ausrüstungsplätzen (Kopf, Brust, Arme, Beine, Kette, Ohrring, Ring, Armband, Haupt- und Nebenhand), Rahmenfarbe nach Rang. Rechts Kampfwerte, Werte und Waffen, darunter das Inventar als Raster mit Filtern und die World-Skills. Klick auf einen Gegenstand öffnet ein Menü (Ausrüsten/Ablegen, Benutzen, Details, Bearbeiten, An Ziel geben, Wegwerfen). Rüstung tauscht automatisch mit dem Teil auf demselben Platz.
- **Skills:** aktive und passive Skills getrennt. Passive Skills wirken immer und brauchen keine Aktion; feste Zahlen aus dem Skilltext (z. B. +1 Bewegung, +3 Rüstwert, +2 HP pro Level) sind schon in den Werten eingerechnet. Der GM kann im Skill eigene Zahlen eintragen.
- **Insignien:** drei Slots, alle wirken; darunter die ruhenden Insignien. Nur der GM bearbeitet sie.
- **Notizen:** Profil, was gerade passiv wirkt, GM-Boni und ein freies Notizfeld.
- **Kampfleiste:** Porträt mit HP-Ring, Aktion/Schnellaktion/Reaktion, Bewegung, ausgerüstete Waffen und aktive Skills als Bildtasten mit Tooltip und Abklingzeit, passive Skills als kleine Symbole. Foundrys Makro-Leiste ist im Kampf ausgeblendet.

## Skills und Gegenstände geben

Als GM im Charakterbogen: Tab *Skills* → **Skill geben**, Tab *Inventar* → **Gegenstand geben**. Ein Suchfenster listet alle Einträge der Welt; ein Klick legt eine Kopie beim Charakter an. Skill-Slots (Level 1: 3, ab Level 4: 4, 8: 5, 13: 6, 18: 7, 23: 8, 30: 9, 37: 10) werden geprüft, Klassen-Skills zählen nicht. Alternativ einen Eintrag aus der Item-Sidebar auf den Bogen ziehen.

## NSC-Gespräch

- Der GM öffnet Gespräche: im Token-HUD der NSC-Figur öffnet die **Sprechblase** das Fenster nur für dich, das **Personen-Symbol** zeigt es sofort allen. So kannst du entscheiden, ob die Gruppe überhaupt eine Antwort bekommt.
- Das Fenster ist rahmenlos: links das Porträt, rechts alles, was die Gruppe über den NSC weiß, darunter eigene Notizen (pro Spieler gespeichert).
- Optional (Spieleinstellungen → „Spieler öffnen NSC-Gespräche selbst“): Spieler dürfen das Gespräch per Doppelklick selbst öffnen. Standard ist aus; dann bekommen Spieler beim Doppelklick nur den Hinweis, die Person am Tisch anzusprechen.
- Der Name steht für Spieler zuerst als „???“. Jeder kann selbst einen Namen eintragen. Der GM gibt den echten Namen per Haken frei.
- Der GM öffnet das Gespräch über den Sprechblasen-Knopf im Token-HUD, legt Einträge an, gibt sie frei und kann das Gespräch mit „Allen zeigen“ bei allen öffnen.

## Lindhain (Startdorf)

Als GM in der Konsole oder per Makro:

```js
game.hlw.erstelleLindhain()              // neu anlegen
game.hlw.erstelleLindhain({ neu: true })  // Szene und Ortsliste neu aufbauen, NSC bleiben
```

Legt die Szene „Lindhain“ an: 64 × 64 Felder (1 Feld = 1,5 m), 10 Gebäude mit Innenräumen, Wänden und Türen, Dächer, die ausblenden, sobald eine eigene Figur das Haus betritt, 8 Dorf-NSC mit Porträts und Gesprächsdaten sowie die Ortsliste „Lindhain – Orte“ im Journal (ohne Marker auf der Karte; alte Buch-Marker entfernt das System beim ersten GM-Start, sonst `game.hlw.entferneOrtsmarker()`). Verdecktes GM-Wissen trägt der GM im Gesprächsfenster selbst ein.

## Struktur

```text
system.json, template.json   Manifest und Datenmodell
scripts/hlw.js               Actor, Bögen, Kampf, Import
scripts/hlw-regeln.js        Regeln aus Kanon 2.0 (Kampfwerte, Punkte, Klassen, Kes)
scripts/hlw-talk.js          NSC-Gespräch
scripts/hlw-szenen.js        Szenenaufbau Lindhain
scripts/hlw-geben.js         GM-Fenster „Skill geben“ / „Gegenstand geben“
styles/hlw-bogen.css         Charakterbogen und Kampfleiste
data/klassen.json            Klassen mit Lvl-Satz
import/                      Daten für den JSON-Import
assets/                      Karten, Gebäude, Dächer, NSC-Porträts, Tokens und Bilder (icons/)
docs/                        Spielerbücher und Regeltabellen
```

Die Daten werden aus den Kanon-2.0-Tabellen erzeugt. GM-Material (Weltgeschichte, Kampagne, Wächter) ist bewusst nicht in diesem öffentlichen Repository.
