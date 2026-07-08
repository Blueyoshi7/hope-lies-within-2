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
HLW.elementLabels = {
  physical: "Physical",
  magic: "Magic",
  fire: "Fire",
  ice: "Ice",
  lightning: "Lightning",
  earth: "Earth",
  wind: "Wind",
  holy: "Holy",
  shadow: "Shadow"
};
HLW.pendingSkill = null;
HLW.rangeLayer = null;
HLW.rangeHelp = null;

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

function normalizeFormula(value) {
  return String(value ?? "").trim().replaceAll("W", "d").replaceAll("D", "d");
}

function parseRange(value) {
  const parsed = Number(String(value ?? "").replace(",", ".").match(/-?\d+(\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeElement(value, fallbackText = "") {
  const text = `${value ?? ""} ${fallbackText ?? ""}`.toLowerCase();
  if (text.includes("feuer") || text.includes("fire")) return "fire";
  if (text.includes("eis") || text.includes("ice") || text.includes("frost")) return "ice";
  if (text.includes("blitz") || text.includes("donner") || text.includes("lightning")) return "lightning";
  if (text.includes("erde") || text.includes("earth") || text.includes("stein")) return "earth";
  if (text.includes("wind") || text.includes("sturm")) return "wind";
  if (text.includes("holy") || text.includes("heilig")) return "holy";
  if (text.includes("shadow") || text.includes("schatten")) return "shadow";
  if (text.includes("phys") || text.includes("nahkampf") || text.includes("fernkampf")) return "physical";
  return "magic";
}

function getTokenDistanceInTiles(sourceToken, targetToken) {
  const gridSize = canvas.grid?.size || canvas.scene?.grid?.size || 100;
  const sourceCenter = sourceToken.center ?? { x: sourceToken.x + sourceToken.w / 2, y: sourceToken.y + sourceToken.h / 2 };
  const targetCenter = targetToken.center ?? { x: targetToken.x + targetToken.w / 2, y: targetToken.y + targetToken.h / 2 };
  const distancePixels = Math.hypot(targetCenter.x - sourceCenter.x, targetCenter.y - sourceCenter.y);
  return distancePixels / gridSize;
}

function getPointDistanceInTiles(from, to) {
  const gridSize = canvas.grid?.size || canvas.scene?.grid?.size || 100;
  return Math.hypot(to.x - from.x, to.y - from.y) / gridSize;
}

function getBestResistance(actor, element) {
  const resistances = actor.system?.resistances ?? {};
  const elementResistance = numberValue(resistances[element]?.value);
  const magicResistance = numberValue(resistances.magic?.value);

  if (element === "physical") return numberValue(resistances.physical?.value);
  return Math.max(elementResistance, magicResistance);
}

function showCombatOverlay(combat, mode = "start", actorName = "") {
  const existing = document.querySelector(".hlw-combat-overlay");
  if (existing) existing.remove();

  const isEnd = mode === "end";
  const isTurn = mode === "turn";
  const overlay = document.createElement("div");
  overlay.className = `hlw-combat-overlay ${isEnd ? "is-end" : isTurn ? "is-turn" : "is-start"}`;
  overlay.innerHTML = `
    <div class="hlw-combat-overlay__text">${isEnd ? "KAMPF BEENDET" : isTurn ? "DU BIST AM ZUG" : "IM KAMPF"}</div>
    <div class="hlw-combat-overlay__sub">${isEnd ? "Zurueck in den Erkundungsmodus" : isTurn ? escapeHtml(actorName) : `Runde ${combat.round || 1} beginnt`}</div>
  `;
  document.body.appendChild(overlay);

  window.setTimeout(() => overlay.classList.add("is-fading"), 1800);
  window.setTimeout(() => overlay.remove(), 2600);
}

function showTurnOverlayForActor(actor) {
  if (!actor) return;
  if (game.user?.isGM) return;
  if (!actor.testUserPermission?.(game.user, "OWNER")) return;

  showCombatOverlay(game.combat, "turn", actor.name);
}

function getSourceTokenForActor(actor) {
  return canvas.tokens?.controlled?.find((token) => token.actor?.id === actor.id) ?? actor.getActiveTokens()?.[0];
}

function clearPendingSkill() {
  if (HLW.rangeLayer) {
    HLW.rangeLayer.destroy({ children: true });
    HLW.rangeLayer = null;
  }

  if (HLW.rangeHelp) {
    HLW.rangeHelp.remove();
    HLW.rangeHelp = null;
  }

  HLW.pendingSkill = null;
}

function drawSkillRange(sourceToken, rangeLimit, skillName) {
  clearPendingSkill();

  const gridSize = canvas.grid?.size || canvas.scene?.grid?.size || 100;
  const radius = rangeLimit * gridSize;
  const layer = new PIXI.Graphics();
  const center = sourceToken.center ?? { x: sourceToken.x + sourceToken.w / 2, y: sourceToken.y + sourceToken.h / 2 };

  layer.lineStyle(4, 0xf0b529, 0.95);
  layer.beginFill(0xf0b529, 0.13);
  layer.drawCircle(center.x, center.y, radius);
  layer.endFill();
  layer.lineStyle(1, 0xffffff, 0.6);
  layer.drawCircle(center.x, center.y, radius);
  canvas.stage.addChild(layer);
  HLW.rangeLayer = layer;

  const help = document.createElement("div");
  help.className = "hlw-range-help";
  help.innerText = `${skillName}: Ziel im Umkreis von ${rangeLimit || "-"} Tiles anklicken. ESC bricht ab.`;
  document.body.appendChild(help);
  HLW.rangeHelp = help;
}

function tokenAtCanvasPoint(point) {
  const tokens = canvas.tokens?.placeables ?? [];
  return tokens.find((token) => {
    const bounds = token.bounds;
    if (bounds?.contains?.(point.x, point.y)) return true;
    return point.x >= token.x && point.x <= token.x + token.w && point.y >= token.y && point.y <= token.y + token.h;
  });
}

function getCanvasTokenById(tokenId) {
  return canvas.tokens?.placeables?.find((token) => token.id === tokenId || token.document?.id === tokenId);
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

async function postCombatEndMessage(combat) {
  if (!game.user?.isGM) return;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `
      <div class="hlw-chat-card hlw-combat-card is-end">
        <h2>KAMPF BEENDET</h2>
        <p>Der Combatmodus wurde beendet.</p>
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
    "system.actions.bonus.available": true,
    "system.combat.movementSpent": 0
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

  async endTurn() {
    const combat = game.combat;
    if (!combat?.started) {
      ui.notifications?.warn("Es ist kein aktiver Combat gestartet.");
      return;
    }

    if (combat.combatant?.actor?.id !== this.id) {
      ui.notifications?.warn("Dieser Actor ist gerade nicht am Zug.");
      return;
    }

    if (game.user?.isGM) {
      await combat.nextTurn();
      return;
    }

    game.socket.emit("system.hope-lies-within-2", {
      type: "endTurn",
      combatId: combat.id,
      actorId: this.id,
      userId: game.user.id
    });
    ui.notifications?.info("Zugende wurde an den GM gesendet.");
  }

  startSkillTargeting(itemId) {
    const item = this.items.get(itemId);
    if (!item || !["playerSkill", "classSkill"].includes(item.type)) return;

    const cooldown = item.system?.cooldown ?? {};
    const currentCooldown = numberValue(cooldown.value);

    if (currentCooldown > 0) {
      ui.notifications?.warn(`${item.name} ist noch ${currentCooldown} Zug(e) auf Cooldown.`);
      return;
    }

    if (!boolValue(this.system.actions?.main?.available)) {
      ui.notifications?.warn("Die Hauptaktion ist in diesem Zug bereits verbraucht.");
      return;
    }

    const damageFormula = normalizeFormula(item.system?.damage);
    const hasDamage = damageFormula && !["-", "xxx", "n/a"].includes(damageFormula.toLowerCase());
    const sourceToken = getSourceTokenForActor(this);

    if (hasDamage) {
      if (!sourceToken) {
        ui.notifications?.warn("Bitte zuerst den handelnden Token auf der Szene auswählen.");
        return;
      }

      const rangeLimit = parseRange(item.system?.range);
      HLW.pendingSkill = { actorId: this.id, itemId, sourceTokenId: sourceToken.id, rangeLimit };
      drawSkillRange(sourceToken, rangeLimit, item.name);
      return;
    }

    this.resolveSkill(itemId, null);
  }

  async resolveSkill(itemId, targetToken = null) {
    const item = this.items.get(itemId);
    if (!item || !["playerSkill", "classSkill"].includes(item.type)) return;

    const cooldown = item.system?.cooldown ?? {};
    const currentCooldown = numberValue(cooldown.value);
    const maxCooldown = numberValue(cooldown.max);

    if (currentCooldown > 0) {
      ui.notifications?.warn(`${item.name} ist noch ${currentCooldown} Zug(e) auf Cooldown.`);
      return;
    }

    if (!boolValue(this.system.actions?.main?.available)) {
      ui.notifications?.warn("Die Hauptaktion ist in diesem Zug bereits verbraucht.");
      return;
    }

    const damageFormula = normalizeFormula(item.system?.damage);
    const hasDamage = damageFormula && !["-", "xxx", "n/a"].includes(damageFormula.toLowerCase());
    const sourceToken = getSourceTokenForActor(this);
    let damageResult = null;

    if (hasDamage) {
      if (!sourceToken) {
        ui.notifications?.warn("Bitte zuerst den handelnden Token auf der Szene auswählen.");
        return;
      }

      if (!targetToken) {
        const targets = Array.from(game.user?.targets ?? []);
        if (targets.length !== 1) {
          ui.notifications?.warn("Bitte ein Ziel im Range-Kreis anklicken oder genau ein Foundry-Target markieren.");
          return;
        }
        targetToken = targets[0];
      }

      const rangeLimit = parseRange(item.system?.range);
      const distance = getTokenDistanceInTiles(sourceToken, targetToken);

      if (rangeLimit > 0 && distance > rangeLimit) {
        ui.notifications?.warn(`${targetToken.name} ist ausser Reichweite (${distance.toFixed(1)} / ${rangeLimit} Tiles).`);
        return;
      }

      const element = normalizeElement(item.system?.element, `${item.system?.skillType} ${item.name}`);
      const roll = await new Roll(damageFormula, this.getRollData()).evaluate();
      const resistance = getBestResistance(targetToken.actor, element);
      const finalDamage = Math.max(numberValue(roll.total) - resistance, 0);
      const currentHp = numberValue(targetToken.actor?.system?.resources?.hp?.value);

      if (targetToken.actor) {
        await targetToken.actor.update({
          "system.resources.hp.value": Math.max(currentHp - finalDamage, 0)
        });
      }

      damageResult = {
        targetName: targetToken.name,
        range: rangeLimit,
        distance,
        element,
        roll,
        resistance,
        finalDamage
      };
    }

    const skillType = escapeHtml(item.system?.skillType);
    const cost = escapeHtml(item.system?.cost);
    const range = escapeHtml(item.system?.range);
    const damage = escapeHtml(item.system?.damage);
    const elementLabel = escapeHtml(HLW.elementLabels[damageResult?.element] ?? item.system?.element ?? "-");
    const effect = escapeHtml(item.system?.effect || item.system?.description);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="hlw-chat-card">
          <h2>${escapeHtml(item.name)}</h2>
          <dl>
            <dt>Art</dt><dd>${skillType || "-"}</dd>
            <dt>Kosten</dt><dd>${cost || "-"}</dd>
            <dt>Element</dt><dd>${elementLabel || "-"}</dd>
            <dt>Range</dt><dd>${range || "-"}</dd>
            <dt>Schaden / Heilung</dt><dd>${damage || "-"}</dd>
            <dt>Cooldown</dt><dd>${maxCooldown || 0} Zug(e)</dd>
          </dl>
          ${damageResult ? `
            <hr>
            <dl>
              <dt>Ziel</dt><dd>${escapeHtml(damageResult.targetName)}</dd>
              <dt>Distanz</dt><dd>${damageResult.distance.toFixed(1)} / ${damageResult.range || "-"} Tiles</dd>
              <dt>Wurf</dt><dd>${damageResult.roll.total}</dd>
              <dt>Resistenz</dt><dd>${damageResult.resistance}</dd>
              <dt>Finaler Schaden</dt><dd><strong>${damageResult.finalDamage}</strong></dd>
            </dl>
          ` : ""}
          ${effect ? `<p>${effect}</p>` : ""}
        </div>
      `
    });

    if (maxCooldown > 0) {
      await item.update({ "system.cooldown.value": maxCooldown });
    }

    await this.update({ "system.actions.main.available": false });
    clearPendingSkill();
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
      this.actor.startSkillTargeting(itemId);
    });

    html.find("[data-end-turn]").on("click", (event) => {
      event.preventDefault();
      this.actor.endTurn();
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
      if (["playerSkill", "classSkill"].includes(item.type)) {
        groups.skills.push({
          id: item.id,
          name: item.name,
          type: item.type,
          system: item.system,
          canUse: boolValue(this.actor.system.actions?.main?.available) && numberValue(item.system?.cooldown?.value) <= 0
        });
      }
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

Hooks.once("ready", () => {
  game.socket.on("system.hope-lies-within-2", async (data) => {
    if (!game.user?.isGM) return;
    if (data?.type !== "endTurn") return;

    const combat = game.combats?.get(data.combatId);
    if (!combat?.started) return;
    if (combat.combatant?.actor?.id !== data.actorId) return;

    await combat.nextTurn();
  });
});

Hooks.on("canvasReady", () => {
  canvas.stage.off("pointerdown", HLW._canvasPointerDown);

  HLW._canvasPointerDown = async (event) => {
    if (!HLW.pendingSkill) return;

    const point = event.data.getLocalPosition(canvas.stage);
    const targetToken = tokenAtCanvasPoint(point);
    if (!targetToken) return;

    const actor = game.actors?.get(HLW.pendingSkill.actorId);
    const sourceToken = getCanvasTokenById(HLW.pendingSkill.sourceTokenId);
    if (!actor || !sourceToken) {
      clearPendingSkill();
      return;
    }

    const distance = getTokenDistanceInTiles(sourceToken, targetToken);
    if (HLW.pendingSkill.rangeLimit > 0 && distance > HLW.pendingSkill.rangeLimit) {
      ui.notifications?.warn(`${targetToken.name} ist ausser Reichweite (${distance.toFixed(1)} / ${HLW.pendingSkill.rangeLimit} Tiles).`);
      return;
    }

    await actor.resolveSkill(HLW.pendingSkill.itemId, targetToken);
  };

  canvas.stage.eventMode = "static";
  canvas.stage.on("pointerdown", HLW._canvasPointerDown);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && HLW.pendingSkill) {
    clearPendingSkill();
    ui.notifications?.info("Skill-Zielmodus abgebrochen.");
  }
});

Hooks.on("combatStart", (combat) => {
  showCombatOverlay(combat);
  postCombatStartMessage(combat);
  showTurnOverlayForActor(combat.combatant?.actor);
});

Hooks.on("deleteCombat", (combat) => {
  showCombatOverlay(combat, "end");
  postCombatEndMessage(combat);
});

Hooks.on("updateCombat", (combat, changed) => {
  if (!("turn" in changed)) return;

  const actor = combat.combatant?.actor;
  resetActorTurnState(actor);
  showTurnOverlayForActor(actor);
});

Hooks.on("preUpdateToken", async (tokenDocument, changes) => {
  if (!game.combat?.started) return;
  if (!("x" in changes) && !("y" in changes)) return;

  const actor = tokenDocument.actor;
  if (!actor) return;

  const currentActor = game.combat.combatant?.actor;
  if (currentActor?.id !== actor.id) {
    if (!game.user?.isGM) {
      ui.notifications?.warn("Dieser Token ist gerade nicht am Zug.");
      return false;
    }
    return;
  }

  const from = {
    x: numberValue(tokenDocument.x),
    y: numberValue(tokenDocument.y)
  };
  const to = {
    x: "x" in changes ? numberValue(changes.x) : from.x,
    y: "y" in changes ? numberValue(changes.y) : from.y
  };
  const distance = getPointDistanceInTiles(from, to);
  const limit = numberValue(actor.system?.resources?.movement?.value);
  const spent = numberValue(actor.system?.combat?.movementSpent);
  const remaining = Math.max(limit - spent, 0);

  if (limit > 0 && distance > remaining + 0.01) {
    ui.notifications?.warn(`Bewegungslimit erreicht: ${remaining.toFixed(1)} Tiles uebrig.`);
    return false;
  }

  const nextSpent = spent + distance;
  await actor.update({
    "system.combat.movementSpent": nextSpent,
    "system.actions.movement.available": limit <= 0 || nextSpent < limit - 0.01
  });
});
