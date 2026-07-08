# Hope lies Within 2.0 - Foundry VTT Systemplan V1

## Ziel von Version 1

Version 1 ist ein spielbarer Lern- und Upload-Prototyp fuer Foundry VTT. Das System soll bewusst die Grundlagen abbilden, damit Charaktere angelegt, Werte gepflegt, World-Skills gewuerfelt und einfache Combat-Szenen getestet werden koennen.

Huebsche Sheets, vollautomatische Klassenprogression, vollstaendige Compendiums und komplexe Active Effects kommen nach V1.

## Spielmodi

### Erkundungsmodus

Der Erkundungsmodus nutzt Foundrys Standardfunktionen:

- freie Token-Bewegung
- Sichtweite je Token
- Fog of War
- normale Szenen, Reisen, Gespraeche, RaeTsel und Interaktion
- keine feste Zugreihenfolge
- Wechsel in Combat ueber Foundrys Combat Tracker

### Combatmodus

Der Combatmodus nutzt Foundrys Combat Tracker und ergaenzt ihn durch Systemdaten:

- Initiative / Turn Order ueber Foundry
- Initiative-Formel V1: 1W20 + SPE
- Kampfstart-Overlay: grosser Text "IM KAMPF"
- Aktionsstatus pro Zug: Hauptaktion, Bewegung, Bonusaktion
- Skill-Nutzung erzeugt eine Chat Card und setzt Cooldown
- Cooldowns sinken am Zugbeginn des jeweiligen Actors um 1
- Lebenspunkte
- Bewegungsreichweite
- Aktionspunkte
- Korruptionswert
- Skills mit Cooldown, Range, Kosten und Effekttext
- spaeter automatische Cooldown-Reduktion am Zug- oder Rundenwechsel

## Aktionen pro Zug

- 1 Hauptaktion
- 1 Bewegung
- 1 optionale Bonusaktion

## Attribute

| Kuerzel | Name |
| --- | --- |
| STR | Staerke |
| DEX | Geschicklichkeit |
| CON | Konstitution / Ausdauer |
| INT | Intelligenz |
| WIS | Weisheit |
| CHA | Charisma |
| AGL | Beweglichkeit |
| SPE | Geschwindigkeit |
| EDU | Bildung |
| SOU | Seelenkraft |

## Ressourcen

| Ressource | V1-Verhalten |
| --- | --- |
| Lebenspunkte | manuell gepflegt |
| Bewegungsreichweite | manuell gepflegt, Standard 3 Tiles |
| Aktionspunkte | manuell gepflegt |
| Korruptionswert | manuell gepflegt |

## World-Skill-Formel

```text
World-Skill-Check = 1W20 + Attribut 1 + Attribut 2 + Attribut 3 + Bonus
```

Der Bonus ist in V1 ein manuelles Feld. Spaeter kommen Job-, Titel-, Insignien-, Ausruestungs-, Set- und temporaere Boni automatisch dazu.

## World-Skills V1

| World-Skill | Attribute |
| --- | --- |
| Athletik | STR, CON, AGL |
| Wortgewandtheit | CHA, EDU, INT |
| Erfindergeist | INT, WIS, DEX |
| Naturkunde | WIS, AGL, SOU |
| Religion | WIS, EDU, SOU |
| Scharfsinnigkeit | INT, SPE, DEX |
| Archaeologie | STR, CON, EDU |
| Handwerkskunst | DEX, CON, STR |
| Willenskraft | SOU, CHA, CON |
| Tierkunde | AGL, SPE, WIS |

## Actor-Typen

| Typ | Zweck |
| --- | --- |
| character | Spielercharaktere mit Attributen, Ressourcen, World-Skills, Skills und Inventar |
| npc | NSCs mit vereinfachten Charakterdaten |
| monster | Gegner mit HP, Bewegung, Aktionspunkten, Skills und Loot |

## Item-Typen

| Typ | Zweck |
| --- | --- |
| playerSkill | aktive/passive Spielerfaehigkeiten |
| classSkill | klassengebundene Skills |
| weapon | Waffen |
| armor | Ruestung |
| equipment | Werkzeuge, Accessoires, Taschen, Set-Teile |
| consumable | Essen, Trinken, Potions, Einmaleffekte |
| material | Craftingmaterial, Naturgegenstaende, Drops |

## V1-Abschlusskriterien

- Foundry erkennt das System ueber `system.json`.
- Ein Charakter kann erstellt und geoeffnet werden.
- Attribute und Ressourcen koennen editiert werden.
- World-Skills werden im Sheet berechnet.
- World-Skills koennen in den Chat gewuerfelt werden.
- Items und Skills koennen angelegt und am Charakter angezeigt werden.
- Das Projekt kann als Systemordner oder ZIP in Foundry getestet werden.
