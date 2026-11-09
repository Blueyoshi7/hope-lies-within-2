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
// Phasen machen den Boss stärker (2026-11-09): je Phase Boni (Bewegung, Aktionspunkte, RW, MR, Genauigkeit, Schaden),
// die sich bis zur aktiven Phase aufaddieren, und Skills mit „ab Phase N“ (Item-Flag abPhase) erscheinen erst dann im HUD.
// Die aktive Phase steht am Gegner selbst (system.monster.phaseAktiv, bei Tokens ohne Verknüpfung nur an diesem Token).
// Das Phasenbild zeigt nur die oberen 75 % (Beine weg, unten weich ausgeblendet); der Text erscheint Wort für Wort.

const SYSTEM_ID = "hope-lies-within-2";
export const MAX_PHASEN = 3;
export const BOSS_LAUT = 0.8;
export const BOSS_LEISE = 0.3;
export const BOSS_EINBLENDEN_SEKUNDEN = 5;
export const BOSS_LAUT_SEKUNDEN = 10;
const POP_MS = 1400;   // so lange steht beim Phasenwechsel das alte Bild, bevor das neue darüber springt
const MUSIK_ORDNER = "systems/hope-lies-within-2/assets/musik/";   // hier liegt die ganze Musik, am Bogen wählbar
const BILD_ANTEIL = 0.75;   // vom Phasenbild nur die oberen 75 % zeigen
const WORT_SEKUNDEN = 0.14; // Abstand zwischen zwei Wörtern beim Einblenden

// Phasenbilder aus dem System (Phase 1 ruhig, dann immer wilder): werden leeren Feldern einmal je Gegner eingetragen,
// wer danach ein Feld leert, behält es leer
const PHASEN_BILDER = {
  Dornenschrat: [1, 2, 3].map((n) => `systems/hope-lies-within-2/assets/monster/dornenschrat-phase-${n}.webp`)
};

// Phasen-Inhalte aus dem System: neue Skills (ab Phase N) und Boni je Phase, einmal je Gegner eingetragen
const skill = (name, ab, rang, felder) => ({
  name, type: "playerSkill", img: ab === 3 ? "icons/magic/nature/root-vine-entangle-foot-green.webp" : "icons/magic/nature/root-vine-entangled-hand.webp",
  flags: { [SYSTEM_ID]: { abPhase: ab } },
  system: { skillType: "Monster", source: "Bosskampf", rank: rang, activation: "active", castTime: "action", damageCategory: "physical", ...felder }
});
const PHASEN_INHALT = {
  Dornenschrat: {
    boni: { p2: { bewegung: 1, acc: 1 }, p3: { bewegung: 1, aktionen: 1, rw: 2, schaden: 2 } },
    skills: [
      skill("Dornensalve", 2, "C", {
        damage: "2d6+2", damageText: "2W6+2", range: 4, cooldown: { value: 0, max: 3 }, cooldownText: "3 Runden",
        effect: "Schießt Dornen auf bis zu 3 Ziele in 4 Feldern, je 2W6+2. Wer getroffen wird, blutet: 1W4 am Zugbeginn, 2 Runden.",
        description: "Aktion (ab Phase 2): Bis zu 3 Ziele in 4 Feldern, je 2W6+2. Treffer bluten 2 Runden lang (1W4 am Zugbeginn)."
      }),
      skill("Würgender Hain", 3, "C", {
        damage: "2d8+4", damageText: "2W8+4", range: 2, cooldown: { value: 0, max: 4 }, cooldownText: "4 Runden",
        effect: "Wurzeln brechen im Umkreis von 2 Feldern aus dem Boden: alle dort 2W8+4, Athletik 30 oder 1 Runde bewegungsunfähig. Er heilt sich um die Hälfte des Schadens.",
        description: "Aktion (ab Phase 3): Alle in 2 Feldern Umkreis 2W8+4, Athletik 30 oder 1 Runde bewegungsunfähig. Heilt sich um die Hälfte des verursachten Schadens."
      })
    ]
  }
};

let musik = null;          // laufender Sound
let musikSrc = null;       // Datei der laufenden Musik
let leiserTimer = null;
let overlayTimer = [];

export function istBoss(actor) {
  const m = actor?.system?.monster;
  return actor?.type === "monster" && (!!m?.boss || m?.role === "Boss");
}

export const BONI = [
  ["bewegung", "Bewegung"], ["aktionen", "Aktionspunkte"], ["rw", "Rüstwert"],
  ["mr", "Magieresistenz"], ["acc", "Genauigkeit"], ["schaden", "Schaden"]
];
const zahl = (v) => Number(v) || 0;
const boniSumme = (p) => BONI.reduce((s, [k]) => s + Math.abs(zahl(p?.boni?.[k])), 0);
const phaseLeer = (p) => !p || !(p.bild || p.musik || p.text || p.token || boniSumme(p));

// Aktive Phase eines Gegners (0 = noch keine ausgelöst, zählt wie Phase 1)
export function aktivePhase(actor) {
  return Math.max(1, zahl(actor?.system?.monster?.phaseAktiv));
}

// Boni aller Phasen bis zur aktiven Phase zusammengezählt (nur wenn eine Phase ausgelöst wurde)
export function phasenBoni(system) {
  const m = system?.monster ?? {};
  const aktiv = zahl(m.phaseAktiv);
  const summe = Object.fromEntries(BONI.map(([k]) => [k, 0]));
  for (let nr = 1; nr <= Math.min(aktiv, MAX_PHASEN); nr++) {
    for (const [k] of BONI) summe[k] += zahl(m.phasen?.[`p${nr}`]?.boni?.[k]);
  }
  return summe;
}

// Ist dieser Skill in der aktuellen Phase schon frei?
export function skillFrei(actor, item) {
  const ab = zahl(item?.getFlag?.(SYSTEM_ID, "abPhase"));
  return ab <= 1 || actor?.type !== "monster" || aktivePhase(actor) >= ab;
}

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

  // Text Wort für Wort: jedes Wort blendet kurz nach dem vorigen ein (Zeilenumbrüche bleiben)
  const textStart = wechsel ? 2.0 : 1.0;
  let wortNr = 0;
  const woerter = {
    html: String(d.text ?? "").split("\n").map((zeile) => zeile.split(/\s+/).filter(Boolean)
      .map((wort) => `<span class="bp-wort" style="animation-delay:${(textStart + WORT_SEKUNDEN * wortNr++).toFixed(2)}s">${html(wort)}</span>`).join(" ")).join("<br>")
  };
  const el = document.createElement("div");
  el.className = `hlw-bossphase${wechsel ? " is-wechsel" : ""}${d.text ? "" : " ohne-text"}`;
  el.innerHTML = `
    <div class="bp-bild">
      <div class="bp-rahmen">
        ${wechsel ? `<img class="bp-alt" src="${html(d.altBild)}" alt="">` : ""}
        ${d.bild ? `<img class="bp-neu" src="${html(d.bild)}" alt="">` : ""}
      </div>
      <div class="bp-blitz"></div>
    </div>
    <div class="bp-text">
      <div class="bp-phase">Phase ${Number(d.nach) || 1}</div>
      ${d.text ? `<p>${woerter.html}</p>` : ""}
    </div>`;
  el.addEventListener("click", overlaySchliessen);
  document.body.appendChild(el);
  // Nur die oberen 75 % des Bildes zeigen: Rahmen bekommt das Seitenverhältnis des gekürzten Bildes
  if (d.bild) {
    const probe = new Image();
    probe.onload = () => { if (probe.naturalHeight) el.querySelector(".bp-bild").style.aspectRatio = String(probe.naturalWidth / (probe.naturalHeight * BILD_ANTEIL)); };
    probe.src = d.bild;
  }

  const dauer = Math.min(20000, Math.max(7000, (textStart + WORT_SEKUNDEN * wortNr) * 1000 + 4500)) + (wechsel ? POP_MS : 0);
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
  await phaseAmGegner(kaempfer.actor, nach);
}

// Phase am Gegner setzen: Boni wirken über die Werteberechnung, neue Aktionspunkte gibt es sofort,
// neu freie Skills sind gleich einsatzbereit. Der GM bekommt eine Übersicht in den Chat.
async function phaseAmGegner(actor, nach) {
  if (!actor) return;
  const vorher = phasenBoni(actor.system);
  const alteAP = zahl(actor.system?.resources?.actionPoints?.max);
  const altePhase = aktivePhase(actor);
  await actor.update({ "system.monster.phaseAktiv": nach });
  const nachher = phasenBoni(actor.system);
  const plusAP = zahl(actor.system?.resources?.actionPoints?.max) - alteAP;
  if (plusAP > 0) await actor.update({ "system.resources.actionPoints.value": zahl(actor.system.resources.actionPoints.value) + plusAP });
  const neu = actor.items.filter((i) => { const ab = zahl(i.getFlag(SYSTEM_ID, "abPhase")); return ab > altePhase && ab <= nach; });
  const bereit = neu.filter((i) => zahl(i.system?.cooldown?.value) > 0).map((i) => ({ _id: i.id, "system.cooldown.value": 0 }));
  if (bereit.length) await actor.updateEmbeddedDocuments("Item", bereit);
  const aenderung = BONI.map(([k, name]) => [name, nachher[k] - vorher[k]]).filter(([, d]) => d)
    .map(([name, d]) => `${name} ${d > 0 ? "+" : ""}${d}`);
  if (!neu.length && !aenderung.length) return;
  await ChatMessage.create({
    whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
    content: `<div class="hlw-chat-card hlw-chat-kurz"><h2><i class="fa-solid fa-dragon"></i> ${html(actor.name)}: Phase ${nach}</h2>`
      + (neu.length ? `<p><b>Neue Skills:</b> ${neu.map((i) => html(i.name)).join(", ")}</p>` : "")
      + (aenderung.length ? `<p><b>Werte:</b> ${aenderung.join(", ")}</p>` : "") + "</div>"
  });
}

// Nach dem Kampf: alte Token-Bilder zurück
async function urbilderZurueck(combat) {
  if (!game.users.activeGM?.isSelf) return;
  const urbilder = combat.getFlag(SYSTEM_ID, "bossUrbild") ?? {};
  for (const [id, src] of Object.entries(urbilder)) {
    const token = combat.combatants.get(id)?.token;
    if (token && src && token.texture.src !== src) await token.update({ "texture.src": src });
  }
  // Phase und Phasen-Boni enden mit dem Kampf
  for (const c of bosseIm(combat)) {
    if (zahl(c.actor?.system?.monster?.phaseAktiv)) await c.actor.update({ "system.monster.phaseAktiv": 0 });
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
    // Musik aus dem alten Welt-Ordner hlw-musik/ liegt jetzt im System (assets/musik), dann klappt sie auch auf einem Server
    for (const actor of game.actors.filter((a) => a.type === "monster")) {
      const update = {};
      for (let nr = 1; nr <= MAX_PHASEN; nr++) {
        const alt = actor.system.monster?.phasen?.[`p${nr}`]?.musik ?? "";
        const datei = alt.match(/^hlw-musik\/(dornenschrat\.mp3)$/)?.[1];
        if (datei) update[`system.monster.phasen.p${nr}.musik`] = `${MUSIK_ORDNER}${datei}`;
      }
      if (!actor.system.monster?.phasen?.p1?.musik && actor.name === "Dornenschrat") update["system.monster.phasen.p1.musik"] = `${MUSIK_ORDNER}dornenschrat.mp3`;
      if (Object.keys(update).length) await actor.update(update);
    }
    // Phasenbilder aus dem System einmal eintragen, wo das Feld noch leer ist
    for (const actor of game.actors.filter((a) => a.type === "monster" && PHASEN_BILDER[a.name] && !a.getFlag(SYSTEM_ID, "phasenBilder"))) {
      const update = { [`flags.${SYSTEM_ID}.phasenBilder`]: true };
      PHASEN_BILDER[actor.name].forEach((src, i) => {
        if (!actor.system.monster?.phasen?.[`p${i + 1}`]?.bild) update[`system.monster.phasen.p${i + 1}.bild`] = src;
      });
      await actor.update(update);
    }
    for (const actor of game.actors.filter((a) => a.type === "monster" && PHASEN_INHALT[a.name] && !a.getFlag(SYSTEM_ID, "phasenInhalt"))) {
      const inhalt = PHASEN_INHALT[actor.name];
      const update = { [`flags.${SYSTEM_ID}.phasenInhalt`]: true };
      for (const [key, boni] of Object.entries(inhalt.boni)) {
        for (const [k, v] of Object.entries(boni)) if (!zahl(actor.system.monster?.phasen?.[key]?.boni?.[k])) update[`system.monster.phasen.${key}.boni.${k}`] = v;
      }
      await actor.update(update);
      const fehlt = inhalt.skills.filter((sk) => !actor.items.some((i) => i.name === sk.name));
      if (fehlt.length) await actor.createEmbeddedDocuments("Item", fehlt);
    }
  });
}
