# JSON-Import fuer Items, Waffen, Ruestungen und Skills

Die Importdateien liegen im Systemordner unter `import/`.

## Dateien

- `import/items.json`
- `import/accessories.json`
- `import/weapons.json`
- `import/armor.json`
- `import/food-drink.json`
- `import/skills.json`

## Import in Foundry

Als GM im Character Sheet im Inventar-Tab auf `JSON importieren` klicken.

Alternativ in der Browser-Konsole ausfuehren:

```js
await game.hlw.importAllJson()
```

Bereits vorhandene Items mit gleichem Namen und Typ werden beim Import uebersprungen, damit Testimporte keine Duplikate erzeugen.

Eine einzelne Datei importierst du so:

```js
await game.hlw.importJsonFile("systems/hope-lies-within-2/import/weapons.json", "weapon")
```

## Grundformat

```json
[
  {
    "name": "Itemname",
    "type": "weapon",
    "img": "icons/svg/item-bag.svg",
    "system": {
      "description": "Beschreibung",
      "quantity": 1,
      "price": 10
    }
  }
]
```

## Wichtige Typen

- `playerSkill`
- `classSkill`
- `weapon`
- `armor`
- `equipment`
- `accessory`
- `consumable`
- `material`
- `natural`
- `mineral`
- `junk`
- `foodDrink`

## Ordnerstruktur

Der Import erstellt automatisch Foundry-Ordner:

```text
HLW Import / Kategorie / Tier X
```

Beispiele:

```text
HLW Import / Accessories / Tier 1
HLW Import / Skills / Tier 1
HLW Import / Essen & Trinken / Tier 1
```

Wenn `tier` im JSON `GM` oder `Abyss` ist, wird das Item automatisch in `Tier 5` einsortiert.

## Preis

`system.price` ist ein GM-Preisvorschlag. Spieler sehen diesen Wert nicht im Detailfenster und nicht im Item Sheet.

## Skills

Skills brauchen fuer den Kampf `activation`.

```json
{
  "name": "Feuerball",
  "type": "playerSkill",
  "system": {
    "skillType": "Feuermagie",
    "activation": "active",
    "damageCategory": "magical",
    "damageType": "fire",
    "range": 6,
    "damage": "1d4",
    "cooldown": { "value": 0, "max": 1 }
  }
}
```

Passive Skills bekommen:

```json
"activation": "passive"
```

Passive Skills werden am Charakter angezeigt, aber nicht als Combat-Aktion auswählbar.
