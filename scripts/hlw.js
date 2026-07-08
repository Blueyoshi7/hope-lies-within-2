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

HLW.initiativeFormula = "1d20 + @attributes.spe.value";

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boolValue(value) {
  return value === true || value === "true";
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.innerText = value ?? "";
  return div.innerHTML;
}

function showCombatOverlay(combat) {
  const existing = document.querySelector(".hlw-combat-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "hlw-combat-overlay";
  overlay.innerHTML = `
    <div class="hlw-combat-overlay__text">IM KAMPF</div>
    <div class="hlw-combat-overlay__sub">Runde ${combat.round || 1} beginnt</div>
  `;
  document.body.appendChild(overlay);

  window.setTimeout(() => overlay.classList.add("is-fading"), 1800);
  window.setTimeout(() => overlay.remove(), 2600);
}

async function postCombatStartMessage(combat) {
  if (!game.user?.isGM) return;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `
      <div class="hlw-chat-card hlw-combat-card">
        <h2>IM KAMPF</h2>
        <p>Der Combatmodus wurde gestartet. Runde ${combat.round || 1} beginnt.</p>
      </div>
    `
  });
}

async function resetActorTurnState(actor) {
  if (!game.user?.isGM) return;
  if (!actor?.isOwner) return;

  const updates = {
    "system.actions.main.available": true,
    "system.actions.movement.available": true,
    "system.actions.bonus.available": true
  };

  const itemUpdates = [];
  for (const item of actor.items ?? []) {
    if (!["playerSkill", "classSkill"].includes(item.type)) continue;

    const currentCooldown = numberValue(item.system?.cooldown?.value);
    if (currentCooldown > 0) {
      itemUpdates.push({
        _id: item.id,
        "system.cooldown.value": Math.max(currentCooldown - 1, 0)
      });
    }
  }

  await actor.update(updates);
  if (itemUpdates.length) await actor.updateEmbeddedDocuments("Item", itemUpdates);
}

export class HopeLiesWithinActor extends Actor {
  getRollData() {
    const data = super.getRollData();
    data.attributes = this.system.attributes ?? {};
    data.resources = this.system.resources ?? {};
    return data;
  }

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

  async toggleAction(actionKey) {
    const current = boolValue(this.system.actions?.[actionKey]?.available);
    await this.update({ [`system.actions.${actionKey}.available`]: !current });
  }

  async useSkill(itemId) {
    const item = this.items.get(itemId);
    if (!item || !["playerSkill", "classSkill"].includes(item.type)) return;

    const cooldown = item.system?.cooldown ?? {};
    const currentCooldown = numberValue(cooldown.value);
    const maxCooldown = numberValue(cooldown.max);

    if (currentCooldown > 0) {
      ui.notifications?.warn(`${item.name} ist noch ${currentCooldown} Zug(e) auf Cooldown.`);
      return;
    }

    const skillType = escapeHtml(item.system?.skillType);
    const cost = escapeHtml(item.system?.cost);
    const range = escapeHtml(item.system?.range);
    const damage = escapeHtml(item.system?.damage);
    const effect = escapeHtml(item.system?.effect || item.system?.description);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="hlw-chat-card">
          <h2>${escapeHtml(item.name)}</h2>
          <dl>
            <dt>Art</dt><dd>${skillType || "-"}</dd>
            <dt>Kosten</dt><dd>${cost || "-"}</dd>
            <dt>Range</dt><dd>${range || "-"}</dd>
            <dt>Schaden / Heilung</dt><dd>${damage || "-"}</dd>
            <dt>Cooldown</dt><dd>${maxCooldown || 0} Zug(e)</dd>
          </dl>
          ${effect ? `<p>${effect}</p>` : ""}
        </div>
      `
    });

    if (maxCooldown > 0) {
      await item.update({ "system.cooldown.value": maxCooldown });
    }
  }
}

export class HopeLiesWithinItem extends Item {}

const BaseActorSheet = globalThis.ActorSheet;
const BaseItemSheet = globalThis.ItemSheet;

export class HopeLiesWithinActorSheet extends (BaseActorSheet ?? class {}) {
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

    html.find("[data-toggle-action]").on("click", (event) => {
      event.preventDefault();
      const actionKey = event.currentTarget.dataset.toggleAction;
      this.actor.toggleAction(actionKey);
    });

    html.find("[data-use-skill]").on("click", (event) => {
      event.preventDefault();
      const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      this.actor.useSkill(itemId);
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

export class HopeLiesWithinItemSheet extends (BaseItemSheet ?? class {}) {
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
  CONFIG.Combat.initiative = {
    formula: HLW.initiativeFormula,
    decimals: 2
  };

  if (BaseActorSheet && globalThis.Actors?.registerSheet) {
    Actors.unregisterSheet("core", BaseActorSheet);
    Actors.registerSheet("hope-lies-within-2", HopeLiesWithinActorSheet, {
      makeDefault: true,
      types: ["character", "npc", "monster"]
    });
  } else {
    console.warn("Hope lies Within 2.0 | Klassische ActorSheet-API nicht gefunden. System startet ohne eigenes Actor Sheet.");
  }

  if (BaseItemSheet && globalThis.Items?.registerSheet) {
    Items.unregisterSheet("core", BaseItemSheet);
    Items.registerSheet("hope-lies-within-2", HopeLiesWithinItemSheet, {
      makeDefault: true,
      types: ["playerSkill", "classSkill", "weapon", "armor", "equipment", "consumable", "material"]
    });
  } else {
    console.warn("Hope lies Within 2.0 | Klassische ItemSheet-API nicht gefunden. System startet ohne eigenes Item Sheet.");
  }
});

Hooks.on("createCombat", (combat) => {
  showCombatOverlay(combat);
  postCombatStartMessage(combat);
});

Hooks.on("updateCombat", (combat, changed) => {
  if (!("turn" in changed)) return;

  const actor = combat.combatant?.actor;
  resetActorTurnState(actor);
});
