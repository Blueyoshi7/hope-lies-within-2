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
  slash: "Klinge",
  blunt: "Stumpf",
  pierce: "Stich",
  physical: "Physisch",
  magic: "Magie",
  fire: "Feuer",
  ice: "Eis",
  lightning: "Blitz",
  earth: "Erde",
  wind: "Wind",
  holy: "Heilig",
  shadow: "Schatten"
};
HLW.affinityDefaults = {
  slash: { label: "Klinge", value: 0 },
  blunt: { label: "Stumpf", value: 0 },
  pierce: { label: "Stich", value: 0 },
  magic: { label: "Magie", value: 0 },
  fire: { label: "Feuer", value: 0 },
  ice: { label: "Eis", value: 0 },
  lightning: { label: "Blitz", value: 0 },
  earth: { label: "Erde", value: 0 },
  wind: { label: "Wind", value: 0 },
  holy: { label: "Heilig", value: 0 },
  shadow: { label: "Schatten", value: 0 }
};
HLW.insigniaSlotDefaults = {
  slot1: { image: "", name: "", description: "" },
  slot2: { image: "", name: "", description: "" },
  slot3: { image: "", name: "", description: "" }
};
HLW.pendingSkill = null;
HLW.rangeGraphics = null;
HLW.movementGraphics = null;
HLW.rangeHelp = null;
HLW.targetPicker = null;
HLW.combatHud = null;
HLW.lastHandledTurnKey = null;
HLW.lastLegalTokenPositions = new Map();
HLW.pendingLegalMoves = new Map();
HLW.revertingTokens = new Set();

HLW.damageCategories = {
  physical: "Physisch",
  magical: "Magisch"
};

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

function getEffectiveRangeInTiles(value) {
  return Math.max(parseRange(value), 0);
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
  if (text.includes("klinge") || text.includes("slash") || text.includes("schnitt")) return "slash";
  if (text.includes("stumpf") || text.includes("blunt") || text.includes("keule")) return "blunt";
  if (text.includes("stich") || text.includes("pierce") || text.includes("pfeil")) return "pierce";
  if (text.includes("phys") || text.includes("nahkampf") || text.includes("fernkampf")) return "physical";
  return "magic";
}

function normalizeDamageCategory(value, fallbackText = "") {
  const text = `${value ?? ""} ${fallbackText ?? ""}`.toLowerCase();
  if (text.includes("mag") || text.includes("zauber") || text.includes("spell") || text.includes("feuer") || text.includes("eis") || text.includes("holy") || text.includes("heilig")) return "magical";
  return "physical";
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

function getAffinity(actor, element) {
  const affinities = actor.system?.affinities ?? actor.system?.resistances ?? {};
  return numberValue(affinities[element]?.value);
}

function getDefensiveAffinity(actor, element) {
  const elementAffinity = getAffinity(actor, element);
  const magicAffinity = getAffinity(actor, "magic");
  if (["fire", "ice", "lightning", "earth", "wind", "holy", "shadow"].includes(element)) {
    return Math.max(elementAffinity, magicAffinity);
  }
  return elementAffinity || getAffinity(actor, "physical");
}

function getDefenseValue(actor, damageCategory) {
  const key = damageCategory === "magical" ? "magical" : "physical";
  const base = numberValue(actor.system?.defenses?.[key]?.value);
  const defendingBonus = boolValue(actor.system?.combat?.defending) ? 1 : 0;
  return base + defendingBonus;
}

function prepareAffinities(system) {
  const oldResistances = system.resistances ?? {};
  const current = system.affinities ?? {};
  const prepared = {};

  for (const [key, defaults] of Object.entries(HLW.affinityDefaults)) {
    const oldValue = oldResistances[key]?.value;
    const currentValue = current[key]?.value;
    prepared[key] = {
      label: defaults.label,
      value: numberValue(currentValue ?? oldValue ?? defaults.value)
    };
  }

  return prepared;
}

function prepareInsigniaSlots(system) {
  const current = system.insigniaSlots ?? {};
  const prepared = {};

  for (const [key, defaults] of Object.entries(HLW.insigniaSlotDefaults)) {
    prepared[key] = {
      image: current[key]?.image ?? defaults.image,
      name: current[key]?.name ?? defaults.name,
      description: current[key]?.description ?? defaults.description
    };
  }

  return prepared;
}

function prepareResources(system) {
  const resources = system.resources ?? {};
  resources.gold = resources.gold ?? { label: "Gold", value: 0 };
  return resources;
}

function prepareDefenses(system) {
  const current = system.defenses ?? {};
  return {
    physical: {
      label: "Physische Verteidigung",
      value: numberValue(current.physical?.value)
    },
    magical: {
      label: "Magische Verteidigung",
      value: numberValue(current.magical?.value)
    }
  };
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
  const combatToken = game.combat?.combatant?.actor?.id === actor.id ? getCanvasTokenById(game.combat.combatant.tokenId) : null;
  return combatToken ?? canvas.tokens?.controlled?.find((token) => token.actor?.id === actor.id) ?? actor.getActiveTokens()?.[0];
}

function getPendingSourceToken(actor) {
  const pendingToken = HLW.pendingSkill?.actorId === actor.id ? getCanvasTokenById(HLW.pendingSkill.sourceTokenId) : null;
  return pendingToken ?? getSourceTokenForActor(actor);
}

function rerenderActorSheet(actorId) {
  const actor = game.actors?.get(actorId);
  if (actor?.sheet?.rendered) actor.sheet.render(false);
}

function getTokensInRange(sourceToken, rangeLimit) {
  return (canvas.tokens?.placeables ?? [])
    .filter((token) => token.id !== sourceToken.id && token.actor)
    .map((token) => ({
      token,
      distance: getTokenDistanceInTiles(sourceToken, token)
    }))
    .filter((entry) => rangeLimit <= 0 || entry.distance <= rangeLimit + 0.01)
    .sort((a, b) => a.distance - b.distance);
}

function removeRangeUi() {
  if (HLW.rangeGraphics) {
    HLW.rangeGraphics.destroy();
    HLW.rangeGraphics = null;
  }

  if (HLW.rangeHelp) {
    HLW.rangeHelp.remove();
    HLW.rangeHelp = null;
  }
}

function closeTargetPicker() {
  if (HLW.targetPicker) {
    HLW.targetPicker.remove();
    HLW.targetPicker = null;
  }
}

function clearPendingSkill() {
  const actorId = HLW.pendingSkill?.actorId;

  removeRangeUi();
  closeTargetPicker();
  HLW.pendingSkill = null;
  if (actorId) rerenderActorSheet(actorId);
  renderCombatHud();
}

function drawSkillRange(sourceToken, rangeLimit, skillName, rawRange = rangeLimit) {
  removeRangeUi();

  const gridSize = canvas.grid?.size || canvas.scene?.grid?.size || 100;
  const radius = Math.max(rangeLimit * gridSize, gridSize * 0.5);
  const center = sourceToken.center ?? { x: sourceToken.x + sourceToken.w / 2, y: sourceToken.y + sourceToken.h / 2 };
  const graphics = new PIXI.Graphics();
  graphics.eventMode = "none";
  graphics.lineStyle(4, 0xf0b529, 0.96);
  graphics.beginFill(0xf0b529, 0.14);
  graphics.drawCircle(center.x, center.y, radius);
  graphics.endFill();
  graphics.lineStyle(1, 0xffef9b, 0.75);
  graphics.drawCircle(center.x, center.y, Math.max(radius - 6, gridSize * 0.4));
  const layer = canvas.controls ?? canvas.interface ?? canvas.stage;
  layer.addChild(graphics);
  HLW.rangeGraphics = graphics;

  const help = document.createElement("div");
  help.className = "hlw-range-help";
  help.innerText = `${skillName}: Ziel waehlen (${rawRange || rangeLimit} Tiles). Button erneut klicken bricht ab.`;
  document.body.appendChild(help);
  HLW.rangeHelp = help;
}

function getCanvasTokenById(tokenId) {
  return canvas.tokens?.placeables?.find((token) => token.id === tokenId || token.document?.id === tokenId);
}

function getTokenGridLabel(token, index) {
  const gridSize = canvas.grid?.size || canvas.scene?.grid?.size || 100;
  const col = Math.round(numberValue(token.document?.x ?? token.x) / gridSize) + 1;
  const row = Math.round(numberValue(token.document?.y ?? token.y) / gridSize) + 1;
  return `Ziel ${index + 1} | Feld ${col}:${row}`;
}

function showTargetPicker(actor, item, sourceToken, rangeLimit) {
  closeTargetPicker();

  const entries = getTokensInRange(sourceToken, rangeLimit);
  const picker = document.createElement("div");
  picker.className = "hlw-target-picker";

  const targetRows = entries.length
    ? entries.map(({ token, distance }, index) => `
      <button type="button" data-target-token-id="${token.id}">
        <img src="${escapeHtml(token.document?.texture?.src || token.actor?.img || "")}" alt="">
        <span>
          <strong>${escapeHtml(token.name)}</strong>
          <small>${escapeHtml(getTokenGridLabel(token, index))}</small>
        </span>
        <span>
          <strong>${distance.toFixed(1)} Tiles</strong>
          <small>HP ${numberValue(token.actor?.system?.resources?.hp?.value)} / ${numberValue(token.actor?.system?.resources?.hp?.max)}</small>
        </span>
      </button>
    `).join("")
    : `<p>Keine Ziele in Reichweite.</p>`;

  picker.innerHTML = `
    <header>
      <strong>${escapeHtml(item.name)}</strong>
      <button type="button" data-cancel-targeting>Abbrechen</button>
    </header>
    <div class="hlw-target-picker__list">${targetRows}</div>
  `;

  picker.addEventListener("click", async (event) => {
    const cancel = event.target.closest("[data-cancel-targeting]");
    if (cancel) {
      clearPendingSkill();
      return;
    }

    const button = event.target.closest("[data-target-token-id]");
    if (!button) return;

    const token = getCanvasTokenById(button.dataset.targetTokenId);
    if (!token) {
      ui.notifications?.warn("Zieltoken wurde nicht gefunden.");
      return;
    }

    await actor.resolveSkill(item.id, token);
  });

  document.body.appendChild(picker);
  HLW.targetPicker = picker;
}

function refreshPendingSkillTargeting() {
  const pending = HLW.pendingSkill;
  if (!pending) return;

  const actor = game.actors?.get(pending.actorId);
  const item = actor?.items?.get(pending.itemId);
  const sourceToken = getCanvasTokenById(pending.sourceTokenId);
  if (!actor || !item || !sourceToken) {
    clearPendingSkill();
    return;
  }

  drawSkillRange(sourceToken, pending.rangeLimit, item.name, pending.rawRange);
  showTargetPicker(actor, item, sourceToken, pending.rangeLimit);
  renderCombatHud();
}

function removeMovementUi() {
  if (HLW.movementGraphics) {
    HLW.movementGraphics.destroy();
    HLW.movementGraphics = null;
  }
}

function drawMovementRange(actor) {
  removeMovementUi();
  if (!game.combat?.started || !actor) return;

  const token = getSourceTokenForActor(actor);
  if (!token) return;

  const limit = numberValue(actor.system?.resources?.movement?.value);
  const spent = numberValue(actor.system?.combat?.movementSpent);
  const remaining = Math.max(limit - spent, 0);
  if (remaining <= 0) return;

  const gridSize = canvas.grid?.size || canvas.scene?.grid?.size || 100;
  const radius = remaining * gridSize;
  const center = token.center ?? { x: token.x + token.w / 2, y: token.y + token.h / 2 };
  const graphics = new PIXI.Graphics();
  graphics.eventMode = "none";
  graphics.lineStyle(3, 0x45d7ff, 0.75);
  graphics.beginFill(0x45d7ff, 0.08);
  graphics.drawCircle(center.x, center.y, Math.max(radius, gridSize * 0.5));
  graphics.endFill();
  const layer = canvas.controls ?? canvas.interface ?? canvas.stage;
  layer.addChild(graphics);
  HLW.movementGraphics = graphics;
}

function getCombatHudActor() {
  const currentActor = game.combat?.combatant?.actor;
  if (currentActor) return currentActor;
  const controlled = canvas.tokens?.controlled?.[0]?.actor;
  return controlled ?? null;
}

function getUsableCombatItems(actor) {
  if (!actor) return [];
  return Array.from(actor.items ?? [])
    .filter((item) => ["playerSkill", "classSkill", "weapon"].includes(item.type))
    .map((item) => ({
      id: item.id,
      type: item.type,
      name: item.name,
      range: parseRange(item.system?.range),
      damage: item.system?.damage || "-",
      cooldown: numberValue(item.system?.cooldown?.value),
      maxCooldown: numberValue(item.system?.cooldown?.max),
      element: item.system?.damageType || item.system?.element || "",
      damageCategory: normalizeDamageCategory(item.system?.damageCategory, `${item.system?.skillType} ${item.system?.element}`),
      equipped: boolValue(item.system?.equipped),
      pending: HLW.pendingSkill?.actorId === actor.id && HLW.pendingSkill?.itemId === item.id
    }));
}

function renderCombatHud() {
  if (HLW.combatHud) {
    HLW.combatHud.remove();
    HLW.combatHud = null;
  }

  if (!game.combat?.started) {
    removeMovementUi();
    return;
  }

  const actor = getCombatHudActor();
  if (!actor) return;

  drawMovementRange(actor);

  const hp = actor.system?.resources?.hp ?? {};
  const movement = actor.system?.resources?.movement ?? {};
  const actionPoints = actor.system?.resources?.actionPoints ?? {};
  const spent = numberValue(actor.system?.combat?.movementSpent);
  const movementMax = numberValue(movement.value);
  const movementLeft = Math.max(movementMax - spent, 0);
  const mainReady = boolValue(actor.system?.actions?.main?.available);
  const isCurrentTurn = game.combat?.combatant?.actor?.id === actor.id;
  const skills = getUsableCombatItems(actor);
  const skillButtons = skills.length
    ? skills.map((item) => `
      <button type="button" class="hlw-hud-skill ${item.pending ? "is-pending" : ""}" data-hud-skill="${item.id}" ${(!mainReady || item.cooldown > 0) && !item.pending ? "disabled" : ""}>
        <strong>${escapeHtml(item.pending ? "Abbrechen" : item.name)}${item.equipped ? " [E]" : ""}</strong>
        <span>${escapeHtml(HLW.damageCategories[item.damageCategory] ?? item.damageCategory)} | ${escapeHtml(item.element || "Typ")} | R ${item.range || "-"} | ${escapeHtml(item.damage)}</span>
        <small>${item.cooldown > 0 ? `CD ${item.cooldown}/${item.maxCooldown}` : "bereit"}</small>
      </button>
    `).join("")
    : `<p class="hlw-hud-empty">Keine Skills am Actor.</p>`;

  const hud = document.createElement("aside");
  hud.className = `hlw-combat-hud ${isCurrentTurn ? "is-turn" : ""}`;
  hud.innerHTML = `
    <header>
      <img src="${escapeHtml(actor.img || "")}" alt="">
      <div>
        <strong>${escapeHtml(actor.name)}</strong>
        <span>${isCurrentTurn ? "Am Zug" : "Wartet"}</span>
      </div>
    </header>
    <section class="hlw-hud-stats">
      <div><span>HP</span><strong>${numberValue(hp.value)} / ${numberValue(hp.max)}</strong></div>
      <div><span>Bewegung</span><strong>${movementLeft.toFixed(1)} / ${movementMax}</strong></div>
      <div><span>Aktionspunkte</span><strong>${numberValue(actionPoints.value)} / ${numberValue(actionPoints.max)}</strong></div>
      <div><span>Aktion</span><strong>${mainReady ? "bereit" : "verbraucht"}</strong></div>
    </section>
    <section class="hlw-hud-actions">
      <button type="button" data-hud-standard="attack" ${mainReady ? "" : "disabled"}>Angriff</button>
      <button type="button" data-hud-standard="item" ${mainReady ? "" : "disabled"}>Item</button>
      <button type="button" data-hud-standard="defend" ${mainReady ? "" : "disabled"}>Abwehr</button>
      <button type="button" data-hud-end-turn>Zug Ende</button>
    </section>
    <section class="hlw-hud-skills"><h3>Aktionen & Skills</h3>${skillButtons}</section>
  `;

  hud.addEventListener("click", (event) => {
    const skillButton = event.target.closest("[data-hud-skill]");
    if (skillButton) {
      actor.startSkillTargeting(skillButton.dataset.hudSkill);
      return;
    }

    const standardButton = event.target.closest("[data-hud-standard]");
    if (standardButton) {
      actor.useStandardAction(standardButton.dataset.hudStandard);
      return;
    }

    if (event.target.closest("[data-hud-end-turn]")) {
      actor.endTurn();
    }
  });

  document.body.appendChild(hud);
  HLW.combatHud = hud;
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
    "system.combat.movementSpent": 0,
    "system.combat.defending": false
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

function handleCombatTurnChange(combat) {
  const turnKey = `${combat.id}-${combat.round}-${combat.turn}`;
  if (HLW.lastHandledTurnKey === turnKey) return;
  HLW.lastHandledTurnKey = turnKey;

  const actor = combat.combatant?.actor;
  resetActorTurnState(actor);
  showTurnOverlayForActor(actor);
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

    system.affinities = prepareAffinities(system);
    system.insigniaSlots = prepareInsigniaSlots(system);
    system.resources = prepareResources(system);
    system.defenses = prepareDefenses(system);
    system.combat = system.combat ?? {};
    system.combat.defending = boolValue(system.combat.defending);

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

  async useStandardAction(actionType) {
    if (!boolValue(this.system.actions?.main?.available)) {
      ui.notifications?.warn("Die Hauptaktion ist in diesem Zug bereits verbraucht.");
      return;
    }

    if (actionType === "attack") {
      const weapon = this.items.find((item) => item.type === "weapon" && boolValue(item.system?.equipped)) ?? this.items.find((item) => item.type === "weapon");
      if (!weapon) {
        ui.notifications?.warn("Keine Waffe gefunden. Bitte eine Waffe anlegen oder ausruesten.");
        return;
      }
      this.startOffensiveTargeting(weapon.id, "weapon");
      return;
    }

    if (actionType === "defend") {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="hlw-chat-card"><h2>Abwehrhaltung</h2><p>${escapeHtml(this.name)} erhoeht physische und magische Verteidigung bis zum naechsten eigenen Zug um 1.</p></div>`
      });
      await this.update({ "system.actions.main.available": false, "system.combat.defending": true });
      return;
    }

    if (actionType === "item") {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="hlw-chat-card"><h2>Item verwenden</h2><p>${escapeHtml(this.name)} verwendet ein Item. Die konkrete Item-Wirkung wird in einer spaeteren Version automatisiert.</p></div>`
      });
      await this.update({ "system.actions.main.available": false });
    }
  }

  async toggleEquipped(itemId) {
    const item = this.items.get(itemId);
    if (!item) return;

    const nextValue = !boolValue(item.system?.equipped);
    await item.update({ "system.equipped": nextValue });
  }

  editOwnedItem(itemId) {
    const item = this.items.get(itemId);
    item?.sheet?.render(true);
  }

  async giveItemToTarget(itemId) {
    const item = this.items.get(itemId);
    if (!item) return;

    const targetToken = Array.from(game.user?.targets ?? []).find((token) => token.actor && token.actor.id !== this.id);
    if (!targetToken?.actor) {
      ui.notifications?.warn("Bitte genau den Ziel-Charakter als Foundry-Target markieren.");
      return;
    }

    const itemData = item.toObject();
    const quantity = Math.max(numberValue(item.system?.quantity), 1);
    foundry.utils.setProperty(itemData, "system.quantity", 1);
    delete itemData._id;

    await targetToken.actor.createEmbeddedDocuments("Item", [itemData]);
    if (quantity > 1) await item.update({ "system.quantity": quantity - 1 });
    else await this.deleteEmbeddedDocuments("Item", [item.id]);

    ui.notifications?.info(`${item.name} wurde an ${targetToken.name} gegeben.`);
  }

  async giveGoldToTarget(amount) {
    const value = Math.max(Math.floor(numberValue(amount)), 0);
    if (value <= 0) return;

    const targetToken = Array.from(game.user?.targets ?? []).find((token) => token.actor && token.actor.id !== this.id);
    if (!targetToken?.actor) {
      ui.notifications?.warn("Bitte den Empfaenger als Foundry-Target markieren.");
      return;
    }

    const ownGold = numberValue(this.system?.resources?.gold?.value);
    if (ownGold < value) {
      ui.notifications?.warn("Nicht genug Gold.");
      return;
    }

    const targetGold = numberValue(targetToken.actor.system?.resources?.gold?.value);
    await this.update({ "system.resources.gold.value": ownGold - value });
    await targetToken.actor.update({ "system.resources.gold.value": targetGold + value });
    ui.notifications?.info(`${value} Gold an ${targetToken.name} gegeben.`);
  }

  startSkillTargeting(itemId) {
    if (HLW.pendingSkill?.actorId === this.id && HLW.pendingSkill?.itemId === itemId) {
      clearPendingSkill();
      return;
    }

    this.startOffensiveTargeting(itemId, "skill");
  }

  startOffensiveTargeting(itemId, sourceType = "skill") {
    const item = this.items.get(itemId);
    if (!item) return;

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

      const rawRange = parseRange(item.system?.range);
      const rangeLimit = getEffectiveRangeInTiles(item.system?.range);
      clearPendingSkill();
      HLW.pendingSkill = { actorId: this.id, itemId, sourceType, sourceTokenId: sourceToken.id, rawRange, rangeLimit };
      drawSkillRange(sourceToken, rangeLimit, item.name, rawRange);
      showTargetPicker(this, item, sourceToken, rangeLimit);
      rerenderActorSheet(this.id);
      renderCombatHud();
      return;
    }

    this.resolveSkill(itemId, null);
  }

  async resolveSkill(itemId, targetToken = null) {
    const item = this.items.get(itemId);
    if (!item || !["playerSkill", "classSkill", "weapon"].includes(item.type)) return;

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
    const sourceToken = getPendingSourceToken(this);
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

      const rawRange = parseRange(item.system?.range);
      const rangeLimit = getEffectiveRangeInTiles(item.system?.range);
      const distance = getTokenDistanceInTiles(sourceToken, targetToken);

      if (rangeLimit > 0 && distance > rangeLimit) {
        ui.notifications?.warn(`${targetToken.name} ist ausser Reichweite (${distance.toFixed(1)} / ${rangeLimit} Tiles).`);
        return;
      }

      const damageCategory = normalizeDamageCategory(item.system?.damageCategory, `${item.system?.skillType} ${item.system?.element} ${item.name}`);
      const element = normalizeElement(item.system?.damageType || item.system?.element, `${item.system?.skillType} ${item.name}`);
      const roll = await new Roll(damageFormula, this.getRollData()).evaluate();
      const attackAffinity = getAffinity(this, element);
      const defenseAffinity = getDefensiveAffinity(targetToken.actor, element);
      const defenseValue = getDefenseValue(targetToken.actor, damageCategory);
      const finalDamage = Math.max(numberValue(roll.total) + attackAffinity - defenseAffinity - defenseValue, 0);
      const currentHp = numberValue(targetToken.actor?.system?.resources?.hp?.value);
      const nextHp = Math.max(currentHp - finalDamage, 0);
      let defeated = false;

      if (targetToken.actor) {
        await targetToken.actor.update({
          "system.resources.hp.value": nextHp
        });

        defeated = nextHp <= 0;
        if (defeated && game.combat) {
          const combatant = game.combat.combatants.find((entry) => entry.tokenId === targetToken.document?.id || entry.actor?.id === targetToken.actor?.id);
          if (combatant) await combatant.update({ defeated: true });
        }
      }

      damageResult = {
        targetName: targetToken.name,
        rawRange,
        range: rangeLimit,
        distance,
        damageCategory,
        element,
        roll,
        attackAffinity,
        defenseAffinity,
        defenseValue,
        finalDamage,
        defeated
      };
    }

    const skillType = escapeHtml(item.system?.skillType);
    const cost = escapeHtml(item.system?.cost);
    const range = escapeHtml(item.system?.range);
    const damage = escapeHtml(item.system?.damage);
    const categoryLabel = escapeHtml(HLW.damageCategories[damageResult?.damageCategory] ?? HLW.damageCategories[normalizeDamageCategory(item.system?.damageCategory)] ?? "-");
    const elementLabel = escapeHtml(HLW.elementLabels[damageResult?.element] ?? item.system?.damageType ?? item.system?.element ?? "-");
    const effect = escapeHtml(item.system?.effect || item.system?.description);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="hlw-chat-card">
          <h2>${escapeHtml(item.name)}</h2>
          <dl>
            <dt>Art</dt><dd>${skillType || "-"}</dd>
            <dt>Kosten</dt><dd>${cost || "-"}</dd>
            <dt>Kategorie</dt><dd>${categoryLabel || "-"}</dd>
            <dt>Element</dt><dd>${elementLabel || "-"}</dd>
            <dt>Range</dt><dd>${range || "-"}</dd>
            <dt>Schaden / Heilung</dt><dd>${damage || "-"}</dd>
            <dt>Cooldown</dt><dd>${maxCooldown || 0} Zug(e)</dd>
          </dl>
          ${damageResult ? `
            <hr>
            <dl>
              <dt>Ziel</dt><dd>${escapeHtml(damageResult.targetName)}</dd>
              <dt>Distanz</dt><dd>${damageResult.distance.toFixed(1)} / ${damageResult.range.toFixed(1)} Tiles</dd>
              <dt>Range-Wert</dt><dd>${damageResult.rawRange || "-"}</dd>
              <dt>Wurf</dt><dd>${damageResult.roll.total}</dd>
              <dt>Veranlagung Angriff</dt><dd>+${damageResult.attackAffinity}</dd>
              <dt>Veranlagung Ziel</dt><dd>-${damageResult.defenseAffinity}</dd>
              <dt>Verteidigung</dt><dd>-${damageResult.defenseValue}</dd>
              <dt>Finaler Schaden</dt><dd><strong>${damageResult.finalDamage}</strong></dd>
              ${damageResult.defeated ? `<dt>Status</dt><dd><strong>Besiegt</strong></dd>` : ""}
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
    renderCombatHud();
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
      width: 920,
      height: 820,
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

    html.find("[data-standard-action]").on("click", (event) => {
      event.preventDefault();
      this.actor.useStandardAction(event.currentTarget.dataset.standardAction);
    });

    html.find("[data-edit-owned-item]").on("click", (event) => {
      event.preventDefault();
      this.actor.editOwnedItem(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    });

    html.find("[data-give-owned-item]").on("click", (event) => {
      event.preventDefault();
      this.actor.giveItemToTarget(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    });

    html.find("[data-toggle-equipped]").on("change", (event) => {
      event.preventDefault();
      this.actor.toggleEquipped(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    });

    html.find("[data-give-gold]").on("click", (event) => {
      event.preventDefault();
      const input = html.find("[data-gold-amount]");
      this.actor.giveGoldToTarget(input.val());
      input.val("");
    });

    html.find("[data-item-id][draggable=true]").on("dragstart", (event) => {
      const itemId = event.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (!item) return;

      event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({
        type: "Item",
        uuid: item.uuid,
        actorId: this.actor.id,
        itemId: item.id,
        systemId: "hope-lies-within-2"
      }));
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
          canUse: boolValue(this.actor.system.actions?.main?.available) && numberValue(item.system?.cooldown?.value) <= 0,
          isPending: HLW.pendingSkill?.actorId === this.actor.id && HLW.pendingSkill?.itemId === item.id
        });
      }
      else {
        const preparedItem = {
          id: item.id,
          name: item.name,
          img: item.img,
          type: item.type,
          system: item.system,
          damageCategoryLabel: HLW.damageCategories[normalizeDamageCategory(item.system?.damageCategory)] ?? "-",
          damageTypeLabel: HLW.elementLabels[normalizeElement(item.system?.damageType || item.system?.element)] ?? item.system?.damageType ?? item.system?.element ?? "-",
          equipped: boolValue(item.system?.equipped)
        };

        if (item.type === "weapon") groups.weapons.push(preparedItem);
        else if (item.type === "armor") groups.armor.push(preparedItem);
        else if (item.type === "consumable") groups.consumables.push(preparedItem);
        else if (item.type === "material") groups.materials.push(preparedItem);
        else groups.equipment.push(preparedItem);
      }
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

Hooks.on("hotbarDrop", async (bar, data, slot) => {
  if (data?.systemId !== "hope-lies-within-2" || !data.actorId || !data.itemId) return;

  const actor = game.actors.get(data.actorId);
  const item = actor?.items.get(data.itemId);
  if (!actor || !item) return false;

  const command = `game.actors.get("${actor.id}")?.startSkillTargeting("${item.id}");`;
  let macro = game.macros.find((entry) => entry.name === item.name && entry.command === command);
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command
    });
  }

  game.user.assignHotbarMacro(macro, slot);
  return false;
});

Hooks.on("canvasReady", () => {
  clearPendingSkill();
  renderCombatHud();
});

function handleCancelPendingSkill(event) {
  if (event.key === "Escape" && HLW.pendingSkill) {
    clearPendingSkill();
    ui.notifications?.info("Skill-Zielmodus abgebrochen.");
  }
}

document.addEventListener("keydown", handleCancelPendingSkill, true);
window.addEventListener("keydown", handleCancelPendingSkill, true);

Hooks.on("combatStart", (combat) => {
  showCombatOverlay(combat);
  postCombatStartMessage(combat);
  showTurnOverlayForActor(combat.combatant?.actor);
  renderCombatHud();
});

Hooks.on("deleteCombat", (combat) => {
  showCombatOverlay(combat, "end");
  postCombatEndMessage(combat);
  clearPendingSkill();
  removeMovementUi();
  renderCombatHud();
});

Hooks.on("updateCombat", (combat, changed) => {
  if (!("turn" in changed)) return;
  handleCombatTurnChange(combat);
  renderCombatHud();
});

Hooks.on("combatTurn", (combat) => {
  handleCombatTurnChange(combat);
  renderCombatHud();
});

Hooks.on("preUpdateToken", (tokenDocument, changes) => {
  if (!game.combat?.started) return;
  if (!("x" in changes) && !("y" in changes)) return;
  if (HLW.revertingTokens.has(tokenDocument.id)) return;

  const actor = tokenDocument.actor;
  if (!actor) return;

  HLW.lastLegalTokenPositions.set(tokenDocument.id, {
    x: numberValue(tokenDocument.x),
    y: numberValue(tokenDocument.y)
  });

  const currentActor = game.combat.combatant?.actor;
  if (currentActor?.id !== actor.id) {
    ui.notifications?.warn("Dieser Token ist gerade nicht am Zug.");
    return false;
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
  HLW.pendingLegalMoves.set(tokenDocument.id, {
    x: to.x,
    y: to.y,
    spent: nextSpent
  });
  actor.update({
    "system.combat.movementSpent": nextSpent,
    "system.actions.movement.available": limit <= 0 || nextSpent < limit - 0.01
  });
});

Hooks.on("updateToken", (tokenDocument, changes) => {
  if (!("x" in changes) && !("y" in changes)) return;
  if (HLW.revertingTokens.has(tokenDocument.id)) {
    HLW.revertingTokens.delete(tokenDocument.id);
    return;
  }

  if (game.combat?.started) {
    const actor = tokenDocument.actor;
    const currentActor = game.combat.combatant?.actor;
    if (actor && currentActor?.id === actor.id) {
      const current = { x: numberValue(tokenDocument.x), y: numberValue(tokenDocument.y) };
      const pendingMove = HLW.pendingLegalMoves.get(tokenDocument.id);
      if (pendingMove && Math.abs(pendingMove.x - current.x) < 0.01 && Math.abs(pendingMove.y - current.y) < 0.01) {
        HLW.pendingLegalMoves.delete(tokenDocument.id);
        HLW.lastLegalTokenPositions.set(tokenDocument.id, current);
        if (HLW.pendingSkill?.sourceTokenId === tokenDocument.id) window.setTimeout(refreshPendingSkillTargeting, 50);
        else window.setTimeout(renderCombatHud, 50);
        return;
      }

      const lastLegal = HLW.lastLegalTokenPositions.get(tokenDocument.id);
      const limit = numberValue(actor.system?.resources?.movement?.value);
      const spent = numberValue(actor.system?.combat?.movementSpent);
      const leakedDistance = lastLegal ? getPointDistanceInTiles(lastLegal, current) : 0;
      const remaining = Math.max(limit - spent, 0);
      if (lastLegal && limit > 0 && leakedDistance > remaining + 0.01) {
        HLW.revertingTokens.add(tokenDocument.id);
        tokenDocument.update(lastLegal);
        ui.notifications?.warn("Bewegungslimit erreicht. Token wurde zur erlaubten Position zurueckgesetzt.");
        return;
      }
    }
  }

  if (HLW.pendingSkill?.sourceTokenId === tokenDocument.id) {
    window.setTimeout(refreshPendingSkillTargeting, 50);
    return;
  }

  window.setTimeout(renderCombatHud, 50);
});

Hooks.on("updateActor", (actor) => {
  if (game.combat?.combatant?.actor?.id !== actor.id && HLW.pendingSkill?.actorId !== actor.id) return;
  window.setTimeout(renderCombatHud, 50);
});

Hooks.on("updateItem", (item) => {
  if (!item.parent) return;
  if (game.combat?.combatant?.actor?.id !== item.parent.id && HLW.pendingSkill?.actorId !== item.parent.id) return;
  window.setTimeout(renderCombatHud, 50);
});

Hooks.on("controlToken", () => {
  window.setTimeout(renderCombatHud, 50);
});
