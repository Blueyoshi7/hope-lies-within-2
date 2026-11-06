// Tageszeit und Spieltag (Dominik 2026-11-01)
// Oben in der Mitte steht für alle „Tag 3 · Abend“. Der GM klickt dort Morgen, Tag, Abend oder Nacht und „Neuer Tag“.
// Die Tageszeit stellt die Dunkelheit aller Szenen ein (außer dem Dashboard und Szenen mit gesperrter Dunkelheit):
// Morgen 0,25 · Tag 0 · Abend 0,45 · Nacht 0,85. Ab 0,5 sehen Spieler nur noch, was Licht abbekommt (siehe hlw-szenen.js).
// Ein neuer Tag beginnt am Morgen und meldet sich im Chat; der Zähler (Einstellung "spieltag") zählt für Suchen und Quests.
// Daneben der Schalter für den Nähe-Sprachchat (hlw-naehe.js): der GM schaltet, Spieler sehen ein Ohr, solange er an ist.

import { spieltag, neuerTag } from "./hlw-sammeln.js";
import { naeheAn } from "./hlw-naehe.js";

const SYSTEM_ID = "hope-lies-within-2";

export const TAGESZEITEN = {
  morgen: { label: "Morgen", icon: "fa-solid fa-cloud-sun", dunkel: 0.25, text: "Die Sonne geht auf." },
  tag: { label: "Tag", icon: "fa-solid fa-sun", dunkel: 0, text: "Es ist heller Tag." },
  abend: { label: "Abend", icon: "fa-solid fa-cloud-moon", dunkel: 0.45, text: "Es wird Abend." },
  nacht: { label: "Nacht", icon: "fa-solid fa-moon", dunkel: 0.85, text: "Die Nacht bricht herein." }
};

export function tageszeit() {
  const t = game.settings.get(SYSTEM_ID, "tageszeit");
  return TAGESZEITEN[t] ? t : "tag";
}

function betroffen(scene) {
  return !scene.getFlag(SYSTEM_ID, "dashboard") && !scene.environment?.darknessLock;
}

// GM: Tageszeit setzen, Dunkelheit aller Szenen anpassen, kurze Chatkarte
export async function tageszeitSetzen(zeit, { melden = true } = {}) {
  if (!game.user?.isGM || !TAGESZEITEN[zeit]) return;
  const dunkel = TAGESZEITEN[zeit].dunkel;
  await game.settings.set(SYSTEM_ID, "tageszeit", zeit);
  for (const scene of game.scenes.filter(betroffen)) {
    if (scene._source.environment?.darknessLevel === dunkel) continue;   // gespeicherter Wert, nicht der laufenden Animation
    await scene.update({ "environment.darknessLevel": dunkel }, scene.active ? { animateDarkness: 3000 } : {});
  }
  if (melden) {
    await ChatMessage.create({ content: `<div class="hlw-chat-card hlw-chat-kurz"><h2><i class="${TAGESZEITEN[zeit].icon}"></i> Tag ${spieltag()} · ${TAGESZEITEN[zeit].label}</h2><p>${TAGESZEITEN[zeit].text}</p></div>` });
  }
}

// Anzeige oben in der Mitte: Spieler sehen Tag und Tageszeit, der GM kann umschalten
export function tageszeitAnzeige() {
  if (!game.ready) return;
  let box = document.getElementById("hlw-tageszeit");
  if (!box) {
    box = document.createElement("div");
    box.id = "hlw-tageszeit";
    document.body.appendChild(box);
    box.addEventListener("click", (event) => {
      const knopf = event.target.closest("button");
      if (!knopf || !game.user?.isGM) return;
      if (knopf.dataset.zeit) tageszeitSetzen(knopf.dataset.zeit);
      if (knopf.dataset.neuerTag !== undefined) neuerTag();
      if (knopf.dataset.naehe !== undefined) game.settings.set(SYSTEM_ID, "naeheChat", !naeheAn());
    });
  }
  const jetzt = tageszeit();
  const t = TAGESZEITEN[jetzt];
  box.classList.toggle("is-gm", !!game.user?.isGM);
  box.classList.toggle("im-kampf", !!game.combat?.started);   // im Kampf unter die Kampfleiste oben (Combat Tracker Dock)
  const naehe = naeheAn();
  box.innerHTML = game.user?.isGM
    ? `<span class="tz-tag">Tag ${spieltag()}</span>
       ${Object.entries(TAGESZEITEN).map(([k, z]) => `<button type="button" data-zeit="${k}" class="${k === jetzt ? "is-aktiv" : ""}" data-tooltip="${z.label}"><i class="${z.icon}"></i></button>`).join("")}
       <button type="button" data-neuer-tag class="tz-neu" data-tooltip="Neuer Tag: beginnt am Morgen, alle dürfen wieder suchen"><i class="fa-solid fa-forward"></i> Neuer Tag</button>
       <button type="button" data-naehe class="tz-naehe ${naehe ? "is-aktiv" : ""}" data-tooltip="Nähe-Sprachchat ${naehe ? "an: Spieler hören sich nur in der Nähe (klicken zum Ausschalten)" : "aus (klicken zum Einschalten)"}"><i class="fa-solid fa-ear-listen"></i></button>`
    : `<i class="${t.icon}"></i><span class="tz-tag">Tag ${spieltag()}</span><span>· ${t.label}</span>${naehe ? `<i class="fa-solid fa-ear-listen tz-naehe-an" data-tooltip="Nähe-Chat: Ihr hört nur, wer in der Nähe steht"></i>` : ""}`;
}

export function registerTageszeit() {
  game.settings.register(SYSTEM_ID, "tageszeit", { scope: "world", config: false, type: String, default: "tag", onChange: () => tageszeitAnzeige() });
  // Beim ersten Setzen legt Foundry die Einstellung neu an (createSetting), danach updateSetting
  const neuZeigen = (setting) => {
    if (setting.key === `${SYSTEM_ID}.spieltag` || setting.key === `${SYSTEM_ID}.naeheChat`) tageszeitAnzeige();
  };
  Hooks.on("createSetting", neuZeigen);
  Hooks.on("updateSetting", neuZeigen);
  // Neuer Tag: Morgen (die Chatkarte zum neuen Tag kommt von neuerTag selbst)
  Hooks.on("hlwNeuerTag", () => tageszeitSetzen("morgen", { melden: false }));
  for (const hook of ["combatStart", "updateCombat", "deleteCombat", "createCombat"]) Hooks.on(hook, () => window.setTimeout(tageszeitAnzeige, 50));
  Hooks.once("ready", () => tageszeitAnzeige());
}
