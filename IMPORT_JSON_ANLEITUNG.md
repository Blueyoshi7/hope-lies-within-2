# JSON-Import fuer Items, Waffen, Ruestungen und Skills

Die Importdateien liegen im Systemordner unter `import/`.

## Dateien

- `import/items.json`
- `import/weapons.json`
- `import/armor.json`
- `import/skills.json`

## Import in Foundry

Als GM in der Browser-Konsole ausfuehren:

```js
await game.hlw.importAllJson()
```

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
- `consumable`
- `material`
- `natural`
- `mineral`
- `junk`
- `foodDrink`

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
