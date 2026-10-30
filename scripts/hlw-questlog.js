// Questlog: alle Quests, die die Gruppe angenommen oder erledigt hat, mit Auftraggeber, Text und Belohnung.
// Die Quests liegen an den NSC (flags.talk.quests, siehe hlw-talk.js); das Questlog liest sie nur.
// Spieler sehen angenommene und erledigte Quests. Der GM sieht alle und stellt hier den Stand um (z. B. „Erledigt“).
// Öffnen: Schriftrolle in der linken Werkzeugleiste (Figuren) oder game.hlw.questlog().

import { getTalkData, anzeigeName, questAendern, QUEST_STATUS } from "./hlw-talk.js";

const ApplicationV2 = foundry.applications.api.ApplicationV2;
const REITER = { laufend: "Laufend", erledigt: "Erledigt", alle: "Alle Quests" };

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function absaetze(text) {
  return escapeHtml(text).replaceAll("\n", "<br>");
}

function alleQuests() {
  const liste = [];
  for (const actor of game.actors.filter((a) => a.type === "npc")) {
    for (const quest of getTalkData(actor).quests) liste.push({ actor, quest });
  }
  return liste;
}

function passtZuReiter(quest, reiter) {
  if (reiter === "laufend") return quest.status === "angenommen";
  if (reiter === "erledigt") return quest.status === "erledigt";
  return true;
}

export class HopeLiesWithinQuestlog extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "hlw-questlog",
    classes: ["hope-lies-within", "hlw-questlog"],
    tag: "div",
    window: { title: "Questlog", icon: "fa-solid fa-scroll", resizable: true },
    position: { width: 560, height: 660 }
  };

  reiter = "laufend";

  static oeffnen() {
    const app = foundry.applications.instances.get("hlw-questlog") ?? new HopeLiesWithinQuestlog();
    app.render({ force: true });
    return app;
  }

  async _renderHTML() {
    const isGM = game.user?.isGM;
    const reiterListe = Object.entries(REITER).filter(([key]) => isGM || key !== "alle");
    if (!reiterListe.some(([key]) => key === this.reiter)) this.reiter = "laufend";
    const alle = alleQuests();
    const zaehler = Object.fromEntries(reiterListe.map(([key]) => [key, alle.filter(({ quest }) => passtZuReiter(quest, key)).length]));
    const karten = alle.filter(({ quest }) => passtZuReiter(quest, this.reiter)).map(({ actor, quest }) => {
      const talk = getTalkData(actor);
      const status = isGM
        ? `<select data-ql-status data-actor="${actor.id}" data-quest="${escapeHtml(quest.id)}">${Object.entries(QUEST_STATUS).map(([k, l]) => `<option value="${k}" ${k === quest.status ? "selected" : ""}>${l}</option>`).join("")}</select>`
        : `<span class="ql-status status-${escapeHtml(quest.status)}">${escapeHtml(QUEST_STATUS[quest.status] ?? "")}</span>`;
      return `
        <article class="ql-quest status-${escapeHtml(quest.status)}">
          <header>
            <img src="${escapeHtml(talk.portrait)}" alt="">
            <div>
              <strong>${escapeHtml(quest.titel || "Ohne Titel")}</strong>
              <em>Rang ${escapeHtml(quest.rang || "F")} · von ${escapeHtml(anzeigeName(actor))}</em>
            </div>
            ${status}
          </header>
          <p>${absaetze(quest.text)}</p>
          ${quest.belohnung ? `<p class="ql-belohnung"><b>Belohnung:</b> ${escapeHtml(quest.belohnung)}</p>` : ""}
          ${quest.angenommenVon ? `<small>Angenommen von ${escapeHtml(quest.angenommenVon)}</small>` : ""}
        </article>`;
    }).join("");
    const leer = this.reiter === "erledigt" ? "Noch keine Quest erledigt." : this.reiter === "alle" ? "Noch keine Quests bei den NSC." : "Keine laufende Quest. Quests bekommt ihr im Gespräch mit NSC.";
    return `
      <nav class="ql-reiter">${reiterListe.map(([key, label]) => `<button type="button" data-ql-reiter="${key}" class="${key === this.reiter ? "is-aktiv" : ""}">${label} <span>${zaehler[key]}</span></button>`).join("")}</nav>
      <div class="ql-liste">${karten || `<p class="ql-leer">${leer}</p>`}</div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    content.querySelectorAll("[data-ql-reiter]").forEach((knopf) => knopf.addEventListener("click", () => {
      this.reiter = knopf.dataset.qlReiter;
      this.render();
    }));
    content.querySelectorAll("[data-ql-status]").forEach((feld) => feld.addEventListener("change", () => {
      const actor = game.actors.get(feld.dataset.actor);
      if (actor) questAendern(actor, feld.dataset.quest, { status: feld.value });
    }));
  }
}

export function registerQuestlog() {
  Hooks.on("getSceneControlButtons", (controls) => {
    const figuren = controls.tokens ?? controls.token;
    if (!figuren?.tools) return;
    figuren.tools.hlwQuestlog = {
      name: "hlwQuestlog",
      order: Object.keys(figuren.tools).length + 1,
      title: "Questlog",
      icon: "fa-solid fa-scroll",
      button: true,
      visible: true,
      onChange: () => HopeLiesWithinQuestlog.oeffnen()
    };
  });
  // Neu zeichnen, wenn sich Quests an einem NSC ändern (annehmen, erledigen, Text)
  Hooks.on("updateActor", (actor, changes) => {
    if (actor.type !== "npc" || !foundry.utils.hasProperty(changes, "flags.hope-lies-within-2.talk")) return;
    foundry.applications.instances.get("hlw-questlog")?.render();
  });
}
