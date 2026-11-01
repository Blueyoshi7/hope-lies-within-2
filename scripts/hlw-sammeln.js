// Suchen, Sammeln und Almanach (Dominik 2026-11-01)
// Sammelgebiet = Region auf der Karte mit dem Verhalten „Sammelgebiet“ (Regions-Werkzeug → Region → Verhalten hinzufügen).
// Dort stehen Name, Wurf (World-Skill), Schwierigkeit, Funde und Versuche pro Tag. Funde als Text, getrennt mit ; oder Zeilen:
//   „Nebelfarn“, „2 × Holz (Bündel)“, „Wasserbeere 30 %“, „Holzvogel einmal“ (einmal = nur einmal für die ganze Gruppe).
// Steht die eigene Figur in einem Sammelgebiet, erscheint der Knopf „Suchen“ (auch Makro-Platz 5 oder game.hlw.suchen()).
// 1W20 + World-Skill gegen die Schwierigkeit (sehen die Spieler nicht); natürliche 20 gelingt, natürliche 1 misslingt.
// Geschafft: sichere Funde (ohne %) + 1 Stück je 5 Punkte über der Schwierigkeit, %-Funde mit ihrer Chance, „einmal“-Funde einmal.
// Versuche zählen pro Figur, Gebiet und Spieltag. Dazu hat jedes Gebiet einen Vorrat pro Tag für die ganze Gruppe
// (z. B. 6 Nebelfarn): ist er aufgebraucht, ist das Gebiet für heute abgeerntet. Der GM beginnt einen neuen Tag im
// Almanach („Neuer Tag“), am besten wenn die Gruppe schlafen geht. Sammelgebiete sieht der GM immer, Spieler nie.
// Almanach: alle Pflanzen und Mineralien, verdeckt, bis ein Spielercharakter eines davon bekommt (Suchen, Kauf, Belohnung …).
// Stand in der Welt-Einstellung "almanach": { [Name]: { offen, funde } }. Öffnen: Makro-Platz 4 oder game.hlw.almanach().

import { WORLD_SKILLS } from "./hlw-regeln.js";
import { gegenstandDazu } from "./hlw-nsc.js";

const SYSTEM_ID = "hope-lies-within-2";
const SOCKET = `system.${SYSTEM_ID}`;
const ApplicationV2 = foundry.applications.api.ApplicationV2;
const RANG_FOLGE = ["E", "D", "C", "B", "A", "S", "SS"];

function zahl(wert) {
  const z = Number(wert);
  return Number.isFinite(z) ? z : 0;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// ---------- Sammelgebiet (Regionsverhalten) ----------

export class SammelgebietDaten extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      name: new f.StringField({ required: true, blank: true, initial: "", label: "Name", hint: "So heißt der Ort für die Spieler, z. B. „Lindbach“." }),
      wurf: new f.StringField({ required: true, initial: "naturkunde", choices: Object.fromEntries(Object.entries(WORLD_SKILLS).map(([k, v]) => [k, v.label])), label: "Wurf", hint: "Pflanzen und Mineralien: Naturkunde. Versteckte Dinge: Scharfsinnigkeit." }),
      schwierigkeit: new f.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 12, label: "Schwierigkeit", hint: "Sehen die Spieler nicht. 0 = ohne Wurf, man findet immer etwas." }),
      funde: new f.StringField({ required: true, blank: true, initial: "", label: "Funde", hint: "Getrennt mit ; z. B. „Nebelfarn; 2 × Holz (Bündel); Wasserbeere 30 %; Holzvogel einmal“. Ohne % = sicherer Fund, einmal = nur einmal für die ganze Gruppe." }),
      proTag: new f.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 1, label: "Versuche pro Tag", hint: "Wie oft jede Figur hier pro Spieltag suchen darf. 0 = beliebig oft." }),
      vorrat: new f.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 6, label: "Vorrat pro Tag", hint: "So viele Stück gibt das Gebiet pro Spieltag her, für die ganze Gruppe zusammen. Danach ist es bis zum nächsten Tag abgeerntet. 0 = unbegrenzt. „einmal“-Funde zählen nicht mit." })
    };
  }
}

// „2 × Holz (Bündel)“, „Wasserbeere 30 %“, „Holzvogel einmal“ → { name, menge, chance, einmal }
export function fundeLesen(text) {
  return String(text ?? "").split(/[;\n]/).map((teil) => {
    let rest = teil.trim();
    if (!rest) return null;
    const einmal = /\beinmal\b/i.test(rest);
    rest = rest.replace(/\beinmal\b/i, "").trim();
    const chance = rest.match(/(\d+)\s*%/);
    rest = rest.replace(/(\d+)\s*%/, "").trim();
    const menge = rest.match(/^(\d+)\s*[×x]\s*/i);
    if (menge) rest = rest.slice(menge[0].length).trim();
    return rest ? { name: rest, menge: menge ? Number(menge[1]) : 1, chance: chance ? Math.min(Number(chance[1]), 100) : 100, einmal } : null;
  }).filter(Boolean);
}

function gebieteDer(scene) {
  const liste = [];
  for (const region of scene?.regions ?? []) {
    for (const behavior of region.behaviors) if (behavior.type === "sammeln" && !behavior.disabled) liste.push({ region, behavior });
  }
  return liste;
}

function mitteVon(tokenDoc) {
  const g = tokenDoc.parent?.grid?.size ?? canvas.grid?.size ?? 64;
  return { x: tokenDoc.x + (tokenDoc.width * g) / 2, y: tokenDoc.y + (tokenDoc.height * g) / 2, elevation: tokenDoc.elevation ?? 0 };
}

export function gebietVon(tokenDoc) {
  const punkt = mitteVon(tokenDoc);
  return gebieteDer(tokenDoc.parent).find(({ region }) => region.testPoint(punkt)) ?? null;
}

// Die eigene Figur in einem Sammelgebiet (ausgewählte zuerst)
function figurImGebiet() {
  const eigene = (canvas.tokens?.placeables ?? []).filter((t) => t.actor?.type === "character" && t.actor.isOwner && (!game.user.isGM || t.controlled));
  const sortiert = [...eigene.filter((t) => t.controlled), ...eigene.filter((t) => !t.controlled)];
  for (const token of sortiert) {
    const gebiet = gebietVon(token.document);
    if (gebiet) return { token, ...gebiet };
  }
  return null;
}

function gebietName(behavior) {
  return behavior.system?.name || behavior.parent?.name || "Sammelgebiet";
}

export function spieltag() {
  return zahl(game.settings.get(SYSTEM_ID, "spieltag")) || 1;
}

// GM: ein neuer Spieltag, alle dürfen wieder suchen
export async function neuerTag() {
  if (!game.user?.isGM) return;
  const tag = spieltag() + 1;
  await game.settings.set(SYSTEM_ID, "spieltag", tag);
  await ChatMessage.create({ content: `<div class="hlw-chat-card hlw-chat-kurz"><h2><i class="fa-solid fa-cloud-sun"></i> Tag ${tag} beginnt</h2><p>Ein neuer Morgen. In den Sammelgebieten ist wieder etwas nachgewachsen.</p></div>` });
  Hooks.callAll("hlwNeuerTag", tag);   // hlw-tageszeit.js stellt auf Morgen
}

export async function suchen() {
  const treffer = figurImGebiet();
  if (!treffer) return ui.notifications?.warn("Hier gibt es nichts zu suchen. Stell deine Figur in ein Sammelgebiet.");
  const { token, behavior } = treffer;
  const actor = token.actor;
  const daten = behavior.system;
  const ort = gebietName(behavior);

  // Vorrat des Gebiets für heute (ganze Gruppe) und Versuche pro Figur, Gebiet und Spieltag
  const tag = spieltag();
  const vorrat = zahl(daten.vorrat);
  const genommen = behavior.getFlag(SYSTEM_ID, "vorrat")?.tag === tag ? zahl(behavior.getFlag(SYSTEM_ID, "vorrat").genommen) : 0;
  let rest = vorrat > 0 ? Math.max(vorrat - genommen, 0) : Infinity;
  const vergebenVorher = behavior.getFlag(SYSTEM_ID, "vergeben") ?? [];
  const nurEinmalUebrig = fundeLesen(daten.funde).some((f) => f.einmal && !vergebenVorher.includes(f.name));
  if (rest <= 0 && !nurEinmalUebrig) return ui.notifications?.warn(`Am Ort „${ort}“ ist für heute alles abgeerntet. Morgen wächst wieder etwas nach.`);
  const stand = actor.getFlag(SYSTEM_ID, "suche");
  const heute = stand?.tag === tag ? (stand.gebiete ?? {}) : {};
  const versuche = zahl(heute[behavior.id]);
  if (daten.proTag > 0 && versuche >= daten.proTag) return ui.notifications?.warn(`${actor.name} hat heute schon am Ort „${ort}“ gesucht. Morgen wächst wieder etwas nach.`);
  if (stand?.tag !== tag) await actor.unsetFlag(SYSTEM_ID, "suche");
  await actor.setFlag(SYSTEM_ID, "suche", { tag, gebiete: { ...heute, [behavior.id]: versuche + 1 } });

  // Wurf
  const dc = zahl(daten.schwierigkeit);
  const skill = WORLD_SKILLS[daten.wurf]?.label ?? daten.wurf;
  let roll = null;
  let geschafft = true;
  let ueber = 0;
  if (dc > 0) {
    const wert = zahl(actor.system?.worldSkills?.[daten.wurf]?.total);
    roll = await new Roll(`1d20 + ${wert}`).evaluate();
    const natur = zahl(roll.dice?.[0]?.total);
    geschafft = natur === 20 || (natur !== 1 && roll.total >= dc);
    ueber = Math.max(roll.total - dc, 0);
  }

  // Funde
  const funde = [];
  const vergeben = behavior.getFlag(SYSTEM_ID, "vergeben") ?? [];
  const uebrig = fundeLesen(daten.funde).filter((f) => !(f.einmal && vergeben.includes(f.name)));
  if (geschafft) {
    for (const f of uebrig) {
      if (f.chance < 100 && Math.random() * 100 >= f.chance) continue;
      let menge = f.menge + (f.einmal || f.chance < 100 ? 0 : Math.floor(ueber / 5));
      if (!f.einmal) {
        menge = Math.min(menge, rest);
        rest -= menge;
      }
      if (menge > 0) funde.push({ ...f, menge });
    }
  }
  const erhalten = [];
  for (const f of funde) {
    const ok = await gegenstandDazu(actor, f.name, f.menge);
    if (ok) erhalten.push(f);
    else if (game.user.isGM) ui.notifications?.warn(`Sammelgebiet „${ort}“: „${f.name}“ gibt es nicht als Gegenstand.`);
  }

  const ergebnis = !geschafft ? "Nichts gefunden."
    : erhalten.length ? `Gefunden: ${erhalten.map((f) => `<b>${f.menge} × ${escapeHtml(f.name)}</b>`).join(", ")}`
    : !uebrig.length ? "Hier ist nichts mehr zu holen."
    : rest <= 0 ? "Für heute ist hier alles abgeerntet." : "Diesmal nichts gefunden.";
  const flavor = `Sucht am Ort „${escapeHtml(ort)}“ (${escapeHtml(skill)}) · ${ergebnis}`;
  if (roll) await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor });
  else await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="hlw-chat-card hlw-chat-kurz"><p>${flavor}</p></div>` });

  // GM merkt sich „einmal“-Funde und zählt die Funde im Almanach
  if (erhalten.length) {
    const meldung = { type: "sucheFund", sceneId: behavior.parent.parent.id, regionId: behavior.parent.id, behaviorId: behavior.id, tag, funde: erhalten.map(({ name, menge, einmal }) => ({ name, menge, einmal })) };
    if (game.users.activeGM?.isSelf) await sucheFundVerbuchen(meldung);
    else game.socket.emit(SOCKET, meldung);
  }
  sucheKnopf();
}

async function sucheFundVerbuchen(meldung) {
  const behavior = game.scenes.get(meldung.sceneId)?.regions.get(meldung.regionId)?.behaviors.get(meldung.behaviorId);
  const einmal = meldung.funde.filter((f) => f.einmal).map((f) => f.name);
  if (behavior && einmal.length) {
    const vergeben = behavior.getFlag(SYSTEM_ID, "vergeben") ?? [];
    await behavior.setFlag(SYSTEM_ID, "vergeben", [...new Set([...vergeben, ...einmal])]);
  }
  // Vorrat für heute verbuchen
  const menge = meldung.funde.filter((f) => !f.einmal).reduce((summe, f) => summe + zahl(f.menge), 0);
  if (behavior && menge) {
    const alt = behavior.getFlag(SYSTEM_ID, "vorrat");
    const genommen = alt?.tag === meldung.tag ? zahl(alt.genommen) : 0;
    await behavior.setFlag(SYSTEM_ID, "vorrat", { tag: meldung.tag, genommen: genommen + menge });
  }
  await almanachZaehlen(meldung.funde);
}

// Knopf „Suchen“ unten in der Mitte, solange die eigene Figur in einem Sammelgebiet steht
export function sucheKnopf() {
  let knopf = document.getElementById("hlw-suchen-knopf");
  const treffer = canvas.ready ? figurImGebiet() : null;
  if (!treffer) return knopf?.remove();
  if (!knopf) {
    knopf = document.createElement("button");
    knopf.id = "hlw-suchen-knopf";
    knopf.type = "button";
    knopf.addEventListener("click", () => suchen());
    document.body.appendChild(knopf);
  }
  knopf.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Suchen: ${escapeHtml(gebietName(treffer.behavior))}`;
}

// ---------- Almanach ----------

let katalogLaden = null;
let katalog = { natural: [], mineral: [] };
export function almanachKatalog() {
  const laden = (datei) => fetch(`systems/${SYSTEM_ID}/import/${datei}.json`).then((a) => (a.ok ? a.json() : [])).catch(() => []);
  const sortieren = (liste) => liste.map((e) => ({ name: e.name, img: e.img, type: e.type, system: e.system }))
    .sort((a, b) => RANG_FOLGE.indexOf(a.system?.rank) - RANG_FOLGE.indexOf(b.system?.rank) || a.name.localeCompare(b.name, "de"));
  katalogLaden ??= Promise.all([laden("natural"), laden("minerals")]).then(([pflanzen, mineralien]) => {
    katalog = { natural: sortieren(pflanzen), mineral: sortieren(mineralien) };
    return katalog;
  });
  return katalogLaden;
}

function almanachStand() {
  return game.settings.get(SYSTEM_ID, "almanach") ?? {};
}

export function almanachEintrag(name) {
  const e = almanachStand()[name] ?? {};
  return { offen: !!e.offen, funde: zahl(e.funde) };
}

function imKatalog(name) {
  return [...katalog.natural, ...katalog.mineral].find((e) => e.name === name) ?? null;
}

// GM: Einträge freischalten (neu entdeckt: kurze Chatkarte an alle)
export async function almanachFreischalten(namen, { offen = true, melden = true } = {}) {
  if (!game.user?.isGM) return;
  await almanachKatalog();
  const update = { ...almanachStand() };
  const geaendert = [];
  for (const name of namen) {
    if (!imKatalog(name)) continue;
    const alt = almanachEintrag(name);
    if (alt.offen === offen) continue;
    update[name] = { ...alt, offen };
    geaendert.push(name);
  }
  if (!geaendert.length) return;
  await game.settings.set(SYSTEM_ID, "almanach", update);
  const neu = offen ? geaendert : [];
  if (melden && neu.length) {
    await ChatMessage.create({ content: `<div class="hlw-chat-card hlw-chat-kurz"><h2>Almanach</h2><p>Neu eingetragen: <b>${neu.map(escapeHtml).join(", ")}</b>.</p></div>` });
  }
}

async function almanachZaehlen(funde) {
  if (!game.user?.isGM) return;
  await almanachKatalog();
  const stand = { ...almanachStand() };
  let geaendert = false;
  for (const f of funde) {
    if (!imKatalog(f.name)) continue;
    const alt = almanachEintrag(f.name);
    stand[f.name] = { ...alt, funde: alt.funde + zahl(f.menge) };
    geaendert = true;
  }
  if (geaendert) await game.settings.set(SYSTEM_ID, "almanach", stand);
}

// Bestehende Inventare (einmal): was die Spieler schon haben, steht im Almanach
export async function almanachAusInventaren() {
  if (!game.user?.isGM) return;
  const namen = game.actors.filter((a) => a.type === "character").flatMap((a) => a.items.filter((i) => ["natural", "mineral"].includes(i.type)).map((i) => i.name));
  await almanachFreischalten([...new Set(namen)], { melden: false });
}

const REITER = { natural: "Pflanzen", mineral: "Mineralien" };

export class HopeLiesWithinAlmanach extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "hlw-almanach",
    classes: ["hope-lies-within", "hlw-bestiarium", "hlw-almanach"],
    tag: "div",
    window: { title: "Almanach", icon: "fa-solid fa-seedling", resizable: true },
    position: { width: 820, height: 680 }
  };

  reiter = "natural";
  auswahl = null;
  suche = "";

  static oeffnen() {
    const app = foundry.applications.instances.get("hlw-almanach") ?? new HopeLiesWithinAlmanach();
    app.render({ force: true });
    return app;
  }

  async _renderHTML() {
    await almanachKatalog();
    const isGM = game.user?.isGM;
    const alle = katalog[this.reiter].map((e, i) => ({ ...e, ...almanachEintrag(e.name), nr: i + 1 }));
    const zaehler = Object.fromEntries(Object.keys(REITER).map((k) => [k, katalog[k].filter((e) => almanachEintrag(e.name).offen).length]));
    const suche = this.suche.trim().toLowerCase();
    const sichtbar = alle.filter((e) => !suche || ((isGM || e.offen) && e.name.toLowerCase().includes(suche)));
    if (!sichtbar.some((e) => e.name === this.auswahl)) this.auswahl = (sichtbar.find((e) => isGM || e.offen) ?? sichtbar[0])?.name ?? null;
    const liste = sichtbar.map((e) => {
      const zeigen = e.offen || isGM;
      return `<button type="button" class="bs-zeile ${e.offen ? "" : "is-unbekannt"} ${e.name === this.auswahl ? "is-aktiv" : ""}" data-al-name="${escapeHtml(e.name)}">
        <span class="bs-nr">${String(e.nr).padStart(2, "0")}</span>
        ${zeigen ? `<img src="${escapeHtml(e.img)}" alt="">` : `<i class="fa-solid fa-question"></i>`}
        <span class="bs-name">${escapeHtml(zeigen ? e.name : "???")}</span>
        ${e.funde ? `<span class="al-funde">${e.funde}×</span>` : ""}
      </button>`;
    }).join("");
    const gewaehlt = alle.find((e) => e.name === this.auswahl);
    return `
      <nav class="al-reiter">${Object.entries(REITER).map(([k, label]) => `<button type="button" data-al-reiter="${k}" class="${k === this.reiter ? "is-aktiv" : ""}">${label} <span>${zaehler[k]} / ${katalog[k].length}</span></button>`).join("")}</nav>
      <header class="bs-kopf">
        <input type="search" data-al-suche placeholder="Suchen …" value="${escapeHtml(this.suche)}">
        <span class="bs-zaehler">Tag ${spieltag()}</span>
        ${isGM ? `<button type="button" class="al-tag" data-al-neuer-tag title="Alle dürfen wieder suchen"><i class="fa-solid fa-sun"></i> Neuer Tag</button>` : ""}
      </header>
      <div class="bs-koerper">
        <nav class="bs-liste">${liste || `<p class="bs-leer">Nichts gefunden.</p>`}</nav>
        <section class="bs-detail">${gewaehlt ? this.detail(gewaehlt) : `<p class="bs-leer">Wählt links einen Eintrag.</p>`}</section>
      </div>`;
  }

  detail(e) {
    const isGM = game.user?.isGM;
    const s = e.system ?? {};
    const steuerung = isGM ? `
      <div class="bs-gm">
        <div class="bs-stufen">
          <button type="button" data-al-offen="0" class="${e.offen ? "" : "is-aktiv"}">Verdeckt</button>
          <button type="button" data-al-offen="1" class="${e.offen ? "is-aktiv" : ""}">Eingetragen</button>
        </div>
        <div class="bs-siege"><small>Spieler sehen gerade: ${e.offen ? "den ganzen Eintrag" : "nur „???“"}. Funde durch Suchen: ${e.funde}.</small></div>
      </div>` : "";
    if (!e.offen && !isGM) {
      return `<div class="bs-verdeckt"><i class="fa-solid fa-question"></i><p>Noch nicht entdeckt.</p><small>Findet, kauft oder bekommt es, dann steht es hier.</small></div>`;
    }
    return `
      ${steuerung}
      <div class="bs-titel">
        <img src="${escapeHtml(e.img)}" alt="" class="al-bild">
        <div>
          <h3>${escapeHtml(e.name)}</h3>
          <em>Nr. ${String(e.nr).padStart(2, "0")} · ${REITER[this.reiter]} · ${e.funde} × gefunden</em>
        </div>
      </div>
      <div class="bs-werte">
        <div class="bs-wert"><span>Rang</span><b>${escapeHtml(s.rank ?? "–")}</b></div>
        <div class="bs-wert"><span>Preis</span><b>${escapeHtml(s.price ?? "–")}</b></div>
      </div>
      ${s.description ? `<p>${escapeHtml(s.description)}</p>` : ""}
      ${s.source ? `<p><b>Fundorte:</b> ${escapeHtml(s.source)}</p>` : ""}`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    window.setTimeout(() => content.querySelector(".bs-zeile.is-aktiv")?.scrollIntoView({ block: "nearest" }), 0);
    content.querySelectorAll("[data-al-reiter]").forEach((knopf) => knopf.addEventListener("click", () => {
      this.reiter = knopf.dataset.alReiter;
      this.auswahl = null;
      this.render();
    }));
    content.querySelectorAll("[data-al-name]").forEach((knopf) => knopf.addEventListener("click", () => {
      this.auswahl = knopf.dataset.alName;
      this.render();
    }));
    const suche = content.querySelector("[data-al-suche]");
    suche?.addEventListener("input", foundry.utils.debounce(() => {
      this.suche = suche.value;
      this.render().then(() => {
        const feld = this.element.querySelector("[data-al-suche]");
        feld?.focus();
        feld?.setSelectionRange(feld.value.length, feld.value.length);
      });
    }, 250));
    content.querySelector("[data-al-neuer-tag]")?.addEventListener("click", () => neuerTag());
    content.querySelectorAll("[data-al-offen]").forEach((knopf) => knopf.addEventListener("click", () => {
      almanachFreischalten([this.auswahl], { offen: knopf.dataset.alOffen === "1" });
    }));
  }
}

// ---------- Kapitel 1: Quest-Gegenstände und Sammelgebiete ----------

const QUEST_GEGENSTAENDE = [
  { name: "Holzvogel", img: "icons/creatures/birds/songbird-yellow-flying.webp", description: "Ein kleiner geschnitzter Vogel. Tomas Vater hat ihn gemacht, als die Familie noch an der Grenze wohnte." },
  { name: "Glatter Flussstein", img: "icons/commodities/stone/boulder-grey-blue.webp", description: "Ein flacher, glatter Stein aus dem Lindbach. Toma sagt, er bringt Glück." },
  { name: "Kranz für den Wegstein", img: "icons/magic/nature/leaf-flower-wreath-glow-green-blue.webp", description: "Ein Kranz aus Saatwende-Blumen, gebunden von Bruder Aled. Er gehört an den alten Wegstein an der Straße nach Süden." }
];

export async function questGegenstaendeAnlegen() {
  if (!game.user?.isGM) return;
  const fehlend = QUEST_GEGENSTAENDE.filter((q) => !game.items.find((i) => i.name === q.name && i.getFlag(SYSTEM_ID, "questGegenstand")));
  if (!fehlend.length) return;
  const ordner = game.folders.find((f) => f.type === "Item" && f.name === "Kapitel 1 – Quest-Gegenstände")
    ?? await Folder.create({ name: "Kapitel 1 – Quest-Gegenstände", type: "Item" });
  await Item.createDocuments(fehlend.map((q) => ({
    name: q.name, type: "junk", img: q.img, folder: ordner.id,
    system: { rank: "E", tier: 1, priceSk: 0, price: "0 SK", description: q.description, source: "Kapitel 1, Lindhain", quantity: 1 },
    flags: { [SYSTEM_ID]: { questGegenstand: true } }
  })));
}

const GEBIETE_KAPITEL1 = [
  { szene: (s) => s.name === "Lindhain", name: "Lindbach", rechteck: [3470, 450, 320, 1110], wurf: "naturkunde", schwierigkeit: 12, funde: "Nebelfarn; Wasserbeere 30 %", proTag: 1, vorrat: 6 },
  { szene: (s) => s.name === "Lindhain", name: "Schilf am Mühlbach", rechteck: [3560, 2120, 340, 660], wurf: "scharfsinnigkeit", schwierigkeit: 12, funde: "Holzvogel einmal; Glatter Flussstein 25 %", proTag: 1, vorrat: 2 },
  { szene: (s) => s.name === "Lindhain", name: "Bretter an der Mühle", rechteck: [3000, 2830, 220, 400], wurf: "athletik", schwierigkeit: 0, funde: "Holz (Bündel)", proTag: 3, vorrat: 8 },
  { szene: (s) => s.getFlag(SYSTEM_ID, "weg") === "nord", name: "Waldrand", rechteck: [200, 2850, 1500, 650], wurf: "naturkunde", schwierigkeit: 15, funde: "Sternmoos; Leuchtbeere 25 %", proTag: 1, vorrat: 4 },
  { szene: (s) => s.getFlag(SYSTEM_ID, "weg") === "nord", name: "Umgestürzte Stämme", rechteck: [2350, 1100, 750, 600], wurf: "athletik", schwierigkeit: 15, funde: "Holz (Bündel)", proTag: 2, vorrat: 6 },
  { szene: (s) => s.getFlag(SYSTEM_ID, "weg") === "west", name: "Alte Scheune", rechteck: [450, 2000, 1400, 1450], wurf: "scharfsinnigkeit", schwierigkeit: 8, funde: "3 × Kohle (Sack) einmal; Holz (Bündel) 30 %", proTag: 1, vorrat: 3 }
];

// Legt die Sammelgebiete aus Kapitel 1 an, einmal pro Szene (beim GM-Start; neue Szenen bekommen sie beim nächsten Start).
// Danach gehören sie dem GM: verschieben, ändern oder löschen, sie kommen nicht wieder. Mit { neu: true } erneut anlegen.
export async function sammelgebieteAnlegen({ neu = false } = {}) {
  if (!game.user?.isGM) return;
  const erledigt = new Set();
  for (const g of GEBIETE_KAPITEL1) {
    for (const scene of game.scenes.filter(g.szene)) {
      erledigt.add(scene);
      if (!neu && scene.getFlag(SYSTEM_ID, "sammelgebiete")) continue;
      if (scene.regions.some((r) => r.getFlag(SYSTEM_ID, "sammelgebiet") === g.name)) continue;
      const [x, y, width, height] = g.rechteck;
      const level = scene.initialLevel?.id ?? scene.firstLevel?.id;
      await scene.createEmbeddedDocuments("Region", [{
        name: `Sammelgebiet: ${g.name}`,
        color: "#2fe05a",
        visibility: CONST.REGION_VISIBILITY.GAMEMASTER,   // der GM sieht Sammelgebiete immer, Spieler nie
        shapes: [{ type: "rectangle", x, y, width, height }],
        ...(level ? { levels: [level] } : {}),
        flags: { [SYSTEM_ID]: { sammelgebiet: g.name } },
        behaviors: [{ name: "Sammelgebiet", type: "sammeln", system: { name: g.name, wurf: g.wurf, schwierigkeit: g.schwierigkeit, funde: g.funde, proTag: g.proTag, vorrat: g.vorrat } }]
      }]);
    }
  }
  for (const scene of erledigt) if (!scene.getFlag(SYSTEM_ID, "sammelgebiete")) await scene.setFlag(SYSTEM_ID, "sammelgebiete", true);
}

// Region nur sichtbar, solange das Regionen-Werkzeug aktiv ist (Foundry-Standard)
function nurImWerkzeug(region) {
  return [CONST.REGION_VISIBILITY.LAYER, CONST.REGION_VISIBILITY.LAYER_UNLOCKED].includes(region?.visibility);
}

// Bestehende Welten (einmal): Sammelgebiete für den GM sichtbar, Vorrat pro Tag eintragen, Leuchtbeere statt Schattenpilz
export async function sammelgebieteNachruesten() {
  if (!game.user?.isGM) return;
  for (const scene of game.scenes) {
    for (const region of scene.regions) {
      const behaviors = region.behaviors.filter((b) => b.type === "sammeln");
      if (!behaviors.length) continue;
      if (nurImWerkzeug(region)) await region.update({ visibility: CONST.REGION_VISIBILITY.GAMEMASTER });
      if (region.getFlag(SYSTEM_ID, "sammelgebiet") && region.color?.toString() === "#5fae5a") await region.update({ color: "#2fe05a" });
      const vorlage = GEBIETE_KAPITEL1.find((g) => g.name === region.getFlag(SYSTEM_ID, "sammelgebiet"));
      if (!vorlage) continue;
      for (const behavior of behaviors) {
        const update = { "system.vorrat": vorlage.vorrat };
        if (behavior.system.funde === "Sternmoos; Schattenpilz 25 %") update["system.funde"] = vorlage.funde;
        await behavior.update(update);
      }
    }
  }
}

// ---------- Anmeldung ----------

// In init: Regionsverhalten „Sammelgebiet“ und Einstellungen
export function registerSammeln() {
  CONFIG.RegionBehavior.dataModels.sammeln = SammelgebietDaten;
  CONFIG.RegionBehavior.typeLabels.sammeln = "Sammelgebiet";
  CONFIG.RegionBehavior.typeIcons.sammeln = "fa-solid fa-seedling";
  game.settings.register(SYSTEM_ID, "spieltag", { scope: "world", config: false, type: Number, default: 1, onChange: () => foundry.applications.instances.get("hlw-almanach")?.render() });
  game.settings.register(SYSTEM_ID, "almanach", { scope: "world", config: false, type: Object, default: {}, onChange: () => foundry.applications.instances.get("hlw-almanach")?.render() });

  // Knopf „Suchen“ ein- und ausblenden
  const knopfPruefen = () => window.setTimeout(() => sucheKnopf(), 50);   // nach dem Update, auch in Hintergrund-Tabs
  Hooks.on("canvasReady", knopfPruefen);
  Hooks.on("controlToken", knopfPruefen);
  Hooks.on("updateToken", knopfPruefen);
  Hooks.on("createToken", knopfPruefen);
  Hooks.on("deleteToken", knopfPruefen);
  Hooks.on("updateRegion", knopfPruefen);
  Hooks.on("createRegionBehavior", knopfPruefen);
  // Selbst gezeichnete Sammelgebiete: der GM sieht sie immer (Foundry zeigt Regionen sonst nur im Regionen-Werkzeug)
  Hooks.on("createRegionBehavior", (behavior) => {
    const region = behavior.parent;
    if (behavior.type !== "sammeln" || !game.users.activeGM?.isSelf || !nurImWerkzeug(region)) return;
    region.update({ visibility: CONST.REGION_VISIBILITY.GAMEMASTER });
  });
  Hooks.on("updateRegionBehavior", knopfPruefen);
  Hooks.on("deleteRegionBehavior", knopfPruefen);

  // Almanach: Bekommt ein Spielercharakter eine Pflanze oder ein Mineral (egal wie), ist es entdeckt
  Hooks.on("createItem", (item) => {
    if (!game.users.activeGM?.isSelf || item.parent?.type !== "character" || !["natural", "mineral"].includes(item.type)) return;
    almanachFreischalten([item.name]);
  });

  Hooks.once("ready", () => {
    almanachKatalog();
    game.socket.on(SOCKET, (data) => {
      if (data?.type === "sucheFund" && game.users.activeGM?.isSelf) sucheFundVerbuchen(data);
    });
  });
}
