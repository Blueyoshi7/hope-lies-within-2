// NSC: Level, Wertpunkte nach Schwerpunkt, Ausstattung der Lindhain-NSC, Handel und Quests.
// NSC rechnen mit denselben Regeln wie Spielercharaktere (Punkte pro Level, abgeleitete Werte, Waffen, Skills),
// damit sie kämpfen können, falls die Gruppe das Dorf angreift.

import { ATTRS, verteiltePunkte, klasseVorschlag, kes } from "./hlw-regeln.js";

const SYSTEM_ID = "hope-lies-within-2";
const SKILL_TYPEN = ["playerSkill", "classSkill"];

// Klassenliste kommt aus hlw.js (data/klassen.json), damit die Klasse aus den Werten folgt wie bei Spielern.
let KLASSEN = [];
export function setzeKlassen(klassen) {
  KLASSEN = klassen ?? [];
}

// Gewichte je Wert: str, dex, con, int, wis, cha, agl, spe, edu, sou
export const SCHWERPUNKTE = {
  zivil: { label: "Dorfbewohner", gewichte: { cha: 2, edu: 2, wis: 1, con: 1, spe: 1, agl: 1 } },
  handwerk: { label: "Handwerker", gewichte: { str: 3, con: 3, dex: 2, edu: 1 } },
  kampf: { label: "Kämpfer / Wache", gewichte: { str: 3, con: 3, dex: 1, agl: 1, spe: 1 } },
  fern: { label: "Schütze / Jäger", gewichte: { dex: 3, agl: 3, spe: 1, wis: 1 } },
  magie: { label: "Magier", gewichte: { int: 3, sou: 2, edu: 2, wis: 1 } },
  heil: { label: "Heiler / Priester", gewichte: { wis: 3, sou: 3, cha: 1, int: 1 } },
  kundschaft: { label: "Kundschafter", gewichte: { agl: 2, spe: 2, dex: 2, wis: 1, cha: 1 } }
};

// Punkte des Levels nach Gewichten verteilen (größter Rest zuerst). Jeder Wert startet bei 1, Deckel 25.
export function nscAttribute(level, schwerpunkt) {
  const gewichte = SCHWERPUNKTE[schwerpunkt]?.gewichte ?? SCHWERPUNKTE.zivil.gewichte;
  const summe = Object.values(gewichte).reduce((a, b) => a + b, 0);
  const punkte = verteiltePunkte(level);
  const werte = Object.fromEntries(ATTRS.map((k) => [k, 1]));
  const anteile = ATTRS.map((k) => ({ k, roh: (punkte * (gewichte[k] ?? 0)) / summe }));
  let rest = punkte;
  for (const a of anteile) {
    const ganz = Math.floor(a.roh);
    werte[a.k] += ganz;
    rest -= ganz;
  }
  for (const a of anteile.sort((x, y) => (y.roh % 1) - (x.roh % 1))) {
    if (rest <= 0) break;
    if (!(gewichte[a.k] > 0)) continue;
    werte[a.k] += 1;
    rest -= 1;
  }
  for (const k of ATTRS) werte[k] = Math.min(werte[k], 25);
  return werte;
}

export async function nscWerteSetzen(actor, { level, schwerpunkt, attribute } = {}) {
  const lvl = Math.max(Math.floor(Number(level) || actor.system?.progression?.level || 1), 1);
  const werte = attribute ?? nscAttribute(lvl, schwerpunkt);
  const update = { "system.progression.level": lvl, "system.progression.classAuto": true };
  for (const k of ATTRS) update[`system.attributes.${k}.value`] = werte[k] ?? 1;
  const probe = foundry.utils.deepClone(actor.system);
  for (const k of ATTRS) probe.attributes[k].value = werte[k] ?? 1;
  update["system.progression.class"] = klasseVorschlag(probe, KLASSEN)?.name ?? "";
  update[`flags.${SYSTEM_ID}.schwerpunkt`] = schwerpunkt ?? "";
  await actor.update(update);
  // Nach dem Neuberechnen auf volle HP setzen
  await actor.update({ "system.resources.hp.value": actor.system?.resources?.hp?.max ?? 1 });
}

// ---------- Daten aus den Import-Listen (Waffen, Skills, Waren) ----------

const IMPORT_DATEIEN = ["weapons", "armor", "accessories", "equipment", "consumables", "food-drink", "natural", "materials", "minerals", "junk", "skills"];
let importCache = null;

async function importListe() {
  if (importCache) return importCache;
  const listen = await Promise.all(IMPORT_DATEIEN.map(async (datei) => {
    try {
      const antwort = await fetch(`systems/${SYSTEM_ID}/import/${datei}.json`);
      return antwort.ok ? await antwort.json() : [];
    } catch {
      return [];
    }
  }));
  importCache = new Map();
  for (const eintrag of listen.flat()) if (eintrag?.name && !importCache.has(eintrag.name)) importCache.set(eintrag.name, eintrag);
  return importCache;
}

async function itemDaten(name, extra = {}) {
  const daten = (await importListe()).get(name) ?? game.items?.getName(name)?.toObject();
  if (!daten) {
    console.warn(`HLW | NSC-Ausstattung: „${name}“ nicht gefunden.`);
    return null;
  }
  // Nur Name, Typ, Bild und Werte übernehmen: „folder“ aus den Import-Listen ist ein Ordnername, keine ID, und lässt das Anlegen scheitern.
  const item = { name: daten.name, type: daten.type, img: daten.img, system: foundry.utils.deepClone(daten.system ?? {}) };
  return foundry.utils.mergeObject(item, extra);
}

// ---------- Lindhain: Werte, Ausrüstung, Waren und Quests ----------
// Alles Vorschläge, frei änderbar. Keine GM-Geheimnisse (öffentlicher Code).

const LINDHAIN_WERTE = {
  "Kessa Dorn": {
    bausteine: [["gruss", "Ah, noch ein Gesicht fürs Fest! Ich bin von der Gilde, keine Angst."], ["gruss", "Na, neugierig auf den Kristall?"], ["abschied", "Wir sehen uns unter der Linde."], ["abschied", "Die Gilde vergisst niemanden, der hilft."]],
    level: 12, schwerpunkt: "kundschaft", kes: 300, waffe: "Eisenschwert", skills: ["Doppelstoß"],
    quests: [{ titel: "Die Prüfung am Fest", rang: "F", belohnung: "Ein Platz an einer Schule in Illmaris (Gildenstipendium)", text: "Zum Saatwendefest prüfe ich jedes Kind mit diesem Kristall. Leuchtet er, wartet in Illmaris ein Platz an einer Schule der Gilde. Stell dich einfach in die Reihe unter der Linde." }]
  },
  "Mira Holm": {
    bausteine: [["gruss", "Kind, du bist ja groß geworden!"], ["gruss", "Komm rein, aber putz dir die Füße ab."], ["abschied", "Pass auf dich auf, hörst du?"], ["abschied", "Geh mit dem Licht, Kind."]],
    level: 4, schwerpunkt: "zivil", kes: 80, waffe: "Holz-Kampfstab (2 Händer)",
    quests: [{ titel: "Bänke für die Saatwende", rang: "F", belohnung: "10 SK und ein Platz in der ersten Reihe", text: "Für das Fest brauchen wir Bänke und Girlanden auf dem Dorfplatz. Die Bretter liegen hinter der Mühle. Wer mir hilft, sitzt beim Tanz in der ersten Reihe." }]
  },
  "Hanne Brook": {
    bausteine: [["gruss", "Willkommen im Lindenblatt! Setzt euch, setzt euch!"], ["gruss", "Na, ihr seht hungrig aus!"], ["handel", "Suppe gibt's für drei Silber, Brot obendrauf."], ["abschied", "Kommt bald wieder, die Suppe wartet!"]],
    level: 3, schwerpunkt: "zivil", kes: 120, waffe: "Holzkeule",
    handel: { kauft: ["foodDrink", "natural"], ankauf: 40, andere: 0, verkauf: 100 },
    waren: [["Sonnenkornbrot", 10], ["Nebeltraum-Suppe", 8], ["Schattenfeuer-Eintopf", 4], ["Windgrass-Bier", 12], ["Proviant (1 Tagesration)", 10], ["Kerzen (5 Stück)", 4]],
    quests: [{ titel: "Ratten im Keller", rang: "F", belohnung: "15 SK und eine Woche freies Essen", text: "Irgendwas frisst mir die Vorräte im Keller weg. Ratten, so groß wie Katzen! Wer den Keller freiräumt, isst eine Woche lang umsonst bei mir." }]
  },
  "Jorun Feldt": {
    bausteine: [["gruss", "Mach die Tür zu, die Esse braucht die Wärme."], ["gruss", "Was brauchst du? Und fass nichts Heißes an."], ["handel", "Gute Arbeit hat ihren Preis."], ["abschied", "Bring's zurück, wenn's stumpf wird."]],
    level: 8, schwerpunkt: "handwerk", kes: 400, waffe: "Kampfhammer (2 Händer)",
    handel: { kauft: ["weapon", "armor", "material", "mineral"], ankauf: 50, andere: 0, verkauf: 110 },
    waren: [["Holzkeule", 2], ["Bronze Dolch", 2], ["Holzbogen", 1], ["Holzpfeile (20 Stück)", 4], ["Holzschild", 2], ["Lederhelm", 2], ["Lederstiefel", 2], ["Jagdmesser", 2], ["Wetzstein", 6]],
    quests: [{ titel: "Kohle für die Esse", rang: "F", belohnung: "20 SK und ein Wetzstein", text: "Meine Esse frisst Kohle wie ein Drache. Hol mir drei Säcke vom Köhler am Waldrand, aber bleib auf dem Weg. Den Wald betritt man nicht." }]
  },
  "Oma Wendel": {
    bausteine: [["gruss", "Ach, Besuch! Komm, setz dich zu mir, Kind."], ["handel", "Gegen fast alles ist ein Kraut gewachsen."], ["abschied", "Und iss genug, du bist viel zu dünn."]],
    level: 9, schwerpunkt: "heil", kes: 150, waffe: "Holz-Kampfstab (2 Händer)", skills: ["Kleine Heilung"],
    handel: { kauft: ["natural", "consumable"], ankauf: 40, andere: 5, verkauf: 100 },
    waren: [["Verband", 10], ["Heilkräutersalbe (Nebelfarn)", 6], ["Gegengift", 2], ["Kleiner Heiltrank", 2], ["Nebelfarn", 8], ["Sternmoos", 2]],
    quests: [{ titel: "Nebelfarn am Lindbach", rang: "F", belohnung: "Zwei Heilkräutersalben", text: "Meine Augen sind nicht mehr die besten, Kind. Am Lindbach wächst Nebelfarn, fünf Wedel brauche ich. Pflück nur die mit den silbrigen Spitzen (Naturkunde 12)." }]
  },
  "Bruder Aled": {
    bausteine: [["gruss", "Das Licht sei mit dir."], ["gruss", "Was bedrückt dich, mein Kind?"], ["abschied", "Geh in Frieden und im Gleichgewicht."]],
    level: 10, schwerpunkt: "heil", kes: 40, waffe: "Gilden Zauberstab", skills: ["Kleine Heilung", "Heiliger Schlag"]
  },
  "Hauptmann Rell": {
    bausteine: [["gruss", "Halt. Was wollt ihr hier oben?"], ["sonst", "Keinen Schritt weiter in den Wald."], ["abschied", "Und jetzt zurück ins Dorf."]],
    level: 14, schwerpunkt: "kampf", kes: 200, waffe: "Eisenschwert", schild: "Holzschild", skills: ["Schwung des Krieger", "Erweiterte Verteidigung"],
    quests: [{ titel: "Proviant für den Posten", rang: "F", belohnung: "10 SK", text: "Meine Leute am Waldrand warten auf Brot und Bier aus dem Lindenblatt. Bring es hoch zum Wachturm, und keinen Schritt weiter in den Wald." }]
  },
  "Toma": {
    bausteine: [["gruss", "Hey! Seid ihr Abenteurer? Echte?"], ["sonst", "Darf ich mitkommen? Bitte!"], ["abschied", "Wartet! Nehmt mich das nächste Mal mit!"]],
    level: 1, schwerpunkt: "kundschaft", kes: 2,
    quests: [{ titel: "Der Holzvogel", rang: "F", belohnung: "Tomas Dank und ein glatter Flussstein", text: "Ich hab meinen Holzvogel am Mühlbach verloren! Papa hat ihn geschnitzt, als wir noch an der Grenze gewohnt haben. Hilfst du mir suchen?" }]
  }
};

export function lindhainWerte(name) {
  return LINDHAIN_WERTE[name] ?? null;
}

function bausteineAus(werte) {
  return (werte?.bausteine ?? []).map(([art, text]) => ({ id: foundry.utils.randomID(), art, text }));
}

// Textbausteine für Lindhain-NSC nachtragen, die vor v0.9.0 ausgestattet wurden (eigene Bausteine bleiben).
export async function lindhainBausteine() {
  for (const actor of game.actors.filter((a) => a.type === "npc" && LINDHAIN_WERTE[a.name])) {
    if (Array.isArray(actor.getFlag(SYSTEM_ID, "talk")?.bausteine)) continue;
    await actor.update({ [`flags.${SYSTEM_ID}.talk.bausteine`]: bausteineAus(LINDHAIN_WERTE[actor.name]) });
  }
}

// Händler-Einstellungen für Lindhain nachtragen (Welten vor v0.10.0; eigene Einstellungen bleiben).
export async function lindhainHandel() {
  for (const actor of game.actors.filter((a) => a.type === "npc" && LINDHAIN_WERTE[a.name]?.handel)) {
    if (actor.getFlag(SYSTEM_ID, "talk")?.handel) continue;
    await actor.update({ [`flags.${SYSTEM_ID}.talk.handel`]: LINDHAIN_WERTE[actor.name].handel });
  }
}

export async function nscAusstatten(actor, werte) {
  if (!actor || !werte) return;
  await nscWerteSetzen(actor, { level: werte.level, schwerpunkt: werte.schwerpunkt });
  const neu = [];
  const vorhanden = new Set(actor.items.map((i) => i.name));
  if (werte.waffe && !vorhanden.has(werte.waffe)) neu.push(await itemDaten(werte.waffe, { system: { equipped: true } }));
  if (werte.schild && !vorhanden.has(werte.schild)) neu.push(await itemDaten(werte.schild, { system: { equipped: true } }));
  for (const name of werte.skills ?? []) {
    if (!vorhanden.has(name)) neu.push(await itemDaten(name, { system: { learned: true } }));
  }
  for (const [name, anzahl] of werte.waren ?? []) {
    if (!vorhanden.has(name)) neu.push(await itemDaten(name, { system: { quantity: anzahl, equipped: false } }));
  }
  const liste = neu.filter(Boolean);
  if (liste.length) await actor.createEmbeddedDocuments("Item", liste);
  const talk = actor.getFlag(SYSTEM_ID, "talk") ?? {};
  const update = { "system.resources.kes.value": werte.kes ?? 0 };
  if (!talk.handel && werte.handel) update[`flags.${SYSTEM_ID}.talk.handel`] = werte.handel;
  if (!Array.isArray(talk.bausteine)) {
    update[`flags.${SYSTEM_ID}.talk.bausteine`] = bausteineAus(werte);
  }
  if (!Array.isArray(talk.quests) || !talk.quests.length) {
    update[`flags.${SYSTEM_ID}.talk.quests`] = (werte.quests ?? []).map((q) => ({ id: foundry.utils.randomID(), status: "verborgen", ...q }));
  }
  await actor.update(update);
}

// Bestehende Lindhain-NSC einmalig ausstatten (für Welten, in denen Lindhain schon vor v0.8.0 angelegt wurde).
export async function lindhainAusstatten({ alle = false } = {}) {
  let anzahl = 0;
  for (const actor of game.actors.filter((a) => a.type === "npc" && LINDHAIN_WERTE[a.name])) {
    if (!alle && actor.getFlag(SYSTEM_ID, "ausgestattet")) continue;
    await nscAusstatten(actor, LINDHAIN_WERTE[actor.name]);
    await actor.setFlag(SYSTEM_ID, "ausgestattet", true);
    anzahl += 1;
  }
  return anzahl;
}

// ---------- Handel ----------
// Jeder Händler hat Einstellungen am NSC (flags.talk.handel):
//   verkauf: Verkaufspreis in % vom Marktwert (Standard 100)
//   kauft:   Warenarten, die er ankauft (Standard: die Arten, die er selbst anbietet)
//   ankauf:  was er für diese Arten zahlt, in % vom Marktwert (Standard 40, wie im Marktsystem)
//   andere:  was er für alle anderen Waren zahlt (Standard 0 = kauft er nicht)
// Angekaufte Ware landet in seinem Angebot und wird wieder zum Verkaufspreis angeboten.

export const WAREN_ARTEN = {
  weapon: "Waffen", armor: "Rüstung", accessory: "Schmuck", equipment: "Ausrüstung", consumable: "Verbrauchsgüter",
  foodDrink: "Essen & Trinken", natural: "Pflanzen & Ernte", material: "Materialien", mineral: "Minerale", junk: "Kram"
};

function zahlOder(wert, standard) {
  const z = Number(wert);
  return wert === "" || wert === null || wert === undefined || !Number.isFinite(z) ? standard : Math.max(z, 0);
}

export function istWare(item) {
  return !SKILL_TYPEN.includes(item.type) && !item.system?.equipped && Number(item.system?.quantity ?? 1) > 0;
}

export function handelVon(actor) {
  const h = actor?.getFlag(SYSTEM_ID, "talk")?.handel ?? {};
  const eigeneArten = [...new Set((actor?.items ?? []).filter((i) => istWare(i)).map((i) => i.type))];
  return {
    verkauf: zahlOder(h.verkauf, 100),
    ankauf: zahlOder(h.ankauf, 40),
    andere: zahlOder(h.andere, 0),
    kauft: Array.isArray(h.kauft) ? h.kauft : eigeneArten
  };
}

// Handelt der NSC überhaupt (hat Waren oder kauft etwas an)?
export function istHaendler(actor) {
  const h = handelVon(actor);
  return actor.items.some((i) => istWare(i)) || (h.kauft.length > 0 && h.ankauf > 0) || h.andere > 0;
}

function marktwert(item) {
  return Math.max(Math.round(Number(item.system?.priceSk) || 0), 0);
}

// Verkaufspreis des NSC: fester Preis, falls der GM einen gesetzt hat, sonst Marktwert × Verkaufs-%.
export function preisVon(item, nsc = item.parent) {
  const fest = item.getFlag?.(SYSTEM_ID, "preis");
  if (fest !== undefined && fest !== null && fest !== "") return Math.max(Math.round(Number(fest) || 0), 0);
  const wert = marktwert(item);
  return wert > 0 ? Math.max(Math.round((wert * handelVon(nsc).verkauf) / 100), 1) : 0;
}

export function ankaufProzent(item, nsc) {
  const h = handelVon(nsc);
  return h.kauft.includes(item.type) ? h.ankauf : h.andere;
}

export function ankaufVon(item, nsc) {
  const wert = marktwert(item);
  const prozent = ankaufProzent(item, nsc);
  return wert > 0 && prozent > 0 ? Math.max(Math.floor((wert * prozent) / 100), 1) : 0;
}

function kesVon(actor) {
  return Math.max(Number(actor.system?.resources?.kes?.value) || 0, 0);
}

async function stueckAbgeben(actor, item) {
  const menge = Number(item.system?.quantity ?? 1);
  if (menge > 1) await item.update({ "system.quantity": menge - 1 });
  else await item.delete();
}

async function stueckAufnehmen(actor, item, menge = 1) {
  const gleich = actor.items.find((i) => i.name === item.name && i.type === item.type && !i.system?.equipped);
  if (gleich) return gleich.update({ "system.quantity": Number(gleich.system?.quantity ?? 1) + menge });
  const system = foundry.utils.deepClone(item.system?.toObject?.() ?? item.system ?? {});
  system.quantity = menge;
  system.equipped = false;
  return actor.createEmbeddedDocuments("Item", [{ name: item.name, type: item.type, img: item.img, system }]);
}

// Läuft beim GM. Gibt einen Text für den Gesprächsverlauf zurück oder wirft einen Fehlertext.
export async function kaufen(nsc, kaeufer, itemId) {
  const item = nsc.items.get(itemId);
  if (!item || !istWare(item)) throw new Error("Diese Ware gibt es nicht mehr.");
  const preis = preisVon(item, nsc);
  if (kesVon(kaeufer) < preis) throw new Error(`${kaeufer.name} hat nicht genug Kes (${kes(preis)} nötig).`);
  await stueckAufnehmen(kaeufer, item);
  await stueckAbgeben(nsc, item);
  await kaeufer.update({ "system.resources.kes.value": kesVon(kaeufer) - preis });
  await nsc.update({ "system.resources.kes.value": kesVon(nsc) + preis });
  return `${kaeufer.name} kauft ${item.name} für ${kes(preis)}.`;
}

export async function verkaufen(nsc, verkaeufer, itemId) {
  const item = verkaeufer.items.get(itemId);
  if (!item || !istWare(item)) throw new Error("Diesen Gegenstand gibt es nicht mehr.");
  const preis = ankaufVon(item, nsc);
  if (!preis) throw new Error(`${nsc.name} kauft so etwas nicht.`);
  if (kesVon(nsc) < preis) throw new Error(`${nsc.name} hat nicht genug Kes in der Kasse (${kes(preis)} nötig).`);
  await stueckAufnehmen(nsc, item);
  await stueckAbgeben(verkaeufer, item);
  await verkaeufer.update({ "system.resources.kes.value": kesVon(verkaeufer) + preis });
  await nsc.update({ "system.resources.kes.value": kesVon(nsc) - preis });
  return `${verkaeufer.name} verkauft ${item.name} für ${kes(preis)}.`;
}

// GM: Ware aus allen Gegenständen des Spiels suchen (Import-Listen und Gegenstände der Welt).
export async function warenSuche(text, max = 30) {
  const worte = String(text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!worte.length) return [];
  const treffer = new Map();
  const pruefen = (eintrag) => {
    if (!eintrag?.name || !WAREN_ARTEN[eintrag.type] || treffer.has(eintrag.name)) return;
    const suchtext = `${eintrag.name} ${WAREN_ARTEN[eintrag.type]}`.toLowerCase();
    if (worte.every((w) => suchtext.includes(w))) treffer.set(eintrag.name, { name: eintrag.name, type: eintrag.type, img: eintrag.img, system: eintrag.system });
  };
  // Zuerst die Kanon-Listen (mit Marktwert), dann eigene Gegenstände der Welt
  for (const eintrag of (await importListe()).values()) pruefen(eintrag);
  for (const item of game.items ?? []) pruefen(item.toObject());
  return [...treffer.values()].slice(0, max);
}

export async function wareHinzufuegen(nsc, name, menge = 1) {
  const daten = (await importListe()).get(name) ?? game.items?.getName(name)?.toObject();
  if (!daten) return;
  await stueckAufnehmen(nsc, { name: daten.name, type: daten.type, img: daten.img, system: daten.system }, menge);
}
