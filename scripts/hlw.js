import { HopeLiesWithinTalkApp, registerTalk, registerTalkSettings, zeigeAllen } from "./hlw-talk.js";
import { setzeKlassen, lindhainAusstatten, lindhainBausteine, lindhainHandel, nscWerteSetzen, SCHWERPUNKTE } from "./hlw-nsc.js";
import { erstelleLindhain, entferneOrtsmarker } from "./hlw-szenen.js";
import { HopeLiesWithinGebenApp, skillSlots } from "./hlw-geben.js";
import { spielercharakterAnlegen, klasseEnthuellen, HERKUNFT, istOrb, orbStufe, orbName, orbWissen, orbUntersuchen, orbLernen, ORB_STUFEN, meisterung, meisterungPlus, istGelernterSkill } from "./hlw-charakter.js";
import { gefaehrteVon, besitzerVon, zaehmen, zaehmSkillDaten, rufen, zurueckrufen, langeRast, freilassen, zugbeginn, registerGefaehrte } from "./hlw-gefaehrte.js";
import { textBoni, WORLD_SKILLS, ATTRS, PLAETZE, klasseVorschlag, verteiltePunkte, berechneWerte, berechneMonster, angriffsWerte, kes, parseKes, ausruestungsPlatz, passivBoni, boniText } from "./hlw-regeln.js";
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
HLW.insignien = [];
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
      description: current[key]?.description ?? defaults.description,
      rank: current[key]?.rank ?? "",
      kategorie: current[key]?.kategorie ?? ""
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
    .filter((item) => HLW.gearItemTypes.includes(item.type) || istOrb(item))
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

function isReactionItem(item) {
  return String(item?.system?.castTime ?? "").toLowerCase() === "reaction";
}

function canUseItemAction(actor, item) {
  if (isQuickItem(item)) return actor.system?.actions?.quick?.available !== false;
  if (isReactionItem(item)) return actor.system?.actions?.reaction?.available !== false;
  return hasActionPoints(actor);
}

async function spendItemAction(actor, item) {
  if (isQuickItem(item)) {
    await actor.update({ "system.actions.quick.available": false });
    return true;
  }
  if (isReactionItem(item)) {
    await actor.update({ "system.actions.reaction.available": false });
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

// Zusatzeffekt eines gemeisterten Skills (100 %): Zahlen, die das System selbst rechnet
function meisterBonus(item) {
  return istGelernterSkill(item) && meisterung(item).fertig ? meisterung(item).bonus : {};
}

function skillReichweite(item) {
  if (boolValue(item.system?.waffenSchaden) && !parseRange(item.system?.range)) {
    const waffe = item.parent?.items?.find((entry) => entry.type === "weapon" && boolValue(entry.system?.equipped));
    if (waffe) return waffe.system?.range;
  }
  const r = parseRange(item.system?.range);
  const plus = numberValue(meisterBonus(item).reichweite);
  return r && plus ? r + plus : item.system?.range;
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
  // Ausgewählter Gefährte des Charakters, der gerade am Zug ist: Leiste für den Gefährten zeigen
  const gewaehlt = canvas.tokens?.controlled?.[0]?.actor;
  if (currentActor && gewaehlt && besitzerVon(gewaehlt)?.id === currentActor.id) return gewaehlt;
  if (currentActor) return currentActor;
  const controlled = canvas.tokens?.controlled?.[0]?.actor;
  return controlled ?? null;
}

function getUsableCombatItems(actor) {
  if (!actor) return [];
  const rang = (item) => {
    const r = String(item.system?.rank ?? "").trim().toUpperCase();
    return ["E", "D", "C", "B", "A", "S", "SS"].includes(r) ? r : "";
  };
  const alle = Array.from(actor.items ?? []);
  const waffen = alle.filter((item) => item.type === "weapon").sort((a, b) => Number(boolValue(b.system?.equipped)) - Number(boolValue(a.system?.equipped)));
  const skills = alle.filter((item) => ["playerSkill", "classSkill"].includes(item.type) && !isPassiveItem(item) && !istOrb(item));
  return [...waffen.filter((item) => boolValue(item.system?.equipped)), ...skills].map((item) => {
    const s = item.system ?? {};
    const kategorie = normalizeDamageCategory(s.damageCategory, `${s.skillType} ${s.element}`);
    const cooldown = numberValue(s.cooldown?.value);
    const heilung = isHealingItem(item);
    const zeilen = [
      item.type === "weapon" ? "Waffe · Angriff" : `${isQuickItem(item) ? "Schnellaktion" : isReactionItem(item) ? "Reaktion" : "Aktion"}${heilung ? " · Heilung, kein Trefferwurf" : s.damage ? ` · gegen ${kategorie === "magical" ? "MR" : "RW"}` : ""}`,
      s.damageText || s.damage ? `${heilung ? "Heilt" : "Schaden"} ${s.damageText || s.damage}` : "",
      s.range ? `Reichweite ${s.range}` : "",
      cooldown > 0 ? `noch ${cooldown} Züge Abklingzeit` : numberValue(s.cooldown?.max) ? `Abklingzeit ${s.cooldown.max}` : ""
    ].filter(Boolean);
    return {
      id: item.id,
      type: item.type,
      name: item.name,
      img: item.img,
      rang: rang(item),
      cooldown,
      quick: isQuickItem(item),
      reaction: isReactionItem(item),
      usable: canUseItemAction(actor, item),
      pending: HLW.pendingSkill?.actorId === actor.id && HLW.pendingSkill?.itemId === item.id,
      tooltip: `<strong>${escapeHtml(item.name)}</strong><br>${zeilen.map(escapeHtml).join("<br>")}${istGelernterSkill(item) ? `<br>Meisterung ${meisterung(item).wert} %` : ""}`
    };
  });
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
  const hpMax = Math.max(numberValue(hp.max), 1);
  const hpWert = numberValue(hp.value);
  const movement = actor.system?.resources?.movement ?? {};
  const spent = numberValue(actor.system?.combat?.movementSpent);
  const movementMax = numberValue(movement.value);
  const movementLeft = Math.max(movementMax - spent, 0);
  const ap = getActionPointState(actor);
  const canAct = ap.value > 0;
  const quickBereit = actor.system?.actions?.quick?.available !== false;
  const reaktionBereit = actor.system?.actions?.reaction?.available !== false;
  const besitzer = besitzerVon(actor);
  const isCurrentTurn = game.combat?.combatant?.actor?.id === (besitzer ?? actor).id;
  const gefaehrte = besitzer ? null : gefaehrteVon(actor);
  const umfang = 2 * Math.PI * 29;
  const hpProzent = Math.min(Math.max(hpWert / hpMax, 0), 1);
  const tokenBild = actor.prototypeToken?.texture?.src || actor.img || "";
  const passive = Array.from(actor.items ?? []).filter((item) => ["playerSkill", "classSkill"].includes(item.type) && isPassiveItem(item) && !istOrb(item));

  const tasten = getUsableCombatItems(actor);
  const waffenTasten = tasten.filter((item) => item.type === "weapon");
  const skillTasten = tasten.filter((item) => item.type !== "weapon");
  const taste = (item) => `
    <button type="button" class="hh-taste ${item.type === "weapon" ? "is-waffe" : ""} ${item.pending ? "is-pending" : ""}" data-hud-skill="${item.id}" data-rang="${item.rang}"
      data-tooltip-html="${escapeHtml(item.pending ? "<strong>Abbrechen</strong>" : item.tooltip)}" data-tooltip-direction="UP"
      ${(!item.usable || item.cooldown > 0) && !item.pending ? "disabled" : ""}>
      <img src="${escapeHtml(item.img || "icons/svg/sword.svg")}" alt="">
      ${item.quick ? `<span class="hh-art">S</span>` : item.reaction ? `<span class="hh-art">R</span>` : ""}
      ${item.cooldown > 0 ? `<span class="hh-cd">${item.cooldown}</span>` : ""}
      ${item.pending ? `<span class="hh-cd">✕</span>` : ""}
    </button>`;

  const hud = document.createElement("aside");
  hud.className = `hope-lies-within hlw-hud ${isCurrentTurn ? "is-turn" : ""}`;
  hud.innerHTML = `
    <div class="hh-person">
      <div class="hh-ring">
        <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="none" stroke="#2a1514" stroke-width="5"/><circle cx="32" cy="32" r="29" fill="none" stroke="${hpProzent > 0.3 ? "#d0574f" : "#ff3b30"}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${umfang.toFixed(1)}" stroke-dashoffset="${(umfang * (1 - hpProzent)).toFixed(1)}"/></svg>
        <img src="${escapeHtml(tokenBild)}" alt="">
      </div>
      <div>
        <div class="hh-zustand ${isCurrentTurn ? "" : "is-warten"}">${besitzer ? `Gefährte von ${escapeHtml(besitzer.name)} · noch ${numberValue(besitzer.system?.companion?.rounds)} Runden` : isCurrentTurn ? "Am Zug" : "Wartet"}</div>
        <div class="hh-name">${escapeHtml(actor.name)}</div>
        <div class="hh-hp"><b>${hpWert}</b> / ${numberValue(hp.max)} HP · RW ${numberValue(actor.system?.derived?.rw)} · MR ${numberValue(actor.system?.derived?.mr)}</div>
        <div class="hh-res">
          <span class="hh-pip hh-a ${canAct ? "is-bereit" : ""}" data-tooltip="Aktion">A</span>
          <span class="hh-pip hh-s ${quickBereit ? "is-bereit" : ""}" data-tooltip="Schnellaktion">S</span>
          <span class="hh-pip hh-r ${reaktionBereit ? "is-bereit" : ""}" data-tooltip="Reaktion">R</span>
          <span class="hh-bewegung">Bewegung <span class="hh-spur"><i style="width:${movementMax ? Math.round((movementLeft / movementMax) * 100) : 0}%"></i></span> ${String(movementLeft.toFixed(1)).replace(".", ",")} / ${movementMax}</span>
        </div>
      </div>
    </div>
    <div class="hh-leiste">
      ${waffenTasten.map(taste).join("")}
      ${waffenTasten.length && skillTasten.length ? `<span class="hh-trenner"></span>` : ""}
      ${skillTasten.map(taste).join("")}
      ${!tasten.length ? `<span class="hh-hp">Keine Waffe ausgerüstet und keine aktiven Skills.</span>` : ""}
      ${gefaehrte ? `<span class="hh-trenner"></span><button type="button" class="hh-taste hh-gefaehrte ${gefaehrte.aufFeld ? "is-feld" : ""}" data-hud-gefaehrte ${gefaehrte.exhausted || (!gefaehrte.aufFeld && numberValue(gefaehrte.cooldown) > 0) ? "disabled" : ""}
        data-tooltip-html="${escapeHtml(`<strong>${escapeHtml(gefaehrte.name)}</strong><br>${gefaehrte.aufFeld ? `Auf dem Feld, noch ${numberValue(gefaehrte.rounds)} Runden. Klick: auswählen und steuern.` : gefaehrte.exhausted ? "Verletzt, braucht eine lange Rast." : numberValue(gefaehrte.cooldown) > 0 ? `Pause: noch ${numberValue(gefaehrte.cooldown)} Runden.` : `Rufen (Schnellaktion), bleibt ${numberValue(gefaehrte.maxRounds)} Runden.`}`)}" data-tooltip-direction="UP">
        <img src="${escapeHtml(gefaehrte.img || "")}" alt="">
        ${gefaehrte.aufFeld ? `<span class="hh-art">${numberValue(gefaehrte.rounds)}</span>` : numberValue(gefaehrte.cooldown) > 0 ? `<span class="hh-cd">${numberValue(gefaehrte.cooldown)}</span>` : ""}
      </button>` : ""}
      ${passive.length ? `<span class="hh-trenner"></span><div class="hh-passiv" data-tooltip-html="${escapeHtml(`<strong>Passiv, wirkt immer</strong><br>${passive.map((item) => escapeHtml(item.name)).join("<br>")}`)}">${passive.map((item) => `<img src="${escapeHtml(item.img)}" alt="">`).join("")}</div>` : ""}
    </div>
    <div class="hh-aktionen">
      <button type="button" data-hud-standard="attack" ${canAct ? "" : "disabled"} data-tooltip="Normaler Angriff mit der ausgerüsteten Waffe">Angriff</button>
      <button type="button" data-hud-standard="item" ${canAct ? "" : "disabled"} data-tooltip="Gegenstand benutzen">Gegenstand</button>
      <button type="button" data-hud-standard="defend" ${canAct ? "" : "disabled"} data-tooltip="RW und MR +2 bis zum nächsten eigenen Zug">Abwehr</button>
      <button type="button" class="hh-ende" data-hud-end-turn>Zug beenden</button>
    </div>
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

    if (event.target.closest("[data-hud-gefaehrte]")) {
      const g = gefaehrteVon(actor);
      if (g?.aufFeld) g.token?.object?.control({ releaseOthers: true });
      else rufen(actor);
      return;
    }

    if (event.target.closest("[data-hud-end-turn]")) {
      (besitzer ?? actor).endTurn();
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
  await zugbeginn(actor);
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
      const passiv = numberValue(derived.worldSkillBonus?.[key]);

      current.label = definition.label;
      current.attributes = definition.attributes;
      current.base = base;
      current.passive = passiv;
      current.total = base + bonus + passiv;
      system.worldSkills[key] = current;
    }
  }

  // Klassen-Skills der gewaehlten Klasse geben. Skills frueherer Klassen bleiben (Klassenregeln).
  // Es gibt immer nur die Klassen-Skills der aktuellen Klasse: Skills früherer Klassen fallen beim Wechsel weg.
  async entferneFremdeKlassenSkills(klassenName) {
    const weg = this.items.filter((i) => i.type === "classSkill" && i.system?.className !== klassenName);
    if (!weg.length) return [];
    await this.deleteEmbeddedDocuments("Item", weg.map((i) => i.id));
    return weg.map((i) => i.name);
  }

  async erhalteKlassenSkills(klassenName) {
    const entfernt = await this.entferneFremdeKlassenSkills(klassenName || "");
    if (entfernt.length) ui.notifications?.info(`${this.name} verliert: ${entfernt.join(", ")}`);
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
        system: { className: klasse.name, skillType: klasse.role, rank: rang, activation: aktiv ? "active" : "passive", effect: klasse.effect, description: `${klasse.name} (${klasse.category}): ${klasse.effect}`, price: "nicht verkäuflich", ...(klasse.skillDaten ?? {}) }
      }];
    }
    if (klasse?.zaehmen && !this.items.some((i) => i.type === "classSkill" && i.system?.skillType === "Zähmen" && i.system?.className === klasse.name)) {
      neu.push(zaehmSkillDaten(klasse));
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

  async zaehmeZiel(item) {
    if (game.combat?.started && !canUseItemAction(this, item)) {
      ui.notifications?.warn("Die Aktion ist schon verbraucht.");
      return;
    }
    const verbraucht = await zaehmen(this, HLW.klassen);
    if (verbraucht && game.combat?.started) await spendItemAction(this, item);
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
    const angelegt = this.items.filter((entry) => boolValue(entry.system?.equipped) && entry.id !== item.id);
    const ablegen = [];
    if (nextValue) {
      const platz = ausruestungsPlatz(item);
      if (item.type === "accessory" && angelegt.filter((entry) => entry.type === "accessory").length >= 3) {
        ui.notifications?.warn("Es können höchstens 3 Accessoires ausgerüstet sein.");
        return;
      }
      if (item.type === "weapon" || platz === "nebenhand") {
        // Zwei Hände: Waffen und Schild teilen sich Haupt- und Nebenhand.
        const haende = angelegt.filter((entry) => entry.type === "weapon" || ausruestungsPlatz(entry) === "nebenhand");
        const frei = gefaehrteVon(this) ? 1 : 2;
        if (haende.length >= frei) {
          ui.notifications?.warn(frei === 1 ? "Die Nebenhand gehört deinem Gefährten. Erst die andere Waffe ablegen." : "Beide Hände sind belegt. Erst eine Waffe oder einen Schild ablegen.");
          return;
        }
      }
      else if (platz && item.type === "armor") {
        // Rüstung tauscht automatisch mit dem Teil, das schon auf diesem Platz sitzt.
        ablegen.push(...angelegt.filter((entry) => entry.type === "armor" && ausruestungsPlatz(entry) === platz));
      }
    }

    const updates = [{ _id: item.id, "system.equipped": nextValue }, ...ablegen.map((entry) => ({ _id: entry.id, "system.equipped": false }))];
    await this.updateEmbeddedDocuments("Item", updates);
    if (ablegen.length) ui.notifications?.info(`Abgelegt: ${ablegen.map((entry) => entry.name).join(", ")}`);
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

    // DialogV2: der alte Dialog ignoriert in Foundry 14 die eigenen Klassen und zeigt hellen Pergament-Hintergrund.
    const fenster = new foundry.applications.api.DialogV2({
      window: { title: item.name },
      classes: ["hope-lies-within", "hlw-detail-dialog"],
      content,
      buttons: [{ action: "ok", label: "Schließen", icon: "fa-solid fa-check", default: true }]
    });
    fenster.render({ force: true }).then(() => fenster.setPosition({ width: 460, height: "auto", left: (window.innerWidth - 460) / 2, top: window.innerHeight / 4 }));
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

    if (item.system?.skillType === "Zähmen") return this.zaehmeZiel(item);

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
    const ausgeruestet = this.items.find((entry) => entry.type === "weapon" && boolValue(entry.system?.equipped));
    const hasDamage = isValidFormula(damageFormula) || (boolValue(item.system?.waffenSchaden) && isValidFormula(normalizeFormula(ausgeruestet?.system?.damage)));
    const sourceToken = getSourceTokenForActor(this);

    // Mehrere Ziele (z. B. Trickshot): nur, wenn genug Ziele in Reichweite stehen; jedes Ziel bekommt einen eigenen Angriff.
    const zielAnzahl = Math.max(numberValue(item.system?.ziele), 1);
    if (hasDamage && zielAnzahl > 1) {
      if (!sourceToken) return ui.notifications?.warn("Bitte zuerst den handelnden Token auf der Szene auswählen.");
      if (boolValue(item.system?.waffenSchaden) && !ausgeruestet) return ui.notifications?.warn(`${item.name} braucht eine ausgerüstete Waffe.`);
      const rangeLimit = getEffectiveRangeInTiles(skillReichweite(item));
      const eigene = sourceToken.document?.disposition;
      const imBereich = getTokensInRange(sourceToken, rangeLimit).filter((e) => e.token.document?.disposition !== eigene && !e.token.document?.hidden);
      if (imBereich.length < zielAnzahl) {
        return ui.notifications?.warn(`${item.name} geht nur, wenn ${zielAnzahl} Ziele in Reichweite (${rangeLimit} Felder) stehen. Gerade sind es ${imBereich.length}.`);
      }
      const markiert = Array.from(game.user?.targets ?? []).filter((t) => t.id !== sourceToken.id);
      const gueltig = markiert.filter((t) => imBereich.some((e) => e.token.id === t.id));
      if (gueltig.length !== zielAnzahl) {
        drawSkillRange(sourceToken, rangeLimit, item.name, parseRange(skillReichweite(item)));
        return ui.notifications?.info(`${item.name}: Markiere ${zielAnzahl} verschiedene Ziele in Reichweite (Taste T) und setze den Skill dann noch einmal ein.`);
      }
      removeRangeUi();
      return this.resolveSkillMehrfach(itemId, gueltig);
    }

    if (hasDamage) {
      if (!sourceToken) {
        ui.notifications?.warn("Bitte zuerst den handelnden Token auf der Szene auswählen.");
        return;
      }

      const rawRange = parseRange(skillReichweite(item));
      const rangeLimit = getEffectiveRangeInTiles(skillReichweite(item));
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

  async resolveSkillMehrfach(itemId, ziele) {
    for (const [i, ziel] of ziele.entries()) {
      await this.resolveSkill(itemId, ziel, { ohneKosten: i < ziele.length - 1 });
    }
  }

  async resolveSkill(itemId, targetToken = null, { ohneKosten = false } = {}) {
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
    const mitWaffe = this.items.find((entry) => entry.type === "weapon" && boolValue(entry.system?.equipped));
    const hasDamage = isValidFormula(damageFormula) || (boolValue(item.system?.waffenSchaden) && isValidFormula(normalizeFormula(mitWaffe?.system?.damage)));
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

      const rangeLimit = getEffectiveRangeInTiles(skillReichweite(item));
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
      const mb = meisterBonus(item);
      const meisterPlus = healing ? mb.heilung : mb.schaden;
      const formel = `${teile.join(" + ")}${werte.bonus ? ` + ${werte.bonus}` : ""}${meisterPlus ? ` + ${meisterPlus}` : ""}`;
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
    const range = escapeHtml(skillReichweite(item));
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
            <dt>${result?.healing ? "Heilung" : "Schaden"}</dt><dd>${result?.waffe ? (damage ? `${damage} + ${escapeHtml(result.waffe)}` : `Waffenschaden (${escapeHtml(result.waffe)})`) : damage || "-"}</dd>
            <dt>Cooldown</dt><dd>${boolValue(item.system?.einmalProKampf) ? "Einmal pro Kampf" : `${maxCooldown || 0} Zug(e)`}</dd>
            ${ergebnis}
          </dl>
          ${effect ? `<p>${effect}</p>` : ""}
        </div>
      `
    });

    // Bei mehreren Zielen zahlt erst der letzte Angriff Aktion, Abklingzeit und Lernfortschritt
    if (ohneKosten) return;

    // Lernleiste: +1 % pro Einsatz; gemeistert verkürzt sich die Abklingzeit, falls das der Zusatzeffekt ist
    await meisterungPlus(this, item);
    // „Einmal pro Kampf“: gesperrt bis Kampfende
    const abkling = boolValue(item.system?.einmalProKampf) && game.combat?.started ? 999 : maxCooldown > 0 ? Math.max(maxCooldown - numberValue(meisterBonus(item).abklingzeit), 1) : 0;
    if (abkling > 0) {
      await item.update({ "system.cooldown.value": abkling });
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
      width: 1010,
      height: 860,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }]
    });
  }

  get template() {
    return "systems/hope-lies-within-2/templates/actor/character-sheet.hbs";
  }

  async getData(options) {
    const context = await super.getData(options);
    context.system = context.actor.system;
    context.bogen = this._prepareItems(context.actor.items);
    context.worldSkills = this._prepareWorldSkills(context.system);
    context.activeInsignia = getActiveInsignia(context.system);
    context.insigniaSlots = getInsigniaSlotList(context.system).map((slot, index) => {
      const b = textBoni(slot.description);
      return { ...slot, nr: index + 1, farbe: /gelb/i.test(slot.kategorie) ? "gelb" : /grün/i.test(slot.kategorie) ? "gruen" : /rot/i.test(slot.kategorie) ? "rot" : "", wirkt: Object.keys(b).length ? boniText(b) : "" };
    });
    context.profileImage = context.actor.img;
    context.tokenImage = context.actor.prototypeToken?.texture?.src || context.actor.img;
    context.isGM = game.user?.isGM;
    context.canAct = hasActionPoints(context.actor);
    context.inventoryUsed = countInventorySlots(context.actor.items);
    context.inventoryMax = numberValue(context.system.resources?.inventorySlots?.max);
    context.isMonster = context.actor.type === "monster";
    context.isNpc = context.actor.type === "npc";
    if (context.isNpc) {
      const gewaehlt = context.actor.getFlag("hope-lies-within-2", "schwerpunkt") || "zivil";
      context.schwerpunkte = Object.entries(SCHWERPUNKTE).map(([key, s]) => ({ key, label: s.label, selected: key === gewaehlt }));
    }
    context.skillSlots = skillSlots(context.actor);
    context.slotPips = Array.from({ length: Math.max(context.skillSlots.max, context.skillSlots.used) }, (_, i) => i < context.skillSlots.used);
    // Klassen-Auswahl fuer den GM: alle Klassen nach Kategorie, der Vorschlag aus der Wertverteilung ist markiert.
    const vorschlag = context.system.derived?.suggestedClassName ?? "";
    const aktuell = context.system.progression?.class ?? "";
    const automatisch = context.system.progression?.classAuto !== false;
    // Spieler sehen nur die gespeicherte Klasse; der Vorschlag aus der Verteilung bleibt bis zum Speichern verborgen.
    const gespeichert = HLW.klassen.find((k) => k.name === aktuell);
    context.klasseAnzeige = aktuell ? `${aktuell}${gespeichert ? ` · ${gespeichert.category}` : ""}` : "";
    context.klasseEffekt = gespeichert ? `${gespeichert.skill}: ${gespeichert.effect}` : "";
    context.klassenGruppen = ["Basic", "T1", "T2", "T3", "Story"].map((kategorie) => ({
      kategorie,
      klassen: HLW.klassen.filter((k) => k.category === kategorie).map((k) => ({
        name: k.name,
        label: `${k.name}${k.name === vorschlag ? " ★ Vorschlag" : ""}`,
        selected: !automatisch && k.name === aktuell
      }))
    })).filter((gruppe) => gruppe.klassen.length);
    context.vorschlagLabel = (automatisch ? aktuell || vorschlag : vorschlag) ? `— automatisch: ${automatisch ? aktuell || vorschlag : vorschlag} —` : "— automatisch (noch keine Klasse) —";
    context.punkte = this._punkteKontext(context.actor);
    context.kesText = kes(context.system.resources?.kes?.value);
    context.pointsOver = numberValue(context.system.derived?.points?.free) < 0;
    const prozent = (wert, max) => (max > 0 ? Math.min(Math.max(Math.round((numberValue(wert) / max) * 100), 0), 100) : 0);
    const hp = context.system.resources?.hp ?? {};
    context.balken = {
      hp: prozent(hp.value, numberValue(hp.max)),
      exp: prozent(context.system.progression?.exp, numberValue(context.system.derived?.expNext)),
      korruption: prozent(context.system.resources?.corruption?.value, 100)
    };
    context.klasseGewaehlt = Boolean(context.system.progression?.class);
    context.aktionen = {
      aktion: hasActionPoints(context.actor),
      schnell: context.system.actions?.quick?.available !== false,
      reaktion: context.system.actions?.reaction?.available !== false
    };
    context.passivListe = context.system.derived?.passiv ?? [];
    context.gefaehrteBesitzer = besitzerVon(context.actor)?.name ?? "";
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

    // NSC (nur GM): Level und Schwerpunkt wählen, die Punkte verteilt das System
    html.find("[data-nsc-werte]").on("click", async (event) => {
      event.preventDefault();
      const box = event.currentTarget.closest(".hb-nsc");
      const level = Number(box?.querySelector("[name='nscLevel']")?.value) || 1;
      const schwerpunkt = box?.querySelector("[name='nscSchwerpunkt']")?.value || "zivil";
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: "NSC-Werte verteilen" },
        content: `<p>${escapeHtml(this.actor.name)} auf Level ${level} setzen und alle Wertpunkte neu als <b>${escapeHtml(SCHWERPUNKTE[schwerpunkt]?.label ?? schwerpunkt)}</b> verteilen? Die bisherigen Werte werden überschrieben.</p>`
      });
      if (ok) await nscWerteSetzen(this.actor, { level, schwerpunkt });
    });
    html.find("[data-nsc-gespraech]").on("click", (event) => {
      event.preventDefault();
      zeigeAllen(this.actor, event.currentTarget.dataset.nscGespraech || "gespraech");
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
      const id = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      this.actor.editOwnedItem(id);
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

    // Inventar-Filter
    html.find("[data-filter]").filter("button").on("click", (event) => {
      event.preventDefault();
      const filter = event.currentTarget.dataset.filter;
      html.find(".hb-filter button").removeClass("is-aktiv");
      event.currentTarget.classList.add("is-aktiv");
      html.find(".hb-feld[data-item-id]").each((_, feld) => {
        feld.hidden = filter !== "alle" && feld.dataset.filter !== filter;
      });
    });

    // Klick auf Gegenstand (Raster oder Figur): kleines Menü mit den passenden Aktionen
    // Punkte verteilen (Spieler): erst speichern, dann zeigt sich die Klasse
    html.find("[data-plus]").on("click", (event) => {
      event.preventDefault();
      const k = event.currentTarget.dataset.plus;
      this._plus[k] = (this._plus[k] ?? 0) + 1;
      this.render(false);
    });
    html.find("[data-minus]").on("click", (event) => {
      event.preventDefault();
      const k = event.currentTarget.dataset.minus;
      this._plus[k] = Math.max((this._plus[k] ?? 0) - 1, 0);
      this.render(false);
    });
    html.find("[data-punkte-zuruecksetzen]").on("click", (event) => {
      event.preventDefault();
      this._plus = {};
      this.render(false);
    });
    html.find("[data-punkte-speichern]").on("click", (event) => {
      event.preventDefault();
      this._punkteSpeichern();
    });
    html.find("[data-zu-den-punkten]").on("click", (event) => {
      event.preventDefault();
      this._tabs?.[0]?.activate("main");
      html.find(".hb-werte-karte")[0]?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    // Klasse (GM): automatisch nach Verteilung oder fest gewählt
    html.find("[data-klasse-wahl]").on("change", async (event) => {
      const wert = event.currentTarget.value;
      const vorschlag = this.actor.system.derived?.suggestedClassName ?? "";
      await this.actor.update({ "system.progression.class": wert || vorschlag, "system.progression.classAuto": !wert });
    });
    // Insignien (GM): aus der Liste wählen oder leeren
    html.find("[data-insignie-waehlen]").on("click", (event) => {
      event.preventDefault();
      if (game.user?.isGM) this._insignieWaehlen(event.currentTarget.dataset.insignieWaehlen);
    });
    html.find("[data-insignie-leeren]").on("click", async (event) => {
      event.preventDefault();
      if (!game.user?.isGM) return;
      const key = event.currentTarget.dataset.insignieLeeren;
      await this.actor.update({ [`system.insigniaSlots.${key}`]: { image: "", name: "", description: "", rank: "", kategorie: "" } });
    });

    html.find("[data-gefaehrte]").on("click contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._zeigeGefaehrteMenue(event.currentTarget);
    });

    html.find(".hb-feld[data-item-id], .hb-slot[data-item-id]").on("click contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._zeigeGegenstandMenue(event.currentTarget);
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

  _punkteKontext(actor) {
    if (actor.type === "monster") return null;
    this._plus ??= {};
    const s = actor.system;
    const level = Math.max(numberValue(s.progression?.level), 1);
    const erlaubt = verteiltePunkte(level);
    const gespeichert = ATTRS.reduce((sum, k) => sum + Math.max(numberValue(s.attributes?.[k]?.value) - 1, 0), 0);
    const offen = ATTRS.reduce((sum, k) => sum + (this._plus[k] ?? 0), 0);
    const frei = erlaubt - gespeichert - offen;
    // Bei der Erstellung (Level 1) höchstens +3 auf einen Wert; der Herkunftswert darf einen Punkt höher.
    const herkunft = HERKUNFT[String(s.identity?.origin ?? "").trim().match(/^([ABCD])\b/)?.[1]]?.attr;
    const deckel = (k) => (level === 1 ? 4 + (k === herkunft ? 1 : 0) : 25);
    const werte = ATTRS.map((k) => {
      const wert = numberValue(s.attributes?.[k]?.value);
      const plus = this._plus[k] ?? 0;
      return { key: k, abbr: s.attributes?.[k]?.abbr ?? k.toUpperCase(), label: s.attributes?.[k]?.label ?? k, wert: wert + plus, plus, kannPlus: frei > 0 && wert + plus < deckel(k), kannMinus: plus > 0 };
    });
    return { erlaubt, frei, offen, werte, aenderung: offen > 0, knoepfe: frei > 0 || offen > 0, erstellung: level === 1 };
  }

  async _punkteSpeichern() {
    const actor = this.actor;
    const plus = this._plus ?? {};
    const updates = {};
    const neu = foundry.utils.deepClone(actor.system);
    for (const [k, p] of Object.entries(plus)) {
      if (!(p > 0)) continue;
      neu.attributes[k].value = numberValue(neu.attributes[k].value) + p;
      updates[`system.attributes.${k}.value`] = neu.attributes[k].value;
    }
    if (!Object.keys(updates).length) return;
    const alte = actor.system.progression?.class ?? "";
    const automatisch = actor.system.progression?.classAuto !== false;
    const vorschlag = klasseVorschlag(neu, HLW.klassen);
    if (automatisch && vorschlag) updates["system.progression.class"] = vorschlag.name;
    this._plus = {};
    await actor.update(updates);
    if (automatisch && vorschlag && vorschlag.name !== alte) klasseEnthuellen(actor, vorschlag, alte);
    else ui.notifications?.info(automatisch && !vorschlag ? "Punkte gespeichert. Eine Klasse gibt es ab 10 verteilten Punkten." : "Punkte gespeichert.");
  }

  async _insignieWaehlen(slotKey) {
    const liste = HLW.insignien ?? [];
    const zeilen = liste.map((ins, i) => {
      const b = textBoni(ins.effekt);
      const farbe = /gelb/i.test(ins.kategorie) ? "gelb" : /grün/i.test(ins.kategorie) ? "gruen" : /rot/i.test(ins.kategorie) ? "rot" : "";
      return `<li data-nr="${i}" data-suche="${escapeHtml(`${ins.name} ${ins.effekt} ${ins.kategorie} ${ins.rank}`.toLowerCase())}">
        <img src="${escapeHtml(ins.bild)}" onerror="this.src='icons/svg/aura.svg'" alt="">
        <span><strong>${escapeHtml(ins.name)}</strong> <em class="hi-${farbe}">${escapeHtml(ins.kategorie)} · ${escapeHtml(ins.rank)}</em><small>${escapeHtml(ins.effekt)}</small>${Object.keys(b).length ? `<b>wirkt automatisch: ${escapeHtml(boniText(b))}</b>` : ""}</span>
      </li>`;
    }).join("");
    const fenster = new foundry.applications.api.DialogV2({
      window: { title: `Insignie für Slot ${slotKey.replace("slot", "")}` },
      classes: ["hope-lies-within", "hlw-detail-dialog", "hlw-insignien-wahl"],
      content: `<input type="search" name="suche" placeholder="Suchen (Name, Wirkung, Farbe, Rang) …"><ol class="hi-liste">${zeilen}</ol>`,
      buttons: [{ action: "abbrechen", label: "Abbrechen" }]
    });
    await fenster.render({ force: true });
    fenster.setPosition({ width: 620, height: 640 });
    const root = fenster.element;
    const suche = root.querySelector("input[name='suche']");
    suche?.addEventListener("input", () => {
      const worte = suche.value.toLowerCase().split(/\s+/).filter(Boolean);
      for (const li of root.querySelectorAll("li[data-suche]")) li.hidden = !worte.every((w) => li.dataset.suche.includes(w));
    });
    suche?.focus();
    root.querySelector(".hi-liste")?.addEventListener("click", async (event) => {
      const li = event.target.closest("li[data-nr]");
      if (!li) return;
      const ins = liste[Number(li.dataset.nr)];
      await this.actor.update({ [`system.insigniaSlots.${slotKey}`]: { image: ins.bild, name: ins.name, description: ins.effekt, rank: ins.rank, kategorie: ins.kategorie } });
      fenster.close();
    });
  }

  _zeigeGefaehrteMenue(element) {
    document.querySelectorAll(".hb-menue").forEach((menue) => menue.remove());
    const g = gefaehrteVon(this.actor);
    if (!g) return;
    const eintraege = [];
    if (g.aufFeld) eintraege.push(["zurueck", "Zurückrufen", "fa-person-walking-arrow-loop-left"]);
    else eintraege.push(["rufen", "Rufen (Schnellaktion)", "fa-paw"]);
    if (g.actor) eintraege.push(["bogen", "Bogen öffnen", "fa-id-card"]);
    if (game.user?.isGM) eintraege.push(["rast", "Lange Rast (GM)", "fa-bed"], ["frei", "Freilassen (GM)", "fa-dove"]);
    this._menue(element, g.name, eintraege, {
      rufen: () => rufen(this.actor),
      zurueck: () => zurueckrufen(this.actor),
      bogen: () => g.actor?.sheet.render(true),
      rast: () => langeRast(this.actor),
      frei: () => freilassen(this.actor)
    });
  }

  _menue(element, titel, eintraege, aktionen) {
    const menue = document.createElement("div");
    menue.className = "hope-lies-within hb-menue";
    menue.innerHTML = `<strong>${escapeHtml(titel)}</strong>${eintraege.map(([key, label, icon]) => `<button type="button" data-menue="${key}"><i class="fa-solid ${icon}"></i> ${label}</button>`).join("")}`;
    document.body.appendChild(menue);
    const a = element.getBoundingClientRect();
    const hoehe = menue.offsetHeight;
    menue.style.left = `${Math.min(a.left, window.innerWidth - menue.offsetWidth - 8)}px`;
    menue.style.top = `${a.bottom + hoehe + 8 > window.innerHeight ? a.top - hoehe - 4 : a.bottom + 4}px`;
    const schliessen = (event) => {
      if (menue.contains(event.target)) return;
      menue.remove();
      document.removeEventListener("pointerdown", schliessen, true);
    };
    setTimeout(() => document.addEventListener("pointerdown", schliessen, true));
    menue.addEventListener("click", (event) => {
      const knopf = event.target.closest("[data-menue]");
      if (!knopf) return;
      event.preventDefault();
      menue.remove();
      aktionen[knopf.dataset.menue]?.();
    });
  }

  _zeigeGegenstandMenue(element) {
    document.querySelectorAll(".hb-menue").forEach((menue) => menue.remove());
    const item = this.actor.items.get(element.dataset.itemId);
    if (!item) return;
    if (istOrb(item)) {
      const eintraege = [];
      if (!item.system?.appraisal?.versucht || game.user?.isGM) eintraege.push(["untersuchen", "Untersuchen (Appraisal)", "fa-magnifying-glass"]);
      eintraege.push(["lernen", "Lernen (Skill-Slot)", "fa-brain"], ["give", "An Ziel geben", "fa-hand-holding"], ["discard", "Wegwerfen", "fa-trash"]);
      if (game.user?.isGM) eintraege.push(["neu", "Neuer Versuch (GM)", "fa-rotate"], ["gilde", "Gilde: alles zeigen (GM)", "fa-landmark"]);
      const id = item.id;
      this._menue(element, orbName(item), eintraege, {
        untersuchen: () => orbUntersuchen(this.actor, item),
        lernen: () => orbLernen(this.actor, item, skillSlots(this.actor)),
        give: () => this.actor.giveItemToTarget(id),
        discard: () => this.actor.discardOwnedItem(id),
        neu: () => item.update({ "system.appraisal.versucht": false }),
        gilde: () => item.update({ "system.appraisal.stufe": 3 })
      });
      return;
    }
    const angelegt = boolValue(item.system?.equipped);
    const eintraege = [];
    if (["weapon", "armor", "accessory", "equipment"].includes(item.type)) eintraege.push(["equip", angelegt ? "Ablegen" : "Ausrüsten", "fa-shirt"]);
    if (["consumable", "foodDrink"].includes(item.type)) eintraege.push(["consume", "Benutzen", "fa-flask"]);
    eintraege.push(["details", "Details", "fa-circle-info"], ["edit", "Bearbeiten", "fa-pen"], ["give", "An Ziel geben", "fa-hand-holding"], ["discard", "Wegwerfen", "fa-trash"]);
    const id = item.id;
    this._menue(element, item.name, eintraege, {
      equip: () => this.actor.toggleEquipped(id),
      consume: () => this.actor.consumeOwnedItem(id),
      details: () => this.actor.showOwnedItemDetails(id),
      edit: () => this.actor.editOwnedItem(id),
      give: () => this.actor.giveItemToTarget(id),
      discard: () => this.actor.discardOwnedItem(id)
    });
  }

  _prepareItems(items) {
    const actor = this.actor;
    const rangVon = (item) => {
      const r = String(item.system?.rank ?? "").trim().toUpperCase();
      return ["E", "D", "C", "B", "A", "S", "SS"].includes(r) ? r : "";
    };
    const filterVon = (type) => (["weapon", "armor", "accessory", "equipment"].includes(type) ? "ausr" : ["consumable", "foodDrink"].includes(type) ? "verbrauch" : "material");
    const zeile = (label, wert) => (wert || wert === 0 ? `<br>${escapeHtml(label)}: ${escapeHtml(wert)}` : "");

    const skills = { aktiv: [], passiv: [] };
    const gear = [];
    for (const item of items) {
      const s = item.system ?? {};
      if (["playerSkill", "classSkill"].includes(item.type) && !istOrb(item)) {
        const passive = isPassiveItem(item);
        const cooldown = numberValue(s.cooldown?.value);
        const kategorie = normalizeDamageCategory(s.damageCategory, `${s.skillType} ${s.element}`);
        const heilung = isHealingItem(item);
        const tags = [];
        if (passive) tags.push({ text: "Passiv · wirkt immer", art: "passiv" });
        else {
          if (heilung) tags.push({ text: "Heilung", art: "heil" });
          else if (s.damage) tags.push({ text: HLW.damageCategories[kategorie] ?? kategorie, art: kategorie === "magical" ? "magisch" : "physisch" });
          tags.push({ text: isQuickItem(item) ? "Schnellaktion" : isReactionItem(item) ? "Reaktion" : "Aktion" });
          if (s.damageText || s.damage) tags.push({ text: s.damageText || s.damage, schaden: true });
          if (s.range) tags.push({ text: `Reichweite ${s.range}` });
          if (numberValue(s.cooldown?.max)) tags.push({ text: cooldown > 0 ? `noch ${cooldown} Züge` : `Abklingzeit ${s.cooldown.max}`, art: cooldown > 0 ? "cd" : "" });
        }
        const boni = passive ? boniText(passivBoni(item)) : "";
        // Lernleiste: gelernte Skills der Spieler meistern sich mit jedem Einsatz (Zusatzeffekt bei 100 %)
        const m = meisterung(item);
        const eintrag = {
          id: item.id,
          name: item.name,
          img: item.img,
          rang: rangVon(item),
          istKlasse: item.type === "classSkill",
          beschreibung: s.effect || s.description || "",
          tags,
          boni,
          meisterung: istGelernterSkill(item) ? { wert: m.wert, fertig: m.fertig, text: m.text } : null,
          cooldown,
          canUse: !passive && canUseItemAction(actor, item) && cooldown <= 0,
          isPending: HLW.pendingSkill?.actorId === actor.id && HLW.pendingSkill?.itemId === item.id
        };
        (passive ? skills.passiv : skills.aktiv).push(eintrag);
        continue;
      }
      if (istOrb(item)) {
        // Skill-Orb: der Spieler kennt nur, was sein Appraisal gezeigt hat
        const wissen = orbWissen(item);
        gear.push({
          id: item.id, name: orbName(item), img: item.img, type: "orb", orb: true, rang: rangVon(item), filter: "orb", menge: "",
          tooltip: `<strong>${escapeHtml(orbName(item))}</strong><br>${wissen.zeilen.map(escapeHtml).join("<br>")}<br><em>${escapeHtml(ORB_STUFEN[wissen.stufe])}</em>`,
          equipped: false, platz: null
        });
        continue;
      }
      if (!HLW.gearItemTypes.includes(item.type)) continue;
      const menge = Math.max(numberValue(s.quantity), 1);
      const tooltip = `<strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(HLW.itemTypeLabels[item.type] ?? item.type)}${rangVon(item) ? ` · Rang ${rangVon(item)}` : ""}`
        + zeile("Schaden", s.damageText || s.damage)
        + (item.type === "armor" ? zeile("HP", `${numberValue(s.hp)}${s.hpDice ? ` (${s.hpDice})` : ""}`) : "")
        + zeile("Effekt", s.effect)
        + (menge > 1 ? zeile("Anzahl", menge) : "");
      gear.push({
        id: item.id,
        name: item.name,
        img: item.img,
        type: item.type,
        rang: rangVon(item),
        filter: filterVon(item.type),
        menge: menge > 1 ? menge : "",
        tooltip,
        equipped: boolValue(s.equipped),
        platz: ausruestungsPlatz(item)
      });
    }

    // Figur: jeder Platz zeigt das erste ausgerüstete Teil, Waffen füllen Haupt- und Nebenhand.
    const belegt = {};
    const weitere = [];
    for (const g of gear.filter((entry) => entry.equipped)) {
      let platz = g.platz;
      if (platz === "waffe") platz = belegt.haupthand ? "nebenhand" : "haupthand";
      if (platz && !belegt[platz]) belegt[platz] = g;
      else weitere.push(g);
    }
    const platz = (key) => ({ key, label: PLAETZE[key], item: belegt[key] ?? null });
    // Gefährte belegt die Nebenhand
    const g = gefaehrteVon(actor);
    let nebenhand = platz("nebenhand");
    if (g) {
      if (nebenhand.item) weitere.push(nebenhand.item);
      const status = g.aufFeld ? `auf dem Feld, noch ${numberValue(g.rounds)} Runden` : g.exhausted ? "verletzt (lange Rast)" : numberValue(g.cooldown) > 0 ? `Pause ${numberValue(g.cooldown)} Runden` : "bereit";
      nebenhand = {
        key: "nebenhand", label: "Gefährte",
        gefaehrte: {
          name: g.name, img: g.img || g.actor?.img, status, aufFeld: g.aufFeld, badge: g.aufFeld ? numberValue(g.rounds) : "",
          tooltip: `<strong>${escapeHtml(g.name)}</strong><br>Gefährte · ${escapeHtml(status)}<br>Bleibt ${numberValue(g.maxRounds)} Runden auf dem Feld`
        }
      };
    }
    const leere = Math.max(numberValue(actor.system?.resources?.inventorySlots?.max) - countInventorySlots(items), 0);

    return {
      skills,
      figur: {
        links: ["kopf", "brust", "arme", "beine"].map(platz),
        rechts: ["kette", "ohrring", "ring", "armband"].map(platz),
        waffen: [platz("haupthand"), nebenhand],
        weitere
      },
      raster: gear.filter((entry) => !entry.equipped),
      leereFelder: Array.from({ length: Math.min(leere, 40) })
    };
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
    context.isPassive = context.isSkill && isPassiveItem(context.item);
    context.passivText = context.isPassive ? boniText(passivBoni(context.item)) : "";
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
const BILD_STAND = 2;

async function aktualisiereBilder({ alle = false, nurEigene = false } = {}) {
  if (!game.user?.isGM) return 0;
  const basePath = "systems/hope-lies-within-2/import";
  const dateien = ["weapons", "armor", "accessories", "equipment", "consumables", "food-drink", "materials", "natural", "minerals", "junk", "skills", "class-skills", "monsters"];
  const bilder = new Map();
  for (const datei of dateien) {
    const response = await fetch(`${basePath}/${datei}.json`);
    if (!response.ok) continue;
    for (const entry of await response.json()) bilder.set(`${entry.type}|${entry.name}`, entry.img);
  }
  // Klassen-Skills, die nur in der Klassenliste stehen (z. B. Basic-Klassen)
  for (const klasse of HLW.klassen) if (klasse.skill && klasse.img && !bilder.has(`classSkill|${klasse.skill}`)) bilder.set(`classSkill|${klasse.skill}`, klasse.img);
  const standard = (img) => !img || /icons\/svg\/(item-bag|mystery-man)/.test(img) || (alle && /^icons\//.test(img));
  // nurEigene: nur dort ersetzen, wo es ein eigenes Bild (assets/icons) gibt
  if (nurEigene) for (const [key, img] of bilder) if (!img.includes("/assets/icons/")) bilder.delete(key);
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
  // Nicht verknüpfte Figuren auf Szenen haben eigene Kopien der Gegenstände
  for (const scene of game.scenes) {
    for (const token of scene.tokens) {
      if (token.actorLink || !token.actor) continue;
      const updates = token.actor.items.filter((i) => standard(i.img) && bilder.has(`${i.type}|${i.name}`)).map((i) => ({ _id: i.id, img: bilder.get(`${i.type}|${i.name}`) }));
      if (updates.length) await token.actor.updateEmbeddedDocuments("Item", updates);
      anzahl += updates.length;
    }
  }
  ui.notifications?.info(`${anzahl} Bilder aktualisiert.`);
  return anzahl;
}

// Waffen und Klassen-Skills, deren Text noch eine Klassen- oder Waffenbindung nennt, auf den neuen Stand bringen.
async function freieWahlNachziehen() {
  if (!game.user?.isGM) return 0;
  const neu = new Map();
  for (const datei of ["weapons", "class-skills"]) {
    const response = await fetch(`systems/hope-lies-within-2/import/${datei}.json`);
    if (response.ok) for (const e of await response.json()) neu.set(`${e.type}|${e.name}`, e);
  }
  const alt = /Erlaubt den Einsatz von Magie|jede Waffe|magische Waffe|magischen Waffe/i;
  const updates = (items) => items.filter((i) => alt.test(`${i.system?.description ?? ""} ${i.system?.effect ?? ""}`) && neu.has(`${i.type}|${i.name}`)).map((i) => {
    const e = neu.get(`${i.type}|${i.name}`).system ?? {};
    return { _id: i.id, "system.description": e.description ?? "", "system.effect": e.effect ?? "", ...(e.bonuses ? { "system.bonuses": e.bonuses } : {}) };
  });
  let anzahl = 0;
  const welt = updates(game.items.contents);
  if (welt.length) await Item.updateDocuments(welt);
  anzahl += welt.length;
  for (const actor of game.actors) {
    const u = updates(actor.items.contents);
    if (u.length) await actor.updateEmbeddedDocuments("Item", u);
    anzahl += u.length;
  }
  return anzahl;
}

const BESTIARIUM_STAND = 1;

// Vorhandene Monster auf den aktuellen Stand bringen: eigenes Bild und Token, Verhalten, Zähmbarkeit,
// Angriff und Monster-Skills. Vom GM geänderte Bilder (nicht aus Foundrys Bibliothek) bleiben.
async function aktualisiereBestiarium() {
  if (!game.user?.isGM) return 0;
  const response = await fetch("systems/hope-lies-within-2/import/monsters.json");
  if (!response.ok) return 0;
  const eintraege = new Map((await response.json()).map((e) => [e.name, e]));
  const alt = (img) => !img || /^icons\//.test(img);
  let anzahl = 0;
  for (const actor of game.actors.filter((a) => a.type === "monster" && !besitzerVon(a))) {
    const e = eintraege.get(actor.name);
    if (!e) continue;
    const update = {
      "system.monster.behavior": e.system.monster.behavior,
      "system.monster.tameable": e.system.monster.tameable,
      "system.monster.tamers": e.system.monster.tamers
    };
    const altesBild = actor.img;
    if (alt(actor.img)) update.img = e.img;
    if (alt(actor.prototypeToken?.texture?.src)) update["prototypeToken.texture.src"] = e.token || e.img;
    await actor.update(update);
    // Angriff und Skills aus dem Bestiarium; vorhandene Einträge gleichen Namens werden ersetzt
    const namen = new Set(e.items.map((i) => i.name));
    const weg = actor.items.filter((i) => namen.has(i.name) || (i.type === "weapon" && alt(i.img) && i.system?.weaponClass === "monster")).map((i) => i.id);
    if (weg.length) await actor.deleteEmbeddedDocuments("Item", weg);
    await actor.createEmbeddedDocuments("Item", e.items);
    // Figuren dieses Monsters auf den Szenen bekommen das neue Token-Bild
    for (const scene of game.scenes) {
      const tokens = scene.tokens.filter((t) => t.actorId === actor.id && (alt(t.texture?.src) || t.texture?.src === altesBild));
      if (tokens.length) await scene.updateEmbeddedDocuments("Token", tokens.map((t) => ({ _id: t.id, "texture.src": e.token || e.img })));
    }
    anzahl += 1;
  }
  ui.notifications?.info(`Bestiarium aktualisiert: ${anzahl} Monster.`);
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
      prototypeToken: { name: entry.name, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE, texture: { src: entry.token || entry.img } }
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
  // Stand der eigenen Bilder in dieser Welt; steigt, wenn neue Bilder dazukommen (dann werden Foundry-Symbole einmal ersetzt).
  game.settings.register("hope-lies-within-2", "bildStand", { scope: "world", config: false, type: Number, default: 0 });
  game.settings.register("hope-lies-within-2", "ortsmarkerEntfernt", { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register("hope-lies-within-2", "bestiariumStand", { scope: "world", config: false, type: Number, default: 0 });
  game.settings.register("hope-lies-within-2", "skillOrbsGesetzt", { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register("hope-lies-within-2", "freieWahlGesetzt", { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register("hope-lies-within-2", "einKlassenSkill", { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register("hope-lies-within-2", "lindhainNsc", { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register("hope-lies-within-2", "lindhainBausteine", { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register("hope-lies-within-2", "lindhainHandel", { scope: "world", config: false, type: Boolean, default: false });
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
    HLW.insignien = await (await fetch("systems/hope-lies-within-2/data/insignien.json")).json();
    setzeKlassen(HLW.klassen);
    for (const actor of game.actors ?? []) actor.prepareData();
  } catch (error) {
    console.warn("Hope lies Within 2.0 | Klassenliste nicht geladen", error);
  }

  game.hlw = {
    importJsonFile,
    importAllJson: importAllJsonFiles,
    importMonsters,
    aktualisiereBilder,
    aktualisiereBestiarium,
    erstelleLindhain,
    entferneOrtsmarker,
    spielercharakterAnlegen,
    gespraech: (actor) => HopeLiesWithinTalkApp.openFor(actor),
    gespraechAllen: zeigeAllen,
    lindhainAusstatten,
    nscWerte: nscWerteSetzen
  };
  registerTalk();
  registerGefaehrte();

  // Eigene Bilder für Skills und Ausrüstung: ersetzt einmalig die Foundry-Symbole (icons/…) in Welt und Charakteren.
  // Selbst gewählte Bilder bleiben unberührt.
  if (game.user?.isGM && game.settings.get("hope-lies-within-2", "bildStand") < BILD_STAND) {
    await aktualisiereBilder({ alle: true, nurEigene: true });
    await game.settings.set("hope-lies-within-2", "bildStand", BILD_STAND);
  }
  // Bestiarium: Bilder, Tokens, Monster-Skills, Verhalten und Zähmbarkeit einmalig nachziehen.
  if (game.user?.isGM && game.settings.get("hope-lies-within-2", "bestiariumStand") < BESTIARIUM_STAND) {
    await aktualisiereBestiarium();
    await game.settings.set("hope-lies-within-2", "bestiariumStand", BESTIARIUM_STAND);
  }
  // Skill-Orbs neu: Skills, die Charaktere schon haben, gelten als gelernt; dazu Lernleiste und Zusatzeffekt aus dem Import (einmalig).
  if (game.user?.isGM && !game.settings.get("hope-lies-within-2", "skillOrbsGesetzt")) {
    const response = await fetch("systems/hope-lies-within-2/import/skills.json");
    const quelle = new Map(response.ok ? (await response.json()).map((e) => [e.name, e.system?.mastery]) : []);
    const weltUpdates = game.items.filter((i) => i.type === "playerSkill" && quelle.has(i.name)).map((i) => ({ _id: i.id, "system.mastery": quelle.get(i.name), "system.learned": false }));
    if (weltUpdates.length) await Item.updateDocuments(weltUpdates);
    for (const actor of game.actors.filter((a) => a.type === "character")) {
      const u = actor.items.filter((i) => i.type === "playerSkill").map((i) => ({ _id: i.id, "system.learned": true, ...(quelle.has(i.name) ? { "system.mastery": { ...quelle.get(i.name), value: numberValue(i.system?.mastery?.value) } } : {}) }));
      if (u.length) await actor.updateEmbeddedDocuments("Item", u);
    }
    await game.settings.set("hope-lies-within-2", "skillOrbsGesetzt", true);
  }
  // Freie Wahl: alte Texte („Erlaubt den Einsatz von Magie“, „Führt jede Waffe“ …) einmalig ersetzen.
  if (game.user?.isGM && !game.settings.get("hope-lies-within-2", "freieWahlGesetzt")) {
    await freieWahlNachziehen();
    await game.settings.set("hope-lies-within-2", "freieWahlGesetzt", true);
  }
  // Nur die Klassen-Skills der aktuellen Klasse behalten (einmalig für alte Charaktere).
  if (game.user?.isGM && !game.settings.get("hope-lies-within-2", "einKlassenSkill")) {
    for (const actor of game.actors.filter((a) => a.type === "character" && a.system?.progression?.class)) await actor.entferneFremdeKlassenSkills(actor.system.progression.class);
    await game.settings.set("hope-lies-within-2", "einKlassenSkill", true);
  }
  // Lindhain-NSC: Level, Werte, Waffen, Waren und Quests einmalig nachziehen (Welten mit Lindhain vor v0.8.0).
  if (game.user?.isGM && !game.settings.get("hope-lies-within-2", "lindhainNsc")) {
    const anzahl = await lindhainAusstatten();
    if (anzahl) ui.notifications?.info(`${anzahl} NSC in Lindhain haben jetzt Level, Werte, Ausrüstung, Waren und Quests.`);
    await game.settings.set("hope-lies-within-2", "lindhainNsc", true);
  }
  if (game.user?.isGM && !game.settings.get("hope-lies-within-2", "lindhainBausteine")) {
    await lindhainBausteine();
    await game.settings.set("hope-lies-within-2", "lindhainBausteine", true);
  }
  if (game.user?.isGM && !game.settings.get("hope-lies-within-2", "lindhainHandel")) {
    await lindhainHandel();
    await game.settings.set("hope-lies-within-2", "lindhainHandel", true);
  }
  // Klassen-Skills mit Zusatzdaten (z. B. Trickshot: zwei Ziele, Waffenschaden) auf den aktuellen Stand bringen
  if (game.user?.isGM) {
    for (const actor of game.actors.filter((a) => a.type === "character")) {
      const u = actor.items.filter((i) => i.type === "classSkill").map((i) => {
        const k = HLW.klassen.find((kl) => kl.skill === i.name && kl.skillDaten);
        if (!k || numberValue(i.system?.ziele) === numberValue(k.skillDaten.ziele)) return null;
        return { _id: i.id, "system.effect": k.effect, "system.description": `${k.name} (${k.category}): ${k.effect}`, ...Object.fromEntries(Object.entries(k.skillDaten).map(([key, v]) => [`system.${key}`, v])) };
      }).filter(Boolean);
      if (u.length) await actor.updateEmbeddedDocuments("Item", u);
    }
  }
  // Tier-Klassen bekommen den Klassen-Skill „Zähmen“.
  if (game.user?.isGM) {
    for (const actor of game.actors.filter((a) => a.type === "character")) {
      const klasse = HLW.klassen.find((k) => k.name === actor.system?.progression?.class);
      if (klasse?.zaehmen && !actor.items.some((i) => i.system?.skillType === "Zähmen")) await actor.createEmbeddedDocuments("Item", [zaehmSkillDaten(klasse)]);
    }
  }
  // Die Buch-Symbole der Lindhain-Ortsliste (v0.3.0) einmalig von den Karten nehmen.
  if (game.user?.isGM && !game.settings.get("hope-lies-within-2", "ortsmarkerEntfernt")) {
    await entferneOrtsmarker();
    await game.settings.set("hope-lies-within-2", "ortsmarkerEntfernt", true);
  }

  game.socket.on("system.hope-lies-within-2", async (data) => {
    if (!game.user?.isGM) return;
    if (data?.type !== "endTurn") return;

    const combat = game.combats?.get(data.combatId);
    if (!combat?.started) return;
    if (combat.combatant?.actor?.id !== data.actorId) return;

    await combat.nextTurn();
  });
});

// GM: Spielercharakter anlegen und einem Spieler zuweisen
Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user?.isGM) return;
  const root = html?.[0] ?? html;
  if (!root?.querySelector || root.querySelector("[data-hlw-spieler-anlegen]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hlw-sidebar-import";
  button.dataset.hlwSpielerAnlegen = "true";
  button.innerHTML = `<i class="fa-solid fa-user-plus"></i> Spielercharakter anlegen`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    spielercharakterAnlegen();
  });
  (root.querySelector(".directory-header") ?? root.querySelector("header") ?? root).appendChild(button);
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

// Passive Skills wachsen um 1 % pro Kampf, in dem sie wirken; „einmal pro Kampf“ wird wieder frei
Hooks.on("deleteCombat", async (combat) => {
  if (!game.user?.isGM || game.users.activeGM?.id !== game.user.id) return;
  const gesehen = new Set();
  for (const c of combat.combatants) {
    const einmal = c.actor?.items?.filter((i) => boolValue(i.system?.einmalProKampf) && numberValue(i.system?.cooldown?.value) > 0) ?? [];
    if (einmal.length) await c.actor.updateEmbeddedDocuments("Item", einmal.map((i) => ({ _id: i.id, "system.cooldown.value": 0 })));
    const actor = c.actor?.isToken ? game.actors.get(c.actor.id) : c.actor;
    if (!actor || actor.type !== "character" || gesehen.has(actor.id)) continue;
    gesehen.add(actor.id);
    for (const item of actor.items.filter((i) => istGelernterSkill(i) && isPassiveItem(i))) await meisterungPlus(actor, item);
  }
});

Hooks.on("updateActor", (actor) => {
  if (game.combat?.combatant?.actor?.id !== actor.id && HLW.pendingSkill?.actorId !== actor.id) return;
  window.setTimeout(renderCombatHud, 50);
});

for (const hook of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hook, (item) => {
    if (!item.parent || !HLW.combatHud) return;
    if (getCombatHudActor()?.id !== item.parent.id) return;
    window.setTimeout(renderCombatHud, 50);
  });
}

Hooks.on("controlToken", () => {
  window.setTimeout(renderCombatHud, 50);
});
