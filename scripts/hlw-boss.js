// Bosskämpfe (Dominik 2026-11-05)
// Ein Gegner ist ein Boss, wenn am Bogen „Bosskampf“ angehakt ist oder seine Rolle „Boss“ heißt.
// Beginnt ein Kampf mit einem Boss, zeigt „IM KAMPF“ groß das Boss-Bild (Feld „Boss-Bild“, sonst das Bild des Gegners).
// Bei allen läuft dazu die Boss-Musik (Feld „Boss-Musik“): 10 Sekunden laut, dann leiser im Hintergrund, in Schleife,
// bis der Kampf endet. Sie läuft über den Musik-Kanal, also gilt der Playlist-Regler jedes Spielers.
// Wer mitten im Bosskampf neu lädt, hört die Musik gleich leise weiter (ohne Einblendung).

export const BOSS_LAUT = 0.8;
export const BOSS_LEISE = 0.3;
export const BOSS_LAUT_SEKUNDEN = 10;

let musik = null;          // laufender Sound
let musikKampf = null;     // Kampf, zu dem die Musik gehört
let leiserTimer = null;

export function istBoss(actor) {
  const m = actor?.system?.monster;
  return actor?.type === "monster" && (!!m?.boss || m?.role === "Boss");
}

// Der Boss eines Kampfes (lebende zuerst)
export function bossVon(combat) {
  const bosse = combat?.combatants?.filter((c) => istBoss(c.actor)) ?? [];
  return bosse.find((c) => !c.isDefeated) ?? bosse[0] ?? null;
}

export function bossBild(actor) {
  return actor?.system?.monster?.bossBild || actor?.img || "";
}

export async function bossMusikStarten(combat, { sofortLeise = false } = {}) {
  const src = bossVon(combat)?.actor?.system?.monster?.bossMusik;
  if (!src || musikKampf === combat.id) return;
  await bossMusikStoppen(0);
  musikKampf = combat.id;
  try {
    await game.audio.awaitFirstGesture();   // nach dem Neuladen spielt der Browser erst nach dem ersten Klick
    if (musikKampf !== combat.id) return;
    const sound = await game.audio.play(src, { context: game.audio.music, loop: true, volume: sofortLeise ? BOSS_LEISE : BOSS_LAUT });
    if (musikKampf !== combat.id) return sound.stop();   // Kampf inzwischen vorbei
    musik = sound;
    if (!sofortLeise) leiserTimer = window.setTimeout(() => musik?.fade(BOSS_LEISE, { duration: 4000 }), BOSS_LAUT_SEKUNDEN * 1000);
  } catch (error) {
    console.warn("HLW | Boss-Musik konnte nicht starten", src, error);
    musikKampf = null;
  }
}

export async function bossMusikStoppen(dauer = 2500) {
  window.clearTimeout(leiserTimer);
  leiserTimer = null;
  musikKampf = null;
  const sound = musik;
  musik = null;
  if (!sound) return;
  if (dauer) await sound.fade(0, { duration: dauer });
  sound.stop();
}

export function registerBoss() {
  Hooks.on("deleteCombat", () => bossMusikStoppen());
  // Boss erst nach Kampfbeginn dazugeholt
  Hooks.on("createCombatant", (combatant) => {
    if (combatant.parent?.started && istBoss(combatant.actor)) bossMusikStarten(combatant.parent);
  });
  Hooks.once("ready", () => {
    if (game.combat?.started) bossMusikStarten(game.combat, { sofortLeise: true });
  });
}
