// Tageszeit und Spieltag (Dominik 2026-11-01)
// Oben in der Mitte steht für alle „Tag 3 · Abend“. Der GM klickt dort Morgen, Tag, Abend oder Nacht und „Neuer Tag“.
// Die Tageszeit stellt die Dunkelheit aller Szenen ein (außer dem Dashboard und Szenen mit gesperrter Dunkelheit):
// Morgen 0,25 · Tag 0 · Abend 0,45 · Nacht 0,85. Ab 0,5 sehen Spieler nur noch, was Licht abbekommt (siehe hlw-szenen.js).
// Ein neuer Tag beginnt am Morgen und meldet sich im Chat; der Zähler (Einstellung "spieltag") zählt für Suchen und Quests.

import { spieltag, neuerTag } from "./hlw-sammeln.js";

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
    });
  }
  const jetzt = tageszeit();
  const t = TAGESZEITEN[jetzt];
  box.classList.toggle("is-gm", !!game.user?.isGM);
  box.innerHTML = game.user?.isGM
    ? `<span class="tz-tag">Tag ${spieltag()}</span>
       ${Object.entries(TAGESZEITEN).map(([k, z]) => `<button type="button" data-zeit="${k}" class="${k === jetzt ? "is-aktiv" : ""}" data-tooltip="${z.label}"><i class="${z.icon}"></i></button>`).join("")}
       <button type="button" data-neuer-tag class="tz-neu" data-tooltip="Neuer Tag: beginnt am Morgen, alle dürfen wieder suchen"><i class="fa-solid fa-forward"></i> Neuer Tag</button>`
    : `<i class="${t.icon}"></i><span class="tz-tag">Tag ${spieltag()}</span><span>· ${t.label}</span>`;
}

export function registerTageszeit() {
  game.settings.register(SYSTEM_ID, "tageszeit", { scope: "world", config: false, type: String, default: "tag", onChange: () => tageszeitAnzeige() });
  Hooks.on("updateSetting", (setting) => {
    if (setting.key === `${SYSTEM_ID}.spieltag`) tageszeitAnzeige();
  });
  // Neuer Tag: Morgen (die Chatkarte zum neuen Tag kommt von neuerTag selbst)
  Hooks.on("hlwNeuerTag", () => tageszeitSetzen("morgen", { melden: false }));
  Hooks.once("ready", () => tageszeitAnzeige());
}
