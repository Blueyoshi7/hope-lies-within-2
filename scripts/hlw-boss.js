// Bosskämpfe mit Phasen (Dominik 2026-11-09)
// Ein Gegner ist ein Boss, wenn am Bogen „Bosskampf“ angehakt ist oder seine Rolle „Boss“ heißt.
// Beim Kampfstart passiert nichts Besonderes mehr (nur Foundrys Kampfstart-Klang entfällt bei Bossen).
// Der GM bekommt im Kampf oben eine Leiste mit „Phase 1“, „Phase 2“, „Phase 3“ (je nachdem, wie viele Phasen
// am Bogen eingetragen sind). Ein Klick zeigt allen die Phase:
//   - Hintergrund wird dunkel, das Phasenbild blendet groß ein, rechts daneben der Phasentext in Violett.
//   - Beim Phasenwechsel steht zuerst das alte Bild da, dann „poppt“ das neue darüber.
//   - Die Phasenmusik startet (5 Sekunden lauter werdend, ab Sekunde 10 leiser, dann leise in Schleife).
//     Ohne eigene Musik läuft die Musik der vorigen Phase weiter.
//   - Ist ein Kartenbild eingetragen, wechselt das Token auf der Karte. Nach dem Kampf kommt das alte Token-Bild zurück.
// Die aktuelle Phase steht am Kampf; wer neu lädt, hört die Musik gleich leise weiter.

const SYSTEM_ID = "hope-lies-within-2";
export const MAX_PHASEN = 3;
export const BOSS_LAUT = 0.8;
export const BOSS_LEISE = 0.3;
export const BOSS_EINBLENDEN_SEKUNDEN = 5;
export const BOSS_LAUT_SEKUNDEN = 10;
const POP_MS = 1400;   // so lange steht beim Phasenwechsel das alte Bild, bevor das neue darüber springt

// Phasenbilder aus dem System (Phase 1 ruhig, dann immer wilder): werden leeren Feldern einmal je Gegner eingetragen,
// wer danach ein Feld leert, behält es leer
const PHASEN_BILDER = {
  Dornenschrat: [1, 2, 3].map((n) => `systems/hope-lies-within-2/assets/monster/dornenschrat-phase-${n}.webp`)
};

let musik = null;          // laufender Sound
let musikSrc = null;       // Datei der laufenden Musik
let leiserTimer = null;
let overlayTimer = [];

export function istBoss(actor) {
  const m = actor?.system?.monster;
  return actor?.type === "monster" && (!!m?.boss || m?.role === "Boss");
}

const phaseLeer = (p) => !p || !(p.bild || p.musik || p.text || p.token);

// Die Phasen eines Bosses: Phase 1 gibt es immer, Phase 2 und 3 nur, wenn dort etwas eingetragen ist.
// Leere Felder erben: Bild von der vorigen Phase (Phase 1: Bild des Gegners), Musik ebenso.
export function bossPhasen(actor) {
  const m = actor?.system?.monster ?? {};
  const liste = [];
  let bild = actor?.img || "";
  let ton = m.bossMusik || "";
  for (let nr = 1; nr <= MAX_PHASEN; nr++) {
    const p = m.phasen?.[`p${nr}`] ?? {};
    if (nr > 1 && phaseLeer(p)) continue;
    bild = p.bild || bild;
    ton = p.musik || ton;
    liste.push({ nr, bild, musik: ton, text: p.text || "", token: p.token || "" });
  }
  return liste;
}

function bosseIm(combat) {
  return combat?.combatants?.filter((c) => istBoss(c.actor)) ?? [];
}

function phaseStand(combat) {
  return combat?.getFlag(SYSTEM_ID, "bossPhasen") ?? {};
}

// ---------- Musik ----------

async function musikSpielen(src, { sofortLeise = false } = {}) {
  if (!src) return;
  window.clearTimeout(leiserTimer);
  // Gleiche Musik läuft schon: nur noch einmal anschwellen lassen
  if (src === musikSrc && musik) {
    if (sofortLeise) return;
    musik.fade(BOSS_LAUT, { duration: 2000 });
    leiserTimer = window.setTimeout(() => musik?.fade(BOSS_LEISE, { duration: 4000 }), BOSS_LAUT_SEKUNDEN * 1000);
    return;
  }
  const alt = musik;
  musik = null;
  musikSrc = src;
  if (alt) ausblenden(alt, 1800);
  try {
    await game.audio.awaitFirstGesture();   // nach dem Neuladen spielt der Browser erst nach dem ersten Klick
    if (musikSrc !== src) return;
    const sound = await game.audio.play(src, { context: game.audio.music, loop: true, volume: sofortLeise ? BOSS_LEISE : 0 });
    if (musikSrc !== src) return sound.stop();   // inzwischen andere Phase oder Kampf vorbei
    musik = sound;
    if (sofortLeise) return;
    sound.fade(BOSS_LAUT, { duration: BOSS_EINBLENDEN_SEKUNDEN * 1000 });
    leiserTimer = window.setTimeout(() => musik?.fade(BOSS_LEISE, { duration: 4000 }), BOSS_LAUT_SEKUNDEN * 1000);
  } catch (error) {
    console.warn("HLW | Boss-Musik konnte nicht starten", src, error);
    if (musikSrc === src) musikSrc = null;
  }
}

function ausblenden(sound, dauer) {
  try {
    sound.fade(0, { duration: dauer });
  } catch { /* schon gestoppt */ }
  window.setTimeout(() => { try { sound.stop(); } catch { /* egal */ } }, dauer + 100);
}

export function bossMusikStoppen(dauer = 2500) {
  window.clearTimeout(leiserTimer);
  leiserTimer = null;
  musikSrc = null;
  const sound = musik;
  musik = null;
  if (sound) ausblenden(sound, dauer);
}

// ---------- Einblendung ----------

function html(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

function overlaySchliessen() {
  for (const t of overlayTimer) window.clearTimeout(t);
  overlayTimer = [];
  const el = document.querySelector(".hlw-bossphase");
  if (!el) return;
  el.classList.add("is-fading");
  window.setTimeout(() => el.remove(), 900);
}

function phaseZeigen(d) {
  for (const t of overlayTimer) window.clearTimeout(t);
  overlayTimer = [];
  document.querySelector(".hlw-bossphase")?.remove();

  const wechsel = !!d.wechsel && !!d.altBild;
  // Neue Musik setzt beim Pop ein
  overlayTimer.push(window.setTimeout(() => musikSpielen(d.musik), wechsel ? POP_MS - 200 : 0));

  const el = document.createElement("div");
  el.className = `hlw-bossphase${wechsel ? " is-wechsel" : ""}${d.text ? "" : " ohne-text"}`;
  el.innerHTML = `
    <div class="bp-bild">
      ${wechsel ? `<img class="bp-alt" src="${html(d.altBild)}" alt="">` : ""}
      ${d.bild ? `<img class="bp-neu" src="${html(d.bild)}" alt="">` : ""}
      <div class="bp-blitz"></div>
    </div>
    <div class="bp-text">
      <div class="bp-phase">Phase ${Number(d.nach) || 1}</div>
      ${d.text ? `<p>${html(d.text).replace(/\n/g, "<br>")}</p>` : ""}
    </div>`;
  el.addEventListener("click", overlaySchliessen);
  document.body.appendChild(el);

  const dauer = Math.min(16000, Math.max(7000, 4000 + String(d.text ?? "").length * 55)) + (wechsel ? POP_MS : 0);
  overlayTimer.push(window.setTimeout(overlaySchliessen, dauer));
}

// GM: Phase auslösen (bei allen zeigen, Phase am Kampf merken, Token-Bild wechseln)
export async function phaseAusloesen(combat, combatantId, nach) {
  if (!game.user?.isGM || !combat) return;
  const kaempfer = combat.combatants.get(combatantId);
  const phasen = bossPhasen(kaempfer?.actor);
  const ziel = phasen.find((p) => p.nr === nach);
  if (!ziel) return;
  const von = Number(phaseStand(combat)[combatantId]) || 0;
  const alt = phasen.find((p) => p.nr === von);
  const wechsel = !!alt && von !== nach;
  const daten = { type: "bossPhase", nach, wechsel, altBild: wechsel ? alt.bild : "", bild: ziel.bild, text: ziel.text, musik: ziel.musik };
  game.socket.emit(`system.${SYSTEM_ID}`, daten);
  phaseZeigen(daten);

  const update = { [`flags.${SYSTEM_ID}.bossPhasen.${combatantId}`]: nach };
  const token = kaempfer.token;
  const urbilder = combat.getFlag(SYSTEM_ID, "bossUrbild") ?? {};
  if (token && ziel.token && !urbilder[combatantId]) update[`flags.${SYSTEM_ID}.bossUrbild.${combatantId}`] = token.texture.src;
  await combat.update(update);
  if (token && ziel.token && token.texture.src !== ziel.token) {
    window.setTimeout(() => token.update({ "texture.src": ziel.token }), wechsel ? POP_MS : 600);
  }
}

// Nach dem Kampf: alte Token-Bilder zurück
async function urbilderZurueck(combat) {
  if (!game.users.activeGM?.isSelf) return;
  const urbilder = combat.getFlag(SYSTEM_ID, "bossUrbild") ?? {};
  for (const [id, src] of Object.entries(urbilder)) {
    const token = combat.combatants.get(id)?.token;
    if (token && src && token.texture.src !== src) await token.update({ "texture.src": src });
  }
}

// ---------- GM-Leiste ----------

function leisteZeichnen() {
  document.getElementById("hlw-bossleiste")?.remove();
  if (!game.user?.isGM || !game.ready) return;
  const combat = game.combat;
  const bosse = bosseIm(combat);
  if (!bosse.length) return;
  const stand = phaseStand(combat);
  const leiste = document.createElement("div");
  leiste.id = "hlw-bossleiste";
  leiste.innerHTML = bosse.map((c) => {
    const aktuell = Number(stand[c.id]) || 0;
    const knoepfe = bossPhasen(c.actor).map((p) => `
      <button type="button" data-boss-phase="${p.nr}" data-kaempfer="${c.id}" class="${p.nr === aktuell ? "is-aktiv" : ""}"
        data-tooltip="${html(p.text ? p.text.slice(0, 120) : "Ohne Text")}">Phase ${p.nr}</button>`).join("");
    return `<div class="bl-boss"><img src="${html(c.token?.texture?.src || c.actor?.img || "")}" alt=""><span>${html(c.name)}</span>${knoepfe}</div>`;
  }).join("") + `<button type="button" class="bl-stumm" data-boss-stumm data-tooltip="Boss-Musik ausblenden (bei allen)"><i class="fa-solid fa-volume-xmark"></i></button>`;
  leiste.addEventListener("click", (event) => {
    const knopf = event.target.closest("button");
    if (!knopf) return;
    if (knopf.dataset.bossStumm !== undefined) {
      game.socket.emit(`system.${SYSTEM_ID}`, { type: "bossStumm" });
      bossMusikStoppen();
      return;
    }
    phaseAusloesen(game.combat, knopf.dataset.kaempfer, Number(knopf.dataset.bossPhase));
  });
  document.body.appendChild(leiste);
}

let zeichnenGeplant = false;
function leisteSpaeter() {
  if (zeichnenGeplant) return;
  zeichnenGeplant = true;
  window.setTimeout(() => { zeichnenGeplant = false; leisteZeichnen(); }, 50);
}

// Nach dem Neuladen: Musik der aktuellen Phase leise weiter
function musikFortsetzen() {
  const combat = game.combat;
  const stand = phaseStand(combat);
  for (const c of bosseIm(combat)) {
    const nr = Number(stand[c.id]) || 0;
    const phase = bossPhasen(c.actor).find((p) => p.nr === nr);
    if (phase?.musik) return musikSpielen(phase.musik, { sofortLeise: true });
  }
}

export function registerBoss() {
  // Foundrys Kampfstart-Klang (Kampf-Thema) bei Bosskämpfen weglassen
  const Kampf = CONFIG.Combat.documentClass;
  const klang = Kampf.prototype._playCombatSound;
  Kampf.prototype._playCombatSound = function (announcement) {
    if (announcement === "startEncounter" && bosseIm(this).length) return;
    return klang.call(this, announcement);
  };
  Hooks.on("deleteCombat", (combat) => {
    bossMusikStoppen();
    overlaySchliessen();
    urbilderZurueck(combat);
    leisteSpaeter();
  });
  for (const hook of ["createCombat", "updateCombat", "createCombatant", "deleteCombatant", "updateCombatant", "updateActor", "canvasReady"]) {
    Hooks.on(hook, leisteSpaeter);
  }
  Hooks.once("ready", async () => {
    game.socket.on(`system.${SYSTEM_ID}`, (daten) => {
      if (daten?.type === "bossPhase") phaseZeigen(daten);
      else if (daten?.type === "bossStumm") bossMusikStoppen();
    });
    leisteZeichnen();
    musikFortsetzen();
    // Alte Boss-Musik (ein Feld für den ganzen Kampf) wird zur Musik von Phase 1
    if (!game.users.activeGM?.isSelf) return;
    for (const actor of game.actors.filter((a) => a.type === "monster" && a.system.monster?.bossMusik && !a.system.monster?.phasen?.p1?.musik)) {
      await actor.update({ "system.monster.phasen.p1.musik": actor.system.monster.bossMusik, "system.monster.bossMusik": "", "system.monster.bossBild": "" });
    }
    // Phasenbilder aus dem System einmal eintragen, wo das Feld noch leer ist
    for (const actor of game.actors.filter((a) => a.type === "monster" && PHASEN_BILDER[a.name] && !a.getFlag(SYSTEM_ID, "phasenBilder"))) {
      const update = { [`flags.${SYSTEM_ID}.phasenBilder`]: true };
      PHASEN_BILDER[actor.name].forEach((src, i) => {
        if (!actor.system.monster?.phasen?.[`p${i + 1}`]?.bild) update[`system.monster.phasen.p${i + 1}.bild`] = src;
      });
      await actor.update(update);
    }
  });
}
