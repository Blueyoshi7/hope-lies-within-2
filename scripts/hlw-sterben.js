// Sterben (Kanon: Kampfablauf → 0 HP, 2026-10-30, Dominik)
// Spielercharakter auf 0 HP: Er liegt am Boden und macht einen Todeswurf (1W20, 10 oder mehr).
// Geschafft: steht mit 1 HP wieder auf. Nicht geschafft: Gewurzelt (Rooted) für 3 Runden. In der Zeit kann ihn
// jemand mit einem Heiltrank (Verabreichen) oder einem Heil-Skill retten. Sonst stirbt er, und der Spieler erstellt einen neuen Charakter.
// Zustand am Actor: flags.hope-lies-within-2.sterben = { phase: "wurf" | "gewurzelt" | "tot", runden }

const SYSTEM_ID = "hope-lies-within-2";
export const STERBE_RUNDEN = 3;
export const TODESWURF_ZIEL = 10;

function zahl(wert) {
  const z = Number(wert);
  return Number.isFinite(z) ? z : 0;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function sterbeZustand(actor) {
  if (actor?.type !== "character") return null;
  const flag = actor.getFlag(SYSTEM_ID, "sterben");
  if (flag?.phase) return flag;
  return zahl(actor.system?.resources?.hp?.value) <= 0 ? { phase: "wurf", runden: 0 } : null;
}

// Darf sich die Figur bewegen oder handeln? (0 HP, gewurzelt oder tot: nein)
export function istAmBoden(actor) {
  return !!sterbeZustand(actor);
}

async function status(actor, id, aktiv) {
  if (!CONFIG.statusEffects.some((s) => s.id === id)) return;
  if (!!actor.statuses?.has(id) !== aktiv) await actor.toggleStatusEffect(id, { active: aktiv, overlay: id === "dead" });
}

// Nur der GM und die Besitzer der Figur sehen die Nachricht
function empfaenger(actor) {
  return game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id);
}

async function karte(actor, titel, text, { allen = true } = {}) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="hlw-chat-card hlw-chat-kurz hlw-sterben"><h2>${escapeHtml(titel)}</h2><p>${text}</p></div>`,
    ...(allen ? {} : { whisper: empfaenger(actor) })
  });
}

// Todeswurf (der Spieler drückt den Knopf): 1W20 gegen 10
export async function todeswurf(actor) {
  const z = sterbeZustand(actor);
  if (!z || z.phase !== "wurf") return ui.notifications?.warn("Ein Todeswurf ist nur auf 0 HP möglich, einmal pro Sturz.");
  if (game.combat?.started && game.combat.combatant?.actor?.id !== actor.id && !game.user?.isGM) return ui.notifications?.warn("Den Todeswurf machst du, wenn du am Zug bist.");
  const roll = await new Roll("1d20").evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `Todeswurf (${TODESWURF_ZIEL} oder mehr)` });
  if (roll.total >= TODESWURF_ZIEL) {
    await actor.update({ "system.resources.hp.value": 1, [`flags.${SYSTEM_ID}.-=sterben`]: null });
    await status(actor, "prone", false);
    await karte(actor, "Todeswurf geschafft", `${escapeHtml(actor.name)} rappelt sich mit 1 HP wieder auf.`);
    return;
  }
  await actor.update({ [`flags.${SYSTEM_ID}.sterben`]: { phase: "gewurzelt", runden: STERBE_RUNDEN } });
  await status(actor, "restrain", true);
  await karte(actor, "Todeswurf misslungen", `${escapeHtml(actor.name)} ist <b>gewurzelt</b> und kann sich nicht bewegen. Noch <b>${STERBE_RUNDEN} Runden</b>: Ein Heiltrank (Verabreichen) oder ein Heil-Skill rettet ${escapeHtml(actor.name)}. Sonst stirbt die Figur.`);
}

// GM: am Anfang des eigenen Zugs läuft die Frist ab
export async function sterbenZugbeginn(actor) {
  if (!game.user?.isGM || actor?.type !== "character") return;
  const z = actor.getFlag(SYSTEM_ID, "sterben");
  if (z?.phase !== "gewurzelt") return;
  const rest = zahl(z.runden) - 1;
  if (rest > 0) {
    await actor.update({ [`flags.${SYSTEM_ID}.sterben.runden`]: rest });
    return karte(actor, "Gewurzelt", `${escapeHtml(actor.name)} liegt am Boden. Noch <b>${rest} ${rest === 1 ? "Runde" : "Runden"}</b>, bis die Figur stirbt.`);
  }
  await sterben(actor);
}

export async function sterben(actor) {
  await actor.update({ [`flags.${SYSTEM_ID}.sterben`]: { phase: "tot", runden: 0 }, "system.resources.hp.value": 0 });
  await status(actor, "restrain", false);
  await status(actor, "prone", false);
  await status(actor, "dead", true);
  const combatant = game.combat?.combatants.find((c) => c.actorId === actor.id);
  if (combatant && !combatant.defeated) await combatant.update({ defeated: true });
  await karte(actor, `${actor.name} ist gestorben`, "Niemand kam rechtzeitig. Der Spieler erstellt einen neuen Charakter (Level des Gefallenen minus 2).");
}

// GM: HP-Änderungen beobachten. Auf 0: am Boden. Über 0 (Heilung): gerettet.
export function registerSterben() {
  for (const s of CONFIG.statusEffects) {
    if (s.id === "prone") s.name = "Am Boden";
    if (s.id === "restrain") s.name = "Gewurzelt (Rooted)";
    if (s.id === "dead") s.name = "Tot";
  }
  Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (actor.type !== "character" || !game.users.activeGM?.isSelf) return;
    const neu = foundry.utils.getProperty(changes, "system.resources.hp.value");
    if (neu === undefined) return;
    const z = actor.getFlag(SYSTEM_ID, "sterben");
    if (zahl(neu) <= 0) {
      if (z?.phase) return;
      await actor.setFlag(SYSTEM_ID, "sterben", { phase: "wurf", runden: 0 });
      await status(actor, "prone", true);
      return karte(actor, `${actor.name} geht zu Boden`, `0 HP. ${escapeHtml(actor.name)} macht einen <b>Todeswurf</b> (1W20, ${TODESWURF_ZIEL} oder mehr): im Kampf-HUD oder im Bogen.`);
    }
    if (!z?.phase) return;
    const warTot = z.phase === "tot";
    // Tote heilt man nicht zurück; das darf nur der GM (z. B. Phönixasche)
    if (warTot && !game.users.get(userId)?.isGM) {
      await actor.update({ "system.resources.hp.value": 0 });
      return ui.notifications?.warn(`${actor.name} ist tot. Nur der GM kann die Figur zurückholen (Phönixasche).`);
    }
    await actor.unsetFlag(SYSTEM_ID, "sterben");
    await status(actor, "restrain", false);
    await status(actor, "prone", false);
    if (warTot) await status(actor, "dead", false);
    const combatant = game.combat?.combatants.find((c) => c.actorId === actor.id);
    if (combatant?.defeated) await combatant.update({ defeated: false });
    if (z.phase === "gewurzelt") await karte(actor, `${actor.name} ist gerettet`, `Mit ${zahl(neu)} HP wieder bei Bewusstsein.`);
  });
}
