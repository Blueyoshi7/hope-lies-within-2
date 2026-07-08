const HLW = {};

HLW.attributeLabels = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
  agl: "AGL",
  spe: "SPE",
  edu: "EDU",
  sou: "SOU"
};

HLW.worldSkills = {
  athletik: { label: "Athletik", attributes: ["str", "con", "agl"] },
  wortgewandtheit: { label: "Wortgewandtheit", attributes: ["cha", "edu", "int"] },
  erfindergeist: { label: "Erfindergeist", attributes: ["int", "wis", "dex"] },
  naturkunde: { label: "Naturkunde", attributes: ["wis", "agl", "sou"] },
  religion: { label: "Religion", attributes: ["wis", "edu", "sou"] },
  scharfsinnigkeit: { label: "Scharfsinnigkeit", attributes: ["int", "spe", "dex"] },
  archaeologie: { label: "Archaeologie", attributes: ["str", "con", "edu"] },
  handwerkskunst: { label: "Handwerkskunst", attributes: ["dex", "con", "str"] },
  willenskraft: { label: "Willenskraft", attributes: ["sou", "cha", "con"] },
  tierkunde: { label: "Tierkunde", attributes: ["agl", "spe", "wis"] }
};

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export class HopeLiesWithinActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();

    const system = this.system;
    if (!system?.attributes || !system?.worldSkills) return;

    for (const [key, definition] of Object.entries(HLW.worldSkills)) {
      const current = system.worldSkills[key] ?? {};
      const base = definition.attributes.reduce((sum, attributeKey) => {
        return sum + numberValue(system.attributes?.[attributeKey]?.value);
      }, 0);
      const bonus = numberValue(current.bonus);

      current.label = definition.label;
      current.attributes = definition.attributes;
      current.base = base;
      current.total = base + bonus;
      system.worldSkills[key] = current;
    }
  }

  async rollWorldSkill(skillKey) {
    const skill = this.system.worldSkills?.[skillKey];
    if (!skill) return;

    const total = numberValue(skill.total);
    const formula = `1d20 + ${total}`;
    const roll = await new Roll(formula, this.getRollData()).evaluate();

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${skill.label}</strong> (${skill.attributes.map((key) => HLW.attributeLabels[key]).join(" + ")})`
    });
  }
}

export class HopeLiesWithinItem extends Item {}

export class HopeLiesWithinActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hope-lies-within", "sheet", "actor"],
      template: "systems/hope-lies-within-2/templates/actor/character-sheet.hbs",
      width: 760,
      height: 780,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }]
    });
  }

  get template() {
    return "systems/hope-lies-within-2/templates/actor/character-sheet.hbs";
  }

  async getData(options) {
    const context = await super.getData(options);
    context.system = context.actor.system;
    context.itemsByType = this._prepareItems(context.actor.items);
    context.worldSkills = this._prepareWorldSkills(context.system);
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find("[data-roll-world-skill]").on("click", (event) => {
      event.preventDefault();
      const skillKey = event.currentTarget.dataset.rollWorldSkill;
      this.actor.rollWorldSkill(skillKey);
    });
  }

  _prepareItems(items) {
    const groups = {
      skills: [],
      weapons: [],
      armor: [],
      equipment: [],
      consumables: [],
      materials: []
    };

    for (const item of items) {
      if (["playerSkill", "classSkill"].includes(item.type)) groups.skills.push(item);
      else if (item.type === "weapon") groups.weapons.push(item);
      else if (item.type === "armor") groups.armor.push(item);
      else if (item.type === "consumable") groups.consumables.push(item);
      else if (item.type === "material") groups.materials.push(item);
      else groups.equipment.push(item);
    }

    return groups;
  }

  _prepareWorldSkills(system) {
    return Object.entries(HLW.worldSkills).map(([key, definition]) => {
      const skill = system.worldSkills?.[key] ?? {};
      return {
        key,
        label: definition.label,
        attributeLabels: definition.attributes.map((attributeKey) => HLW.attributeLabels[attributeKey]).join(" + "),
        base: numberValue(skill.base),
        bonus: numberValue(skill.bonus),
        total: numberValue(skill.total)
      };
    });
  }
}

export class HopeLiesWithinItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hope-lies-within", "sheet", "item"],
      template: "systems/hope-lies-within-2/templates/item/item-sheet.hbs",
      width: 560,
      height: 620
    });
  }

  async getData(options) {
    const context = await super.getData(options);
    context.system = context.item.system;
    context.isSkill = ["playerSkill", "classSkill"].includes(context.item.type);
    context.isGear = !context.isSkill;
    return context;
  }
}

Hooks.once("init", () => {
  console.log("Hope lies Within 2.0 | Initialisiere System");

  CONFIG.HLW = HLW;
  CONFIG.Actor.documentClass = HopeLiesWithinActor;
  CONFIG.Item.documentClass = HopeLiesWithinItem;

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hope-lies-within-2", HopeLiesWithinActorSheet, {
    makeDefault: true,
    types: ["character", "npc", "monster"]
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hope-lies-within-2", HopeLiesWithinItemSheet, {
    makeDefault: true,
    types: ["playerSkill", "classSkill", "weapon", "armor", "equipment", "consumable", "material"]
  });
});
