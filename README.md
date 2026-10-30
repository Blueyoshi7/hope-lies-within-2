# Hope lies Within 2.0 – Foundry VTT System

Foundry-VTT-System (Version 14) für das Pen-&-Paper **Hope lies Within**, Regelstand **Kanon 2.0**.

## Installation

In Foundry unter *Game Systems → Install System* diese Manifest-URL eintragen:

```text
https://raw.githubusercontent.com/Blueyoshi7/hope-lies-within-2/main/system.json
```


**3D-Würfel (optional):** Mit dem Modul [Dice So Nice](https://gitlab.com/riccisi/foundryvtt-dice-so-nice) rollen alle automatischen Würfe als 3D-Würfel über den Bildschirm: Angriffe, Schaden, Heilung, World-Skill-Proben, Appraisal und Zähmen. Ohne das Modul spielt Foundry den Würfelklang.
## Regeln (Kanon 2.0)

- **Werte:** STR, DEX, CON, INT, WIS, CHA, AGL, SPE, EDU, SOU. Jeder Wert startet bei 1. Level 1: 5 freie Punkte + 1 Herkunftspunkt, bis Level 10 +1 pro Level, ab Level 11 +2 pro Level. Der Bogen zeigt verteilte und erlaubte Punkte.
- **Klasse:** ergibt sich aus der Verteilung der Werte (Basic ab 10 verteilten Punkten, T1 ab 20, T2 ab 40, T3 ab 60). Der GM wählt sie im Bogen aus einem Dropdown mit allen Klassen; der Vorschlag aus der Wertverteilung ist mit ★ markiert (Story- und Sonderklassen sind ebenfalls wählbar). Beim Wählen bekommt der Charakter den Klassen-Skill; Es gibt immer nur den Klassen-Skill der aktuellen Klasse; beim Wechsel fällt der alte weg.
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
| `import/equipment.json`, `consumables.json`, `food-drink.json`, `materials.json`, `junk.json` | Abenteurerbedarf, Tränke, Gerichte, Grundmaterialien, EXP- und Abyss-Kristalle, Rucksäcke, Müll |
| `import/natural.json`, `minerals.json` | Pflanzen und Mineralien mit Fundgebiet |
| `import/skills.json`, `class-skills.json` | Skills und Klassen-Skills |
| `import/monsters.json` | Bestiarium als Monster-Actors (Werte nach Rang, Rolle und Größe) |

Alle Preise sind in Kes (`priceSk` in Silber-Kes), Ränge E bis SS. Rüstungs-HP werden beim Appraisal gewürfelt: im Item-Bogen auf „Würfeln“ klicken.

**Bilder:** Alle Skills, Klassen-Skills, Waffen, Rüstungen und Accessoires haben eigene Bilder im Stil der Charakterporträts (`assets/icons`), alle übrigen Gegenstände ein passendes Symbol aus Foundrys Bibliothek. Beim ersten Start einer Welt mit dieser Version ersetzt das System als GM einmalig die alten Foundry-Symbole durch die eigenen Bilder (Item-Sidebar, Charaktere und nicht verknüpfte Figuren auf Szenen); selbst gewählte Bilder bleiben. Von Hand: `game.hlw.aktualisiereBilder()`, `game.hlw.aktualisiereBilder({ alle: true })` ersetzt auch schon gesetzte Foundry-Symbole.

## Spielercharaktere

- **Anlegen (GM):** In der Actor-Sidebar auf **Spielercharakter anlegen** klicken: Name, Spieler und Herkunft (A–D) wählen. Der Charakter gehört dann dem Spieler, ist seine Spielfigur, sein Token ist verknüpft, und der Herkunftspunkt steckt schon im passenden Wert. Dazu zwei Bilder (optional): **Token-Bild** (rund, für die Karte) und **Figur** (ganzer Körper, für den Bogen).
- **Punkte verteilen (Spieler):** Im Bogen erscheint „N Punkte frei“. Mit + und − verteilen, mit **Speichern** bestätigen. Gespeicherte Punkte sind fest. Bei Level 1 höchstens +3 pro Wert (Herkunftswert einen mehr).
- **Klasse als Überraschung:** Während des Verteilens sieht der Spieler keine Klasse. Beim Speichern wird sie bestimmt und groß aufgedeckt; der Klassen-Skill kommt automatisch. Nach jedem Level-Up kann der Spieler neue Punkte jederzeit verteilen, und die Klasse kann sich dabei ändern.
- **GM:** Level und EXP stellt nur der GM. Werte kann der GM direkt eintragen. Im Klassen-Dropdown heißt „automatisch“: Klasse nach Verteilung; eine fest gewählte Klasse (z. B. Story-Klasse) bleibt, bis der GM wieder „automatisch“ wählt.
- **Freie Wahl:** Waffen und Skills sind an keine Klasse und keine Mindestwerte gebunden. Magie braucht keine magische Waffe; magische Waffen geben Magischer Schaden +1.
- **Skill-Orbs (Glücksspiel):** Der GM gibt Skill-Orbs T1, T2 oder T3 („Gegenstand geben“). Klick auf den Orb → **Appraisal**: 1W20 + SOU gegen 10 (T1), 15 (T2) oder 20 (T3). Gelingt es, verschwindet der Orb und ein **bestimmter Skill-Orb** wird zufällig gezogen: T1 → Rang D (5 % Rang C) · T2 → Rang D oder C (5 % Rang B) · T3 → Rang C oder B (5 % Rang A). Klassen- und Abyss-Skills sind nie dabei. Die Chatkarte zeigt, ob der Skill mehr oder weniger wert ist als der Orb. Misslingt der Wurf, bleibt der Orb versiegelt (ein Versuch pro Orb; GM: „Neuer Versuch“). Mit dem Skill Adlerauge gelingt jedes Appraisal. Ein bestimmter Skill-Orb zeigt Namen und alle Werte; **Lernen** verbraucht ihn und belegt einen Skill-Slot. Orbs lassen sich weitergeben und zählen als Inventarplatz.
- **Skill ansehen:** Klick auf den Namen eines Skills (oder „Ansehen“ bei einem Orb) zeigt Beschreibung und alle festen Werte: Rang, Art, Einsatz (Aktion, Schnellaktion, Reaktion, Passiv), Reichweite, Abklingzeit, Schaden oder Heilung, Schutz, Ziele, Fläche, Dauer, Skalierung und den Zusatzeffekt bei 100 % Meisterung. Das gilt auch für Klassen-Skills. Der GM kann von dort aus bearbeiten (alle Werte inklusive Ziele, Schutz, Fläche und Dauer); was er so ändert, wird gespeichert und bei späteren automatischen Wertübernahmen nicht mehr überschrieben. Fernkampf-Skills gehen mit jeder Waffe; ohne Bogen wird die Waffe (oder etwas anderes) geworfen.
- **Lernleiste:** Jeder gelernte Skill hat eine Leiste von 0 bis 100 %: +1 % pro Einsatz (passive Skills +1 % pro Kampf). Bei 100 % ist er gemeistert und bekommt seinen eigenen Zusatzeffekt (z. B. Schaden +2, Abklingzeit −1, Doppelstoß trifft dreimal, Kettenblitz springt weiter). Zahlen wie Schaden, Heilung, Reichweite und Abklingzeit rechnet das System selbst. Skills, die Charaktere vor diesem Update hatten, gelten als gelernt.

## Charakterbogen und Kampfleiste

- **Bilder:** Jeder Charakter und NSC hat zwei Bilder. Oben links das Token-Bild (Klick als GM: ändern, gilt auch für alle Figuren auf den Karten), in der Mitte die Figur (Klick als GM: ganzes Körperbild wählen). NSC nehmen als Figur ihr Gesprächsporträt, solange keine eigene gesetzt ist. Figur und Slots skalieren gemeinsam mit der Fensterbreite.
- **Charakter:** Figur mit Ausrüstungsplätzen (Kopf, Brust, Arme, Beine, Kette, Ohrring, Ring, Armband, Haupt- und Nebenhand), Rahmenfarbe nach Rang. Rechts Kampfwerte, Werte und Waffen, darunter das Inventar als Raster mit Filtern und die World-Skills. Klick auf einen Gegenstand öffnet ein Menü (Ausrüsten/Ablegen, Benutzen, Details, Bearbeiten, An Ziel geben, Wegwerfen). Rüstung tauscht automatisch mit dem Teil auf demselben Platz.
- **Skills:** aktive und passive Skills getrennt. Passive Skills wirken immer und brauchen keine Aktion; feste Zahlen aus dem Skilltext (z. B. +1 Bewegung, +3 Rüstwert, +2 HP pro Level) sind schon in den Werten eingerechnet. Der GM kann im Skill eigene Zahlen eintragen.
- **Insignien:** drei Slots, alle wirken; darunter die ruhenden Insignien. Nur der GM bearbeitet sie: „Aus Liste wählen“ öffnet alle 77 Insignien des Kanons, oder er schreibt eine eigene hinein. Feste Werte im Wirkungstext (z. B. „Naturkunde +3“, „Initiative +5“, „Max-HP +15 %“) rechnet das System automatisch; Bedingtes („einmal pro Kampf …“, „gegen Untote …“) bleibt Tischregel. Die Insignien-Bilder liegen nicht im System, sondern im Foundry-Datenordner unter `hlw-insignien/`.
- **Notizen:** Profil, was gerade passiv wirkt, GM-Boni und ein freies Notizfeld.
- **Kampfleiste:** Porträt mit HP-Ring, Aktion/Schnellaktion/Reaktion, Bewegung, ausgerüstete Waffen und aktive Skills als Bildtasten mit Tooltip und Abklingzeit, passive Skills als kleine Symbole. Foundrys Makro-Leiste ist im Kampf ausgeblendet.

## Monster, Zähmen und Gefährten

- **Besiegt und EXP:** Fällt ein Monster auf 0 HP, bekommt sein Token den Totenkopf und gilt im Kampf als besiegt (mit „Besiegte Kampfteilnehmer überspringen“ in den Einstellungen des Kampftrackers wird sein Zug übersprungen). Wer es mit einem Angriff oder Skill besiegt, bekommt automatisch seine EXP (steht im Monsterbogen; Gefährten zählen für ihren Besitzer). In den Spieleinstellungen umstellbar: EXP an alle Spielercharaktere im Kampf. Der GM kann im Token-HUD eines Monsters mit dem Totenkopf-Knopf ein Monster von Hand als tot markieren (und wählen, wer die EXP bekommt) oder wiederbeleben. EXP gibt es pro Monster nur einmal; 0 HP von Hand eintragen markiert nur als tot. Reicht es für ein Level-Up, sagt das die Chatkarte (Level-Up bei der Gilde).

- **Monster:** Alle 74 Monster aus dem Bestiarium haben eigene Bilder und runde Tokens (Rahmen: Holz normal, Silber Elite, Gold Boss), ihren Angriff und 1–6 Monster-Skills (aus Merkmalen, Rolle und Besonderheit). Im Bogen stehen **Verhalten** (friedlich, scheu, territorial, aggressiv) und ob das Monster **zähmbar** ist. Vorhandene Welten werden beim ersten GM-Start einmalig nachgezogen (`game.hlw.aktualisiereBestiarium()`).
- **Zähmen:** nur Tier-Klassen (Tierbändiger bis Rang D, Tiermeister bis C, Bestienmeister und Bestienkönig bis B) über ihren Klassen-Skill **Zähmen**: Monster als Ziel markieren, Skill einsetzen. 1W20 + Tierkunde + Klassenbonus gegen den Probenwert. Bei Erfolg wird das Monster zum Gefährten des Charakters (eigene Figur, gehört dem Spieler).
- **Gefährte:** belegt die Nebenhand (keine zweite Waffe, kein Schild). Rufen kostet die Schnellaktion; er bleibt so viele Runden wie die Klasse erlaubt (2/3/4), danach 2 Runden Pause. Er handelt im Zug seines Besitzers: Figur auswählen, die Kampfleiste zeigt seine Angriffe und Skills. Bei 0 HP kehrt er verletzt zurück (lange Rast nötig). Der GM kann im Menü des Nebenhand-Platzes „Lange Rast“ und „Freilassen“ wählen.

Die vollständigen Regeln stehen in [`docs/regeln/Zähmen und Gefährten.csv`](docs/regeln).

## Skills und Gegenstände geben

Als GM im Charakterbogen: Tab *Skills* → **Skill geben**, Tab *Inventar* → **Gegenstand geben**. Ein Suchfenster listet alle Einträge der Welt; ein Klick legt eine Kopie beim Charakter an. Skill-Slots (Level 1: 3, ab Level 4: 4, 8: 5, 13: 6, 18: 7, 23: 8, 30: 9, 37: 10) werden geprüft, Klassen-Skills zählen nicht. Alternativ einen Eintrag aus der Item-Sidebar auf den Bogen ziehen.

## NSC und Gespräche

- **Rechtsklick auf eine NSC-Figur** (GM): Neben dem Token-HUD erscheint ein Menü mit **Sprechen**, **Handeln** (nur wenn der NSC Waren hat) und **Quests** (nur wenn er welche hat). Jeder Eintrag öffnet das Gesprächsfenster sofort bei allen; „Nur für mich öffnen“ zum Vorbereiten.
- **Gespräch:** Nur du sprichst. Der aktuelle Satz steht groß in der Mitte und erscheint bei allen Wort für Wort; kein Chatverlauf. Du schreibst, was der NSC sagt (Enter), oder **erzählst** etwas (kursiv). **Textbausteine** pro NSC (Begrüßung, Abschied, Handel, Sonstiges): Klick sagt sie sofort, Umschalt+Klick übernimmt sie ins Feld zum Anpassen; unter „Textbausteine bearbeiten“ legst du eigene an. Unter „Zuletzt gesagt“ kannst du frühere Sätze nochmal zeigen, ändern oder löschen.
- **Quests:** Im Reiter Quests schreibst und änderst du Titel, Rang, Text, Belohnung und Status. „Im Gespräch zeigen“ setzt die Quest als Karte in den Verlauf und bietet sie an; Spieler klicken „Annehmen“. Änderungen am Text erscheinen sofort auch in der Karte im Gespräch.
- **Handel:** Spieler kaufen und verkaufen selbst mit den Knöpfen „Kaufen“ und „Verkaufen“; Kes und Gegenstände wandern automatisch, du trägst nichts von Hand ein. Waren fügst du im Fenster per **Suche** hinzu (alle Gegenstände des Kanons und der Welt, mit Anzahl). In den **Händler-Einstellungen** legst du fest, zu wie viel % vom Marktwert der NSC verkauft, welche Warenarten er ankauft und zu wie viel % (Standard 40 %), und was er für alles andere zahlt (0 = kauft er nicht); dazu seine Kasse. Angekaufte Ware legt er wieder ins Angebot, zum Verkaufspreis. Ein fester Preis neben einer Ware gilt statt Marktwert × %. Lindhain: Hanne kauft Essen und Pflanzen (40 %), Jorun Waffen, Rüstung, Materialien und Minerale (50 %, verkauft zu 110 %), Oma Wendel Pflanzen und Verbrauchsgüter (40 %, anderes 5 %).
- **Wissen:** Einträge über den NSC, die du freigibst (oder per Sprechblase direkt im Gespräch sagen lässt), und die **Notizen der Gruppe**: Jeder Spieler kann Notizen zum NSC anlegen, alle sehen alle Notizen; gespeichert am NSC in der Welt. Der Name steht für Spieler zuerst als „???“, bis du ihn freigibst.
- **Werte:** NSC haben Level, Wertpunkte, Klasse, Waffen und manchmal Skills wie Spielercharaktere und kämpfen nach denselben Regeln. Im NSC-Bogen (nur GM) Level und Schwerpunkt wählen (Dorfbewohner, Handwerker, Kämpfer, Schütze, Magier, Heiler, Kundschafter) und „Werte verteilen“.
- Optional (Spieleinstellungen → „Spieler öffnen NSC-Gespräche selbst“): Spieler dürfen das Gespräch per Doppelklick selbst öffnen.

## Lindhain (Startdorf)

Als GM in der Konsole oder per Makro:

```js
game.hlw.erstelleLindhain()              // neu anlegen
game.hlw.erstelleLindhain({ neu: true })  // Szene und Ortsliste neu aufbauen, NSC bleiben
```

Legt die Szene „Lindhain“ an: 64 × 64 Felder (1 Feld = 1,5 m), 10 Gebäude mit Innenräumen, Wänden und Türen, Dächer, die ausblenden, sobald eine eigene Figur das Haus betritt, 8 Dorf-NSC mit Porträts, Gesprächsdaten, Level, Waffen, Waren und Quests (Hanne: Essen, Jorun: Waffen und Rüstung, Oma Wendel: Heilmittel) sowie die Ortsliste „Lindhain – Orte“ im Journal (ohne Marker auf der Karte; alte Buch-Marker entfernt das System beim ersten GM-Start, sonst `game.hlw.entferneOrtsmarker()`). Verdecktes GM-Wissen trägt der GM im Gesprächsfenster selbst ein. Wurde Lindhain mit einer älteren Version angelegt, bekommen die NSC Werte, Waren und Quests beim ersten GM-Start automatisch (sonst `game.hlw.lindhainAusstatten()`).


**Häuser und Türen (jede Szene):** Dächer (Kacheln mit Ausblenden) gehen für einen Spieler nur auf, wenn seine eigene Figur darunter steht, nicht beim Darüberfahren mit der Maus und nicht wegen NSC im Haus; Figuren unter einem geschlossenen Dach verraten sich auch nicht beim Darüberfahren. Der GM sieht immer hinein (Dächer halbdurchsichtig). Türen: Spieler klicken auf das Türsymbol, darüber erscheint „Geöffnet“, „Geschlossen“ oder „Verschlossen“. Der GM sperrt eine Tür mit Rechtsklick auf das Türsymbol ab oder auf („Abgesperrt“ / „Aufgesperrt“); abgesperrte Türen können Spieler nicht öffnen.
## Dashboard und Login-Hintergrund

Als GM in der Konsole oder per Makro:

```js
game.hlw.erstelleDashboard()              // Szene „Dashboard“ und Journal „Willkommen in Gaia“ anlegen
game.hlw.erstelleDashboard({ neu: true })  // beides neu aufbauen
game.hlw.dashboardAktualisieren()          // Steckbriefe von Hand neu zeichnen
```

- **Szene „Dashboard“** (in der Navigation „Willkommen“, 3840 × 2160, ohne Raster): Titel wie auf der Website, links die **Weltkarte** (Spieleransicht des Atlas von Gaia, als Kachel austauschbar), rechts **Die Gruppe** mit einem Steckbrief pro Spielercharakter (Bild, Name, Level, Klasse, Herkunft, Alter, Spieler) und unten **Erste Schritte**. Die Steckbriefe ziehen sich selbst nach, sobald sich Name, Bild, Level, Klasse, Herkunft oder Besitzer eines Charakters ändern; Gefährten zählen nicht.
- **Journal „Willkommen in Gaia“** (für alle lesbar): Willkommen, Dein Charakter, Proben, Kampf, Foundry, Am Tisch und die Weltkarte zum Zoomen. Ein Doppelklick auf die Symbole im Dashboard öffnet die Seiten. Nur Spielerwissen.
- **Login-Hintergrund:** In Foundrys Setup bei der Welt auf **Welt bearbeiten** → **Hintergrundbild** `systems/hope-lies-within-2/assets/dashboard/login-hintergrund.webp` eintragen und als **Thema der Beitrittsseite** „Minimal“ wählen. Dunkles Violett mit dem Logo in Weiß groß hinter dem Anmeldefenster, darunter „Hope lies within“; beim Thema „Standard“ verdecken die breiten Felder das Logo. Foundry zeigt das Bild immer mit halber Helligkeit, die Farben im Bild sind deshalb heller angelegt. `titel.webp` ist dieselbe Fläche mittig gesetzt (z. B. als Szenenhintergrund).

## Kristalle und Rucksäcke

- **EXP-Kristalle:** Jedes besiegte Monster gibt weniger EXP direkt (40 % des alten Werts) und legt dafür EXP-Kristalle seines Rangs (D–S) ins Inventar dessen, der es besiegt hat (Normal 1, Elite 2, Boss 4, Diener 25 %, Rang E 50 %). Im Inventar: **Verwenden** (EXP), **An Ziel geben** (auch an Charaktere anderer Spieler, der GM bucht es) oder bei einem Händler verkaufen.
- **Abyss-Kristalle:** Korrumpierte Monster und Abyss-Wesen lassen Abyss-Kristalle: mehr EXP, aber Korruption beim Verwenden. Im Kampf: **Im Kampf einsetzen** (Schnellaktion).
- **Gilde und Schwarzmarkt:** In den Händler-Einstellungen eines NSC (Gesprächsfenster → Handel) gibt es „Gilde: kauft Kristalle zum vollen Wert“ und „Schwarzmarkt: Abyss-Kristalle zum doppelten Wert“. Kessa Dorn in Lindhain ist Gilde.
- **Rucksäcke S/M/L** (10/20/30 Plätze) belegen die Nebenhand. Ausgerüstet erscheint im Bogen der Tab **Rucksack**; Gegenstände per Menü „In den Rucksack“ oder durch Ziehen einpacken. Was im Rucksack liegt, zählt nicht fürs Inventar.

## Todeswurf und Heiltränke

- **0 HP:** Ein Spielercharakter liegt am Boden und kann sich nicht bewegen. Im Kampf-HUD (oder oben im Bogen) erscheint **Todeswurf**: 1W20, ab 10 steht er mit 1 HP auf. Sonst ist er **gewurzelt** (Rooted): noch 3 Runden, am Anfang jedes eigenen Zugs läuft eine ab, danach stirbt er.
- **Retten:** Ein anderer markiert ihn als Ziel und nimmt im HUD **Gegenstand** oder im Inventar **Verabreichen** (Heiltrank, Salbe, Verband; direkt daneben, kostet die Aktion). Heil-Skills retten genauso. Tote kann nur der GM zurückholen.
- **Heilgegenstände:** „Benutzen“ würfelt die Heilung aus dem Text des Gegenstands (z. B. Kleiner Heiltrank 2W6 + 2).
- **Combat Tracker Dock:** Das System stellt den verfolgten Wert des Combat-Trackers automatisch auf HP (`resources.hp.value`).

## Struktur

```text
system.json, template.json   Manifest und Datenmodell
scripts/hlw.js               Actor, Bögen, Kampf, Import
scripts/hlw-regeln.js        Regeln aus Kanon 2.0 (Kampfwerte, Punkte, Klassen, Kes)
scripts/hlw-talk.js          NSC-Gespräch
scripts/hlw-szenen.js        Szenenaufbau Lindhain
scripts/hlw-gefaehrte.js     Zähmen und Gefährten
scripts/hlw-charakter.js     Spielercharaktere anlegen, Klassen-Enthüllung, Skill-Orbs, Meisterung
scripts/hlw-geben.js         GM-Fenster „Skill geben“ / „Gegenstand geben“
styles/hlw-bogen.css         Charakterbogen und Kampfleiste
data/klassen.json            Klassen mit Lvl-Satz
import/                      Daten für den JSON-Import
assets/                      Karten, Gebäude, Dächer, NSC-Porträts, Tokens, Bilder (icons/) und Monster (monster/)
docs/                        Spielerbücher und Regeltabellen
```

Die Daten werden aus den Kanon-2.0-Tabellen erzeugt. GM-Material (Weltgeschichte, Kampagne, Wächter) ist bewusst nicht in diesem öffentlichen Repository.
