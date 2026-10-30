// EXP-Kristalle und Abyss-Kristalle (Kanon: Tab Kristalle, 2026-10-30)
// Jedes besiegte Monster lässt Kristalle seines Rangs direkt ins Inventar dessen, der es besiegt hat.
// Ein Kristall hält EXP: verwenden, weitergeben oder verkaufen (die Gilde zahlt den vollen Wert).
// Korrumpierte Monster und Abyss-Wesen lassen Abyss-Kristalle: mehr EXP, aber Korruption; die Gilde will jeden davon.

const SYSTEM_ID = "hope-lies-within-2";
const RAENGE = ["E", "D", "C", "B", "A", "S", "SS"];
export const KRISTALL = {
  exp: { D: 6, C: 12, B: 20, A: 35, S: 60 },
  abyssExp: { D: 9, C: 18, B: 30, A: 50, S: 90 },
  korruption: { D: 1, C: 2, B: 3, A: 5, S: 10 }
};
const ANZAHL = { Diener: 0, Normal: 1, Elite: 2, Boss: 4 };

function zahl(wert) {
  const z = Number(wert);
  return Number.isFinite(z) ? z : 0;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// Ist das ein Kristall? → { rang, abyss, exp, korruption } oder null
export function kristallInfo(item) {
  const m = String(item?.name ?? "").match(/^(EXP|Abyss)-Kristall ([DCBAS])$/);
  if (m) {
    const abyss = m[1] === "Abyss";
    return { rang: m[2], abyss, exp: (abyss ? KRISTALL.abyssExp : KRISTALL.exp)[m[2]], korruption: abyss ? KRISTALL.korruption[m[2]] : 0 };
  }
  if (item?.name === "Kern eines Verlorenen") return { rang: "S", abyss: true, exp: 150, korruption: 20, kern: true };
  return null;
}

// Welche Kristalle lässt dieses Monster? Würfelt Diener (1W4 = 4) und Rang E (11+ auf 1W20).
// → { name, anzahl, wurf } (anzahl 0 = diesmal keiner) oder null (harmlose Tiere, keine Monster)
export async function kristallBeute(actor) {
  const m = actor?.system?.monster;
  if (!m || actor.type !== "monster" || m.harmless === true || m.harmless === "true") return null;
  const stufe = String(m.category ?? "") === "Abyss-Wesen" ? Math.max(zahl(m.corrupted), 3) : zahl(m.corrupted);
  const abyss = stufe > 0;
  const basis = RAENGE.indexOf(String(m.rank ?? "").toUpperCase());
  let rang = RAENGE[Math.min(RAENGE.length - 1, Math.max(basis, 0) + (stufe >= 2 ? stufe - 1 : 0))];
  let anzahl = ANZAHL[m.role] ?? 1;
  const wuerfe = [];
  if (anzahl === 0) {
    const w = (await new Roll("1d4").evaluate()).total;
    wuerfe.push(`1W4 = ${w}`);
    anzahl = w === 4 ? 1 : 0;
  }
  if (rang === "SS") { rang = "S"; anzahl *= 2; }
  if (rang === "E") {
    rang = "D";
    let treffer = 0;
    for (let i = 0; i < anzahl; i++) {
      const w = (await new Roll("1d20").evaluate()).total;
      wuerfe.push(`1W20 = ${w}`);
      if (w >= 11) treffer++;
    }
    anzahl = treffer;
  }
  return { name: `${abyss ? "Abyss" : "EXP"}-Kristall ${rang}`, anzahl, wurf: wuerfe.join(", ") };
}

// Gegenstandsdaten aus der Import-Liste (Fallback: Gegenstand der Welt). Nur Name, Typ, Bild und Werte.
let importCache = null;
async function kristallDaten(name) {
  if (!importCache) {
    try {
      const antwort = await fetch(`systems/${SYSTEM_ID}/import/consumables.json`);
      importCache = antwort.ok ? await antwort.json() : [];
    } catch {
      importCache = [];
    }
  }
  const quelle = importCache.find((e) => e.name === name) ?? game.items?.getName(name)?.toObject();
  if (!quelle) return { name, type: "consumable", img: "icons/commodities/gems/gem-rough-cushion-blue.webp", system: { quantity: 1 } };
  return { name: quelle.name, type: quelle.type, img: quelle.img, system: foundry.utils.deepClone(quelle.system) };
}

// GM: Kristalle ins Inventar legen (stapelt mit vorhandenen gleichen Kristallen außerhalb des Rucksacks)
export async function kristalleGeben(actor, name, anzahl = 1) {
  if (!actor || anzahl <= 0) return;
  const vorhanden = actor.items.find((i) => i.name === name && !i.getFlag(SYSTEM_ID, "rucksack"));
  if (vorhanden) return vorhanden.update({ "system.quantity": Math.max(zahl(vorhanden.system?.quantity), 1) + anzahl });
  const daten = await kristallDaten(name);
  daten.system.quantity = anzahl;
  return actor.createEmbeddedDocuments("Item", [daten]);
}

// Zeile für die Chat-Karte „… ist besiegt“
export function kristallZeile(spieler, beute) {
  if (!beute) return "";
  if (!beute.anzahl) return `Kein Kristall diesmal${beute.wurf ? ` (${escapeHtml(beute.wurf)})` : ""}.`;
  const was = `${beute.anzahl > 1 ? `${beute.anzahl} × ` : ""}${escapeHtml(beute.name)}`;
  return `<strong>${escapeHtml(spieler?.name ?? "Niemand")}</strong> bekommt ${was}${beute.wurf ? ` (${escapeHtml(beute.wurf)})` : ""}.`;
}

// Nur der GM und die Besitzer der Figur sehen, was mit Kristallen passiert (Spieler dürfen Geheimnisse haben)
function nurGmUndBesitzer(actor) {
  return game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id);
}

function imKampf(actor) {
  return !!game.combat?.started && game.combat.combatants.some((c) => c.actor?.id === actor.id || c.actorId === actor.id);
}

async function stueckWeg(item) {
  const menge = Math.max(zahl(item.system?.quantity), 1);
  if (menge > 1) await item.update({ "system.quantity": menge - 1 });
  else await item.delete();
}

// Korruption nach Resistenz: ⌊Willenskraft ÷ 10⌋ weniger, mindestens +1
async function korruptionPlus(actor, wert) {
  if (!wert) return 0;
  const resistenz = Math.floor(zahl(actor.system?.worldSkills?.willenskraft?.total) / 10);
  const plus = Math.max(wert - resistenz, 1);
  const alt = zahl(actor.system?.resources?.corruption?.value);
  await actor.update({ "system.resources.corruption.value": Math.min(alt + plus, 100) });
  return plus;
}

// Verwenden: außerhalb des Kampfs, der Kristall zerfällt und gibt seine EXP (Abyss: dazu Korruption)
export async function kristallVerwenden(actor, item) {
  const info = kristallInfo(item);
  if (!actor || !info) return;
  if (imKampf(actor) && !game.user?.isGM) return ui.notifications?.warn("Kristalle verwendet man außerhalb des Kampfs. Abyss-Kristalle kann man im Kampf einsetzen.");
  if (info.abyss) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: `${item.name} verwenden?` },
      content: `<p>Gibt ${info.exp} EXP, aber +${info.korruption} Korruption (abzüglich Resistenz). Abyss-Kristalle gehören nach dem Gildenpakt der Gilde.</p>`,
      yes: { label: "Verwenden", icon: "fa-solid fa-gem" },
      no: { label: "Abbrechen" },
      rejectClose: false
    });
    if (!ok) return;
  }
  const exp = zahl(actor.system?.progression?.exp) + info.exp;
  await actor.update({ "system.progression.exp": exp });
  const plus = await korruptionPlus(actor, info.korruption);
  await stueckWeg(item);
  const naechstes = zahl(actor.system?.derived?.expNext);
  const levelText = naechstes && exp >= naechstes ? ` Genug für Level ${zahl(actor.system?.progression?.level) + 1} (Level-Up bei der Gilde).` : "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: nurGmUndBesitzer(actor),
    content: `<div class="hlw-chat-card hlw-chat-kurz"><h2>${escapeHtml(item.name)} verwendet</h2><p>${escapeHtml(actor.name)} nimmt ${info.exp} EXP auf${plus ? ` und bekommt +${plus} Korruption` : ""}.${levelText}</p></div>`
  });
}

// Abyss-Kristall im Kampf einsetzen (Schnellaktion): nächster Skill ohne Cooldown oder +1W6, Kristall weg, Korruption, keine EXP
export async function kristallEinsetzen(actor, item) {
  const info = kristallInfo(item);
  if (!actor || !info?.abyss) return;
  const plus = await korruptionPlus(actor, info.korruption);
  await stueckWeg(item);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: nurGmUndBesitzer(actor),
    content: `<div class="hlw-chat-card hlw-chat-kurz"><h2>${escapeHtml(item.name)} eingesetzt</h2><p>Schnellaktion: Der nächste Skill in diesem Zug ignoriert seinen Cooldown oder bekommt +1W6. ${escapeHtml(actor.name)} bekommt +${plus} Korruption.</p></div>`
  });
}
