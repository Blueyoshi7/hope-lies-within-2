// Bestiarium für die Spieler (Dominik 2026-10-31)
// Alle Monster stehen von Anfang an drin, aber verdeckt. Pro Monster gibt es eine Stufe:
//   0 Unbekannt: nur „???“
//   1 Name und Bild
//   2 dazu HP und eine kleine Info (Art, Größe, Lebensraum, Verhalten)
//   3 alles: Werte, Fähigkeiten, Rang und wie viele EXP es gibt
// Besiegte Monster zählen (beim GM, einmal pro Figur). 1, 3 und 6 Siege schalten Stufe 1, 2 und 3 frei.
// Der GM setzt die Stufe auch von Hand (z. B. nach einem geschafften Tierkunde-Check) und kann sie wieder senken.
// Solange ein Monster unbekannt ist, sehen Spieler in Kampfleiste, Zielauswahl und Angriffskarten nur „Unbekanntes Wesen“.
// Stand in der Welt-Einstellung "bestiarium": { [Name]: { kills, stufe, daten? } }. daten nur für Monster außerhalb der Liste.
// Öffnen: Buch-Symbol in der linken Werkzeugleiste (Figuren) oder game.hlw.bestiarium().

const SYSTEM_ID = "hope-lies-within-2";
const ApplicationV2 = foundry.applications.api.ApplicationV2;

export const BESTIARIUM_STUFEN = ["Unbekannt", "Gesichtet", "Bekannt", "Erforscht"];
export const UNBEKANNT = "Unbekanntes Wesen";
const SIEGE_FUER_STUFE = [0, 1, 3, 6];   // so viele Siege braucht Stufe 0, 1, 2, 3
const RANG_FOLGE = ["E", "D", "C", "B", "A", "S", "SS"];

function zahl(wert) {
  const z = Number(wert);
  return Number.isFinite(z) ? z : 0;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// ---------- Daten ----------

let katalogLaden = null;
let katalog = [];
// Alle Monster aus dem Bestiarium (import/monsters.json), nach Rang und Name sortiert
export function monsterKatalog() {
  katalogLaden ??= fetch(`systems/${SYSTEM_ID}/import/monsters.json`)
    .then((antwort) => (antwort.ok ? antwort.json() : []))
    .then((liste) => {
      katalog = liste
        .map((e) => ({ name: e.name, img: e.img, system: e.system, items: e.items ?? [] }))
        .sort((a, b) => RANG_FOLGE.indexOf(a.system?.monster?.rank) - RANG_FOLGE.indexOf(b.system?.monster?.rank) || a.name.localeCompare(b.name, "de"));
      return katalog;
    })
    .catch(() => []);
  return katalogLaden;
}

function stand() {
  return game.settings.get(SYSTEM_ID, "bestiarium") ?? {};
}

export function bestiarEintrag(name) {
  const e = stand()[name] ?? {};
  return { kills: zahl(e.kills), stufe: Math.min(Math.max(zahl(e.stufe), 0), 3), daten: e.daten ?? null };
}

// Unter welchem Namen steht ein Monster im Bestiarium? Abwandlungen (z. B. Korrumpierter Keiler) zählen für ihr Grundtier.
export function bestiarName(actor) {
  return actor?.getFlag?.(SYSTEM_ID, "bestiarium") || actor?.prototypeToken?.name || actor?.name || "";
}

function zaehltNicht(actor) {
  return actor?.type !== "monster" || !!actor.getFlag(SYSTEM_ID, "uebung");
}

// Für Monster außerhalb der Liste (vom GM gebaut) merkt sich das Bestiarium die Werte, damit Spieler sie sehen können
function datenVon(actor) {
  if (!actor || katalog.some((e) => e.name === bestiarName(actor))) return null;
  return {
    img: actor.img,
    system: { monster: foundry.utils.deepClone(actor.system?.monster ?? {}) },
    items: actor.items.filter((i) => ["weapon", "playerSkill"].includes(i.type)).map((i) => ({ name: i.name, type: i.type, system: { damage: i.system?.damage, description: i.system?.description, effect: i.system?.effect } }))
  };
}

// GM: Stufe oder Siege setzen. Neu freigeschaltete Stufen meldet eine kurze Chatkarte an alle.
export async function bestiarSetzen(name, { stufe, kills, actor } = {}) {
  if (!game.user?.isGM || !name) return;
  await monsterKatalog();
  const alt = bestiarEintrag(name);
  const neu = { kills: kills ?? alt.kills, stufe: stufe ?? alt.stufe };
  neu.kills = Math.max(0, Math.round(zahl(neu.kills)));
  neu.stufe = Math.min(Math.max(Math.round(zahl(neu.stufe)), 0), 3);
  const daten = alt.daten ?? datenVon(actor ?? game.actors.find((a) => a.type === "monster" && a.name === name));
  if (daten) neu.daten = daten;
  await game.settings.set(SYSTEM_ID, "bestiarium", { ...stand(), [name]: neu });
  if (neu.stufe > alt.stufe) {
    await ChatMessage.create({
      content: `<div class="hlw-chat-card hlw-chat-kurz hlw-bestiar-karte"><h2>Bestiarium: ${escapeHtml(name)}</h2><p>${neu.stufe === 1 ? "Neuer Eintrag" : `Stufe ${neu.stufe}`} freigeschaltet: <b>${BESTIARIUM_STUFEN[neu.stufe]}</b>.</p></div>`
    });
  }
}

// GM: ein Monster wurde besiegt. Zählt einen Sieg und schaltet nach Siegen frei (nie zurück).
export async function bestiarSieg(actor) {
  if (!game.user?.isGM || zaehltNicht(actor)) return;
  const name = bestiarName(actor);
  const e = bestiarEintrag(name);
  const kills = e.kills + 1;
  const durchSiege = SIEGE_FUER_STUFE.reduce((stufe, noetig, i) => (kills >= noetig ? i : stufe), 0);
  await bestiarSetzen(name, { kills, stufe: Math.max(e.stufe, durchSiege), actor });
}

// Welchen Namen sieht dieser Benutzer an einer Figur? Unbekannte Monster heißen für Spieler „Unbekanntes Wesen“.
// Getarnte Figuren behalten ihren Tarnnamen (den sollen die Spieler ja sehen).
export function sichtbarerName(token) {
  const doc = token?.document ?? token;
  const name = doc?.name ?? "";
  const actor = doc?.actor;
  if (game.user?.isGM || !actor || actor.type !== "monster" || actor.isOwner) return name;
  if (doc.getFlag?.(SYSTEM_ID, "tarnung")) return name;
  return bestiarEintrag(bestiarName(actor)).stufe >= 1 ? name : UNBEKANNT;
}

// Dürfen Spieler die HP dieser Figur sehen? (Monster ab Stufe 2)
export function hpSichtbar(token) {
  const actor = (token?.document ?? token)?.actor;
  if (game.user?.isGM || !actor || actor.type !== "monster" || actor.isOwner) return true;
  return bestiarEintrag(bestiarName(actor)).stufe >= 2;
}

// ---------- Fenster ----------

function wert(label, inhalt) {
  return `<div class="bs-wert"><span>${label}</span><b>${escapeHtml(inhalt)}</b></div>`;
}

function faehigkeiten(items) {
  const liste = (items ?? []).filter((i) => ["weapon", "playerSkill"].includes(i.type));
  if (!liste.length) return "";
  return `<h4>Fähigkeiten</h4><ul class="bs-faehigkeiten">${liste.map((i) => {
    const text = i.type === "weapon" ? `Angriff, Schaden ${String(i.system?.damage ?? "–").replace(/(\d*)d(\d+)/gi, (_, n, f) => `${n || 1}W${f}`)}` : i.system?.description || i.system?.effect || "";
    return `<li><b>${escapeHtml(i.name)}</b>${text ? ` <span>${escapeHtml(text)}</span>` : ""}</li>`;
  }).join("")}</ul>`;
}

export class HopeLiesWithinBestiarium extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "hlw-bestiarium",
    classes: ["hope-lies-within", "hlw-bestiarium"],
    tag: "div",
    window: { title: "Bestiarium", icon: "fa-solid fa-book-skull", resizable: true },
    position: { width: 820, height: 680 }
  };

  auswahl = null;
  suche = "";
  nurEntdeckt = false;

  static oeffnen() {
    const app = foundry.applications.instances.get("hlw-bestiarium") ?? new HopeLiesWithinBestiarium();
    app.render({ force: true });
    return app;
  }

  // Liste: alle Monster aus dem Bestiarium, dazu Einträge des GM außerhalb der Liste
  eintraege() {
    const s = stand();
    const liste = katalog.map((e) => ({ ...e, ...bestiarEintrag(e.name) }));
    for (const name of Object.keys(s)) {
      if (liste.some((e) => e.name === name)) continue;
      const e = bestiarEintrag(name);
      if (e.daten) liste.push({ name, img: e.daten.img, system: e.daten.system, items: e.daten.items, ...e });
    }
    if (game.user?.isGM) {
      for (const actor of game.actors.filter((a) => a.type === "monster" && !zaehltNicht(a) && !a.getFlag(SYSTEM_ID, "bestiarium") && !liste.some((e) => e.name === a.name))) {
        liste.push({ name: actor.name, img: actor.img, system: actor.system, items: actor.items.map((i) => i.toObject()), ...bestiarEintrag(actor.name), eigen: true });
      }
    }
    return liste.map((e, i) => ({ ...e, nr: i + 1 }));
  }

  async _renderHTML() {
    await monsterKatalog();
    const isGM = game.user?.isGM;
    const alle = this.eintraege();
    const entdeckt = alle.filter((e) => e.stufe >= 1).length;
    const suche = this.suche.trim().toLowerCase();
    const sichtbar = alle.filter((e) => (!this.nurEntdeckt || e.stufe >= 1) && (!suche || ((isGM || e.stufe >= 1) && e.name.toLowerCase().includes(suche))));
    if (!sichtbar.some((e) => e.name === this.auswahl)) this.auswahl = (sichtbar.find((e) => isGM || e.stufe >= 1) ?? sichtbar[0])?.name ?? null;
    const liste = sichtbar.map((e) => {
      const bekannt = e.stufe >= 1;
      const name = bekannt || isGM ? e.name : "???";
      return `<button type="button" class="bs-zeile ${bekannt ? "" : "is-unbekannt"} ${e.name === this.auswahl ? "is-aktiv" : ""}" data-bs-name="${escapeHtml(e.name)}">
        <span class="bs-nr">${String(e.nr).padStart(2, "0")}</span>
        ${bekannt || isGM ? `<img src="${escapeHtml(e.img)}" alt="">` : `<i class="fa-solid fa-question"></i>`}
        <span class="bs-name">${escapeHtml(name)}</span>
        <span class="bs-pips">${[1, 2, 3].map((s) => `<i class="${e.stufe >= s ? "is-an" : ""}"></i>`).join("")}</span>
      </button>`;
    }).join("");
    const gewaehlt = alle.find((e) => e.name === this.auswahl);
    return `
      <header class="bs-kopf">
        <input type="search" data-bs-suche placeholder="Suchen …" value="${escapeHtml(this.suche)}">
        <label><input type="checkbox" data-bs-entdeckt ${this.nurEntdeckt ? "checked" : ""}> Nur entdeckte</label>
        <span class="bs-zaehler">${entdeckt} / ${alle.length} entdeckt</span>
      </header>
      <div class="bs-koerper">
        <nav class="bs-liste">${liste || `<p class="bs-leer">Nichts gefunden.</p>`}</nav>
        <section class="bs-detail">${gewaehlt ? this.detail(gewaehlt) : `<p class="bs-leer">Wählt links ein Monster.</p>`}</section>
      </div>`;
  }

  detail(e) {
    const isGM = game.user?.isGM;
    const m = e.system?.monster ?? {};
    const stufe = isGM ? 3 : e.stufe;
    const steuerung = isGM ? `
      <div class="bs-gm">
        <div class="bs-stufen">${BESTIARIUM_STUFEN.map((label, s) => `<button type="button" data-bs-stufe="${s}" class="${e.stufe === s ? "is-aktiv" : ""}">${s} · ${label}</button>`).join("")}</div>
        <div class="bs-siege">Siege <button type="button" data-bs-kills="-1">−</button><b>${e.kills}</b><button type="button" data-bs-kills="1">+</button>
          <small>Spieler sehen gerade: Stufe ${e.stufe} (${BESTIARIUM_STUFEN[e.stufe]}). Tierkunde-Probe ${escapeHtml(m.probe ?? "–")}.</small></div>
      </div>` : "";
    if (stufe < 1) {
      return `${steuerung}<div class="bs-verdeckt"><i class="fa-solid fa-question"></i><p>Noch unbekannt.</p><small>Besiegt es, oder erforscht es mit Tierkunde.</small></div>`;
    }
    const info = stufe >= 2 ? `
      <div class="bs-werte">
        ${wert("HP", m.hp ?? "–")}
        ${wert("Art", m.category ?? "–")}
        ${wert("Größe", m.size ?? "–")}
        ${wert("Lebensraum", m.habitat ?? "–")}
        ${wert("Verhalten", m.behavior ?? "–")}
      </div>` : `<p class="bs-hinweis">Mehr erfahrt ihr, wenn ihr es öfter besiegt oder mit Tierkunde erforscht.</p>`;
    const alles = stufe >= 3 ? `
      <div class="bs-werte">
        ${wert("Rang", `${m.rank ?? "–"} · ${m.role ?? ""}`)}
        ${wert("EXP", m.exp ?? "–")}
        ${wert("Rüstwert", m.rw ?? "–")}
        ${wert("Magieres.", m.mr ?? "–")}
        ${wert("Genauigkeit", `${zahl(m.acc) >= 0 ? "+" : ""}${zahl(m.acc)}`)}
        ${wert("Bewegung", `${m.movement ?? "–"} Felder`)}
        ${wert("Initiative", `${zahl(m.initiative) >= 0 ? "+" : ""}${zahl(m.initiative)}`)}
        ${wert("Korrumpiert", m.corrupted ? `Stufe ${m.corrupted}` : "nein")}
      </div>
      ${m.traits ? `<p><b>Eigenschaften:</b> ${escapeHtml(m.traits)}</p>` : ""}
      ${m.special ? `<p><b>Besonderes:</b> ${escapeHtml(m.special)}</p>` : ""}
      ${m.tameable ? `<p><b>Zähmbar</b>${m.tamers ? ` (${escapeHtml(m.tamers)})` : ""}</p>` : ""}
      ${faehigkeiten(e.items)}` : stufe >= 2 ? `<p class="bs-hinweis">Alle Werte und Fähigkeiten auf Stufe 3.</p>` : "";
    return `
      ${steuerung}
      <div class="bs-titel">
        <img src="${escapeHtml(e.img)}" alt="">
        <div>
          <h3>${escapeHtml(e.name)}</h3>
          <em>Nr. ${String(e.nr).padStart(2, "0")} · ${BESTIARIUM_STUFEN[e.stufe]} · ${e.kills} ${e.kills === 1 ? "Sieg" : "Siege"}</em>
        </div>
      </div>
      ${info}
      ${alles}`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    content.querySelector(".bs-zeile.is-aktiv")?.scrollIntoView({ block: "nearest" });
    content.querySelectorAll("[data-bs-name]").forEach((knopf) => knopf.addEventListener("click", () => {
      this.auswahl = knopf.dataset.bsName;
      this.render();
    }));
    const suche = content.querySelector("[data-bs-suche]");
    suche?.addEventListener("input", foundry.utils.debounce(() => {
      this.suche = suche.value;
      this.render().then(() => {
        const feld = this.element.querySelector("[data-bs-suche]");
        feld?.focus();
        feld?.setSelectionRange(feld.value.length, feld.value.length);
      });
    }, 250));
    content.querySelector("[data-bs-entdeckt]")?.addEventListener("change", (event) => {
      this.nurEntdeckt = event.currentTarget.checked;
      this.render();
    });
    content.querySelectorAll("[data-bs-stufe]").forEach((knopf) => knopf.addEventListener("click", () => bestiarSetzen(this.auswahl, { stufe: Number(knopf.dataset.bsStufe) })));
    content.querySelectorAll("[data-bs-kills]").forEach((knopf) => knopf.addEventListener("click", () => {
      bestiarSetzen(this.auswahl, { kills: bestiarEintrag(this.auswahl).kills + Number(knopf.dataset.bsKills) });
    }));
  }
}

// Kampfleiste: unbekannte Monster heißen für Spieler „Unbekanntes Wesen“
function kampfleisteVerdecken(app, html) {
  if (game.user?.isGM) return;
  const wurzel = html instanceof HTMLElement ? html : html?.[0];
  const combat = app?.viewed ?? game.combat;
  if (!wurzel || !combat) return;
  for (const zeile of wurzel.querySelectorAll("[data-combatant-id]")) {
    const combatant = combat.combatants.get(zeile.dataset.combatantId);
    if (!combatant?.token) continue;
    const name = sichtbarerName(combatant.token);
    if (name === combatant.token.name) continue;
    const feld = zeile.querySelector(".token-name .name, .token-name strong, h4");
    if (feld) feld.textContent = name;
    zeile.querySelector("img.token-image")?.setAttribute("alt", name);
  }
}

export function registerBestiarium() {
  game.settings.register(SYSTEM_ID, "bestiarium", {
    scope: "world", config: false, type: Object, default: {},
    onChange: () => {
      foundry.applications.instances.get("hlw-bestiarium")?.render();
      ui.combat?.render();
    }
  });
  Hooks.on("getSceneControlButtons", (controls) => {
    const figuren = controls.tokens ?? controls.token;
    if (!figuren?.tools) return;
    figuren.tools.hlwBestiarium = {
      name: "hlwBestiarium",
      order: Object.keys(figuren.tools).length + 1,
      title: "Bestiarium",
      icon: "fa-solid fa-book-skull",
      button: true,
      visible: true,
      onChange: () => HopeLiesWithinBestiarium.oeffnen()
    };
  });
  Hooks.on("renderCombatTracker", kampfleisteVerdecken);
  Hooks.once("ready", () => monsterKatalog());
}
