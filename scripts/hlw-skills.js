// Skill-Übersicht für den GM (Dominik 2026-11-02): alle Spieler- und Klassen-Skills mit Werten, Abklingzeit und Schaden.
// Nur der GM sieht sie (Buch-Symbol mit Zauberstab in der Werkzeugleiste, game.hlw.skills()).
// Wahl-Modus: Öffnet ein Spieler einen Skill-Orb und „Skill aus Orbs“ steht auf „GM wählt“, springt die Übersicht beim GM auf,
// gefiltert auf die Ränge, die der Orb hergeben darf. „In den Orb legen“ gibt dem Charakter den Skill, „Zufällig ziehen“
// zieht wie früher. Schließt der GM das Fenster ohne Wahl, bleibt der Orb offen und steht oben als „Offene Orbs“.

import { skillZeilen, ORB_RAENGE, skillZiehen, orbFuellen } from "./hlw-charakter.js";

const SYSTEM_ID = "hope-lies-within-2";
const ApplicationV2 = foundry.applications.api.ApplicationV2;
const RANG_FOLGE = ["E", "D", "C", "B", "A", "S", "SS"];
const REITER = { playerSkill: "Spieler-Skills", classSkill: "Klassen-Skills" };

function zahl(wert) {
  const z = Number(wert);
  return Number.isFinite(z) ? z : 0;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

let katalogLaden = null;
let katalog = { playerSkill: [], classSkill: [] };
function skillKatalog() {
  const laden = (datei) => fetch(`systems/${SYSTEM_ID}/import/${datei}.json`).then((a) => (a.ok ? a.json() : [])).catch(() => []);
  const sortieren = (liste) => liste.sort((a, b) => RANG_FOLGE.indexOf(a.system?.rank) - RANG_FOLGE.indexOf(b.system?.rank) || a.name.localeCompare(b.name, "de"));
  katalogLaden ??= Promise.all([laden("skills"), laden("class-skills")]).then(([spieler, klassen]) => {
    katalog = { playerSkill: sortieren(spieler.filter((s) => s.type === "playerSkill")), classSkill: sortieren(klassen.filter((s) => s.type === "classSkill")) };
    return katalog;
  });
  return katalogLaden;
}

// Aus welchen Orbs kann der Skill kommen? (Abyss-Skills SS und Rang S nie)
function ausOrbs(skill) {
  if (skill.type !== "playerSkill" || ["S", "SS"].includes(skill.system?.rank)) return "";
  const r = skill.system?.rank;
  return Object.entries(ORB_RAENGE).map(([tier, def]) => (def.normal.includes(r) ? `T${tier}` : def.selten === r ? `T${tier} (selten)` : "")).filter(Boolean).join(", ");
}

function kurzAbklingzeit(s) {
  if (String(s.activation ?? "").toLowerCase() === "passive") return "passiv";
  if (s.einmalProKampf === true || s.einmalProKampf === "true") return "1× Kampf";
  const max = zahl(s.cooldown?.max);
  return max ? `${max} Z.` : "–";
}

// Offene Orbs (Spieler hat geöffnet, GM hat noch nicht gewählt): aus den Inventaren gelesen, damit nichts verloren geht
function offeneOrbs() {
  const liste = [];
  for (const actor of game.actors.filter((a) => a.type === "character")) {
    for (const item of actor.items.filter((i) => i.getFlag(SYSTEM_ID, "orbWartet"))) {
      const tier = Number(String(item.name).match(/T([123])/)?.[1] ?? 1);
      liste.push({ actorId: actor.id, itemId: item.id, tier, actorName: actor.name });
    }
  }
  return liste;
}

export class HopeLiesWithinSkills extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "hlw-skills",
    classes: ["hope-lies-within", "hlw-bestiarium", "hlw-almanach", "hlw-skills"],
    tag: "div",
    window: { title: "Skill-Übersicht (GM)", icon: "fa-solid fa-wand-sparkles", resizable: true },
    position: { width: 980, height: 720 }
  };

  reiter = "playerSkill";
  auswahl = null;
  suche = "";
  rang = "";
  art = "";
  wahl = null;   // { actorId, itemId, tier }

  static oeffnen(wahl = null) {
    if (!game.user?.isGM) return ui.notifications?.warn("Die Skill-Übersicht ist nur für den GM.");
    const app = foundry.applications.instances.get("hlw-skills") ?? new HopeLiesWithinSkills();
    if (wahl) {
      app.wahl = wahl;
      app.reiter = "playerSkill";
      app.rang = "";
      app.auswahl = null;
    }
    app.render({ force: true }).then(() => app.bringToFront?.());
    return app;
  }

  wahlRaenge() {
    const def = ORB_RAENGE[this.wahl?.tier];
    return def ? [...def.normal, def.selten] : [];
  }

  eintraege() {
    const erlaubt = this.wahl ? this.wahlRaenge() : null;
    const suche = this.suche.trim().toLowerCase();
    return katalog[this.reiter].filter((s) => {
      const sys = s.system ?? {};
      if (erlaubt && !erlaubt.includes(sys.rank)) return false;
      if (this.rang && sys.rank !== this.rang) return false;
      if (this.art && sys.skillType !== this.art) return false;
      if (suche && !`${s.name} ${sys.description ?? ""} ${sys.effect ?? ""} ${sys.className ?? ""}`.toLowerCase().includes(suche)) return false;
      return true;
    });
  }

  async _renderHTML() {
    await skillKatalog();
    if (this.wahl) this.reiter = "playerSkill";
    const liste = this.eintraege();
    if (!liste.some((s) => s.name === this.auswahl)) this.auswahl = liste[0]?.name ?? null;
    const arten = [...new Set(katalog[this.reiter].map((s) => s.system?.skillType).filter(Boolean))].sort();
    const raenge = [...new Set(katalog[this.reiter].map((s) => s.system?.rank).filter(Boolean))].sort((a, b) => RANG_FOLGE.indexOf(a) - RANG_FOLGE.indexOf(b));
    const offen = offeneOrbs();
    const wahlActor = this.wahl ? game.actors.get(this.wahl.actorId) : null;
    const def = ORB_RAENGE[this.wahl?.tier];
    const banner = this.wahl ? `
      <div class="sk-wahl">
        <span><i class="fa-solid fa-circle-dot"></i> Skill für <b>${escapeHtml(wahlActor?.name ?? "?")}</b>s Skill-Orb T${this.wahl.tier} wählen · erlaubt: Rang ${def.normal.join(" oder ")}, selten ${def.selten}</span>
        <button type="button" data-sk-zufall><i class="fa-solid fa-dice"></i> Zufällig ziehen</button>
        <button type="button" data-sk-wahl-ende title="Später wählen: der Orb bleibt offen">Später</button>
      </div>` : offen.length ? `
      <div class="sk-wahl sk-offen"><span><i class="fa-solid fa-circle-dot"></i> Offene Orbs:</span>
        ${offen.map((o) => `<button type="button" data-sk-offen="${o.actorId}|${o.itemId}|${o.tier}">${escapeHtml(o.actorName)} (T${o.tier})</button>`).join("")}
      </div>` : "";
    const zeilen = liste.map((s) => {
      const sys = s.system ?? {};
      return `<button type="button" class="sk-zeile ${s.name === this.auswahl ? "is-aktiv" : ""}" data-sk-name="${escapeHtml(s.name)}">
        <img src="${escapeHtml(s.img)}" alt="">
        <span class="sk-name">${escapeHtml(s.name)}${this.reiter === "classSkill" ? `<small>${escapeHtml(sys.className ?? "")}</small>` : ""}</span>
        <span class="sk-rang rang-${escapeHtml(sys.rank)}">${escapeHtml(sys.rank)}</span>
        <span class="sk-art">${escapeHtml(sys.skillType ?? "")}</span>
        <span class="sk-schaden">${escapeHtml(sys.heilung || sys.damageText || sys.damage || "–")}</span>
        <span class="sk-cd">${escapeHtml(kurzAbklingzeit(sys))}</span>
      </button>`;
    }).join("");
    const gewaehlt = liste.find((s) => s.name === this.auswahl);
    return `
      ${banner}
      <nav class="al-reiter">${Object.entries(REITER).map(([k, label]) => `<button type="button" data-sk-reiter="${k}" class="${k === this.reiter ? "is-aktiv" : ""}" ${this.wahl && k !== "playerSkill" ? "disabled" : ""}>${label} <span>${katalog[k].length}</span></button>`).join("")}</nav>
      <header class="bs-kopf">
        <input type="search" data-sk-suche placeholder="Name, Effekt oder Klasse …" value="${escapeHtml(this.suche)}">
        <select data-sk-rang><option value="">Alle Ränge</option>${raenge.filter((r) => !this.wahl || this.wahlRaenge().includes(r)).map((r) => `<option value="${r}" ${r === this.rang ? "selected" : ""}>Rang ${r}</option>`).join("")}</select>
        <select data-sk-art><option value="">Alle Arten</option>${arten.map((a) => `<option value="${escapeHtml(a)}" ${a === this.art ? "selected" : ""}>${escapeHtml(a)}</option>`).join("")}</select>
        <span class="bs-zaehler">${liste.length} Skills</span>
      </header>
      <div class="sk-spalten"><span></span><span>Name</span><span>Rang</span><span>Art</span><span>Schaden / Heilung</span><span>Abkl.</span></div>
      <div class="bs-koerper">
        <nav class="bs-liste sk-liste">${zeilen || `<p class="bs-leer">Nichts gefunden.</p>`}</nav>
        <section class="bs-detail">${gewaehlt ? this.detail(gewaehlt) : `<p class="bs-leer">Links einen Skill wählen.</p>`}</section>
      </div>`;
  }

  detail(skill) {
    const sys = skill.system ?? {};
    const zeilen = skillZeilen(skill);
    const orbs = ausOrbs(skill);
    return `
      ${this.wahl ? `<button type="button" class="sk-legen" data-sk-legen><i class="fa-solid fa-circle-down"></i> In den Orb legen</button>` : ""}
      <div class="bs-titel">
        <img src="${escapeHtml(skill.img)}" alt="" class="al-bild">
        <div>
          <h3>${escapeHtml(skill.name)}</h3>
          <em>${escapeHtml(REITER[skill.type])}${sys.price ? ` · ${escapeHtml(sys.price)}` : ""}${orbs ? ` · aus Orbs: ${escapeHtml(orbs)}` : ""}</em>
        </div>
      </div>
      <p>${escapeHtml(sys.description || sys.effect || "")}</p>
      ${sys.effect && sys.effect !== sys.description ? `<p><b>Effekt:</b> ${escapeHtml(sys.effect)}</p>` : ""}
      <div class="bs-werte">${zeilen.map(([k, v]) => `<div class="bs-wert"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join("")}
        ${sys.learningPoints ? `<div class="bs-wert"><span>Lernpunkte</span><b>${escapeHtml(sys.learningPoints)}</b></div>` : ""}
      </div>`;
  }

  async legen(skill, { zufall = false } = {}) {
    const wahl = this.wahl;
    const actor = game.actors.get(wahl?.actorId);
    const item = actor?.items.get(wahl?.itemId);
    if (!actor || !item) {
      this.wahl = null;
      this.render();
      return ui.notifications?.warn("Den Orb gibt es nicht mehr.");
    }
    let selten = false;
    if (zufall) {
      const zug = await skillZiehen(wahl.tier);
      skill = zug.skill;
      selten = zug.selten;
    } else selten = ORB_RAENGE[wahl.tier]?.selten === skill.system?.rank;
    if (!skill) return ui.notifications?.error("Kein passender Skill gefunden.");
    this.wahl = null;
    await orbFuellen(actor, item, skill, { selten, gewaehlt: true });
    this.render();
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    window.setTimeout(() => content.querySelector(".sk-zeile.is-aktiv")?.scrollIntoView({ block: "nearest" }), 0);
    content.querySelectorAll("[data-sk-reiter]").forEach((k) => k.addEventListener("click", () => {
      this.reiter = k.dataset.skReiter;
      this.rang = "";
      this.art = "";
      this.auswahl = null;
      this.render();
    }));
    content.querySelectorAll("[data-sk-name]").forEach((k) => k.addEventListener("click", () => {
      this.auswahl = k.dataset.skName;
      this.render();
    }));
    const suche = content.querySelector("[data-sk-suche]");
    suche?.addEventListener("input", foundry.utils.debounce(() => {
      this.suche = suche.value;
      this.render().then(() => {
        const feld = this.element.querySelector("[data-sk-suche]");
        feld?.focus();
        feld?.setSelectionRange(feld.value.length, feld.value.length);
      });
    }, 250));
    content.querySelector("[data-sk-rang]")?.addEventListener("change", (e) => { this.rang = e.currentTarget.value; this.render(); });
    content.querySelector("[data-sk-art]")?.addEventListener("change", (e) => { this.art = e.currentTarget.value; this.render(); });
    content.querySelector("[data-sk-legen]")?.addEventListener("click", () => this.legen(katalog.playerSkill.find((s) => s.name === this.auswahl)));
    content.querySelector("[data-sk-zufall]")?.addEventListener("click", () => this.legen(null, { zufall: true }));
    content.querySelector("[data-sk-wahl-ende]")?.addEventListener("click", () => { this.wahl = null; this.render(); });
    content.querySelectorAll("[data-sk-offen]").forEach((k) => k.addEventListener("click", () => {
      const [actorId, itemId, tier] = k.dataset.skOffen.split("|");
      this.wahl = { actorId, itemId, tier: Number(tier) };
      this.rang = "";
      this.auswahl = null;
      this.render();
    }));
  }

  _onClose(options) {
    this.wahl = null;
    super._onClose?.(options);
  }
}

export function registerSkills() {
  game.settings.register(SYSTEM_ID, "orbWahl", {
    name: "Skill aus Skill-Orbs",
    hint: "GM wählt: Gelingt ein Appraisal, öffnet sich beim GM die Skill-Übersicht und er legt den Skill in den Orb (ohne GM online wird gezogen). Zufall: das System zieht wie bisher.",
    scope: "world", config: true, type: String, default: "gm",
    choices: { gm: "GM wählt", zufall: "Zufall" }
  });
  Hooks.on("getSceneControlButtons", (controls) => {
    const figuren = controls.tokens ?? controls.token;
    if (!figuren?.tools || !game.user?.isGM) return;
    figuren.tools.hlwSkills = {
      name: "hlwSkills",
      order: Object.keys(figuren.tools).length + 1,
      title: "Skill-Übersicht (GM)",
      icon: "fa-solid fa-wand-sparkles",
      button: true,
      visible: true,
      onChange: () => HopeLiesWithinSkills.oeffnen()
    };
  });
  // Ein Spieler hat einen Orb geöffnet: beim aktiven GM die Übersicht im Wahl-Modus
  const wahlOeffnen = (data) => {
    if (data?.type !== "orbWahl" || !game.users.activeGM?.isSelf) return;
    const actor = game.actors.get(data.actorId);
    ui.notifications?.info(`${actor?.name ?? "Ein Spieler"} hat einen Skill-Orb T${data.tier} geöffnet. Wähle den Skill.`);
    HopeLiesWithinSkills.oeffnen({ actorId: data.actorId, itemId: data.itemId, tier: data.tier });
  };
  Hooks.on("hlwOrbWahl", wahlOeffnen);
  Hooks.once("ready", () => game.socket.on(`system.${SYSTEM_ID}`, wahlOeffnen));
}
