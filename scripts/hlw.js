import { HopeLiesWithinTalkApp, registerTalk, registerTalkSettings } from "./hlw-talk.js";
import { erstelleLindhain } from "./hlw-szenen.js";
import { HopeLiesWithinGebenApp, skillSlots } from "./hlw-geben.js";
import { WORLD_SKILLS, berechneWerte, berechneMonster, angriffsWerte, kes, parseKes } from "./hlw-regeln.js";
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

HLW.worldSkills = WORLD_SKILLS;

HLW.initiativeFormula = "1d20 + @derived.initiative";
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
HLW.insigniaSlotDefaults = {
  slot1: { image: "", name: "", description: "" },
  slot2: { image: "", name: "", description: "" },
  slot3: { image: "", name: "", description: "" }
};
HLW.klassen = [];
HLW.pendingSkill = null;
HLW.rangeGraphics = null;
HLW.movementGraphics = null;
HLW.rangeHelp = null;
HLW.targetPicker = null;
HLW.combatHud = null;
HLW.lastHandledTurnKey = null;
HLW.lastLegalTokenPositions = new Map();
HLW.pendingLegalMoves = new Map();
HLW.movementSpentCache = new Map();
HLW.revertingTokens = new Set();

HLW.damageCategories = {
  physical: "Physisch",
  magical: "Magisch"
};
HLW.itemTypeLabels = {
  playerSkill: "Skills",
  classSkill: "Skills",
  weapon: "Waffen",
  armor: "Ruestung",
  equipment: "Ausrüstung",
  accessory: "Accessories",
  consumable: "Verbrauchbares",
  material: "Materialien",
  natural: "Naturgegenstände",
  mineral: "Mineralien",
  junk: "Müll",
  foodDrink: "Essen & Trinken"
};
HLW.gearItemTypes = ["weapon", "armor", "equipment", "accessory", "consumable", "material", "natural", "mineral", "junk", "foodDrink"];

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
  // Ein ausdruecklich gesetzter Wert gilt; nur ohne Angabe wird aus dem Text geraten (sonst waere z. B. „Eisenschwert“ magisch).
  if (["physical", "magical"].includes(value)) return value;
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

function getActiveInsignia(system) {
  const slots = prepareInsigniaSlots(system);
  const activeKey = system.progression?.activeInsignia || "slot1";
  return slots[activeKey] ?? slots.slot1;
}

function getInsigniaSlotList(system) {
  const slots = prepareInsigniaSlots(system);
  const activeKey = system.progression?.activeInsignia || "slot1";
  return Object.entries(slots).map(([key, slot]) => ({
    key,
    active: key === activeKey,
    ...slot
  }));
}

function prepareResources(system) {
  const resources = system.resources ?? {};
  resources.kes = resources.kes ?? { label: "Kes (in Silber-Kes)", value: 0 };
  resources.inventorySlots = resources.inventorySlots ?? { label: "Inventarplaetze", value: 0, max: 20 };
  return resources;
}

function countInventorySlots(items) {
  return Array.from(items ?? [])
    .filter((item) => HLW.gearItemTypes.includes(item.type))
    .reduce((sum, item) => sum + Math.max(numberValue(item.system?.quantity), 1), 0);
}

function normalizeTier(value) {
  const text = String(value ?? "").trim();
  if (!text) return 1;
  if (["gm", "abyss"].includes(text.toLowerCase())) return 5;
  const parsed = Number(text.match(/\d+/)?.[0]);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), 5);
}

function getActionPointState(actor) {
  const value = numberValue(actor.system?.resources?.actionPoints?.value);
  const max = Math.max(numberValue(actor.system?.resources?.actionPoints?.max), 0);
  return { value, max };
}

function hasActionPoints(actor, amount = 1) {
  return getActionPointState(actor).value >= amount;
}

async function spendActionPoints(actor, amount = 1) {
  const state = getActionPointState(actor);
  if (state.value < amount) {
    ui.notifications?.warn("Nicht genug Aktionspunkte.");
    return false;
  }

  const nextValue = Math.max(state.value - amount, 0);
  await actor.update({
    "system.resources.actionPoints.value": nextValue,
    "system.actions.main.available": nextValue > 0
  });
  return true;
}

function isQuickItem(item) {
  return String(item?.system?.castTime ?? "").toLowerCase() === "quick";
}

function canUseItemAction(actor, item) {
  if (isQuickItem(item)) return actor.system?.actions?.quick?.available !== false;
  return hasActionPoints(actor);
}

async function spendItemAction(actor, item) {
  if (isQuickItem(item)) {
    await actor.update({ "system.actions.quick.available": false });
    return true;
  }
  return spendActionPoints(actor);
}

function isHealingItem(item) {
  return /heil/i.test(`${item?.system?.skillType ?? ""} ${item?.system?.damageCategory ?? ""}`);
}

function isValidFormula(formula) {
  if (!formula) return false;
  try {
    return Roll.validate(formula);
  } catch (error) {
    return false;
  }
}

function isPassiveItem(item) {
  const activation = String(item.system?.activation ?? "").toLowerCase();
  return activation === "passive" || boolValue(item.system?.passive);
}

function getActivationLabel(item) {
  return isPassiveItem(item) ? "Passiv" : "Aktiv";
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
  help.innerText = `${skillName}: Ziel waehlen (${rawRange || rangeLimit} Felder). Button erneut klicken bricht ab.`;
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
          <strong>${distance.toFixed(1)} Felder</strong>
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
    .filter((item) => item.type === "weapon" || !isPassiveItem(item))
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
      isPassive: isPassiveItem(item),
      usable: canUseItemAction(actor, item),
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
  const ap = getActionPointState(actor);
  const canAct = ap.value > 0;
  const isCurrentTurn = game.combat?.combatant?.actor?.id === actor.id;
  const skills = getUsableCombatItems(actor);
  const skillButtons = skills.length
    ? skills.map((item) => `
      <button type="button" class="hlw-hud-skill ${item.pending ? "is-pending" : ""}" data-hud-skill="${item.id}" ${(!item.usable || item.cooldown > 0) && !item.pending ? "disabled" : ""}>
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
      <div><span>Aktion</span><strong>${numberValue(actionPoints.value)} / ${numberValue(actionPoints.max)}</strong></div>
      <div><span>Schnellaktion</span><strong>${actor.system?.actions?.quick?.available === false ? "verbraucht" : "bereit"}</strong></div>
      <div><span>RW / MR</span><strong>${numberValue(actor.system?.derived?.rw)} / ${numberValue(actor.system?.derived?.mr)}</strong></div>
    </section>
    <section class="hlw-hud-actions">
      <button type="button" data-hud-standard="attack" ${canAct ? "" : "disabled"}>Angriff</button>
      <button type="button" data-hud-standard="item" ${canAct ? "" : "disabled"}>Item</button>
      <button type="button" data-hud-standard="defend" ${canAct ? "" : "disabled"}>Abwehr</button>
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

  const maxActionPoints = Math.max(numberValue(actor.system?.resources?.actionPoints?.max), 1);
  const updates = {
    "system.actions.main.available": true,
    "system.actions.movement.available": true,
    "system.actions.bonus.available": true,
    "system.actions.quick.available": true,
    "system.actions.reaction.available": true,
    "system.resources.actionPoints.value": maxActionPoints,
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
  for (const token of actor.getActiveTokens?.() ?? []) HLW.movementSpentCache.delete(token.id);
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
  async _onCreate(data, options, userId) {
    await super._onCreate?.(data, options, userId);
    if (game.user?.id !== userId) return;
    const max = numberValue(this.system?.derived?.hpMax);
    if (max > 0 && numberValue(this.system?.resources?.hp?.value) !== max) await this.update({ "system.resources.hp.value": max });
  }

  getRollData() {
    const data = super.getRollData();
    data.attributes = this.system.attributes ?? {};
    data.resources = this.system.resources ?? {};
    data.derived = this.system.derived ?? {};
    return data;
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    const system = this.system;
    if (!system?.attributes || !system?.worldSkills) return;

    system.insigniaSlots = prepareInsigniaSlots(system);
    system.progression.activeInsignia = system.progression.activeInsignia || "slot1";
    system.resources = prepareResources(system);
    system.combat = system.combat ?? {};
    system.combat.defending = boolValue(system.combat.defending);

    // Kampfwerte nach Kanon 2.0 (Tab Kampfwerte): HP, Ruestwert, Magieresistenz, Blockwert, Bewegung, Initiative, Inventar.
    const derived = this.type === "monster" ? berechneMonster(system) : berechneWerte(system, this.items, HLW.klassen);
    system.derived = derived;
    system.resources.hp.max = derived.hpMax;
    // Alte Charaktere (z. B. 1000 HP aus dem alten System) werden auf das neue Maximum begrenzt.
    if (numberValue(system.resources.hp.value) > derived.hpMax) system.resources.hp.value = derived.hpMax;
    system.resources.movement.value = derived.movement;
    if (this.type !== "monster") system.resources.inventorySlots.max = derived.inventory;

    for (const [key, definition] of Object.entries(HLW.worldSkills)) {
      const current = system.worldSkills[key] ?? { bonus: 0 };
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

  // Klassen-Skills der gewaehlten Klasse geben. Skills frueherer Klassen bleiben (Klassenregeln).
  async erhalteKlassenSkills(klassenName) {
    if (!klassenName) return [];
    const klasse = HLW.klassen.find((k) => k.name === klassenName);
    const vorhanden = new Set(this.items.filter((i) => i.type === "classSkill").map((i) => i.name));
    let neu = (game.items?.contents ?? [])
      // Awaken-Skills kommen nicht automatisch: sie werden erst durch ihre Bedingung freigeschaltet (GM gibt sie per „Skill geben“).
      .filter((i) => i.type === "classSkill" && i.system?.className === klassenName && !vorhanden.has(i.name))
      .filter((i) => !i.system?.awaken && i.system?.source !== "Awaken")
      .map((i) => {
        const data = i.toObject();
        delete data._id;
        delete data.folder;
        return data;
      });
    const hatSkill = this.items.some((i) => i.type === "classSkill" && i.system?.className === klassenName);
    if (!neu.length && !hatSkill && klasse && !vorhanden.has(klasse.skill)) {
      // Klasse ohne eigenes Skill-Item (z. B. die Basic-Klassen): Skill aus der Klassenliste anlegen.
      const rang = { Basic: "E", T1: "D", T2: "C", T3: "B", Story: "A" }[klasse.category] ?? "";
      const aktiv = /\dW\d|einmal|pro kampf|aktion/i.test(klasse.effect);
      neu = [{
        name: klasse.skill,
        type: "classSkill",
        img: klasse.img || "icons/magic/symbols/question-stone-yellow.webp",
        system: { className: klasse.name, skillType: klasse.role, rank: rang, activation: aktiv ? "active" : "passive", effect: klasse.effect, description: `${klasse.name} (${klasse.category}): ${klasse.effect}`, price: "nicht verkäuflich" }
      }];
    }
    if (!neu.length) return [];
    const created = await this.createEmbeddedDocuments("Item", neu);
    ui.notifications?.info(`${this.name} erhält: ${created.map((i) => i.name).join(", ")}`);
    return created;
  }

  async rollWorldSkill(skillKey) {
    const skill = this.system.worldSkills?.[skillKey];
    if (!skill) return;

    const total = numberValue(skill.total);
    const formula = `1d20 + ${total}`;
    const roll = await new Roll(formula, this.getRollData()).evaluate();

    // Kanon 2.0: natuerliche 20 gelingt immer, natuerliche 1 misslingt immer.
    const natur = numberValue(roll.dice?.[0]?.total);
    const hinweis = natur === 20 ? " · <strong>Natürliche 20: Erfolg</strong>" : natur === 1 ? " · <strong>Natürliche 1: Fehlschlag</strong>" : "";
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${skill.label}</strong> (${skill.attributes.map((key) => HLW.attributeLabels[key]).join(" + ")})${hinweis}`
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
    if (!hasActionPoints(this)) {
      ui.notifications?.warn("Nicht genug Aktionspunkte.");
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
        content: `<div class="hlw-chat-card"><h2>Abwehrhaltung</h2><p>${escapeHtml(this.name)} bekommt bis zum naechsten eigenen Zug Rüstwert und Magieresistenz +2.</p></div>`
      });
      await this.update({ "system.combat.defending": true });
      await spendActionPoints(this);
      return;
    }

    if (actionType === "item") {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="hlw-chat-card"><h2>Item verwenden</h2><p>${escapeHtml(this.name)} verwendet ein Item. Die konkrete Item-Wirkung wird in einer spaeteren Version automatisiert.</p></div>`
      });
      await spendActionPoints(this);
    }
  }

  async toggleEquipped(itemId) {
    const item = this.items.get(itemId);
    if (!item) return;

    const nextValue = !boolValue(item.system?.equipped);
    if (item.type === "accessory" && nextValue) {
      const equippedAccessories = this.items.filter((entry) => entry.type === "accessory" && boolValue(entry.system?.equipped) && entry.id !== item.id);
      if (equippedAccessories.length >= 3) {
        ui.notifications?.warn("Es koennen maximal 3 Accessories ausgeruestet sein.");
        return;
      }
    }

    await item.update({ "system.equipped": nextValue });
  }

  editOwnedItem(itemId) {
    const item = this.items.get(itemId);
    if (!item) return;

    const sheet = new HopeLiesWithinItemSheet(item);
    sheet.render(true);
  }

  showOwnedItemDetails(itemId) {
    const item = this.items.get(itemId);
    if (!item) return;

    const price = item.system?.priceSk ? kes(item.system.priceSk) : item.system?.price || "-";
    const quantity = Math.max(numberValue(item.system?.quantity), 1);
    const description = item.system?.description || item.system?.effect || "Keine Beschreibung.";
    const gmRows = game.user?.isGM ? `
      <dt>Rang</dt><dd>${escapeHtml(item.system?.rank || "-")}</dd>
      <dt>Fundort</dt><dd>${escapeHtml(item.system?.source || "-")}</dd>
      <dt>Marktwert</dt><dd>${escapeHtml(price)}</dd>
    ` : "";
    const content = `
      <div class="hlw-item-detail">
        <img src="${escapeHtml(item.img || "")}" alt="">
        <div>
          <h2>${escapeHtml(item.name)}</h2>
          <dl>
            <dt>Kategorie</dt><dd>${escapeHtml(HLW.itemTypeLabels[item.type] ?? item.type)}</dd>
            <dt>Anzahl</dt><dd>${quantity}</dd>
            ${gmRows}
          </dl>
          <p>${escapeHtml(description)}</p>
        </div>
      </div>
    `;

    new Dialog({
      title: item.name,
      content,
      classes: ["hope-lies-within", "hlw-detail-dialog"],
      buttons: {
        close: { label: "Schliessen" }
      }
    }).render(true);
  }

  async consumeOwnedItem(itemId) {
    const item = this.items.get(itemId);
    if (!item) return;

    const quantity = Math.max(numberValue(item.system?.quantity), 1);
    if (quantity > 1) await item.update({ "system.quantity": quantity - 1 });
    else await this.deleteEmbeddedDocuments("Item", [item.id]);
    ui.notifications?.info(`${item.name} verbraucht.`);
  }

  async discardOwnedItem(itemId) {
    const item = this.items.get(itemId);
    if (!item) return;

    const confirmed = await Dialog.confirm({
      title: `${item.name} wegwerfen?`,
      content: `<p>${escapeHtml(item.name)} wirklich entfernen?</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });
    if (!confirmed) return;

    await this.deleteEmbeddedDocuments("Item", [item.id]);
    ui.notifications?.info(`${item.name} wurde weggeworfen.`);
  }

  async deleteOwnedSkill(itemId) {
    const item = this.items.get(itemId);
    if (!item || !["playerSkill", "classSkill"].includes(item.type)) return;

    const confirmed = await Dialog.confirm({
      title: `${item.name} entfernen?`,
      content: `<p>Skill von ${escapeHtml(this.name)} entfernen?</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });
    if (!confirmed) return;

    await this.deleteEmbeddedDocuments("Item", [item.id]);
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
    const value = Math.abs(parseKes(amount));
    if (value <= 0) return;

    const targetToken = Array.from(game.user?.targets ?? []).find((token) => token.actor && token.actor.id !== this.id);
    if (!targetToken?.actor) {
      ui.notifications?.warn("Bitte den Empfaenger als Foundry-Target markieren.");
      return;
    }

    const own = numberValue(this.system?.resources?.kes?.value);
    if (own < value) {
      ui.notifications?.warn("Nicht genug Kes.");
      return;
    }

    const target = numberValue(targetToken.actor.system?.resources?.kes?.value);
    await this.update({ "system.resources.kes.value": own - value });
    await targetToken.actor.update({ "system.resources.kes.value": target + value });
    ui.notifications?.info(`${kes(value)} an ${targetToken.name} gegeben.`);
  }

  async addGold(amount) {
    if (!game.user?.isGM) {
      ui.notifications?.warn("Nur der GM kann Kes frei hinzufuegen.");
      return;
    }

    const value = parseKes(amount);
    if (!value) return;

    const current = numberValue(this.system?.resources?.kes?.value);
    await this.update({ "system.resources.kes.value": Math.max(current + value, 0) });
    ui.notifications?.info(`${value < 0 ? "−" : "+"}${kes(Math.abs(value))} bei ${this.name} gebucht.`);
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

    if (sourceType === "skill" && isPassiveItem(item)) {
      ui.notifications?.warn(`${item.name} ist ein passiver Skill und kann nicht als Aktion genutzt werden.`);
      return;
    }

    const cooldown = item.system?.cooldown ?? {};
    const currentCooldown = numberValue(cooldown.value);

    if (currentCooldown > 0) {
      ui.notifications?.warn(`${item.name} ist noch ${currentCooldown} Zug(e) auf Cooldown.`);
      return;
    }

    if (!canUseItemAction(this, item)) {
      ui.notifications?.warn(isQuickItem(item) ? "Die Schnellaktion ist schon verbraucht." : "Die Aktion ist schon verbraucht.");
      return;
    }

    const damageFormula = normalizeFormula(item.system?.damage);
    const hasDamage = isValidFormula(damageFormula);
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

    if (["playerSkill", "classSkill"].includes(item.type) && isPassiveItem(item)) {
      ui.notifications?.warn(`${item.name} ist passiv und kann nicht als Aktion genutzt werden.`);
      return;
    }

    const cooldown = item.system?.cooldown ?? {};
    const currentCooldown = numberValue(cooldown.value);
    const maxCooldown = numberValue(cooldown.max);

    if (currentCooldown > 0) {
      ui.notifications?.warn(`${item.name} ist noch ${currentCooldown} Zug(e) auf Cooldown.`);
      return;
    }

    if (!canUseItemAction(this, item)) {
      ui.notifications?.warn(isQuickItem(item) ? "Die Schnellaktion ist schon verbraucht." : "Die Aktion ist schon verbraucht.");
      return;
    }

    const damageFormula = normalizeFormula(item.system?.damage);
    const hasDamage = isValidFormula(damageFormula);
    const healing = isHealingItem(item);
    const sourceToken = getPendingSourceToken(this);
    let result = null;

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

      const rangeLimit = getEffectiveRangeInTiles(item.system?.range);
      const distance = getTokenDistanceInTiles(sourceToken, targetToken);
      if (rangeLimit > 0 && distance > rangeLimit + 0.01) {
        ui.notifications?.warn(`${targetToken.name} ist ausser Reichweite (${distance.toFixed(1)} / ${rangeLimit} Felder).`);
        return;
      }

      // Kanon 2.0: Schaden = Skillschaden + Waffenschaden + Schadensbonus − Blockwert des Ziels (mindestens 1).
      const werte = angriffsWerte(this, item);
      const magisch = normalizeDamageCategory(item.system?.damageCategory, `${item.system?.skillType} ${item.name}`) === "magical";
      const waffe = item.type !== "weapon" && !healing && this.type !== "monster"
        ? this.items.find((entry) => entry.type === "weapon" && boolValue(entry.system?.equipped))
        : null;
      const waffenFormel = waffe ? normalizeFormula(waffe.system?.damage) : "";
      const teile = [damageFormula, waffenFormel].filter(isValidFormula).map((f) => `(${f})`);
      const formel = `${teile.join(" + ")}${werte.bonus ? ` + ${werte.bonus}` : ""}`;
      const target = targetToken.actor;
      const targetDerived = target?.system?.derived ?? {};
      const currentHp = numberValue(target?.system?.resources?.hp?.value);
      result = { targetName: targetToken.name, targetIsMonster: target?.type === "monster", distance, range: rangeLimit, healing, magisch, waffe: waffe?.name, werte };

      if (healing) {
        const roll = await new Roll(formel, this.getRollData()).evaluate();
        const maxHp = numberValue(target?.system?.resources?.hp?.max) || currentHp + roll.total;
        const nextHp = Math.min(currentHp + numberValue(roll.total), maxHp);
        if (target) await target.update({ "system.resources.hp.value": nextHp });
        Object.assign(result, { roll, amount: nextHp - currentHp, nextHp });
      } else {
        const verteidigung = numberValue(magisch ? targetDerived.mr : targetDerived.rw) || 10;
        const angriff = await new Roll(`1d20 + ${werte.acc}`).evaluate();
        const natur = numberValue(angriff.dice?.[0]?.total);
        const kritisch = natur === 20;
        const patzer = natur === 1;
        const trifft = !patzer && (kritisch || angriff.total >= verteidigung);
        Object.assign(result, { angriff, natur, kritisch, patzer, trifft, verteidigung, verteidigungsArt: magisch ? "MR" : "RW" });

        if (trifft) {
          let roll = new Roll(formel, this.getRollData());
          if (kritisch) roll = roll.alter(2, 0);
          await roll.evaluate();
          const block = numberValue(targetDerived.block);
          const finalDamage = Math.max(numberValue(roll.total) - block, 1);
          const nextHp = Math.max(currentHp - finalDamage, 0);
          if (target) await target.update({ "system.resources.hp.value": nextHp });
          let defeated = false;
          if (nextHp <= 0 && target) {
            defeated = true;
            const combatant = game.combat?.combatants.find((entry) => entry.tokenId === targetToken.document?.id || entry.actor?.id === target.id);
            if (combatant && target.type === "monster") await combatant.update({ defeated: true });
          }
          Object.assign(result, { roll, block, finalDamage, nextHp, defeated });
        }
      }
    }

    const skillType = escapeHtml(item.system?.skillType || HLW.itemTypeLabels[item.type] || "");
    const range = escapeHtml(item.system?.range);
    const damage = escapeHtml(item.system?.damageText || item.system?.damage);
    const effect = escapeHtml(item.system?.effect || item.system?.description);
    let ergebnis = "";
    if (result?.healing) {
      ergebnis = `<dt>Ziel</dt><dd>${escapeHtml(result.targetName)}</dd>
        <dt>Heilung</dt><dd>${result.roll.formula} = <strong>${result.roll.total}</strong> (${result.amount} geheilt)</dd>`;
    } else if (result) {
      const wurf = `${result.natur} + ${result.werte.acc} = ${result.angriff.total} gegen ${result.verteidigungsArt} ${result.verteidigung}`;
      const status = result.kritisch ? "Kritischer Treffer" : result.patzer ? "Natürliche 1: daneben" : result.trifft ? "Treffer" : "Verfehlt";
      ergebnis = `<dt>Ziel</dt><dd>${escapeHtml(result.targetName)} (${result.distance.toFixed(1)} Felder)</dd>
        <dt>Angriff</dt><dd>${wurf}</dd>
        <dt>Ergebnis</dt><dd><strong>${status}</strong></dd>
        ${result.trifft ? `<dt>Schaden</dt><dd>${result.roll.formula} = ${result.roll.total}${result.block ? ` − Blockwert ${result.block}` : ""}</dd>
        <dt>Finaler Schaden</dt><dd><strong>${result.finalDamage}</strong></dd>` : ""}
        ${result.defeated ? `<dt>Status</dt><dd><strong>${result.targetIsMonster ? "Besiegt" : "Am Boden (Sterbewürfe)"}</strong></dd>` : ""}`;
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="hlw-chat-card">
          <h2>${escapeHtml(item.name)}</h2>
          <dl>
            <dt>Art</dt><dd>${skillType || "-"}${isQuickItem(item) ? " · Schnellaktion" : ""}</dd>
            <dt>Reichweite</dt><dd>${range || "-"}</dd>
            <dt>${result?.healing ? "Heilung" : "Schaden"}</dt><dd>${damage || "-"}${result?.waffe ? ` + ${escapeHtml(result.waffe)}` : ""}</dd>
            <dt>Cooldown</dt><dd>${maxCooldown || 0} Zug(e)</dd>
            ${ergebnis}
          </dl>
          ${effect ? `<p>${effect}</p>` : ""}
        </div>
      `
    });

    if (maxCooldown > 0) {
      await item.update({ "system.cooldown.value": maxCooldown });
    }

    await spendItemAction(this, item);
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
    context.activeInsignia = getActiveInsignia(context.system);
    context.insigniaSlots = getInsigniaSlotList(context.system);
    context.profileImage = context.activeInsignia?.image || context.actor.img;
    context.isGM = game.user?.isGM;
    context.canAct = hasActionPoints(context.actor);
    context.inventoryUsed = countInventorySlots(context.actor.items);
    context.inventoryMax = numberValue(context.system.resources?.inventorySlots?.max);
    context.isMonster = context.actor.type === "monster";
    context.skillSlots = skillSlots(context.actor);
    // Klassen-Auswahl fuer den GM: alle Klassen nach Kategorie, der Vorschlag aus der Wertverteilung ist markiert.
    const vorschlag = context.system.derived?.suggestedClassName ?? "";
    const aktuell = context.system.progression?.class ?? "";
    context.klasseAnzeige = aktuell || context.system.derived?.suggestedClass || "";
    context.klassenGruppen = ["Basic", "T1", "T2", "T3", "Story"].map((kategorie) => ({
      kategorie,
      klassen: HLW.klassen.filter((k) => k.category === kategorie).map((k) => ({
        name: k.name,
        label: `${k.name}${k.name === vorschlag ? " ★ Vorschlag" : ""}`,
        selected: k.name === aktuell
      }))
    })).filter((gruppe) => gruppe.klassen.length);
    context.vorschlagLabel = vorschlag ? `— automatisch: ${vorschlag} —` : "— automatisch (noch keine Klasse) —";
    context.kesText = kes(context.system.resources?.kes?.value);
    context.pointsOver = numberValue(context.system.derived?.points?.free) < 0;
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
      event.stopPropagation();
      this.actor.editOwnedItem(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    });

    html.find("[data-give-owned-item]").on("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.actor.giveItemToTarget(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    });

    html.find("[data-toggle-equipped]").on("change", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.actor.toggleEquipped(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    });

    html.find("[data-consume-owned-item]").on("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.actor.consumeOwnedItem(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    });

    html.find("[data-discard-owned-item]").on("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.actor.discardOwnedItem(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    });

    html.find("[data-delete-skill]").on("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.actor.deleteOwnedSkill(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    });

    html.find("[data-show-item-details]").on("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.actor.showOwnedItemDetails(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    });

    html.find("[data-give-gold]").on("click", (event) => {
      event.preventDefault();
      const input = html.find("[data-gold-amount]");
      this.actor.giveGoldToTarget(input.val());
      input.val("");
    });

    html.find("[data-add-gold]").on("click", (event) => {
      event.preventDefault();
      const input = html.find("[data-add-gold-amount]");
      this.actor.addGold(input.val());
      input.val("");
    });

    html.find("[data-geben]").on("click", (event) => {
      event.preventDefault();
      if (!game.user?.isGM) return;
      new HopeLiesWithinGebenApp(this.actor, event.currentTarget.dataset.geben).render({ force: true });
    });

    html.find("[data-import-json]").on("click", async (event) => {
      event.preventDefault();
      if (!game.user?.isGM) return;
      await importAllJsonFiles();
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
      materials: [],
      accessories: [],
      natural: [],
      minerals: [],
      junk: [],
      foodDrink: []
    };

    for (const item of items) {
      if (["playerSkill", "classSkill"].includes(item.type)) {
        const passive = isPassiveItem(item);
        groups.skills.push({
          id: item.id,
          name: item.name,
          type: item.type,
          system: item.system,
          canUse: !passive && hasActionPoints(this.actor) && numberValue(item.system?.cooldown?.value) <= 0,
          isPassive: passive,
          activationLabel: getActivationLabel(item),
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
        else if (item.type === "accessory") groups.accessories.push(preparedItem);
        else if (item.type === "consumable") groups.consumables.push(preparedItem);
        else if (item.type === "material") groups.materials.push(preparedItem);
        else if (item.type === "natural") groups.natural.push(preparedItem);
        else if (item.type === "mineral") groups.minerals.push(preparedItem);
        else if (item.type === "junk") groups.junk.push(preparedItem);
        else if (item.type === "foodDrink") groups.foodDrink.push(preparedItem);
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
    context.isGM = game.user?.isGM;
    context.isArmor = context.item.type === "armor";
    context.isWeapon = context.item.type === "weapon";
    context.priceText = context.system.priceSk ? kes(context.system.priceSk) : context.system.price;
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Appraisal: Ruestungs-HP werden einmal gewuerfelt und dann fest eingetragen.
    html.find("[data-roll-item-hp]").on("click", async (event) => {
      event.preventDefault();
      const formula = normalizeFormula(this.item.system?.hpDice);
      if (!isValidFormula(formula)) return ui.notifications?.warn("Kein gültiger HP-Würfel eingetragen.");
      const roll = await new Roll(formula).evaluate();
      await this.item.update({ "system.hp": roll.total });
      await roll.toMessage({ flavor: `Appraisal: ${escapeHtml(this.item.name)} (HP ${formula})` });
    });

    html.find("[data-delete-item]").on("click", async (event) => {
      event.preventDefault();
      if (!game.user?.isGM) return;

      const confirmed = await Dialog.confirm({
        title: `${this.item.name} loeschen?`,
        content: `<p>${escapeHtml(this.item.name)} wirklich dauerhaft loeschen?</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: false
      });
      if (!confirmed) return;

      await this.item.delete();
      this.close();
    });
  }
}

function normalizeImportType(type) {
  const key = String(type ?? "").trim().toLowerCase();
  const aliases = {
    playerskill: "playerSkill",
    player_skill: "playerSkill",
    player: "playerSkill",
    skill: "playerSkill",
    classskill: "classSkill",
    class_skill: "classSkill",
    klasse: "classSkill",
    weapon: "weapon",
    waffe: "weapon",
    weapons: "weapon",
    armor: "armor",
    armour: "armor",
    ruestung: "armor",
    rüstung: "armor",
    equipment: "equipment",
    ausruestung: "equipment",
    ausrüstung: "equipment",
    accessory: "accessory",
    accessories: "accessory",
    accessoire: "accessory",
    accessoires: "accessory",
    consumable: "consumable",
    verbrauchbar: "consumable",
    material: "material",
    natural: "natural",
    natur: "natural",
    naturgegenstand: "natural",
    mineral: "mineral",
    minerals: "mineral",
    mineralien: "mineral",
    junk: "junk",
    muell: "junk",
    müll: "junk",
    food: "foodDrink",
    drink: "foodDrink",
    fooddrink: "foodDrink",
    essen: "foodDrink",
    trinken: "foodDrink"
  };

  return aliases[key] ?? type ?? "equipment";
}

function normalizeImportedItem(entry, fallbackType = "equipment") {
  const type = normalizeImportType(entry.type ?? fallbackType);
  const systemData = foundry.utils.deepClone(entry.system ?? {});

  for (const [sourceKey, targetKey] of [
    ["beschreibung", "description"],
    ["quelle", "source"],
    ["anzahl", "quantity"],
    ["preis", "price"],
    ["schaden", "damage"],
    ["reichweite", "range"],
    ["effekt", "effect"],
    ["aktivierung", "activation"],
    ["kategorie", "damageCategory"],
    ["schadenstyp", "damageType"],
    ["fundort", "source"],
    ["wert", "price"],
    ["gold", "price"],
    ["faehigkeit", "effect"],
    ["fähigkeit", "effect"],
    ["lernpoints", "learningPoints"],
    ["lernpunkte", "learningPoints"]
  ]) {
    if (entry[sourceKey] !== undefined && systemData[targetKey] === undefined) systemData[targetKey] = entry[sourceKey];
  }

  systemData.tier = normalizeTier(systemData.tier ?? entry.tier ?? entry.Tier);

  if (["playerSkill", "classSkill"].includes(type)) {
    systemData.activation = systemData.activation ?? "active";
    systemData.cooldown = systemData.cooldown ?? { value: 0, max: 0 };
    systemData.scaling = systemData.scaling ?? { primary: "", secondary: "", tertiary: "" };
    if (entry.primary !== undefined && !systemData.scaling.primary) systemData.scaling.primary = entry.primary;
    if (entry.secondary !== undefined && !systemData.scaling.secondary) systemData.scaling.secondary = entry.secondary;
    if (entry.tertiary !== undefined && !systemData.scaling.tertiary) systemData.scaling.tertiary = entry.tertiary;
  } else {
    systemData.quantity = Math.max(numberValue(systemData.quantity ?? entry.quantity), 1);
  }

  return {
    name: entry.name ?? entry.Name ?? "Unbenannt",
    type,
    img: entry.img ?? entry.image ?? "icons/svg/item-bag.svg",
    folderPath: entry.folder,
    system: systemData
  };
}

function getImportFolderPath(itemData) {
  if (itemData.folderPath) return itemData.folderPath;
  const category = HLW.itemTypeLabels[itemData.type] ?? "Sonstiges";
  const tier = normalizeTier(itemData.system?.tier);
  return `HLW Import/${category}/Tier ${tier}`;
}

async function ensureItemFolderPath(path, type = "Item") {
  const parts = String(path ?? "").split("/").map((part) => part.trim()).filter(Boolean);
  let parent = null;

  for (const name of parts) {
    const existing = game.folders?.find((folder) => {
      const parentId = parent?.id ?? null;
      const folderParentId = folder.folder?.id ?? folder.folder ?? null;
      return folder.type === type && folder.name === name && folderParentId === parentId;
    });

    parent = existing ?? await Folder.create({
      name,
      type,
      folder: parent?.id ?? null
    });
  }

  return parent;
}

async function importJsonFile(path, fallbackType = "equipment") {
  if (!game.user?.isGM) {
    ui.notifications?.warn("Nur der GM kann JSON-Imports ausfuehren.");
    return [];
  }

  const response = await fetch(path);
  if (!response.ok) throw new Error(`Import fehlgeschlagen: ${path}`);

  const json = await response.json();
  const entries = Array.isArray(json) ? json : json.items ?? [];
  if (!entries.length) {
    ui.notifications?.info(`${path} enthaelt keine Eintraege.`);
    return [];
  }

  const documents = [];
  for (const entry of entries) {
    const itemData = normalizeImportedItem(entry, fallbackType);
    const duplicate = game.items?.find((item) => item.name === itemData.name && item.type === itemData.type);
    if (duplicate) continue;

    const folder = await ensureItemFolderPath(getImportFolderPath(itemData));
    if (folder) itemData.folder = folder.id;
    delete itemData.folderPath;
    documents.push(itemData);
  }
  const created = await Item.createDocuments(documents);
  ui.notifications?.info(`${created.length} Eintraege aus ${path} importiert.`);
  return created;
}

async function importAllJsonFiles() {
  const basePath = "systems/hope-lies-within-2/import";
  const imports = [
    ["weapons.json", "weapon"],
    ["armor.json", "armor"],
    ["accessories.json", "accessory"],
    ["equipment.json", "equipment"],
    ["consumables.json", "consumable"],
    ["food-drink.json", "foodDrink"],
    ["materials.json", "material"],
    ["natural.json", "natural"],
    ["minerals.json", "mineral"],
    ["junk.json", "junk"],
    ["skills.json", "playerSkill"],
    ["class-skills.json", "classSkill"]
  ];

  const results = [];
  for (const [fileName, fallbackType] of imports) {
    results.push(...await importJsonFile(`${basePath}/${fileName}`, fallbackType));
  }
  results.push(...await importMonsters(`${basePath}/monsters.json`));
  await aktualisiereBilder();
  return results;
}

// Bilder nachziehen: Eintraege, die noch das Standardbild haben, bekommen das Symbol aus den Importdateien.
// Mit { alle: true } werden auch schon gesetzte Symbole aus Foundrys Bibliothek durch die aktuelle Zuordnung ersetzt.
async function aktualisiereBilder({ alle = false } = {}) {
  if (!game.user?.isGM) return 0;
  const basePath = "systems/hope-lies-within-2/import";
  const dateien = ["weapons", "armor", "accessories", "equipment", "consumables", "food-drink", "materials", "natural", "minerals", "junk", "skills", "class-skills", "monsters"];
  const bilder = new Map();
  for (const datei of dateien) {
    const response = await fetch(`${basePath}/${datei}.json`);
    if (!response.ok) continue;
    for (const entry of await response.json()) bilder.set(`${entry.type}|${entry.name}`, entry.img);
  }
  const standard = (img) => !img || /icons\/svg\/(item-bag|mystery-man)/.test(img) || (alle && /^icons\//.test(img));
  let anzahl = 0;
  const itemUpdates = game.items.filter((i) => standard(i.img) && bilder.has(`${i.type}|${i.name}`)).map((i) => ({ _id: i.id, img: bilder.get(`${i.type}|${i.name}`) }));
  if (itemUpdates.length) await Item.updateDocuments(itemUpdates);
  anzahl += itemUpdates.length;
  for (const actor of game.actors) {
    const updates = actor.items.filter((i) => standard(i.img) && bilder.has(`${i.type}|${i.name}`)).map((i) => ({ _id: i.id, img: bilder.get(`${i.type}|${i.name}`) }));
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
    anzahl += updates.length;
    const monsterBild = bilder.get(`monster|${actor.name}`);
    if (actor.type === "monster" && monsterBild && standard(actor.img)) {
      await actor.update({ img: monsterBild, "prototypeToken.texture.src": monsterBild });
      anzahl += 1;
    }
  }
  ui.notifications?.info(`${anzahl} Bilder aktualisiert.`);
  return anzahl;
}

// Bestiarium: Monster als Actors mit ihrem Angriff als Waffe.
async function importMonsters(path) {
  if (!game.user?.isGM) return [];
  const response = await fetch(path);
  if (!response.ok) return [];
  const entries = await response.json();
  const documents = [];
  for (const entry of entries) {
    if (game.actors?.find((actor) => actor.name === entry.name && actor.type === "monster")) continue;
    const folder = await ensureItemFolderPath(entry.folder, "Actor");
    documents.push({
      name: entry.name,
      type: "monster",
      img: entry.img,
      folder: folder?.id,
      system: entry.system,
      items: entry.items ?? [],
      prototypeToken: { name: entry.name, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE, texture: { src: entry.img } }
    });
  }
  const created = documents.length ? await Actor.createDocuments(documents) : [];
  ui.notifications?.info(`${created.length} Monster aus dem Bestiarium importiert.`);
  return created;
}

Hooks.once("init", () => {
  console.log("Hope lies Within 2.0 | Initialisiere System");

  CONFIG.HLW = HLW;
  registerTalkSettings();
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
      types: ["playerSkill", "classSkill", "weapon", "armor", "equipment", "accessory", "consumable", "material", "natural", "mineral", "junk", "foodDrink"]
    });
  } else {
    console.warn("Hope lies Within 2.0 | Klassische ItemSheet-API nicht gefunden. System startet ohne eigenes Item Sheet.");
  }
});

Hooks.once("ready", async () => {
  // Klassenliste fuer die automatische Klassenzuteilung (Lvl-Saetze aus Kanon 2.0)
  try {
    HLW.klassen = await (await fetch("systems/hope-lies-within-2/data/klassen.json")).json();
    for (const actor of game.actors ?? []) actor.prepareData();
  } catch (error) {
    console.warn("Hope lies Within 2.0 | Klassenliste nicht geladen", error);
  }

  game.hlw = {
    importJsonFile,
    importAllJson: importAllJsonFiles,
    importMonsters,
    aktualisiereBilder,
    erstelleLindhain,
    gespraech: (actor) => HopeLiesWithinTalkApp.openFor(actor)
  };
  registerTalk();

  game.socket.on("system.hope-lies-within-2", async (data) => {
    if (!game.user?.isGM) return;
    if (data?.type !== "endTurn") return;

    const combat = game.combats?.get(data.combatId);
    if (!combat?.started) return;
    if (combat.combatant?.actor?.id !== data.actorId) return;

    await combat.nextTurn();
  });
});

Hooks.on("renderItemDirectory", (app, html) => {
  if (!game.user?.isGM) return;

  const root = html?.[0] ?? html;
  if (!root?.querySelector) return;
  if (root.querySelector("[data-hlw-sidebar-import]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "hlw-sidebar-import";
  button.dataset.hlwSidebarImport = "true";
  button.innerText = "HLW JSON Import";
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    await importAllJsonFiles();
  });

  const target = root.querySelector(".directory-header") ?? root.querySelector("header") ?? root;
  target.appendChild(button);
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
  HLW.movementSpentCache.clear();
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
  const spent = HLW.movementSpentCache.has(tokenDocument.id)
    ? numberValue(HLW.movementSpentCache.get(tokenDocument.id))
    : numberValue(actor.system?.combat?.movementSpent);
  const remaining = Math.max(limit - spent, 0);

  if (limit > 0 && distance > remaining + 0.01) {
    ui.notifications?.warn(`Bewegungslimit erreicht: ${remaining.toFixed(1)} Felder uebrig.`);
    return false;
  }

  const nextSpent = spent + distance;
  HLW.movementSpentCache.set(tokenDocument.id, nextSpent);
  HLW.pendingLegalMoves.set(tokenDocument.id, {
    x: to.x,
    y: to.y,
    spent: nextSpent
  });
});

Hooks.on("updateToken", async (tokenDocument, changes) => {
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
      const limit = numberValue(actor.system?.resources?.movement?.value);
      const pendingMove = HLW.pendingLegalMoves.get(tokenDocument.id);
      if (pendingMove && Math.abs(pendingMove.x - current.x) < 0.01 && Math.abs(pendingMove.y - current.y) < 0.01) {
        HLW.pendingLegalMoves.delete(tokenDocument.id);
        HLW.lastLegalTokenPositions.set(tokenDocument.id, current);
        await actor.update({
          "system.combat.movementSpent": pendingMove.spent,
          "system.actions.movement.available": limit <= 0 || pendingMove.spent < limit - 0.01
        });
        if (HLW.pendingSkill?.sourceTokenId === tokenDocument.id) window.setTimeout(refreshPendingSkillTargeting, 50);
        else window.setTimeout(renderCombatHud, 50);
        return;
      }

      const lastLegal = HLW.lastLegalTokenPositions.get(tokenDocument.id);
      const spent = HLW.movementSpentCache.has(tokenDocument.id)
        ? numberValue(HLW.movementSpentCache.get(tokenDocument.id))
        : numberValue(actor.system?.combat?.movementSpent);
      const leakedDistance = lastLegal ? getPointDistanceInTiles(lastLegal, current) : 0;
      const remaining = Math.max(limit - spent, 0);
      if (lastLegal && limit > 0 && leakedDistance > remaining + 0.01) {
        HLW.revertingTokens.add(tokenDocument.id);
        HLW.movementSpentCache.set(tokenDocument.id, spent);
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

// GM waehlt eine Klasse im Bogen: Klassen-Skill direkt beim Charakter anlegen.
Hooks.on("updateActor", (actor, changes, options, userId) => {
  if (userId !== game.user?.id) return;
  if (!foundry.utils.hasProperty(changes, "system.progression.class")) return;
  actor.erhalteKlassenSkills(foundry.utils.getProperty(changes, "system.progression.class"));
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
