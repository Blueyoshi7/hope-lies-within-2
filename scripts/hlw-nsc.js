// NSC: Level, Wertpunkte nach Schwerpunkt, Ausstattung der Lindhain-NSC, Handel und Quests.
// NSC rechnen mit denselben Regeln wie Spielercharaktere (Punkte pro Level, abgeleitete Werte, Waffen, Skills),
// damit sie kämpfen können, falls die Gruppe das Dorf angreift.

import { ATTRS, verteiltePunkte, klasseVorschlag, kes } from "./hlw-regeln.js";
import { kristallInfo } from "./hlw-kristalle.js";

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

// Kessa Dorn, Werberin der Gilde: Sie ist wegen der Saatwende in Lindhain und sucht junge Leute mit der Fähigkeit,
// um sie nach Illmaris an die Schulen der Gilde zu bringen. Drei Lektionen zeigen den Spielern die Regeln,
// die Hauptquest führt ins nächste Kapitel (Abreise in einer Woche).
const QUEST_ILLMARIS = {
  titel: "Ein Platz in Illmaris", rang: "F",
  belohnung: "Ein Platz an einer Schule der Gilde in Illmaris und die Reise dorthin mit Kessa (nächstes Kapitel)",
  text: "Ich bin wegen der Saatwende hier, so wie jedes Jahr in einem anderen Dorf. Die Gilde sucht junge Leute mit der Fähigkeit, und Feste sind die beste Gelegenheit, sie alle auf einem Platz zu finden.\nWer den Kern in sich trägt, bringt diesen Kristall zum Leuchten. Für den gibt es einen Platz an unseren Schulen in Illmaris: Dort bereiten wir euch auf ein Leben für die Gilde vor, als Abenteurer.\nWenn ihr wollt: In einer Woche reise ich ab. Wer mitkommen will, steht bei Sonnenaufgang am Südtor."
};
const KESSA_LEKTIONEN = [
  { titel: "Erste Lektion: Der Kampf", rang: "F", belohnung: "10 SK und 1 × Kleiner Heiltrank pro Person", text: "Bevor ich jemanden mitnehme, will ich sehen, wie er sich bewegt. Hinter dem Schrein stehen meine Strohpuppen.\nZeigt mir, was ihr könnt: Jeder von euch hat in seinem Zug eine Aktion, eine Schnellaktion und seine Bewegung, dazu eine Reaktion bis zum nächsten Zug. Probiert alles aus, ich erkläre euch den Rest." },
  { titel: "Zweite Lektion: EXP-Kristalle", rang: "F", belohnung: "Kessa zahlt für den ersten Kristall das Doppelte", text: "Habt ihr schon einmal ein Monster besiegt? Dann habt ihr bestimmt einen Kristall bekommen. Bringt mir einen, dann erkläre ich euch, was ihr damit machen könnt.\nVerwenden, weitergeben oder an die Gilde verkaufen, alles hat seinen Preis. Und von den violetten lasst ihr besser die Finger." },
  { titel: "Dritte Lektion: Skill-Orbs", rang: "F", belohnung: "1 × Skill-Orb T1 pro Person", text: "Seht ihr diese Kugeln? Skill-Orbs. In jeder steckt eine Fähigkeit, aber welche, verrät sie erst, wenn man sie untersucht. Manchmal hat man Glück, manchmal nicht.\nJeder von euch bekommt einen. Untersucht ihn, und wenn ihr Platz habt, lernt den Skill. So fängt jeder Abenteurer an." }
];

// Hauptquests: Rell baut mit den Spielern ein Tor am Waldrand und kann dann ins Dorf; danach können die Wachen im Süden
// nach dem Händler Tamm suchen, der vom Keiler angegriffen wurde (Gerolds Keiler).
const QUEST_TOR = {
  titel: "Ein Tor für den Waldrand", rang: "E", haupt: true,
  belohnung: "40 SK, und Rell kann seinen Posten oben verlassen",
  text: "Solange der Weg in den Wald offen ist, steh ich hier oben fest. Und unten auf der Südstraße stehen meine zwei Leute allein.\nIch brauch einen Zaun quer über den Weg und ein Tor, das man schließen kann. Stämme liegen am Waldrand, Bretter hat die Mühle. Holt das Holz und baut mir das Ding.\nSteht das Tor, kann ich runter ins Dorf, und einer von den Wachen im Süden bekommt endlich frei."
};
const QUEST_HAENDLER = {
  titel: "Der Händler kommt nicht", rang: "E", haupt: true,
  belohnung: "40 SK aus der Wachkasse, dazu Tamms Dank: 2 × Kleiner Heiltrank",
  text: "Jetzt, wo der Hauptmann wieder unten ist, kann endlich einer von uns los. Jedes Jahr zur Saatwende kommt der Händler Tamm mit seinem Karren aus Illmaris, und gestern hätte er da sein sollen.\nIch bleib am Tor. Lene geht mit euch die Straße runter, vielleicht bis zur Gabelung beim alten Wegstein.\nUnd passt auf: Gerold sagt, irgendwas wühlt nachts seine Felder um."
};

// Jorun Feldt: Kohle vom Meiler im Westen (führt zur Senke) und eine Einführung ins Herstellen
const QUEST_KOHLE = {
  titel: "Kohle für die Esse", rang: "F", belohnung: "20 SK und ein Wetzstein",
  text: "Meine Esse frisst Kohle wie ein Drache. Drei Säcke hat der Köhler in der alten Scheune am Westweg stehen lassen, aber er traut sich nicht mehr hin. Dahinter liegen tote Tiere, sagt er, ein ganzer Haufen.\nHolt ihr mir die Kohle? Und bleibt auf dem Weg. Den Wald betritt man nicht."
};
const QUEST_HERSTELLEN = {
  titel: "Aus Teilen wird Ausrüstung", rang: "E", belohnung: "Jorun stellt jedem ein Stück Rang-E-Ausrüstung aus euren Teilen her",
  text: "Was ihr den Biestern abnehmt, ist mehr wert, als ihr denkt. Fell, Zähne, Panzer: Daraus mache ich euch Ausrüstung, die zu euch passt.\nBringt mir Teile von euren Kämpfen und das Geld fürs Material. Je besser meine Hand an dem Tag ist, desto besser wird das Stück."
};

// Alte Quest-Texte, die ersetzt werden, wenn der GM sie nicht selbst geändert hat (Welten vor 0.14.0)
const ALT_IVO_TEXT = "Jedes Jahr zur Saatwende kommt der Händler Tamm mit seinem Karren aus Illmaris. Gestern hätte er da sein sollen. Wir zwei dürfen die Straße nicht verlassen, solange der Hauptmann oben am Wald steht.\nGeht ihr ihm entgegen? Weit kann er nicht sein, vielleicht bis zur Gabelung beim alten Wegstein.";
const QUEST_ERSATZ = {
  "Kessa Dorn": [{ alt: "Die Prüfung am Fest", altText: "Zum Saatwendefest prüfe ich jedes Kind mit diesem Kristall. Leuchtet er, wartet in Illmaris ein Platz an einer Schule der Gilde. Stell dich einfach in die Reihe unter der Linde.", neu: QUEST_ILLMARIS }],
  "Jorun Feldt": [{ alt: "Kohle für die Esse", altText: "Meine Esse frisst Kohle wie ein Drache. Hol mir drei Säcke vom Köhler am Waldrand, aber bleib auf dem Weg. Den Wald betritt man nicht.", neu: QUEST_KOHLE }],
  "Ivo Brandt": [{ alt: "Der Händler kommt nicht", altText: ALT_IVO_TEXT, neu: QUEST_HAENDLER }],
  "Oma Wendel": [
    { alt: "Nebelfarn am Lindbach", altBelohnung: "Zwei Heilkräutersalben", neu: { belohnung: "2 × Heilkräutersalbe (Nebelfarn)" } },
    { alt: "Feuer gegen Dornen", altBelohnung: "2 × Funkenbombe und 3 Fackeln", neu: { belohnung: "2 × Funkenbombe und 3 × Fackel" } }
  ],
  "Gerold Wiese": [{ alt: "Der Keiler im Kornfeld", altBelohnung: "25 SK und ein Sack Sonnenkorn (5 Portionen)", neu: { belohnung: "25 SK und 5 × Sonnenkorn" } }]
};
// Entfernte Quests (nur solange sie noch nicht angenommen wurden und der Text unverändert ist)
const QUEST_ENTFERNT = {
  "Hauptmann Rell": [{ titel: "Proviant für den Posten", text: "Meine Leute am Waldrand warten auf Brot und Bier aus dem Lindenblatt. Bring es hoch zum Wachturm, und keinen Schritt weiter in den Wald." }]
};

// Quests im Norden: Toma sucht seinen Bruder Finn, der das Schwert des Hauptmanns mitgenommen hat.
// Die Spieler entscheiden, wem sie das Schwert geben (oder ob sie eine der Quests offen lassen).
const QUEST_FINN = {
  titel: "Wo ist Finn?", rang: "E",
  belohnung: "Das Schwert des Hauptmanns (Finn hat es bei sich)",
  text: "Habt ihr meinen kleinen Bruder gesehen? Finn ist seit drei Tagen weg! Er wollte unbedingt ein Held sein, so wie ihr.\nIn der Nacht, bevor er verschwunden ist, hat er das Schwert vom Hauptmann aus dem Wachturm geholt. Ich glaub, er ist damit in den Wald gelaufen.\nBitte bringt ihn heim! Dann dürft ihr das Schwert behalten. Aber sagt das nicht dem Hauptmann!"
};
const QUEST_MEIN_SCHWERT = {
  titel: "Mein Schwert", rang: "E",
  belohnung: "2 × EXP-Kristall C (von den Schattenwölfen, die Rell zuletzt erlegt hat) und 30 SK",
  text: "Irgendwer war in meinem Turm und hat mein Schwert mitgenommen. Zwanzig Jahre trag ich es schon, den Löwenknauf erkennt ihr sofort.\nBringt es mir zurück, und zwar ohne großes Gerede im Dorf. Dafür bekommt ihr die Kristalle der Schattenwölfe, die ich zuletzt am Waldrand erlegt habe, und ein paar Münzen."
};

const LINDHAIN_WERTE = {
  "Kessa Dorn": {
    bausteine: [["gruss", "Ah, noch ein Gesicht fürs Fest! Ich bin von der Gilde, keine Angst."], ["gruss", "Na, neugierig auf den Kristall?"], ["abschied", "Wir sehen uns unter der Linde."], ["abschied", "Die Gilde vergisst niemanden, der hilft."]],
    level: 12, schwerpunkt: "kundschaft", kes: 300, waffe: "Eisenschwert", skills: ["Doppelstoß"],
    handel: { kauft: [], ankauf: 40, andere: 0, verkauf: 100, gilde: true },
    quests: [QUEST_ILLMARIS, ...KESSA_LEKTIONEN]
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
    quests: [
      { titel: "Ratten im Keller", rang: "F", belohnung: "15 SK und eine Woche freies Essen", text: "Irgendwas frisst mir die Vorräte im Keller weg. Ratten, so groß wie Katzen! Wer den Keller freiräumt, isst eine Woche lang umsonst bei mir." },
      { titel: "Wo bleibt Brom?", rang: "E", belohnung: "20 SK und der erste Teller vom Festbraten", text: "Der alte Brom hütet seine Schafe draußen hinter der Brücke im Osten. Er hat mir zwei Lämmer für den Festbraten versprochen, aber seit Tagen lässt er sich nicht blicken. Das sieht ihm gar nicht ähnlich.\nSchaut ihr nach ihm? Folgt einfach dem Ostweg über die Weiden." }
    ]
  },
  "Jorun Feldt": {
    bausteine: [["gruss", "Mach die Tür zu, die Esse braucht die Wärme."], ["gruss", "Was brauchst du? Und fass nichts Heißes an."], ["handel", "Gute Arbeit hat ihren Preis."], ["abschied", "Bring's zurück, wenn's stumpf wird."]],
    level: 8, schwerpunkt: "handwerk", kes: 400, waffe: "Kampfhammer (2 Händer)",
    handel: { kauft: ["weapon", "armor", "material", "mineral"], ankauf: 50, andere: 0, verkauf: 110 },
    waren: [["Holzkeule", 2], ["Bronze Dolch", 2], ["Holzbogen", 1], ["Holzpfeile (20 Stück)", 4], ["Holzschild", 2], ["Lederhelm", 2], ["Lederstiefel", 2], ["Jagdmesser", 2], ["Wetzstein", 6]],
    quests: [QUEST_KOHLE, QUEST_HERSTELLEN]
  },
  "Oma Wendel": {
    bausteine: [["gruss", "Ach, Besuch! Komm, setz dich zu mir, Kind."], ["handel", "Gegen fast alles ist ein Kraut gewachsen."], ["abschied", "Und iss genug, du bist viel zu dünn."]],
    level: 9, schwerpunkt: "heil", kes: 150, waffe: "Holz-Kampfstab (2 Händer)", skills: ["Kleine Heilung"],
    handel: { kauft: ["natural", "consumable"], ankauf: 40, andere: 5, verkauf: 100 },
    waren: [["Verband", 10], ["Heilkräutersalbe (Nebelfarn)", 6], ["Gegengift", 2], ["Kleiner Heiltrank", 2], ["Nebelfarn", 8], ["Sternmoos", 2]],
    quests: [
      { titel: "Nebelfarn am Lindbach", rang: "F", belohnung: "2 × Heilkräutersalbe (Nebelfarn)", text: "Meine Augen sind nicht mehr die besten, Kind. Am Lindbach wächst Nebelfarn, fünf Wedel brauche ich. Pflück nur die mit den silbrigen Spitzen (Naturkunde 12)." },
      { titel: "Feuer gegen Dornen", rang: "E", belohnung: "2 × Funkenbombe und 3 × Fackel", text: "Grüne Augen im Wald, sagst du? Meine Großmutter hat von solchen Wesen erzählt. Rinde und Dornen, und sie wachsen nach, so schnell man sie schneidet. Nur Feuer hält sie auf.\nBring mir drei Büschel Sternmoos vom Waldrand am Nordweg, dann mische ich dir etwas, das brennt." }
    ]
  },
  "Bruder Aled": {
    bausteine: [["gruss", "Das Licht sei mit dir."], ["gruss", "Was bedrückt dich, mein Kind?"], ["abschied", "Geh in Frieden und im Gleichgewicht."]],
    level: 10, schwerpunkt: "heil", kes: 40, waffe: "Gilden Zauberstab", skills: ["Kleine Heilung", "Heiliger Schlag"],
    quests: [{ titel: "Blumen für den Wegstein", rang: "F", belohnung: "Der Segen des Hüters: einmal +2 auf einen Wurf eurer Wahl (bis Kapitelende)", text: "An der Straße nach Süden steht ein uralter Wegstein, älter als das Dorf. Zur Saatwende schmücken wir ihn mit einem Kranz und sprechen den alten Segen für eine gute Ernte.\nMeine Knie wollen den Weg nicht mehr. Bringt ihr den Kranz hin? Den Segen kennt ihr bestimmt noch aus Kindertagen (Religion 12)." }]
  },
  "Hauptmann Rell": {
    bausteine: [["gruss", "Halt. Was wollt ihr hier oben?"], ["sonst", "Keinen Schritt weiter in den Wald."], ["abschied", "Und jetzt zurück ins Dorf."]],
    level: 14, schwerpunkt: "kampf", kes: 200, waffe: "Eisenschwert", schild: "Holzschild", skills: ["Schwung des Krieger", "Erweiterte Verteidigung"],
    quests: [
      QUEST_TOR,
      QUEST_MEIN_SCHWERT
    ]
  },
  "Toma": {
    bausteine: [["gruss", "Hey! Seid ihr Abenteurer? Echte?"], ["sonst", "Darf ich mitkommen? Bitte!"], ["abschied", "Wartet! Nehmt mich das nächste Mal mit!"]],
    level: 1, schwerpunkt: "kundschaft", kes: 2,
    quests: [
      { titel: "Der Holzvogel", rang: "F", belohnung: "Tomas Dank und ein glatter Flussstein", text: "Ich hab meinen Holzvogel am Mühlbach verloren! Papa hat ihn geschnitzt, als wir noch an der Grenze gewohnt haben. Hilfst du mir suchen?" },
      QUEST_FINN
    ]
  },
  "Ivo Brandt": {
    bausteine: [["gruss", "Hm. Bleibt auf der Straße, dann gibt's keinen Ärger."], ["sonst", "Zwanzig Jahre steh ich an diesem Tor. Hab schon alles gesehen."], ["abschied", "Und grüßt die Hanne von mir."]],
    level: 7, schwerpunkt: "kampf", kes: 60, waffe: "Gilden Lanze",
    quests: [QUEST_HAENDLER]
  },
  "Lene Asch": {
    bausteine: [["gruss", "Hey! Ihr seid doch die vom Fest, oder?"], ["sonst", "Irgendwann geh ich auch nach Illmaris. Zur echten Gilde!"], ["abschied", "Passt auf euch auf da draußen!"]],
    level: 4, schwerpunkt: "kampf", kes: 30, waffe: "Gilden Lanze",
    quests: [{ titel: "Nachtwache zur Saatwende", rang: "F", belohnung: "10 SK und Lenes Vertrauen (sie erzählt, was sie in jener Nacht gesehen hat)", text: "In der Festnacht sind alle auf dem Dorfplatz, nur wir zwei stehen am Südtor. Ivo schnarcht nach einer Stunde, das weiß ich jetzt schon.\nHaltet ihr mit mir Wache? Zu dritt sieht man mehr. Und ehrlich: Seit ein paar Nächten hör ich Dinge da draußen." }]
  },
  "Gerold Wiese": {
    bausteine: [["gruss", "Ach, ihr seid's. Habt ihr was gesehen? Auf meinem Feld?"], ["sonst", "Das Korn ist alles, was wir haben."], ["abschied", "Und wenn ihr den Keiler seht: lauft nicht weg, lauft schneller."]],
    level: 2, schwerpunkt: "zivil", kes: 20, waffe: "Holzkeule",
    quests: [{ titel: "Der Keiler im Kornfeld", rang: "E", belohnung: "25 SK und 5 × Sonnenkorn", text: "Jede Nacht wühlt mir etwas das Kornfeld um. Ein Keiler, groß wie ein Kalb, und seine Augen … die leuchten. Violett.\nDie Wachen sagen, sie dürfen die Straße nicht verlassen. Bitte, wenn er noch eine Nacht kommt, ist die halbe Ernte hin." }]
  },
  "Tamm": {
    bausteine: [["gruss", "Ah, Kundschaft! Kommt näher, kommt näher!"], ["handel", "Frisch aus Illmaris, alles beste Ware!"], ["handel", "Für Retter gibt's natürlich einen Freundschaftspreis."], ["sonst", "Ist es weg? Das Biest? Bei allen Göttern, ich dachte, das war's."], ["abschied", "Beehrt mich bald wieder, in Illmaris findet ihr mich am Markt!"]],
    level: 5, schwerpunkt: "zivil", kes: 600, waffe: "Bronze Dolch",
    handel: { kauft: ["weapon", "armor", "equipment", "consumable", "material", "natural", "mineral"], ankauf: 40, andere: 0, verkauf: 110 },
    waren: [["Kleiner Heiltrank", 4], ["Heiltrank", 1], ["Gegengift", 2], ["Verband", 6], ["Fackel", 10], ["Seil (15 m)", 3], ["Laterne", 1], ["Schlafsack", 2], ["Wasserschlauch", 3], ["Proviant (1 Tagesration)", 10], ["Funkenbombe", 2], ["Lederhelm", 1], ["Lederstiefel", 1], ["Rucksack S", 1], ["Skill-Orb T1", 1]]
  },
  "Finn": {
    bausteine: [["gruss", "G-geht weg! … Seid ihr vom Dorf?"], ["sonst", "Ich wollte doch nur ein Held sein. So wie die Abenteurer."], ["sonst", "Da draußen ist was. Es knackt und hat grüne Augen."], ["abschied", "Sagt ihr Toma, dass ich nicht geweint hab?"]],
    level: 1, schwerpunkt: "kundschaft", kes: 0
  }
};

export function lindhainWerte(name) {
  return LINDHAIN_WERTE[name] ?? null;
}

// Textbausteine je Quest (Anlass: Text). Ein Klick im Gespräch übernimmt den Text nur ins Eingabefeld,
// damit der GM ihn an die Situation anpasst, bevor der NSC ihn sagt.
const QUEST_BAUSTEINE = {
  "Kessa Dorn": {
    "Ein Platz in Illmaris": [
      ["Kristalltest", "Na, nervös? Stellt euch in die Reihe. Eine Hand auf den Kristall, mehr ist es nicht."],
      ["Kristall leuchtet", "Da! Seht ihr das Licht? Ihr tragt den Kern in euch. Das hab ich in diesem Dorf nicht erwartet."],
      ["Angebot", "Die Gilde hat einen Platz für euch, an unseren Schulen in Illmaris. Dort lernt ihr alles, was ein Abenteurer wissen muss."],
      ["Annahme", "Gut. In sieben Tagen reise ich ab. Wer mitkommt, steht bei Sonnenaufgang am Südtor. Bis dahin zeige ich euch, was ich kann."],
      ["Zögern", "Niemand zwingt euch. Aber so eine Gelegenheit kommt nicht zweimal."],
      ["Abreise", "Alle da? Dann los. Zwei Wochen bis Illmaris, und glaubt mir, ihr werdet jeden Tag davon brauchen."]
    ],
    "Erste Lektion: Der Kampf": [
      ["Angebot", "Zeigt mir, wie ihr euch bewegt. Die Strohpuppen hinter dem Schrein beißen nicht. Meistens."],
      ["Der Zug", "Jeder Zug: eine Aktion, eine Schnellaktion und eure Bewegung. Und bis zum nächsten Zug eine Reaktion. Mehr nicht."],
      ["Treffen", "Ein Angriff muss den Rüstwert schlagen, Magie die Magieresistenz. Wer nicht trifft, deckt sich besser: Abwehr gibt zwei Punkte auf beides."],
      ["Skills", "Eure Skills sind stark, aber sie brauchen Zeit, bis sie wieder bereit sind. Überlegt, wann ihr sie einsetzt."],
      ["Todeswurf", "Fällt einer von euch auf null, kommt der Todeswurf. Zehn oder mehr, und ihr steht wieder. Sonst habt ihr drei Runden, bis euch jemand hilft."],
      ["Abschluss", "Nicht schlecht. Wirklich nicht schlecht. Hier, für die Kratzer."]
    ],
    "Zweite Lektion: EXP-Kristalle": [
      ["Angebot", "Habt ihr schon etwas erlegt? Dann zeigt mal her, was ihr dabei gefunden habt."],
      ["Verwenden", "Ein EXP-Kristall. Nehmt ihn in die Hand und lasst ihn zerfallen, dann wird euer Kern stärker. Aber nicht mitten im Kampf."],
      ["Geben oder verkaufen", "Ihr könnt ihn auch jemandem geben, der ihn nötiger hat. Oder ihr verkauft ihn mir, die Gilde zahlt den vollen Wert."],
      ["Abyss-Kristall", "Und die violetten? Finger weg. Sie geben mehr, aber sie fressen sich in euch hinein. Nach dem Gildenpakt gehört jeder davon der Gilde."],
      ["Abschluss", "Für den ersten zahle ich das Doppelte. Merkt euch das Gefühl: ehrlich verdientes Geld."]
    ],
    "Dritte Lektion: Skill-Orbs": [
      ["Angebot", "Fangt! Skill-Orbs. Jeder bekommt einen."],
      ["Untersuchen", "Haltet ihn ins Licht und konzentriert euch. Mit etwas Glück zeigt er euch, was in ihm steckt. Ihr habt nur einen Versuch."],
      ["Lernen", "Lernen könnt ihr ihn nur, wenn noch Platz in euch ist. Und je öfter ihr den Skill nutzt, desto besser beherrscht ihr ihn."],
      ["Pech gehabt", "Nichts? Kommt vor. Die Gilde in Illmaris kann ihn für euch öffnen, gegen eine Gebühr natürlich."],
      ["Abschluss", "So fängt jeder an. Auch ich."]
    ]
  },
  "Mira Holm": {
    "Bänke für die Saatwende": [
      ["Angebot", "Ah, junge Hände! Die Bänke für heute Abend liegen noch hinter der Mühle."],
      ["Unterwegs", "Vorsicht mit den Girlanden, die hat schon meine Mutter genäht!"],
      ["Abschluss", "Wunderbar. Erste Reihe für euch, wie versprochen."]
    ]
  },
  "Hanne Brook": {
    "Ratten im Keller": [
      ["Angebot", "Ihr seht aus, als könntet ihr zupacken. Hört ihr das Kratzen da unten? Mein Keller …"],
      ["Vor der Tür", "Die Laterne hängt an der Treppe. Und macht bitte nicht alle Fässer kaputt!"],
      ["Abschluss", "Ihr seid meine Helden! Eine Woche freies Essen, und keine Widerrede."]
    ],
    "Wo bleibt Brom?": [
      ["Angebot", "Habt ihr den alten Brom gesehen? Er wollte mir längst die Lämmer für den Festbraten bringen."],
      ["Sorge", "Brom ist sonst pünktlich wie der Hahn. Seine Weiden liegen hinter der Brücke, im Osten."],
      ["Schlechte Nachricht", "Brom? Bei allen Göttern … Danke, dass ihr es mir sagt. Setzt euch. Ich bring euch was."],
      ["Abschluss", "Hier, für euren Weg. Und der erste Teller vom Festbraten gehört euch, auch wenn es nicht Broms Lämmer sind."]
    ]
  },
  "Jorun Feldt": {
    "Kohle für die Esse": [
      ["Angebot", "Ihr da. Wollt ihr euch ein paar Münzen verdienen? Meine Esse braucht Kohle."],
      ["Hinweis", "Die alte Scheune am Westweg. Drei Säcke. Und der Köhler faselt was von toten Tieren dahinter."],
      ["Abschluss", "Gut. Endlich wird es hier wieder warm. Nimm den Wetzstein, du wirst ihn brauchen."]
    ],
    "Aus Teilen wird Ausrüstung": [
      ["Angebot", "Was ist das, Fell? Zähne? Zeig her. Daraus lässt sich was machen."],
      ["Ablauf", "Gib mir die Teile und das Geld fürs Material. Dann schauen wir, wie gut meine Hand heute ist."],
      ["Gut gelungen", "Ha! Das ist eins meiner besten Stücke seit Jahren."],
      ["Schlecht gelungen", "Hm. Hält. Schön ist es nicht. Aber es hält."],
      ["Abschluss", "Da. Trag es mit Stolz, und bring es mir, wenn es kaputtgeht."]
    ]
  },
  "Oma Wendel": {
    "Nebelfarn am Lindbach": [
      ["Angebot", "Kind, kannst du einer alten Frau helfen? Am Lindbach wächst Nebelfarn."],
      ["Hinweis", "Nur die mit den silbrigen Spitzen, die anderen taugen nichts."],
      ["Abschluss", "Genau die richtigen. Hier, zwei Salben, für wenn es mal brennt."]
    ],
    "Feuer gegen Dornen": [
      ["Angebot", "Grüne Augen, sagst du? Setz dich. Da gibt es eine alte Geschichte."],
      ["Geschichte", "Rinde und Dornen, und sie wachsen nach, so schnell man sie schneidet. Nur Feuer hält sie auf."],
      ["Auftrag", "Bring mir drei Büschel Sternmoos vom Waldrand am Nordweg. Dann mische ich dir etwas, das brennt."],
      ["Abschluss", "Vorsicht damit. Wirf sie nur, wenn du es ernst meinst."]
    ]
  },
  "Bruder Aled": {
    "Blumen für den Wegstein": [
      ["Angebot", "Das Licht sei mit euch. Würdet ihr einem alten Mann einen Gang abnehmen?"],
      ["Der Segen", "Legt den Kranz nieder und sprecht: Möge die Erde geben, was wir säen, und das Licht behüten, was wir lieben."],
      ["Fragen zum Stein", "Der Stein? Er stand schon hier, bevor es Lindhain gab. Wer die Gestalten darauf sind, weiß niemand mehr."],
      ["Abschluss", "Der Hüter hat euch gesehen. Geht mit seinem Segen."]
    ]
  },
  "Hauptmann Rell": {
    "Ein Tor für den Waldrand": [
      ["Angebot", "Ihr da. Ich steh hier oben fest, solange der Weg in den Wald offen ist. Ich brauche Holz und Leute, die anpacken können."],
      ["Holz", "Stämme liegen am Waldrand, Bretter hat die Mühle. Und keinen Schritt weiter in den Wald, verstanden?"],
      ["Gut gebaut", "Das hält. Das hält sogar einen Ochsen. Gut gemacht."],
      ["Wackelig", "Hm. Das wackelt. Besser als nichts, aber ich lasse heute Nacht noch eine Fackel hier brennen."],
      ["Eingestürzt", "Na wunderbar. Holt mehr Holz, und diesmal bindet ihr die Stämme richtig."],
      ["Abschluss", "Jetzt kann ich endlich runter ins Dorf. Sagt Ivo, dass einer von ihnen los kann."]
    ],
    "Mein Schwert": [
      ["Angebot", "Irgendwer war in meinem Turm. Mein Schwert ist weg."],
      ["Hinweis", "Ein Löwenknauf. Zwanzig Jahre trag ich es. Wer es hat, der wird es bereuen."],
      ["Verdacht", "Kinder waren in letzter Zeit oft hier oben. Zu oft."],
      ["Abschluss", "Mein Schwert … wo habt ihr … Nein. Ich will es gar nicht wissen. Hier, wie versprochen."]
    ]
  },
  "Toma": {
    "Der Holzvogel": [
      ["Angebot", "Habt ihr meinen Holzvogel gesehen? Papa hat ihn geschnitzt!"],
      ["Abschluss", "Mein Vogel! Ihr seid die Besten! Hier, das ist mein glattester Stein."]
    ],
    "Wo ist Finn?": [
      ["Angebot", "Bitte! Ihr müsst mir helfen! Finn ist weg!"],
      ["Das Schwert", "Er hat das Schwert vom Hauptmann. Aber das dürft ihr ihm nicht sagen! Bitte!"],
      ["Wo suchen", "Er redet immer vom Wald. Dass da Helden hingehen. Ich glaub, er ist da hoch."],
      ["Abschluss", "Finn! Du Idiot! … Danke. Danke, danke, danke."]
    ]
  },
  "Ivo Brandt": {
    "Der Händler kommt nicht": [
      ["Angebot", "Jetzt, wo der Hauptmann wieder unten ist, kann einer von uns los. Tamm ist überfällig."],
      ["Aufteilung", "Ich bleib am Tor. Lene, du gehst mit ihnen. Und passt auf, irgendwas wühlt da draußen die Felder um."],
      ["Abschluss", "Tamm, du alter Halunke! Gut, dass ihr ihn gefunden habt. Hier, aus der Wachkasse."]
    ]
  },
  "Lene Asch": {
    "Nachtwache zur Saatwende": [
      ["Angebot", "Habt ihr Lust auf eine Nacht am Tor? Ivo schnarcht eh nach einer Stunde."],
      ["Grüne Augen", "Da! Siehst du das? Da oben am Waldrand … zwei grüne Punkte."],
      ["Der Keiler", "Hörst du das Rascheln? Das kommt aus Gerolds Feld. Etwas Großes."],
      ["Finn", "Ich hab Finn gesehen, vor drei Nächten. Er ist Richtung Wald gelaufen, mit etwas Langem auf dem Rücken."],
      ["Abschluss", "Danke, dass ihr geblieben seid. Allein wäre es mir unheimlich gewesen."]
    ]
  },
  "Gerold Wiese": {
    "Der Keiler im Kornfeld": [
      ["Angebot", "Bitte, ihr müsst mir helfen. Jede Nacht kommt er wieder."],
      ["Beschreibung", "Groß wie ein Kalb, und die Augen … violett. So was hab ich noch nie gesehen."],
      ["Abschluss", "Er ist tot? Wirklich? … Danke. Hier, das Geld und das Sonnenkorn. Ihr habt es euch verdient."]
    ]
  },
  "Tamm": {
    "Der Händler kommt nicht": [
      ["Gerettet", "Ist es weg? Das Biest? Bei allen Göttern, ich dachte, das war's."],
      ["Dank", "Hier, nehmt das. Ohne euch hätte ich die Nacht nicht überlebt."],
      ["Das Rad", "Das Rad ist hin. Kann einer von euch mit Holz umgehen? Sonst müssen wir tragen."]
    ]
  }
};

function questBausteineAus(name) {
  return Object.entries(QUEST_BAUSTEINE[name] ?? {}).flatMap(([quest, liste]) =>
    liste.map(([anlass, text]) => ({ id: foundry.utils.randomID(), art: "quest", quest, anlass, text })));
}

function bausteineAus(werte, name) {
  return [...(werte?.bausteine ?? []).map(([art, text]) => ({ id: foundry.utils.randomID(), art, text })), ...questBausteineAus(name)];
}

// Textbausteine für Lindhain-NSC nachtragen, die vor v0.9.0 ausgestattet wurden (eigene Bausteine bleiben).
export async function lindhainBausteine() {
  for (const actor of game.actors.filter((a) => a.type === "npc" && LINDHAIN_WERTE[a.name])) {
    if (Array.isArray(actor.getFlag(SYSTEM_ID, "talk")?.bausteine)) continue;
    await actor.update({ [`flags.${SYSTEM_ID}.talk.bausteine`]: bausteineAus(LINDHAIN_WERTE[actor.name], actor.name) });
  }
}

// Händler-Einstellungen für Lindhain nachtragen (Welten vor v0.10.0; eigene Einstellungen bleiben).
export async function lindhainHandel() {
  for (const actor of game.actors.filter((a) => a.type === "npc" && LINDHAIN_WERTE[a.name]?.handel)) {
    if (actor.getFlag(SYSTEM_ID, "talk")?.handel) continue;
    await actor.update({ [`flags.${SYSTEM_ID}.talk.handel`]: LINDHAIN_WERTE[actor.name].handel });
  }
}

// Neue Lindhain-Quests in bestehende Welten eintragen (nach Titel; vorhandene Quests bleiben, wie sie sind).
export async function lindhainQuestsNachtragen() {
  let anzahl = 0;
  for (const actor of game.actors.filter((a) => a.type === "npc" && LINDHAIN_WERTE[a.name])) {
    const talk = actor.getFlag(SYSTEM_ID, "talk") ?? {};
    const update = {};
    if (LINDHAIN_WERTE[actor.name].quests) {
      let vorhanden = Array.isArray(talk.quests) ? talk.quests : [];
      const vorher = JSON.stringify(vorhanden);
      // Entfernte Quests (noch nicht angenommen, Text unverändert)
      vorhanden = vorhanden.filter((q) => !(QUEST_ENTFERNT[actor.name] ?? []).some((e) => e.titel === q.titel && e.text === q.text && ["verborgen", "angeboten"].includes(q.status)));
      // Unveränderte alte Fassungen durch die neue ersetzen (Stand und „angenommen von“ bleiben)
      vorhanden = vorhanden.map((q) => {
        const e = (QUEST_ERSATZ[actor.name] ?? []).find((x) => x.alt === q.titel && (!x.altText || x.altText === q.text) && (!x.altBelohnung || x.altBelohnung === q.belohnung));
        return e ? { ...q, ...e.neu } : q;
      });
      // Hauptquest-Markierung nachtragen
      vorhanden = vorhanden.map((q) => {
        const def = LINDHAIN_WERTE[actor.name].quests.find((d) => d.titel === q.titel);
        return def?.haupt && q.haupt === undefined ? { ...q, haupt: true } : q;
      });
      const fehlen = LINDHAIN_WERTE[actor.name].quests.filter((q) => !vorhanden.some((v) => v.titel === q.titel));
      vorhanden = [...vorhanden, ...fehlen.map((q) => ({ id: foundry.utils.randomID(), status: "verborgen", ...q }))];
      if (JSON.stringify(vorhanden) !== vorher) {
        update[`flags.${SYSTEM_ID}.talk.quests`] = vorhanden;
        anzahl += 1;
      }
    }
    // Quest-Textbausteine ergänzen (nach Text; eigene Bausteine bleiben)
    if (Array.isArray(talk.bausteine)) {
      const fehlend = questBausteineAus(actor.name).filter((b) => !talk.bausteine.some((x) => x.text === b.text));
      if (fehlend.length) update[`flags.${SYSTEM_ID}.talk.bausteine`] = [...talk.bausteine, ...fehlend];
    }
    if (Object.keys(update).length) await actor.update(update);
  }
  return anzahl;
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
    update[`flags.${SYSTEM_ID}.talk.bausteine`] = bausteineAus(werte, actor.name);
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

// ---------- Quest-Belohnung (GM stellt eine Quest auf „Erledigt“) ----------
// Die Belohnung wird aus dem Belohnungstext gelesen, damit es auch für selbst geschriebene Quests klappt:
//   „20 SK“, „1 GK 50 SK“ → Geld · „2 × Kleiner Heiltrank“ oder „ein Wetzstein“ → Gegenstände (Name wie in den Import-Listen)
//   „… pro Person“ → jeder Spielercharakter bekommt alles, sonst nur der, der die Quest angenommen hat.
// Alles andere (ein Platz in Illmaris, ein Segen …) bleibt Text und steht nur auf der Chat-Karte.
const ZAHLWORT = { ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, "fünf": 5 };

export async function belohnungLesen(text) {
  const t = String(text ?? "");
  let sk = 0;
  for (const m of t.matchAll(/(\d+)\s*(GK|SK)\b/g)) sk += Number(m[1]) * (m[2] === "GK" ? 100 : 1);
  const namen = [...(await importListe()).keys()].sort((a, b) => b.length - a.length);
  const items = [];
  const muster = /(?:(\d+)\s*×\s*|\b(ein|eine|einen|zwei|drei|vier|fünf)\s+)([^,;]+?)(?=\s+und\s+|\s+pro Person|\s*[,;:]|$)/gi;
  for (const m of t.matchAll(muster)) {
    const anzahl = m[1] ? Number(m[1]) : ZAHLWORT[m[2].toLowerCase()];
    const rest = m[3].trim();
    const name = namen.find((n) => rest === n || rest.startsWith(`${n} `) || rest.startsWith(`${n}(`) || rest.startsWith(`${n},`));
    if (name && anzahl) items.push([name, anzahl]);
  }
  return { sk, items, proPerson: /pro Person/i.test(t) };
}

function questEmpfaenger(quest, proPerson) {
  if (proPerson) return game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner);
  const charakter = game.actors.get(quest.angenommenVonId) ?? game.actors.find((a) => a.type === "character" && a.name === quest.angenommenVon);
  return charakter ? [charakter] : [];
}

async function gegenstandDazu(actor, name, anzahl) {
  const gleich = actor.items.find((i) => i.name === name && !i.system?.equipped && !i.getFlag(SYSTEM_ID, "rucksack"));
  if (gleich && ["consumable", "equipment", "foodDrink", "material", "natural", "mineral", "junk"].includes(gleich.type)) {
    return gleich.update({ "system.quantity": Math.max(Number(gleich.system?.quantity) || 1, 1) + anzahl });
  }
  const daten = await itemDaten(name, { system: { quantity: anzahl, equipped: false } });
  if (daten) return actor.createEmbeddedDocuments("Item", [daten]);
}

export async function questBelohnen(nsc, quest, { zuneigung = null } = {}) {
  if (!game.user?.isGM || !quest) return;
  const lohn = await belohnungLesen(quest.belohnung);
  const empfaenger = questEmpfaenger(quest, lohn.proPerson);
  const teile = [lohn.sk ? kes(lohn.sk) : "", ...lohn.items.map(([n, a]) => `${a} × ${n}`)].filter(Boolean);
  if (teile.length && !empfaenger.length) ui.notifications?.warn(`„${quest.titel}“: Niemand hat die Quest angenommen. Gib die Belohnung bitte selbst.`);
  for (const actor of teile.length ? empfaenger : []) {
    if (lohn.sk) await actor.update({ "system.resources.kes.value": kesVon(actor) + lohn.sk });
    for (const [name, anzahl] of lohn.items) await gegenstandDazu(actor, name, anzahl);
  }
  const wer = empfaenger.map((a) => a.name).join(", ");
  const zeile = teile.length && empfaenger.length ? `<p><b>${wer}</b> ${empfaenger.length > 1 ? "bekommen je" : "bekommt"}: ${teile.join(", ")}.</p>` : "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: nsc }),
    content: `<div class="hlw-chat-card hlw-chat-kurz"><h2>Quest erledigt: ${quest.titel}</h2>${zeile}<p><b>Belohnung:</b> ${quest.belohnung || "–"}</p>${zuneigung !== null ? `<p><i class="fa-solid fa-heart"></i> Zuneigung ${zuneigung} / 100</p>` : ""}</div>`
  });
}

// ---------- GM-Übersicht Kapitel 1 (Journal nur für den GM) ----------
// Wo die Quest spielt, wie sie abläuft und was sie den Spielern beibringt. Keine Lore-Geheimnisse.
const KAPITEL1_GM = {
  "Ein Platz in Illmaris": { ort: "Dorfplatz unter der Linde, am Festtag", ablauf: "Kessa prüft beim Fest alle jungen Leute mit dem Kristall; bei den Spielern leuchtet er. Nehmen sie an, reist Kessa in sieben Tagen ab. In dieser Woche laufen die anderen Quests. Am Abreisemorgen am Südtor beginnt das nächste Kapitel (Reise nach Illmaris, etwa zwei Wochen).", lehrt: "Ziel des Kapitels, Gilde und Schulen" },
  "Erste Lektion: Der Kampf": { ort: "Hof hinter dem Hüter-Schrein (3 Strohpuppen auf der Karte)", ablauf: "Kampf gegen die Strohpuppen starten (HP 12, RW 8, greifen nicht an, geben keine EXP und keine Kristalle). Kessa erklärt dabei: Initiative, Aktion, Schnellaktion, Reaktion und Bewegung, Angriff gegen RW, Magie gegen MR, kritische Treffer, Abwehr, Skills mit Abklingzeit und den Todeswurf bei 0 HP. Wer will, darf danach gegen Kessa üben (sie hält sich zurück).", lehrt: "Kampfablauf und Kampf-HUD" },
  "Zweite Lektion: EXP-Kristalle": { ort: "Bei Kessa, nach dem ersten echten Kampf (Ratten, Keiler, Brom)", ablauf: "Kessa erklärt: Kristall verwenden (außerhalb des Kampfs, gibt EXP), einem anderen geben oder an die Gilde verkaufen (sie zahlt den vollen Wert). Violette Abyss-Kristalle geben mehr EXP, aber Korruption; nach dem Gildenpakt gehören sie der Gilde. Für den ersten normalen Kristall zahlt sie das Doppelte.", lehrt: "EXP-Kristalle, Abyss-Kristalle, Korruption" },
  "Dritte Lektion: Skill-Orbs": { ort: "Bei Kessa", ablauf: "Kessa gibt jedem einen Skill-Orb T1 (GM: „Gegenstand geben“). Untersuchen: 1W20 + SOU, ab 10 gelingt es, ein Versuch. Dann steckt ein zufälliger Rang-D-Skill darin (selten Rang C). Lernen braucht einen freien Skill-Platz; mit jedem Einsatz wächst die Meisterung.", lehrt: "Skill-Orbs, Skills lernen, Meisterung" },
  "Bänke für die Saatwende": { ort: "Bretter hinter der Mühle, Dorfplatz", ablauf: "Bretter tragen (Athletik 12), Girlanden aufhängen (Geschick 12). Gute Gelegenheit, die NSC beim Aufbau kennenzulernen.", lehrt: "World-Skill-Proben" },
  "Ratten im Keller": { ort: "Keller des Gasthauses", ablauf: "4 bis 6 Ratten (Rang E, Diener). Der erste echte Kampf; jede Ratte lässt mit Glück einen Kristall (1W4 = 4).", lehrt: "Erster Kampf, erste Kristalle" },
  "Wo bleibt Brom?": { ort: "Ostweg, dann „Weide im Osten“", ablauf: "Brom ist der Korrumpierte Hirte auf dem verdorbenen Boden. Die erste korrumpierte Person, der die Gruppe begegnet. Er lässt einen Abyss-Kristall. Hanne erfährt es von den Spielern.", lehrt: "Korruption, Abyss-Kristalle (passt zur zweiten Lektion)" },
  "Kohle für die Esse": { ort: "Westweg (Säcke in der verfallenen Scheune), dahinter „Senke im Westen“", ablauf: "Die Kohle ist leicht zu holen. Wer weiter in die Senke geht, findet die toten Tiere und das „verletzte Kleinhorn“, eine Kopierkatze (Scharfsinnigkeit 25 durchschaut sie).", lehrt: "Erkunden, Gefahr hinter dem Auftrag" },
  "Aus Teilen wird Ausrüstung": { ort: "Schmiede", ablauf: "Teile aus dem Fundwurf (Beute der Kämpfe) plus Materialgeld. Jorun würfelt Herstellen gegen den Rang; je besser, desto höher die Qualität.", lehrt: "Beute, Teile, Herstellen" },
  "Nebelfarn am Lindbach": { ort: "Lindbach am Ostrand des Dorfs", ablauf: "Naturkunde 12 für die richtigen Wedel.", lehrt: "Sammeln, Pflanzen" },
  "Feuer gegen Dornen": { ort: "Waldrand am Nordweg (Sternmoos)", ablauf: "Naturkunde 15 findet drei Büschel Sternmoos. Oma Wendel gibt Funkenbomben und Fackeln: Feuer stoppt die Regeneration des Dornenschrats.", lehrt: "Schwächen von Gegnern nutzen" },
  "Blumen für den Wegstein": { ort: "Straße nach Illmaris, Gabelung am alten Wegstein", ablauf: "Kranz ablegen, alten Segen sprechen (Religion 12). Der Stein zeigt vier verwitterte Gestalten (siehe GM-Kampagnenstart). Passt gut mit „Der Händler kommt nicht“ zusammen.", lehrt: "Ruhige Erkundung, erster stiller Hinweis" },
  "Ein Tor für den Waldrand": { ort: "Nordweg an der Schranke (Zaunteile und Tor als Kacheln: assets/lindhain/bauten)", ablauf: "Hauptquest. Holz holen: Stämme am Waldrand (Athletik 15, zwei, drei Gänge) und Bretter von der Mühle (Wortgewandtheit 12 beim Müller). Bauen: Jeder würfelt Handwerk 15. Mehrheit geschafft: stabiles Tor. Knapp: wackelig (Rell lässt eine Fackel brennen, später kann etwas durch). Mehrheit misslungen: es stürzt ein, einer nimmt 1W6 Schaden, mehr Holz holen. Steht das Tor, geht Rell ins Dorf, und Ivo bietet „Der Händler kommt nicht“ an.", lehrt: "Gruppenproben, Folgen guter und schlechter Würfe" },
  "Mein Schwert": { ort: "Wachturm, später im Dorf", ablauf: "Finn hat das Schwert. Gibt die Gruppe es Rell zurück, bekommt sie die Kristalle und das Geld; Tomas Belohnung (das Schwert) fällt dann weg. Beides geht nicht. Rell wird die Quest erst los, wenn er das Tor hat und Zeit zum Suchen findet.", lehrt: "Entscheidungen mit Folgen" },
  "Der Holzvogel": { ort: "Lindbach bei der Mühle", ablauf: "Scharfsinnigkeit 12 findet den Vogel im Schilf.", lehrt: "Einfache Suche" },
  "Wo ist Finn?": { ort: "Nordweg, „Lichtung im Norden“, dann „Alte Hütte“", ablauf: "Auf der Lichtung wartet der Dornenschrat (schwerster Kampf des Kapitels). Oben rechts führt ein Wildwechsel weiter (Scharfsinnigkeit 20) zur versteckten Hütte, in der Finn mit dem Schwert sitzt. Einen Hinweis gibt Lene bei der Nachtwache.", lehrt: "Großer Kampf, versteckte Orte, Entscheidung um das Schwert" },
  "Der Händler kommt nicht": { ort: "Straße nach Illmaris (Wagen mit gebrochenem Rad unten auf der Straße)", ablauf: "Hauptquest, erst nach dem Tor. Ivo bleibt am Südtor, Lene begleitet die Gruppe. Der Korrumpierte Keiler (verborgen im Feld rechts der Straße) hat Tamm angegriffen; Tamm versteckt sich hinter dem Wagen (verborgen). Der Keiler greift die Gruppe an. Sieg: Ivos Belohnung, Gerolds „Der Keiler im Kornfeld“ ist damit auch erledigt, und Tamm bedankt sich. Rad: Handwerk 15, sonst gemeinsam tragen (Athletik 15). Danach verkauft Tamm im Dorf.", lehrt: "Großer Kampf, eine Tat erledigt mehrere Quests" },
  "Nachtwache zur Saatwende": { ort: "Südtor, Festnacht", ablauf: "Drei Proben Scharfsinnigkeit 15: grüne Augen weit im Norden am Waldrand; ein Keiler zieht über Gerolds Kornfeld; Lene erzählt, dass sie Finn vor drei Nächten mit etwas Langem auf dem Rücken Richtung Wald laufen sah.", lehrt: "Stimmung, Hinweise auf andere Quests" },
  "Der Keiler im Kornfeld": { ort: "Gerolds Kornfeld; der Keiler selbst wartet auf der Straße nach Illmaris", ablauf: "Der Korrumpierte Keiler (Wildschwein, Corrupted Stufe 1) liegt verborgen auf der Südstraße und greift bei „Der Händler kommt nicht“ an. Wer ihn besiegt, erledigt beide Quests. Er lässt einen Abyss-Kristall.", lehrt: "Kampf, Corrupted-Tiere" }
};

export async function kapitel1Journal({ neu = false } = {}) {
  if (!game.user?.isGM) return null;
  const name = "Kapitel 1 – Quests (GM)";
  if (neu) await game.journal.getName(name)?.delete();
  if (game.journal.getName(name)) return game.journal.getName(name);
  const absatz = (t) => String(t ?? "").split("\n").map((z) => `<p>${z}</p>`).join("");
  const ueberblick = `<h2>Kapitel 1: Lindhain</h2>
    <p>Die Saatwende. Kessa Dorn von der Gilde sucht junge Leute mit der Fähigkeit und bietet einen Platz an den Schulen in Illmaris an. Nehmen die Spieler an, bleibt eine Woche bis zur Abreise.</p>
    <p><b>Tag 1 (Fest):</b> Kristalltest, Kessas Lektionen, Bänke, Ratten im Keller, Nachtwache. <b>Tag 2 bis 6:</b> Hauptquests in Reihenfolge: Rells Tor am Waldrand, danach sucht die Gruppe mit Lene den Händler Tamm und trifft auf den Keiler. Daneben die Wege hinaus (Nord: Finn und der Dornenschrat, schwerster Kampf; Ost: Brom; West: die Senke; Süd: der Wegstein). <b>Tag 7:</b> Abreise am Südtor, nächstes Kapitel.</p>
    <p>Belohnungen: Stellst du eine Quest auf „Erledigt“, bekommt der Charakter, der sie angenommen hat, Geld und Gegenstände aus dem Belohnungstext direkt ins Inventar („pro Person“: jeder Spielercharakter). Was kein Gegenstand ist, steht nur auf der Chat-Karte.</p>
    <p>Alle Quests sind bei den NSC verborgen hinterlegt. Im Gespräch (Rechtsklick auf die Figur → Quests) zeigst du sie, die Spieler nehmen sie an; im Questlog stellst du sie auf „Erledigt“. Die Spieler entscheiden selbst, was sie erledigen und was offen bleibt.</p>`;
  const seiten = [{ name: "Überblick", type: "text", text: { content: ueberblick } }];
  for (const [nsc, werte] of Object.entries(LINDHAIN_WERTE)) {
    if (!werte.quests?.length) continue;
    const inhalt = werte.quests.map((q) => {
      const g = KAPITEL1_GM[q.titel] ?? {};
      return `<h2>${q.titel} <small>(Rang ${q.rang})</small></h2>${absatz(q.text)}<p><b>Belohnung:</b> ${q.belohnung}</p>
        ${g.ort ? `<p><b>Ort:</b> ${g.ort}</p>` : ""}${g.ablauf ? `<p><b>Ablauf:</b> ${g.ablauf}</p>` : ""}${g.lehrt ? `<p><b>Lehrt:</b> ${g.lehrt}</p>` : ""}`;
    }).join("<hr>");
    seiten.push({ name: nsc, type: "text", text: { content: inhalt } });
  }
  return JournalEntry.create({ name, pages: seiten });
}

// ---------- Handel ----------
// Jeder Händler hat Einstellungen am NSC (flags.talk.handel):
//   verkauf: Verkaufspreis in % vom Marktwert (Standard 100)
//   kauft:   Warenarten, die er ankauft (Standard: die Arten, die er selbst anbietet)
//   ankauf:  was er für diese Arten zahlt, in % vom Marktwert (Standard 40, wie im Marktsystem)
//   andere:  was er für alle anderen Waren zahlt (Standard 0 = kauft er nicht)
//   gilde:   Gilde: kauft EXP- und Abyss-Kristalle zum vollen Wert (Gildenpreis)
//   schwarzmarkt: kauft Abyss-Kristalle zum doppelten Wert (strafbar)
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
    gilde: h.gilde === true,
    schwarzmarkt: h.schwarzmarkt === true,
    kauft: Array.isArray(h.kauft) ? h.kauft : eigeneArten
  };
}

// Handelt der NSC überhaupt (hat Waren oder kauft etwas an)?
export function istHaendler(actor) {
  const h = handelVon(actor);
  return actor.items.some((i) => istWare(i)) || (h.kauft.length > 0 && h.ankauf > 0) || h.andere > 0 || h.gilde || h.schwarzmarkt;
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
  const kristall = kristallInfo(item);
  if (kristall?.abyss && h.schwarzmarkt) return 200;
  if (kristall && h.gilde) return 100;
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
