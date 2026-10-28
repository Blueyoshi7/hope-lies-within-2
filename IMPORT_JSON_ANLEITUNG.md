# JSON-Import

Als GM in der Item-Sidebar auf **HLW JSON Import** klicken. Alternativ in der Konsole:

```js
await game.hlw.importAllJson();          // alle Items, Skills und Monster
await game.hlw.importMonsters("systems/hope-lies-within-2/import/monsters.json");
```

Bereits vorhandene Einträge (gleicher Name und Typ) werden übersprungen. Die Ordner entstehen automatisch nach Kategorie und Rang, z. B. `HLW/Waffen/Rang C` oder `HLW Bestiarium/Rang B`.

## Format eines Eintrags

```json
{
  "name": "Eisenschwert",
  "type": "weapon",
  "img": "icons/svg/item-bag.svg",
  "folder": "HLW/Waffen/Rang C",
  "system": {
    "rank": "C",
    "priceSk": 500,
    "price": "5 GK",
    "damage": "2d6",
    "weaponClass": "melee",
    "range": 1,
    "bonuses": { "rw": 0, "acc": 0 },
    "description": "…"
  }
}
```

Typen: `weapon`, `armor`, `accessory`, `equipment`, `consumable`, `foodDrink`, `material`, `natural`, `mineral`, `junk`, `playerSkill`, `classSkill`. Monster stehen in `monsters.json` als Actors vom Typ `monster`.
