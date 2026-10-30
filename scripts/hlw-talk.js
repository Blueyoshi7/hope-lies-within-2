// NSC-Gespraech: rahmenloses Fenster ueber der Karte. Links das Portraet, rechts vier Reiter:
// Gespräch (nur der GM spricht: der aktuelle Satz steht groß in der Mitte, Wort für Wort eingeblendet; Textbausteine),
// Handel (Waren des NSC, Kaufen/Verkaufen), Quests (der GM schreibt und zeigt sie, Spieler nehmen an)
// und Wissen (freigegebene Einträge, Notizen der Gruppe: jeder schreibt, alle lesen).
// Daten am Actor: flags["hope-lies-within-2"].talk = { portrait, role, nameRevealed, facts[], quests[], verlauf[], bausteine[], notizen[] }
// Namen am User:    flags["hope-lies-within-2"].talkNames[actorId] = "..." (bis der GM den echten Namen freigibt, steht dort „???“)
// Nur der GM schreibt Actor-Daten; Spieler schicken ihre Wünsche (Notiz, kaufen, verkaufen, Quest annehmen) per Socket.

import { kes } from "./hlw-regeln.js";
import { istWare, preisVon, ankaufVon, kaufen, verkaufen, handelVon, istHaendler, WAREN_ARTEN, warenSuche, wareHinzufuegen } from "./hlw-nsc.js";

const SYSTEM_ID = "hope-lies-within-2";
const SOCKET = `system.${SYSTEM_ID}`;
const VERLAUF_MAX = 40;
const QUEST_RAENGE = ["F", "E", "D", "C", "B", "A", "S", "SS"];
const QUEST_STATUS = { verborgen: "Verborgen", angeboten: "Angeboten", angenommen: "Angenommen", erledigt: "Erledigt" };
const REITER = { gespraech: "Gespräch", handel: "Handel", quests: "Quests", wissen: "Wissen" };
const BAUSTEIN_ARTEN = { gruss: "Begrüßung", abschied: "Abschied", handel: "Handel", sonst: "Sonstiges" };
// Gilt für jeden NSC, bis der GM eigene Bausteine anlegt.
const STANDARD_BAUSTEINE = [
  { id: "std-gruss-1", art: "gruss", text: "Seid gegrüßt, Reisende." },
  { id: "std-gruss-2", art: "gruss", text: "Was kann ich für euch tun?" },
  { id: "std-abschied-1", art: "abschied", text: "Passt auf euch auf." },
  { id: "std-abschied-2", art: "abschied", text: "Bis zum nächsten Mal." }
];
// Was groß auf der Bühne steht (Handel und Quest-Annahmen erscheinen nur klein darunter)
const BUEHNE = ["nsc", "erzaehler", "quest"];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function absaetze(text) {
  return escapeHtml(text).replaceAll("\n", "<br>");
}

export function getTalkData(actor) {
  const talk = actor?.getFlag(SYSTEM_ID, "talk") ?? {};
  return {
    portrait: talk.portrait || actor?.img || "icons/svg/mystery-man.svg",
    role: talk.role ?? "",
    nameRevealed: !!talk.nameRevealed,
    facts: Array.isArray(talk.facts) ? talk.facts : [],
    quests: Array.isArray(talk.quests) ? talk.quests : [],
    verlauf: Array.isArray(talk.verlauf) ? talk.verlauf : [],
    bausteine: Array.isArray(talk.bausteine) ? talk.bausteine : STANDARD_BAUSTEINE,
    notizen: Array.isArray(talk.notizen) ? talk.notizen : []
  };
}

export function hasTalk(actor) {
  return actor?.type === "npc";
}

export function warenVon(actor) {
  return actor?.items?.filter((item) => istWare(item)) ?? [];
}

function sichtbareQuests(talk) {
  return game.user?.isGM ? talk.quests : talk.quests.filter((q) => q.status !== "verborgen");
}

// Alte private Notizen (bis v0.8.0) – werden beim Öffnen einmal als Gruppennotiz übernommen.
function getNotes(actorId) {
  return game.user?.getFlag(SYSTEM_ID, `talkNotes.${actorId}`) ?? "";
}

function getOwnName(actorId) {
  return game.user?.getFlag(SYSTEM_ID, `talkNames.${actorId}`) ?? "";
}

// Wie der NSC für diesen Benutzer heißt: echter Name erst nach Freigabe, sonst der selbst eingetragene oder „???“.
function anzeigeName(actor) {
  if (game.user?.isGM || getTalkData(actor).nameRevealed) return actor.name;
  return getOwnName(actor.id) || "???";
}

function ichBinAktiverGM() {
  return game.user?.isGM && game.users?.activeGM?.id === game.user.id;
}

// ---------- Schreiben (das macht nur der GM) ----------

// Änderungen laufen nacheinander und lesen jeweils den neuesten Stand, damit sich zwei schnelle Änderungen
// (z. B. Feld verlassen und gleich danach „Im Gespräch zeigen“) nicht gegenseitig überschreiben.
let warteschlange = Promise.resolve();
function talkAendern(actor, aenderung) {
  warteschlange = warteschlange.then(async () => {
    const changes = typeof aenderung === "function" ? aenderung(getTalkData(actor)) : aenderung;
    if (changes) await actor.setFlag(SYSTEM_ID, "talk", { ...(actor.getFlag(SYSTEM_ID, "talk") ?? {}), ...changes });
  }).catch((fehler) => console.error("HLW | Gespräch speichern", fehler));
  return warteschlange;
}

export function zeileHinzufuegen(actor, zeile) {
  return talkAendern(actor, (talk) => ({ verlauf: [...talk.verlauf, { id: foundry.utils.randomID(), ...zeile }].slice(-VERLAUF_MAX) }));
}

function questAendern(actor, questId, changes) {
  return talkAendern(actor, (talk) => ({ quests: talk.quests.map((q) => (q.id === questId ? { ...q, ...changes } : q)) }));
}

function sprecherVon(userId, actorId) {
  const user = game.users.get(userId);
  return game.actors.get(actorId)?.name ?? user?.character?.name ?? user?.name ?? "Jemand";
}

// Wünsche der Spieler, ausgeführt vom aktiven GM.
async function gmAusfuehren(data) {
  const actor = game.actors.get(data.actorId);
  if (!actor) return;
  const user = game.users.get(data.userId);
  const eigenerCharakter = (id) => {
    const c = game.actors.get(id);
    return c && user && c.testUserPermission(user, "OWNER") ? c : null;
  };
  try {
    if (data.type === "nscNotiz") {
      const text = String(data.text ?? "").trim().slice(0, 2000);
      const darf = (notiz) => notiz && (notiz.userId === data.userId || user?.isGM);
      await talkAendern(actor, (talk) => {
        const alt = talk.notizen.find((n) => n.id === data.notizId);
        if (data.aktion === "loeschen") return darf(alt) ? { notizen: talk.notizen.filter((n) => n.id !== alt.id) } : null;
        if (!text) return null;
        if (data.aktion === "aendern") return darf(alt) ? { notizen: talk.notizen.map((n) => (n.id === alt.id ? { ...n, text } : n)) } : null;
        return { notizen: [...talk.notizen, { id: foundry.utils.randomID(), userId: data.userId, name: sprecherVon(data.userId, data.charakterId), text, zeit: Date.now() }] };
      });
    } else if (data.type === "nscKaufen") {
      const kaeufer = eigenerCharakter(data.charakterId);
      if (!kaeufer) throw new Error("Du brauchst einen eigenen Charakter zum Handeln.");
      await zeileHinzufuegen(actor, { art: "handel", text: await kaufen(actor, kaeufer, data.itemId) });
    } else if (data.type === "nscVerkaufen") {
      const verkaeufer = eigenerCharakter(data.charakterId);
      if (!verkaeufer) throw new Error("Du brauchst einen eigenen Charakter zum Handeln.");
      await zeileHinzufuegen(actor, { art: "handel", text: await verkaufen(actor, verkaeufer, data.itemId) });
    } else if (data.type === "nscQuestAnnehmen") {
      const quest = getTalkData(actor).quests.find((q) => q.id === data.questId);
      if (!quest || quest.status !== "angeboten") return;
      await questAendern(actor, quest.id, { status: "angenommen", angenommenVon: sprecherVon(data.userId, data.charakterId) });
      await zeileHinzufuegen(actor, { art: "handel", text: `${sprecherVon(data.userId, data.charakterId)} nimmt die Quest „${quest.titel}“ an.` });
    }
  } catch (fehler) {
    if (data.userId === game.user.id) ui.notifications?.warn(fehler.message);
    else game.socket.emit(SOCKET, { type: "nscFehler", userId: data.userId, text: fehler.message });
  }
}

// Spieler (oder GM) stellt eine Anfrage; der GM führt sie direkt aus.
function anfrage(type, actor, extra = {}) {
  const data = { type, actorId: actor.id, userId: game.user.id, charakterId: game.user.character?.id ?? null, ...extra };
  if (game.user.isGM) return gmAusfuehren(data);
  if (!game.users.activeGM) return ui.notifications?.warn("Gerade ist kein GM online.");
  game.socket.emit(SOCKET, data);
}

// ---------- Fenster ----------

const ApplicationV2 = foundry.applications.api.ApplicationV2;

export class HopeLiesWithinTalkApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["hope-lies-within", "hlw-talk"],
    tag: "div",
    window: { frame: false, positioned: false }
  };

  constructor(actor, options = {}) {
    super({ ...options, id: `hlw-talk-${actor.id}` });
    this.actor = actor;
    this.reiter = options.reiter ?? "gespraech";
    this._gesehen = null;
  }

  static openFor(actor, reiter) {
    if (!actor) return null;
    const existing = foundry.applications.instances.get(`hlw-talk-${actor.id}`);
    if (existing) {
      if (reiter) existing.reiter = reiter;
      existing.render({ force: true });
      return existing;
    }
    const app = new HopeLiesWithinTalkApp(actor, { reiter });
    app.render({ force: true });
    return app;
  }

  static closeFor(actorId) {
    foundry.applications.instances.get(`hlw-talk-${actorId}`)?.close();
  }

  _reiterListe(talk) {
    const isGM = game.user?.isGM;
    return Object.entries(REITER).filter(([key]) => {
      if (key === "handel") return isGM || istHaendler(this.actor);
      if (key === "quests") return isGM || sichtbareQuests(talk).length > 0;
      return true;
    });
  }

  async _renderHTML() {
    const isGM = game.user?.isGM;
    const talk = getTalkData(this.actor);
    const reiter = this._reiterListe(talk);
    if (!reiter.some(([key]) => key === this.reiter)) this.reiter = "gespraech";
    const zaehler = { handel: warenVon(this.actor).length, quests: sichtbareQuests(talk).length };
    const nav = reiter.map(([key, label]) => `
      <button type="button" class="gs-reiter ${key === this.reiter ? "aktiv" : ""}" data-reiter="${key}">${label}${zaehler[key] ? ` <span>${zaehler[key]}</span>` : ""}</button>`).join("");
    const inhalt = {
      gespraech: () => this._gespraechHtml(talk),
      handel: () => this._handelHtml(),
      quests: () => this._questsHtml(talk),
      wissen: () => this._wissenHtml(talk)
    }[this.reiter]();

    const gmLeiste = isGM ? `
      <div class="gs-gmleiste">
        <button type="button" data-hlw="show"><i class="fa-solid fa-users"></i> Allen zeigen</button>
        <button type="button" data-hlw="hide"><i class="fa-solid fa-xmark"></i> Bei allen schließen</button>
      </div>` : "";

    return `
      <div class="hlw-talk-backdrop" data-hlw="close"></div>
      <img class="hlw-talk-portrait" src="${escapeHtml(talk.portrait)}" alt="">
      <section class="hlw-talk-panel">
        <header class="gs-kopf">
          ${this._nameHtml(isGM, talk)}
          <div class="hlw-talk-role">${escapeHtml(talk.role)}</div>
          ${gmLeiste}
        </header>
        <nav class="gs-reiterleiste">${nav}</nav>
        <div class="gs-inhalt gs-${this.reiter}">${inhalt}</div>
      </section>`;
  }

  _nameHtml(isGM, talk) {
    if (isGM) {
      return `<h1>${escapeHtml(this.actor.name)}</h1>
        <label class="hlw-talk-namecheck"><input type="checkbox" data-hlw="nameRevealed" ${talk.nameRevealed ? "checked" : ""}> Name für Spieler freigegeben</label>`;
    }
    if (talk.nameRevealed) return `<h1>${escapeHtml(this.actor.name)}</h1>`;
    return `<input class="hlw-talk-name" type="text" name="ownName" value="${escapeHtml(getOwnName(this.actor.id))}" placeholder="???" title="Wie heißt diese Person? Trag ein, was du weißt.">`;
  }

  // ----- Gespräch -----

  _questKarte(quest, mitKnopf) {
    if (!quest) return `<div class="gs-questkarte"><em>Quest</em><p>Diese Quest gibt es nicht mehr.</p></div>`;
    const annehmen = mitKnopf && !game.user.isGM && quest.status === "angeboten"
      ? `<button type="button" data-gs="annehmen" data-quest="${escapeHtml(quest.id)}"><i class="fa-solid fa-check"></i> Annehmen</button>` : "";
    return `
      <div class="gs-questkarte status-${escapeHtml(quest.status)}">
        <em>Quest · Rang ${escapeHtml(quest.rang || "F")} · ${escapeHtml(QUEST_STATUS[quest.status] ?? "")}</em>
        <strong>${escapeHtml(quest.titel || "Ohne Titel")}</strong>
        <p>${absaetze(quest.text)}</p>
        ${quest.belohnung ? `<small><b>Belohnung:</b> ${escapeHtml(quest.belohnung)}</small>` : ""}
        ${quest.angenommenVon && quest.status !== "angeboten" ? `<small><b>Angenommen von:</b> ${escapeHtml(quest.angenommenVon)}</small>` : ""}
        ${annehmen}
      </div>`;
  }

  // Wörter einzeln einblenden (per CSS-Verzögerung, läuft auch in Hintergrund-Tabs sauber durch)
  _woerter(text, animieren) {
    if (!animieren) return absaetze(text);
    let nr = 0;
    return String(text ?? "").split("\n").map((zeile) => zeile.split(/(\s+)/).map((teil) => {
      if (!teil.trim()) return teil;
      return `<span class="gs-wort" style="animation-delay:${(nr++ * 0.11).toFixed(2)}s">${escapeHtml(teil)}</span>`;
    }).join("")).join("<br>");
  }

  _gespraechHtml(talk) {
    const isGM = game.user.isGM;
    const sichtbar = (z) => z.art !== "quest" || isGM || talk.quests.find((q) => q.id === z.questId)?.status !== "verborgen";
    const hauptzeilen = talk.verlauf.filter((z) => BUEHNE.includes(z.art) && sichtbar(z));
    const aktuell = hauptzeilen.at(-1);
    const neu = Boolean(aktuell && this._gesehen && !this._gesehen.has(aktuell.id));
    let buehne;
    if (!aktuell) {
      buehne = `<div class="gs-buehne gs-still"><p class="gs-leer">${isGM ? `Noch nichts gesagt. Schreib unten, was ${escapeHtml(this.actor.name)} sagt, nimm einen Textbaustein oder zeig eine Quest.` : "…"}</p></div>`;
    } else if (aktuell.art === "quest") {
      buehne = `<div class="gs-buehne ${neu ? "gs-neu" : ""}">${this._questKarte(talk.quests.find((q) => q.id === aktuell.questId), true)}</div>`;
    } else {
      const sprecher = aktuell.art === "nsc" ? `<b class="gs-sprecher">${escapeHtml(anzeigeName(this.actor))}</b>` : "";
      buehne = `<div class="gs-buehne gs-buehne-${aktuell.art} ${neu ? "gs-neu" : ""}">${sprecher}<p class="gs-satz">${this._woerter(aktuell.text, neu)}</p></div>`;
    }
    // Kleine Hinweise (Kauf, Quest angenommen), die nach dem aktuellen Satz kamen
    const nachIndex = aktuell ? talk.verlauf.findIndex((z) => z.id === aktuell.id) : -1;
    const hinweise = talk.verlauf.slice(nachIndex + 1).filter((z) => z.art === "handel").slice(-3)
      .map((z) => `<li>${escapeHtml(z.text)}</li>`).join("");
    if (!isGM) return `${buehne}${hinweise ? `<ul class="gs-hinweise">${hinweise}</ul>` : ""}`;

    const bausteine = Object.entries(BAUSTEIN_ARTEN).map(([art, label]) => {
      const liste = talk.bausteine.filter((b) => b.art === art);
      if (!liste.length) return "";
      return `<div class="gs-bausteingruppe"><span>${label}</span>${liste.map((b) => `<button type="button" class="gs-baustein" data-baustein="${escapeHtml(b.id)}" title="Klick: sofort sagen · Umschalt+Klick: ins Feld übernehmen">${escapeHtml(b.text)}</button>`).join("")}</div>`;
    }).join("");
    const bausteinEdit = talk.bausteine.map((b) => `
      <li data-baustein-id="${escapeHtml(b.id)}">
        <select data-bfeld="art">${Object.entries(BAUSTEIN_ARTEN).map(([k, l]) => `<option value="${k}" ${k === b.art ? "selected" : ""}>${l}</option>`).join("")}</select>
        <input type="text" data-bfeld="text" value="${escapeHtml(b.text)}">
        <button type="button" data-gs="bausteinWeg" title="Löschen"><i class="fa-solid fa-xmark"></i></button>
      </li>`).join("");
    const frueher = talk.verlauf.filter((z) => z.art !== "quest").slice(-12).reverse().map((z) => `
      <li class="gs-zeile gs-${escapeHtml(z.art)}" data-id="${z.id}">
        <span class="gs-text">${absaetze(z.text)}</span>
        <span class="gs-zeilenknoepfe">
          ${z.art === "handel" ? "" : `<button type="button" data-gs="nochmal" title="Nochmal zeigen"><i class="fa-solid fa-rotate-left"></i></button>
          <button type="button" data-gs="bearbeiten" title="Ändern"><i class="fa-solid fa-pen"></i></button>`}
          <button type="button" data-gs="loeschen" title="Löschen"><i class="fa-solid fa-xmark"></i></button>
        </span>
      </li>`).join("");
    return `
      ${buehne}
      ${hinweise ? `<ul class="gs-hinweise">${hinweise}</ul>` : ""}
      <div class="gs-steuerung">
        <div class="gs-bausteine">${bausteine}</div>
        <div class="gs-eingabe">
          <textarea name="zeile" rows="2" placeholder="Was sagt ${escapeHtml(this.actor.name)}? Enter = sagen, Umschalt+Enter = neue Zeile"></textarea>
          <div class="gs-eingabeknoepfe">
            <button type="button" data-gs="sagen" class="gs-haupt"><i class="fa-solid fa-comment"></i> Als ${escapeHtml(this.actor.name)} sagen</button>
            <button type="button" data-gs="erzaehlen"><i class="fa-solid fa-feather"></i> Erzählen</button>
          </div>
        </div>
        <details class="gs-aufklapp" ${this._bausteineOffen ? "open" : ""} data-aufklapp="bausteine">
          <summary>Textbausteine bearbeiten</summary>
          <ul class="gs-bausteinliste">${bausteinEdit}</ul>
          <button type="button" data-gs="bausteinNeu"><i class="fa-solid fa-plus"></i> Baustein</button>
        </details>
        <details class="gs-aufklapp" ${this._frueherOffen ? "open" : ""} data-aufklapp="frueher">
          <summary>Zuletzt gesagt</summary>
          <ol class="gs-frueher">${frueher || `<li class="gs-leer">Noch nichts.</li>`}</ol>
          <button type="button" data-gs="leeren"><i class="fa-solid fa-broom"></i> Alles löschen</button>
        </details>
      </div>`;
  }

  // ----- Handel -----

  _handelHtml() {
    const isGM = game.user.isGM;
    const nsc = this.actor;
    const name = anzeigeName(nsc);
    const handel = handelVon(nsc);
    const waren = warenVon(nsc);
    const charakter = game.user.character;
    const geld = charakter ? Number(charakter.system?.resources?.kes?.value) || 0 : 0;
    const kasse = Number(nsc.system?.resources?.kes?.value) || 0;
    const warenListe = waren.map((item) => {
      const preis = preisVon(item, nsc);
      const fest = item.getFlag(SYSTEM_ID, "preis");
      const menge = Number(item.system?.quantity ?? 1);
      const aktion = isGM
        ? `<input type="number" min="0" step="1" value="${fest ?? ""}" placeholder="${preis}" data-gs="preis" title="Fester Preis in SK (leer = Marktwert × ${handel.verkauf} %)"> <span class="gs-sk">SK</span>
           <button type="button" data-gs="wareWeg" title="Aus dem Angebot nehmen"><i class="fa-solid fa-xmark"></i></button>`
        : `<b class="gs-preis">${kes(preis)}</b><button type="button" data-gs="kaufen" class="gs-haupt" ${!charakter || geld < preis ? "disabled" : ""}>Kaufen</button>`;
      return `<li data-item="${item.id}">
          <img src="${escapeHtml(item.img)}" alt="">
          <span class="gs-warenname">${escapeHtml(item.name)}${menge > 1 ? ` <small class="gs-menge">×${menge}</small>` : ""}<small>${escapeHtml(WAREN_ARTEN[item.type] ?? "")}${item.system?.rank ? ` · Rang ${escapeHtml(item.system.rank)}` : ""}</small></span>
          ${aktion}
        </li>`;
    }).join("");

    const kauftText = [
      handel.ankauf > 0 && handel.kauft.length ? `${handel.kauft.map((k) => WAREN_ARTEN[k] ?? k).join(", ")} für ${handel.ankauf} %` : "",
      handel.andere > 0 ? `alles andere für ${handel.andere} %` : "",
      handel.gilde ? "Kristalle für 100 %" : "",
      handel.schwarzmarkt ? "Abyss-Kristalle für 200 %" : ""
    ].filter(Boolean).join(", ");

    let verkauf = "";
    if (!isGM && charakter) {
      const eigene = charakter.items.filter((item) => istWare(item) && ankaufVon(item, nsc) > 0);
      verkauf = `
        <h2>Verkaufen <small>${kauftText ? `(${escapeHtml(name)} kauft ${escapeHtml(kauftText)} vom Marktwert)` : `(${escapeHtml(name)} kauft nichts an)`}</small></h2>
        ${kauftText ? `<ul class="gs-waren">${eigene.map((item) => `
          <li data-item="${item.id}">
            <img src="${escapeHtml(item.img)}" alt="">
            <span class="gs-warenname">${escapeHtml(item.name)}${Number(item.system?.quantity ?? 1) > 1 ? ` <small class="gs-menge">×${item.system.quantity}</small>` : ""}<small>${escapeHtml(WAREN_ARTEN[item.type] ?? "")}</small></span>
            <b class="gs-preis">${kes(ankaufVon(item, nsc))}</b><button type="button" data-gs="verkaufen" ${ankaufVon(item, nsc) > kasse ? "disabled title=\"Nicht genug Kes in der Kasse\"" : ""}>Verkaufen</button>
          </li>`).join("") || `<li class="gs-leer">Du hast nichts, was ${escapeHtml(name)} kaufen würde.</li>`}
        </ul>` : ""}`;
    }

    const gmBereich = isGM ? `
      <div class="gs-warensuche">
        <input type="search" name="warensuche" placeholder="Ware hinzufügen: Namen suchen, z. B. Brot, Schwert, Trank …">
        <ul class="gs-suchtreffer"></ul>
      </div>
      <details class="gs-aufklapp gs-haendler" ${this._haendlerOffen ? "open" : ""} data-aufklapp="haendler">
        <summary>Händler-Einstellungen: ${escapeHtml(kauftText || "kauft nichts an")} · verkauft zu ${handel.verkauf} %</summary>
        <div class="gs-haendlerzeile">
          <label>Verkauft zu <input type="number" min="0" step="5" data-hfeld="verkauf" value="${handel.verkauf}"> % vom Marktwert</label>
          <label>Kasse <input type="number" min="0" step="1" data-gs="kasse" value="${kasse}"> SK</label>
        </div>
        <div class="gs-haendlerzeile"><span>Kauft an:</span>
          ${Object.entries(WAREN_ARTEN).map(([k, l]) => `<label class="gs-art"><input type="checkbox" data-hart="${k}" ${handel.kauft.includes(k) ? "checked" : ""}> ${l}</label>`).join("")}
        </div>
        <div class="gs-haendlerzeile">
          <label>zahlt dafür <input type="number" min="0" max="100" step="5" data-hfeld="ankauf" value="${handel.ankauf}"> %</label>
          <label>für alles andere <input type="number" min="0" max="100" step="5" data-hfeld="andere" value="${handel.andere}"> % <small>(0 = kauft er nicht)</small></label>
        </div>
        <div class="gs-haendlerzeile">
          <label class="gs-art"><input type="checkbox" data-hschalter="gilde" ${handel.gilde ? "checked" : ""}> Gilde: kauft Kristalle zum vollen Wert</label>
          <label class="gs-art"><input type="checkbox" data-hschalter="schwarzmarkt" ${handel.schwarzmarkt ? "checked" : ""}> Schwarzmarkt: Abyss-Kristalle zum doppelten Wert</label>
        </div>
        <p class="gs-hinweis">Spieler kaufen und verkaufen selbst mit den Knöpfen im Fenster; Kes und Gegenstände wandern automatisch. Angekaufte Ware legt der Händler wieder ins Angebot, zum Verkaufspreis. Ein fester Preis im Feld neben der Ware gilt statt Marktwert × %.</p>
      </details>` : "";

    return `
      <div class="gs-handelkopf">
        <h2>Angebot</h2>
        ${isGM ? `<span>Kasse: ${kes(kasse)}</span>` : charakter ? `<span>Dein Geld: <b>${kes(geld)}</b></span>` : `<span>Dir ist kein Charakter zugewiesen.</span>`}
      </div>
      <ul class="gs-waren">${warenListe || `<li class="gs-leer">${isGM ? "Noch keine Waren. Unten suchen und hinzufügen." : "Gerade nichts im Angebot."}</li>`}</ul>
      ${gmBereich}
      ${verkauf}`;
  }

  // ----- Quests -----

  _questsHtml(talk) {
    if (!game.user.isGM) {
      const quests = sichtbareQuests(talk);
      return `<div class="gs-questliste">${quests.map((q) => this._questKarte(q, true)).join("")}</div>`;
    }
    const karten = talk.quests.map((q) => `
      <div class="gs-questedit" data-quest="${escapeHtml(q.id)}">
        <div class="gs-questzeile">
          <input type="text" data-feld="titel" value="${escapeHtml(q.titel)}" placeholder="Titel">
          <select data-feld="rang">${QUEST_RAENGE.map((r) => `<option ${r === (q.rang || "F") ? "selected" : ""}>${r}</option>`).join("")}</select>
          <select data-feld="status">${Object.entries(QUEST_STATUS).map(([k, l]) => `<option value="${k}" ${k === q.status ? "selected" : ""}>${l}</option>`).join("")}</select>
        </div>
        <textarea data-feld="text" rows="4" placeholder="Was der NSC sagt, wenn er die Quest anbietet …">${escapeHtml(q.text)}</textarea>
        <input type="text" data-feld="belohnung" value="${escapeHtml(q.belohnung)}" placeholder="Belohnung">
        <div class="gs-questknoepfe">
          <button type="button" data-gs="questZeigen" class="gs-haupt"><i class="fa-solid fa-scroll"></i> Im Gespräch zeigen</button>
          <button type="button" data-gs="questLoeschen" title="Quest löschen"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`).join("");
    return `
      <p class="gs-hinweis">Verborgene Quests sehen nur du. „Im Gespräch zeigen“ schreibt die Quest in den Verlauf und bietet sie an. Änderungen am Text erscheinen sofort auch im Gespräch.</p>
      ${karten}
      <button type="button" data-gs="questNeu"><i class="fa-solid fa-plus"></i> Neue Quest</button>`;
  }

  // ----- Wissen -----

  _wissenHtml(talk) {
    const isGM = game.user.isGM;
    const facts = isGM ? talk.facts : talk.facts.filter((fact) => fact.revealed);
    const factList = facts.length
      ? facts.map((fact) => (isGM ? this._gmFactRow(fact) : `
          <li class="${fact.highlight ? "hlw-talk-new" : ""}">${fact.highlight ? "<b>Neu:</b> " : ""}${escapeHtml(fact.text)}</li>`)).join("")
      : `<li class="hlw-talk-empty">${isGM ? "Noch keine Einträge." : "Ihr wisst noch nichts über diese Person."}</li>`;
    const gmTools = isGM ? `
      <div class="hlw-talk-gm">
        <input type="text" name="newFact" placeholder="Neuer Eintrag (erst sichtbar, wenn du ihn freigibst)">
        <button type="button" data-hlw="add">Hinzufügen</button>
      </div>
      <div class="hlw-talk-gm">
        <input type="text" name="role" value="${escapeHtml(talk.role)}" placeholder="Rolle (z. B. Wirtin)">
        <button type="button" data-hlw="portrait">Porträt wählen</button>
      </div>` : "";
    return `
      <h2>${isGM ? "Einträge (Haken = für Spieler sichtbar)" : "Was ihr wisst"}</h2>
      <ul class="hlw-talk-facts">${factList}</ul>
      ${gmTools}
      <h2>Notizen der Gruppe <small>(alle sehen alle Notizen)</small></h2>
      <ul class="gs-notizen">${talk.notizen.map((n) => `
        <li data-notiz="${escapeHtml(n.id)}">
          <b>${escapeHtml(n.name)}</b>
          <span class="gs-notiztext">${absaetze(n.text)}</span>
          ${n.userId === game.user.id || isGM ? `<span class="gs-zeilenknoepfe"><button type="button" data-gs="notizAendern" title="Ändern"><i class="fa-solid fa-pen"></i></button><button type="button" data-gs="notizWeg" title="Löschen"><i class="fa-solid fa-xmark"></i></button></span>` : ""}
        </li>`).join("") || `<li class="gs-leer">Noch keine Notizen.</li>`}
      </ul>
      <div class="gs-notizneu">
        <textarea name="notiz" rows="2" placeholder="Notiz zu dieser Person (alle in der Gruppe sehen sie) …"></textarea>
        <button type="button" data-gs="notizNeu"><i class="fa-solid fa-plus"></i> Notiz speichern</button>
      </div>
      <div class="hlw-talk-hint">Klick neben das Fenster oder Esc, um es zu schließen.</div>`;
  }

  _gmFactRow(fact) {
    return `
      <li class="hlw-talk-gmfact" data-fact="${escapeHtml(fact.id)}">
        <label><input type="checkbox" data-hlw="reveal" ${fact.revealed ? "checked" : ""}> sichtbar</label>
        <label><input type="checkbox" data-hlw="highlight" ${fact.highlight ? "checked" : ""}> neu</label>
        <span>${escapeHtml(fact.text)}</span>
        <button type="button" data-hlw="factSagen" title="Im Gespräch sagen (und freigeben)"><i class="fa-solid fa-comment"></i></button>
        <button type="button" data-hlw="delete" title="Löschen">×</button>
      </li>`;
  }

  _replaceHTML(result, content) {
    // Angefangene Texte behalten, wenn sich währenddessen etwas ändert
    const entwurf = content.querySelector("textarea[name='zeile']")?.value;
    const notizEntwurf = content.querySelector("textarea[name='notiz']")?.value;
    content.innerHTML = result;
    const feld = content.querySelector("textarea[name='zeile']");
    if (feld && entwurf) feld.value = entwurf;
    const notizFeld = content.querySelector("textarea[name='notiz']");
    if (notizFeld && notizEntwurf) notizFeld.value = notizEntwurf;
    this._bindEvents(content);
    // Ab jetzt gelten alle Zeilen als gesehen; nur später gesagte Sätze werden eingeblendet.
    this._gesehen ??= new Set();
    for (const z of getTalkData(this.actor).verlauf) this._gesehen.add(z.id);
    this._alteNotizUebernehmen();
  }

  // Private Notizen aus v0.8.0 einmal als Gruppennotiz übernehmen.
  _alteNotizUebernehmen() {
    const alt = getNotes(this.actor.id).trim();
    if (!alt || this._notizUebernommen) return;
    this._notizUebernommen = true;
    anfrage("nscNotiz", this.actor, { aktion: "neu", text: alt });
    game.user.unsetFlag(SYSTEM_ID, `talkNotes.${this.actor.id}`);
  }

  _bindEvents(root) {
    const isGM = game.user?.isGM;
    root.querySelector("[data-hlw='close']")?.addEventListener("click", () => this.close());
    root.querySelectorAll("[data-reiter]").forEach((knopf) => knopf.addEventListener("click", () => {
      this.reiter = knopf.dataset.reiter;
      this.render();
    }));
    // Notizen der Gruppe
    root.querySelector("[data-gs='notizNeu']")?.addEventListener("click", () => {
      const feld = root.querySelector("textarea[name='notiz']");
      const text = feld?.value?.trim();
      if (!text) return;
      feld.value = "";
      anfrage("nscNotiz", this.actor, { aktion: "neu", text });
    });
    root.querySelectorAll("[data-gs='notizWeg']").forEach((knopf) => knopf.addEventListener("click", () => {
      anfrage("nscNotiz", this.actor, { aktion: "loeschen", notizId: knopf.closest("[data-notiz]")?.dataset.notiz });
    }));
    root.querySelectorAll("[data-gs='notizAendern']").forEach((knopf) => knopf.addEventListener("click", () => this._notizBearbeiten(knopf.closest("[data-notiz]"))));
    root.querySelector("input[name='ownName']")?.addEventListener("change", (event) => {
      game.user.setFlag(SYSTEM_ID, `talkNames.${this.actor.id}`, event.currentTarget.value.trim());
    });
    // Esc in der Capture-Phase abfangen, bevor Foundrys Tastatursteuerung es verarbeitet.
    this._keyHandler ??= (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      this.close();
    };
    window.addEventListener("keydown", this._keyHandler, true);

    root.querySelectorAll("[data-gs='annehmen']").forEach((knopf) => knopf.addEventListener("click", () => anfrage("nscQuestAnnehmen", this.actor, { questId: knopf.dataset.quest })));

    // Handel (Spieler)
    root.querySelectorAll("[data-gs='kaufen']").forEach((knopf) => knopf.addEventListener("click", () => {
      knopf.disabled = true;
      anfrage("nscKaufen", this.actor, { itemId: knopf.closest("[data-item]")?.dataset.item });
    }));
    root.querySelectorAll("[data-gs='verkaufen']").forEach((knopf) => knopf.addEventListener("click", () => {
      knopf.disabled = true;
      anfrage("nscVerkaufen", this.actor, { itemId: knopf.closest("[data-item]")?.dataset.item });
    }));

    if (!isGM) return;

    // Gespräch: sagen / erzählen / Textbausteine (nur der GM spricht)
    const eingabe = root.querySelector("textarea[name='zeile']");
    const senden = (art) => {
      const text = eingabe?.value?.trim();
      if (!text) return;
      eingabe.value = "";
      zeileHinzufuegen(this.actor, { art, text });
    };
    eingabe?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      senden("nsc");
    });
    if (this.reiter === "gespraech") eingabe?.focus();
    root.querySelector("[data-gs='sagen']")?.addEventListener("click", () => senden("nsc"));
    root.querySelector("[data-gs='erzaehlen']")?.addEventListener("click", () => senden("erzaehler"));
    root.querySelectorAll("[data-baustein]").forEach((knopf) => knopf.addEventListener("click", (event) => {
      const baustein = getTalkData(this.actor).bausteine.find((b) => b.id === knopf.dataset.baustein);
      if (!baustein) return;
      if (event.shiftKey && eingabe) {
        eingabe.value = baustein.text;
        eingabe.focus();
      } else zeileHinzufuegen(this.actor, { art: "nsc", text: baustein.text });
    }));
    root.querySelectorAll("[data-aufklapp]").forEach((el) => el.addEventListener("toggle", () => {
      if (el.dataset.aufklapp === "bausteine") this._bausteineOffen = el.open;
      else this._frueherOffen = el.open;
    }));
    root.querySelectorAll("[data-bfeld]").forEach((feld) => feld.addEventListener("change", () => {
      const id = feld.closest("[data-baustein-id]")?.dataset.bausteinId;
      talkAendern(this.actor, (talk) => ({ bausteine: talk.bausteine.map((b) => (b.id === id ? { ...b, [feld.dataset.bfeld]: feld.value } : b)) }));
    }));
    root.querySelectorAll("[data-gs='bausteinWeg']").forEach((knopf) => knopf.addEventListener("click", () => {
      const id = knopf.closest("[data-baustein-id]")?.dataset.bausteinId;
      talkAendern(this.actor, (talk) => ({ bausteine: talk.bausteine.filter((b) => b.id !== id) }));
    }));
    root.querySelector("[data-gs='bausteinNeu']")?.addEventListener("click", () => {
      talkAendern(this.actor, (talk) => ({ bausteine: [...talk.bausteine, { id: foundry.utils.randomID(), art: "sonst", text: "" }] }));
    });
    root.querySelectorAll("[data-gs='nochmal']").forEach((knopf) => knopf.addEventListener("click", () => {
      const zeile = getTalkData(this.actor).verlauf.find((z) => z.id === knopf.closest("[data-id]")?.dataset.id);
      if (zeile) zeileHinzufuegen(this.actor, { art: zeile.art, text: zeile.text });
    }));

    // Frühere Sätze ändern oder löschen
    root.querySelectorAll("[data-gs='loeschen']").forEach((knopf) => knopf.addEventListener("click", () => {
      const id = knopf.closest("[data-id]")?.dataset.id;
      talkAendern(this.actor, (talk) => ({ verlauf: talk.verlauf.filter((z) => z.id !== id) }));
    }));
    root.querySelectorAll("[data-gs='bearbeiten']").forEach((knopf) => knopf.addEventListener("click", () => this._zeileBearbeiten(knopf.closest("[data-id]"))));
    root.querySelector("[data-gs='leeren']")?.addEventListener("click", async () => {
      const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Verlauf leeren" }, content: `<p>Den ganzen Gesprächsverlauf mit ${escapeHtml(this.actor.name)} löschen?</p>` });
      if (ok) talkAendern(this.actor, { verlauf: [] });
    });

    // Handel (GM): Preise, Waren entfernen, Gegenstände hineinziehen
    root.querySelectorAll("[data-gs='preis']").forEach((feld) => feld.addEventListener("change", () => {
      const item = this.actor.items.get(feld.closest("[data-item]")?.dataset.item);
      if (!item) return;
      if (feld.value === "") item.unsetFlag(SYSTEM_ID, "preis");
      else item.setFlag(SYSTEM_ID, "preis", Math.max(Math.round(Number(feld.value) || 0), 0));
    }));
    // Händler-Einstellungen
    root.querySelectorAll("[data-hfeld]").forEach((feld) => feld.addEventListener("change", () => {
      const handel = handelVon(this.actor);
      talkAendern(this.actor, { handel: { ...handel, [feld.dataset.hfeld]: Math.max(Number(feld.value) || 0, 0) } });
    }));
    root.querySelectorAll("[data-hschalter]").forEach((feld) => feld.addEventListener("change", () => {
      talkAendern(this.actor, { handel: { ...handelVon(this.actor), [feld.dataset.hschalter]: feld.checked } });
    }));
    root.querySelectorAll("[data-hart]").forEach((feld) => feld.addEventListener("change", () => {
      const kauft = Array.from(root.querySelectorAll("[data-hart]")).filter((f) => f.checked).map((f) => f.dataset.hart);
      talkAendern(this.actor, { handel: { ...handelVon(this.actor), kauft } });
    }));
    root.querySelector("[data-gs='kasse']")?.addEventListener("change", (event) => {
      this.actor.update({ "system.resources.kes.value": Math.max(Math.round(Number(event.currentTarget.value) || 0), 0) });
    });
    root.querySelector("[data-aufklapp='haendler']")?.addEventListener("toggle", (event) => {
      this._haendlerOffen = event.currentTarget.open;
    });
    // Ware suchen und hinzufügen (ohne die Seitenleiste)
    const suche = root.querySelector("input[name='warensuche']");
    const trefferListe = root.querySelector(".gs-suchtreffer");
    let suchNr = 0;
    suche?.addEventListener("input", async () => {
      this._letzteSuche = suche.value;
      const nr = ++suchNr;
      const treffer = suche.value.trim().length >= 2 ? await warenSuche(suche.value) : [];
      if (nr !== suchNr || !trefferListe) return;
      trefferListe.innerHTML = treffer.map((w) => `
        <li data-ware="${escapeHtml(w.name)}">
          <img src="${escapeHtml(w.img)}" alt="">
          <span class="gs-warenname">${escapeHtml(w.name)}<small>${escapeHtml(WAREN_ARTEN[w.type] ?? "")} · Marktwert ${kes(Number(w.system?.priceSk) || 0)}</small></span>
          <input type="number" min="1" value="1" title="Anzahl">
          <button type="button" class="gs-haupt"><i class="fa-solid fa-plus"></i></button>
        </li>`).join("") || (suche.value.trim().length >= 2 ? `<li class="gs-leer">Nichts gefunden.</li>` : "");
      trefferListe.querySelectorAll("[data-ware] button").forEach((knopf) => knopf.addEventListener("click", async () => {
        const li = knopf.closest("[data-ware]");
        knopf.disabled = true;
        await wareHinzufuegen(this.actor, li.dataset.ware, Math.max(Number(li.querySelector("input")?.value) || 1, 1));
      }));
    });
    if (this._letzteSuche && suche) {
      suche.value = this._letzteSuche;
      suche.dispatchEvent(new Event("input"));
    }
    root.querySelectorAll("[data-gs='wareWeg']").forEach((knopf) => knopf.addEventListener("click", () => {
      this.actor.items.get(knopf.closest("[data-item]")?.dataset.item)?.delete();
    }));
    const ablage = root.querySelector("[data-gs='ablage']");
    ablage?.addEventListener("dragover", (event) => {
      event.preventDefault();
      ablage.classList.add("drueber");
    });
    ablage?.addEventListener("dragleave", () => ablage.classList.remove("drueber"));
    ablage?.addEventListener("drop", (event) => this._wareAblegen(event));

    // Quests
    root.querySelectorAll(".gs-questedit [data-feld]").forEach((feld) => feld.addEventListener("change", () => {
      const id = feld.closest("[data-quest]")?.dataset.quest;
      questAendern(this.actor, id, { [feld.dataset.feld]: feld.value });
    }));
    root.querySelectorAll("[data-gs='questZeigen']").forEach((knopf) => knopf.addEventListener("click", async () => {
      const id = knopf.closest("[data-quest]")?.dataset.quest;
      await talkAendern(this.actor, (talk) => ({
        quests: talk.quests.map((q) => (q.id === id && q.status === "verborgen" ? { ...q, status: "angeboten" } : q)),
        verlauf: [...talk.verlauf, { id: foundry.utils.randomID(), art: "quest", questId: id }].slice(-VERLAUF_MAX)
      }));
      this.reiter = "gespraech";
      this.render();
    }));
    root.querySelectorAll("[data-gs='questLoeschen']").forEach((knopf) => knopf.addEventListener("click", () => {
      const id = knopf.closest("[data-quest]")?.dataset.quest;
      talkAendern(this.actor, (talk) => ({ quests: talk.quests.filter((q) => q.id !== id), verlauf: talk.verlauf.filter((z) => z.questId !== id) }));
    }));
    root.querySelector("[data-gs='questNeu']")?.addEventListener("click", () => {
      talkAendern(this.actor, (talk) => ({ quests: [...talk.quests, { id: foundry.utils.randomID(), titel: "", rang: "F", text: "", belohnung: "", status: "verborgen" }] }));
    });

    // Wissen
    root.querySelectorAll("[data-hlw='reveal'], [data-hlw='highlight'], [data-hlw='delete'], [data-hlw='factSagen']").forEach((element) => {
      element.addEventListener(element.tagName === "BUTTON" ? "click" : "change", (event) => this._onFactChange(event));
    });
    root.querySelector("[data-hlw='add']")?.addEventListener("click", () => this._addFact(root));
    root.querySelector("[data-hlw='nameRevealed']")?.addEventListener("change", (event) => talkAendern(this.actor, { nameRevealed: event.currentTarget.checked }));
    root.querySelector("input[name='newFact']")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this._addFact(root);
    });
    root.querySelector("input[name='role']")?.addEventListener("change", (event) => talkAendern(this.actor, { role: event.currentTarget.value }));
    root.querySelector("[data-hlw='portrait']")?.addEventListener("click", () => this._pickPortrait());
    root.querySelector("[data-hlw='show']")?.addEventListener("click", () => zeigeAllen(this.actor, this.reiter));
    root.querySelector("[data-hlw='hide']")?.addEventListener("click", () => game.socket.emit(SOCKET, { type: "talkClose", actorId: this.actor.id }));
  }

  _zeileBearbeiten(li) {
    const id = li?.dataset.id;
    const zeile = getTalkData(this.actor).verlauf.find((z) => z.id === id);
    const span = li?.querySelector(".gs-text");
    if (!zeile || !span) return;
    const feld = document.createElement("textarea");
    feld.className = "gs-zeilenfeld";
    feld.value = zeile.text;
    span.replaceWith(feld);
    feld.focus();
    const speichern = () => {
      const text = feld.value.trim();
      talkAendern(this.actor, (talk) => ({ verlauf: text ? talk.verlauf.map((z) => (z.id === id ? { ...z, text } : z)) : talk.verlauf.filter((z) => z.id !== id) }));
    };
    feld.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        feld.blur();
      }
    });
    feld.addEventListener("blur", speichern, { once: true });
  }

  _notizBearbeiten(li) {
    const id = li?.dataset.notiz;
    const notiz = getTalkData(this.actor).notizen.find((n) => n.id === id);
    const span = li?.querySelector(".gs-notiztext");
    if (!notiz || !span) return;
    const feld = document.createElement("textarea");
    feld.className = "gs-zeilenfeld";
    feld.value = notiz.text;
    span.replaceWith(feld);
    feld.focus();
    feld.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        feld.blur();
      }
    });
    feld.addEventListener("blur", () => {
      const text = feld.value.trim();
      anfrage("nscNotiz", this.actor, text ? { aktion: "aendern", notizId: id, text } : { aktion: "loeschen", notizId: id });
    }, { once: true });
  }

  async _wareAblegen(event) {
    event.preventDefault();
    event.currentTarget.classList.remove("drueber");
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    if (data?.type !== "Item") return;
    const item = await fromUuid(data.uuid);
    if (!item || ["playerSkill", "classSkill"].includes(item.type)) return ui.notifications?.warn("Nur Gegenstände können Ware sein.");
    const daten = { name: item.name, type: item.type, img: item.img, system: item.toObject().system };
    daten.system.equipped = false;
    await this.actor.createEmbeddedDocuments("Item", [daten]);
  }

  async _onFactChange(event) {
    const id = event.currentTarget.closest("[data-fact]")?.dataset.fact;
    const action = event.currentTarget.dataset.hlw;
    const checked = event.currentTarget.checked;
    if (action === "factSagen") {
      const fact = getTalkData(this.actor).facts.find((f) => f.id === id);
      if (!fact) return;
      await talkAendern(this.actor, (talk) => ({ facts: talk.facts.map((f) => (f.id === id ? { ...f, revealed: true } : f)) }));
      await zeileHinzufuegen(this.actor, { art: "nsc", text: fact.text });
      this.reiter = "gespraech";
      return this.render();
    }
    await talkAendern(this.actor, (talk) => ({
      facts: action === "delete"
        ? talk.facts.filter((fact) => fact.id !== id)
        : talk.facts.map((fact) => (fact.id === id ? { ...fact, [action === "reveal" ? "revealed" : "highlight"]: checked } : fact))
    }));
  }

  async _addFact(root) {
    const input = root.querySelector("input[name='newFact']");
    const text = input?.value?.trim();
    if (!text) return;
    await talkAendern(this.actor, (talk) => ({ facts: [...talk.facts, { id: foundry.utils.randomID(), text, revealed: false, highlight: false }] }));
  }

  _pickPortrait() {
    const Picker = foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    new Picker({
      type: "image",
      current: getTalkData(this.actor).portrait,
      callback: (path) => talkAendern(this.actor, { portrait: path })
    }).render(true);
  }

  async _onClose(options) {
    if (this._keyHandler) window.removeEventListener("keydown", this._keyHandler, true);
    const ownName = this.element?.querySelector("input[name='ownName']")?.value?.trim();
    if (ownName !== undefined && ownName !== getOwnName(this.actor.id)) await game.user.setFlag(SYSTEM_ID, `talkNames.${this.actor.id}`, ownName);
    return super._onClose?.(options);
  }
}

// Weltweite Einstellung: duerfen Spieler Gespraeche selbst per Doppelklick oeffnen? Standard: nein, der GM oeffnet sie.
export function registerTalkSettings() {
  game.settings.register(SYSTEM_ID, "spielerGespraeche", {
    name: "Spieler öffnen NSC-Gespräche selbst",
    hint: "Aus: Spieler sprechen den NSC am Tisch an, und du öffnest das Gespräch per Rechtsklick auf die NSC-Figur (Sprechen, Handeln, Quests). An: Spieler öffnen es auch selbst per Doppelklick.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
}

export function zeigeAllen(actor, reiter = "gespraech") {
  game.socket.emit(SOCKET, { type: "talkOpen", actorId: actor.id, reiter });
  HopeLiesWithinTalkApp.openFor(actor, reiter);
}

export function registerTalk() {
  game.socket.on(SOCKET, (data) => {
    if (data?.type === "talkOpen" && !game.user?.isGM) HopeLiesWithinTalkApp.openFor(game.actors.get(data.actorId), data.reiter);
    if (data?.type === "talkClose") HopeLiesWithinTalkApp.closeFor(data.actorId);
    if (data?.type === "nscFehler" && data.userId === game.user?.id) ui.notifications?.warn(data.text);
    if (["nscNotiz", "nscKaufen", "nscVerkaufen", "nscQuestAnnehmen"].includes(data?.type) && ichBinAktiverGM()) gmAusfuehren(data);
  });

  // Doppelklick eines Spielers auf eine NSC-Figur: Gespraech nur, wenn der GM es erlaubt; sonst ein Hinweis statt des Bogens.
  const TokenClass = CONFIG.Token.objectClass;
  const originalDoubleClick = TokenClass.prototype._onClickLeft2;
  TokenClass.prototype._onClickLeft2 = function (event) {
    if (!game.user?.isGM && hasTalk(this.actor)) {
      if (game.settings.get(SYSTEM_ID, "spielerGespraeche")) return HopeLiesWithinTalkApp.openFor(this.actor);
      return ui.notifications?.info("Sprich die Person am Tisch an. Der GM öffnet das Gespräch.");
    }
    return originalDoubleClick.call(this, event);
  };

  // Offene Gespraeche aktualisieren, wenn sich etwas ändert. Neue Sätze holen das Fenster zurück auf den Gesprächs-Reiter.
  Hooks.on("updateActor", (actor, changes) => {
    if (!foundry.utils.hasProperty(changes, `flags.${SYSTEM_ID}.talk`) && !foundry.utils.hasProperty(changes, "system.resources.kes")) return;
    const app = foundry.applications.instances.get(`hlw-talk-${actor.id}`);
    if (!app) return;
    const neu = getTalkData(actor).verlauf.at(-1);
    if (neu && app._gesehen && !app._gesehen.has(neu.id) && neu.art !== "handel") app.reiter = "gespraech";
    app.render();
  });
  // Waren ändern sich (Kauf, Verkauf, Preis): Handel neu zeichnen, auch beim Käufer.
  const warenNeu = (item) => {
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof HopeLiesWithinTalkApp && (app.actor.id === item.parent?.id || item.parent?.id === game.user?.character?.id)) app.render();
    }
  };
  for (const hook of ["createItem", "updateItem", "deleteItem"]) Hooks.on(hook, warenNeu);
}

// Rechtsklick auf eine NSC-Figur (GM): Menü neben dem Token-HUD mit Sprechen, Handeln und Quests.
// Das Menü hängt am Dokument (der HUD baut seinen Inhalt nach dem Hook neu auf) und folgt dem HUD beim Verschieben der Karte.
function menueEntfernen() {
  document.getElementById("hlw-nsc-menue")?.remove();
}

function menueAusrichten() {
  const menue = document.getElementById("hlw-nsc-menue");
  const hud = canvas.hud?.token;
  const el = hud?.element?.[0] ?? hud?.element;
  if (!menue) return;
  if (!hud?.object || !el?.isConnected) return menueEntfernen();
  const rect = el.getBoundingClientRect();
  menue.style.left = `${Math.round(rect.right + 100)}px`;
  menue.style.top = `${Math.round(rect.top - 4)}px`;
}

Hooks.on("renderTokenHUD", (hud) => {
  menueEntfernen();
  if (!game.user?.isGM) return;
  const actor = hud.object?.actor;
  if (actor?.type !== "npc") return;
  const talk = getTalkData(actor);
  const waren = warenVon(actor).length;
  const offen = talk.quests.filter((q) => q.status !== "erledigt").length;
  const menue = document.createElement("div");
  menue.id = "hlw-nsc-menue";
  menue.className = "hlw-nsc-menue";
  const eintrag = (icon, text, aktion, extra = "") => {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = extra;
    knopf.innerHTML = `<i class="fa-solid ${icon}"></i><span>${text}</span>`;
    knopf.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      aktion();
      canvas.hud?.token?.close?.();
      menueEntfernen();
    });
    menue.appendChild(knopf);
  };
  eintrag("fa-comment", "Sprechen", () => zeigeAllen(actor, "gespraech"));
  if (istHaendler(actor)) eintrag("fa-scale-balanced", `Handeln <small>${waren}</small>`, () => zeigeAllen(actor, "handel"));
  if (talk.quests.length) eintrag("fa-scroll", `Quests <small>${offen}</small>`, () => zeigeAllen(actor, "quests"));
  eintrag("fa-eye", "Nur für mich öffnen", () => HopeLiesWithinTalkApp.openFor(actor, "gespraech"), "leise");
  document.body.appendChild(menue);
  requestAnimationFrame(menueAusrichten);
});
Hooks.on("closeTokenHUD", menueEntfernen);
Hooks.on("canvasPan", () => requestAnimationFrame(menueAusrichten));
Hooks.on("canvasTearDown", menueEntfernen);
