// Regeln aus Kanon 2.0: Kampfwerte, Punktesystem, Klassenzuteilung, Korruption und Kes.
// Die Zahlen stammen aus den Tabs Kampfwerte, Punktesystem, Klassenregeln und Korruption der Markt- und Tierliste.

export const ATTRS = ["str", "dex", "con", "int", "wis", "cha", "agl", "spe", "edu", "sou"];

export const WORLD_SKILLS = {
  athletik: { label: "Athletik", attributes: ["str", "con", "agl"] },
  wortgewandtheit: { label: "Wortgewandtheit", attributes: ["cha", "edu", "int"] },
  erfindergeist: { label: "Erfindergeist", attributes: ["int", "wis", "dex"] },
  naturkunde: { label: "Naturkunde", attributes: ["wis", "agl", "sou"] },
  tierkunde: { label: "Tierkunde", attributes: ["cha", "spe", "sou"] },
  religion: { label: "Religion", attributes: ["wis", "edu", "sou"] },
  scharfsinnigkeit: { label: "Scharfsinnigkeit", attributes: ["int", "spe", "dex"] },
  archaeologie: { label: "Archäologie", attributes: ["edu", "str", "wis"] },
  handwerkskunst: { label: "Handwerkskunst", attributes: ["dex", "str", "con"] },
  willenskraft: { label: "Willenskraft", attributes: ["sou", "cha", "con"] },
  heimlichkeit: { label: "Heimlichkeit", attributes: ["dex", "agl", "spe"] }
};

export const KLASSEN_STUFEN = { Basic: 10, T1: 20, T2: 40, T3: 60 };
export const MAX_LEVEL = 40;
export const BLOCK_MAX = 8;

const EXP_BAENDER = [[1, 4, 110], [5, 9, 160], [10, 15, 260], [16, 22, 400], [23, 29, 600], [30, 35, 900], [36, 40, 1300]];
const KORRUPTION = [[75, 3, "Stufe 3"], [50, 2, "Stufe 2"], [25, 1, "Stufe 1"], [0, 0, "rein"]];

function zahl(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Wertpunkte, die bis Level L verteilt sein duerfen: Level 1 = 5 frei + 1 Herkunft, bis 10 je +1, ab 11 je +2.
export function verteiltePunkte(level) {
  const L = Math.min(Math.max(Math.floor(zahl(level)) || 1, 1), MAX_LEVEL);
  return 6 + Math.min(L - 1, 9) + Math.max(L - 10, 0) * 2;
}

// EXP bis zum naechsten Level (Richtwert aus Sitzungen × EXP pro Sitzung).
export function expFuerNaechstesLevel(level) {
  const L = Math.max(Math.floor(zahl(level)) || 1, 1);
  if (L >= MAX_LEVEL) return null;
  const band = EXP_BAENDER.find(([von, bis]) => L >= von && L <= bis) ?? EXP_BAENDER.at(-1);
  const sitzungen = L <= 4 ? 1 : L <= 9 ? 1.5 : L <= 19 ? 2 : L <= 29 ? 2.5 : 3;
  return Math.round((sitzungen * band[2]) / 10) * 10;
}

export function korruptionsStufe(wert) {
  const v = zahl(wert);
  const [, stufe, label] = KORRUPTION.find(([grenze]) => v >= grenze);
  return { stufe, label: v >= 100 ? "Kipppunkt" : label };
}

// Kes: 100 Silber-Kes = 1 Gold-Kes. Gespeichert wird alles in Silber-Kes.
export function kes(sk) {
  const total = Math.max(Math.floor(zahl(sk)), 0);
  const gk = Math.floor(total / 100);
  const rest = total % 100;
  if (!gk) return `${rest} SK`;
  return rest ? `${gk} GK ${rest} SK` : `${gk} GK`;
}

export function parseKes(text) {
  const roh = String(text ?? "").trim();
  const vorzeichen = roh.startsWith("-") || roh.startsWith("−") ? -1 : 1;
  const t = roh.replace(/^[-−+]/, "").replace(",", ".").toUpperCase();
  const gk = Number(t.match(/([\d.]+)\s*GK/)?.[1] ?? 0);
  const sk = Number(t.match(/([\d.]+)\s*SK/)?.[1] ?? (/GK/.test(t) ? 0 : t.match(/[\d.]+/)?.[0] ?? 0));
  return vorzeichen * Math.round(gk * 100 + sk);
}

// Wert eines Attributs; "STR, DEX" oder "STR / DEX" nimmt den hoeheren.
export function attributWert(system, angabe) {
  const keys = String(angabe ?? "").toLowerCase().split(/[^a-z]+/).filter((k) => ATTRS.includes(k));
  if (!keys.length) return 0;
  return Math.max(...keys.map((k) => zahl(system.attributes?.[k]?.value)));
}

// Klassenzuteilung: hoechste freigeschaltete Stufe, Lvl-Satz erfuellt, aehnlichste Verteilung (Kosinus).
export function klasseVorschlag(system, klassen) {
  if (!Array.isArray(klassen) || !klassen.length) return null;
  const werte = Object.fromEntries(ATTRS.map((k) => [k.toUpperCase(), Math.max(zahl(system.attributes?.[k]?.value), 1)]));
  const verteilt = Object.values(werte).reduce((s, v) => s + v - 1, 0);
  const vektor = (req) => ATTRS.map((k) => Math.max((req[k.toUpperCase()] ?? 1) - 1, 0));
  const pv = ATTRS.map((k) => werte[k.toUpperCase()] - 1);
  const kosinus = (u, v) => {
    const nu = Math.hypot(...u);
    const nv = Math.hypot(...v);
    return nu && nv ? u.reduce((s, x, i) => s + x * v[i], 0) / (nu * nv) : 0;
  };
  for (const stufe of ["T3", "T2", "T1", "Basic"]) {
    if (verteilt < KLASSEN_STUFEN[stufe]) continue;
    const passend = klassen.filter((c) => c.category === stufe && (stufe === "Basic" || Object.entries(c.req).every(([a, v]) => werte[a] >= v)));
    if (!passend.length) continue;
    return passend.reduce((best, c) => (kosinus(pv, vektor(c.req)) > kosinus(pv, vektor(best.req)) ? c : best));
  }
  return null;
}

// Boni aller ausgeruesteten Gegenstaende; Ruestungs-HP sind die beim Appraisal gewuerfelten HP.
export function ausruestungsBoni(items) {
  const summe = { rw: 0, mr: 0, acc: 0, damageBonus: 0, magicBonus: 0, block: 0, movement: 0, initiative: 0, hp: 0 };
  for (const item of items ?? []) {
    const s = item.system ?? {};
    if (!(s.equipped === true || s.equipped === "true")) continue;
    for (const key of Object.keys(summe)) summe[key] += zahl(s.bonuses?.[key]);
    if (item.type === "armor") summe.hp += zahl(s.hp);
  }
  return summe;
}

// Alle abgeleiteten Werte eines Charakters oder NSC.
export function berechneWerte(system, items, klassen) {
  const a = (k) => Math.max(zahl(system.attributes?.[k]?.value), 0);
  const L = Math.max(Math.floor(zahl(system.progression?.level)) || 1, 1);
  const g = ausruestungsBoni(items);
  const b = system.bonuses ?? {};
  const abwehr = system.combat?.defending ? 2 : 0;
  const verteilt = ATTRS.reduce((s, k) => s + Math.max(a(k) - 1, 0), 0);
  const erlaubt = verteiltePunkte(L);
  const klasse = klasseVorschlag(system, klassen);

  const derived = {
    level: L,
    hpMax: 20 + 2 * L + 3 * a("con") + g.hp + zahl(b.hp),
    rw: 8 + Math.floor((a("agl") + a("dex")) / 4) + g.rw + zahl(b.rw) + abwehr,
    mr: 8 + Math.floor((a("wis") + a("sou")) / 4) + g.mr + zahl(b.mr) + abwehr,
    block: Math.min(g.block + zahl(b.block), BLOCK_MAX),
    accBonus: g.acc + zahl(b.acc),
    damageBonus: g.damageBonus + zahl(b.damage),
    magicBonus: g.magicBonus,
    movement: 3 + Math.floor(a("spe") / 6) + g.movement + zahl(b.movement),
    initiative: Math.floor(a("spe") / 2) + g.initiative + zahl(b.initiative),
    inventory: 10 + a("str") + zahl(b.inventory),
    points: { used: verteilt, allowed: erlaubt, free: erlaubt - verteilt },
    expNext: expFuerNaechstesLevel(L),
    corruption: korruptionsStufe(system.resources?.corruption?.value),
    suggestedClass: klasse ? `${klasse.name} (${klasse.category})` : "noch keine (ab 10 verteilten Punkten)",
    suggestedClassEffect: klasse ? `${klasse.skill}: ${klasse.effect}` : ""
  };
  return derived;
}

// Monster: feste Werte aus dem Bestiarium, Panzer gibt Blockwert.
export function berechneMonster(system) {
  const m = system.monster ?? {};
  const panzer = /Panzer/.test(m.traits ?? "") ? (["B", "A", "S", "SS"].includes(m.rank) ? 4 : 2) : 0;
  const abwehr = system.combat?.defending ? 2 : 0;
  return {
    level: 1,
    hpMax: zahl(m.hp) || zahl(system.resources?.hp?.max) || 10,
    rw: (zahl(m.rw) || 10) + abwehr,
    mr: (zahl(m.mr) || 10) + abwehr,
    block: Math.min(panzer, BLOCK_MAX),
    accBonus: zahl(m.acc),
    damageBonus: 0,
    magicBonus: 0,
    movement: zahl(m.movement) || 4,
    initiative: zahl(m.initiative),
    inventory: 0,
    points: { used: 0, allowed: 0, free: 0 },
    expNext: null,
    corruption: korruptionsStufe(0),
    suggestedClass: "",
    suggestedClassEffect: ""
  };
}

// Genauigkeit eines Angriffs: ⌊Primaerwert ÷ 3⌋ + Boni. Waffen: Nahkampf STR oder DEX, Fernkampf AGL, Zauberstab INT.
export function angriffsWerte(actor, item) {
  const system = actor.system;
  const derived = system.derived ?? {};
  if (actor.type === "monster") return { acc: zahl(derived.accBonus), bonus: 0, primaer: "Bestiarium" };
  let primaer = item?.system?.scaling?.primary || "";
  let sekundaer = item?.system?.scaling?.secondary || "";
  if (item?.type === "weapon" || !primaer) {
    const art = item?.system?.weaponClass ?? "melee";
    primaer = art === "ranged" ? "AGL" : art === "magic" ? "INT" : "STR, DEX";
    sekundaer = "";
  }
  const p = attributWert(system, primaer);
  const s = attributWert(system, sekundaer);
  const magisch = item?.system?.damageCategory === "magical";
  return {
    acc: Math.floor(p / 3) + zahl(derived.accBonus),
    bonus: Math.floor(p / 4) + Math.floor(s / 8) + zahl(derived.damageBonus) + (magisch ? zahl(derived.magicBonus) : 0),
    primaer
  };
}
