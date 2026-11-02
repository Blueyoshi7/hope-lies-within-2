// Buffs, Verstärkungen und Energielauf (Dominik 2026-11-02)
// - Skills mit Dauer („2 Runden“) legen beim Einsetzen einen Eintrag an: auf dich oder einen eigenen Verbündeten,
//   bei Gegnern als Merker auf dir („Natur-Regen → Wolf“). Gezeigt in der Buff-Leiste über dem Kampf-HUD.
// - Die Zahl ist, wie viele Runden nach dieser noch kommen: in der letzten Runde steht 0. Sie sinkt zu Beginn des
//   eigenen Zugs; danach fällt der Eintrag weg. Kampfende räumt alle Einträge ab.
// - Verstärkungen („+1W6 Schaden bei Waffenangriffen“) rechnen ihren Bonus automatisch in Waffenangriffe ein,
//   solange sie laufen („Nahkampfwaffe“ / „Nahkampfangriffe“: nur im Nahkampf).
// - Meisterung „Wirkt 1 Runde länger“ verlängert die Dauer.
// - Energielauf (Runenmagier): Natur-Skills (Element Erde, Pflanze, Wasser, Wind) wirken doppelt: doppelter Schaden,
//   doppelte Heilung, doppelte Dauer.
// Stand am Actor: flags["hope-lies-within-2"].buffs = [{ id, name, img, runden, gesamt, bonus, bonusText, nurNahkampf, text, ziel }]

const SYSTEM_ID = "hope-lies-within-2";
export const NATUR_ELEMENTE = ["Erde", "Pflanze", "Wasser", "Wind"];

function zahl(wert) {
  const z = Number(wert);
  return Number.isFinite(z) ? z : 0;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function wuerfelFormel(text) {
  return String(text ?? "").replace(/(\d*)W(\d+)/gi, (_, n, f) => `${n || 1}d${f}`).replace(/\s+/g, "");
}

// Wie viele Runden wirkt der Skill? („2 Runden“, „danach 2 Runden erschöpft“, „3 Runden lang …“)
export function dauerRunden(item) {
  const s = item?.system ?? {};
  const m = String(s.dauer ?? "").match(/(\d+)\s*Runde/i) ?? String(s.description ?? "").match(/(\d+)\s*Runden lang/i);
  return m ? Number(m[1]) : 0;
}

function meisterRunden(item) {
  const m = item?.system?.mastery ?? {};
  if (zahl(m.value) < 100) return 0;
  const t = String(m.effect ?? "").match(/(\d+|eine?)\s+Runden?\s+länger/i);
  return t ? (/^\d+$/.test(t[1]) ? Number(t[1]) : 1) : 0;
}

// Bonus-Schaden einer Verstärkung: „+1W6 Schaden bei Waffenangriffen“, „+2W4 Schaden“ (Waffe oder Fäuste)
export function verstaerkung(item) {
  const s = item?.system ?? {};
  const text = `${s.description ?? ""} ${s.effect ?? ""}`;
  const istVerstaerkung = s.skillType === "Verstärkung" || /verstärkung/i.test(item?.name ?? "") || /überzieht deine|umrankt deine|Nahkampfangriffe und Nahkampf-Skills machen/i.test(text);
  const m = text.match(/\+\s*(\d*W\d+(?:\s*\+\s*\d+)?)\s+Schaden/i);
  if (!istVerstaerkung || !m) return null;
  return { bonus: wuerfelFormel(m[1]), bonusText: `+${m[1].replace(/\s+/g, "")}`, nurNahkampf: /Nahkampfwaffe|Nahkampfangriffe/i.test(text) };
}

export function istNaturSkill(item) {
  return NATUR_ELEMENTE.includes(item?.system?.element);
}

// Hat der Charakter Energielauf (Klassen-Skill des Runenmagiers) und ist es ein Natur-Skill?
export function energielauf(actor, item) {
  if (!istNaturSkill(item)) return false;
  return !!actor?.items?.some((i) => i.type === "classSkill" && i.name === "Energielauf");
}

export function buffsVon(actor) {
  const liste = actor?.getFlag(SYSTEM_ID, "buffs");
  return Array.isArray(liste) ? liste : [];
}

// Einen Eintrag anlegen oder erneuern (gleicher Skill: Dauer neu)
export async function buffSetzen(traeger, item, { energie = false, ziel = "" } = {}) {
  const grund = dauerRunden(item);
  if (!grund || !traeger?.isOwner) return null;
  const gesamt = (grund + meisterRunden(item)) * (energie ? 2 : 1);
  const v = verstaerkung(item);
  const eintrag = {
    id: `${item.id}${ziel ? `-${ziel}` : ""}`, name: item.name, img: item.img, runden: gesamt - 1, gesamt,
    bonus: v?.bonus ?? "", bonusText: v?.bonusText ?? "", nurNahkampf: !!v?.nurNahkampf,
    text: item.system?.description || item.system?.effect || "", ziel
  };
  const liste = buffsVon(traeger).filter((b) => b.id !== eintrag.id);
  await traeger.setFlag(SYSTEM_ID, "buffs", [...liste, eintrag]);
  return eintrag;
}

// Zu Beginn des eigenen Zugs (beim GM): eine Runde weniger, abgelaufene fallen weg
export async function buffsZugbeginn(actor) {
  const liste = buffsVon(actor);
  if (!liste.length) return;
  const neu = liste.map((b) => ({ ...b, runden: zahl(b.runden) - 1 })).filter((b) => b.runden >= 0);
  await actor.setFlag(SYSTEM_ID, "buffs", neu);
}

// Kampfende: alle Einträge weg
export async function buffsLeeren() {
  for (const actor of game.actors.filter((a) => buffsVon(a).length)) await actor.unsetFlag(SYSTEM_ID, "buffs");
  for (const scene of game.scenes) {
    for (const token of scene.tokens.filter((t) => !t.actorLink && buffsVon(t.actor).length)) await token.actor.unsetFlag(SYSTEM_ID, "buffs");
  }
}

// Bonus-Schaden aller laufenden Verstärkungen für einen Waffenangriff
export function buffBonus(actor, { nahkampf = true } = {}) {
  return buffsVon(actor).filter((b) => b.bonus && (!b.nurNahkampf || nahkampf));
}

// Buff-Leiste über dem Kampf-HUD
export function buffLeisteHtml(actor) {
  const liste = buffsVon(actor);
  if (!liste.length) return "";
  return `<div class="hh-buffs">${liste.map((b) => {
    const tip = `<strong>${escapeHtml(b.name)}${b.ziel ? ` → ${escapeHtml(b.ziel)}` : ""}</strong><br>${escapeHtml(b.text)}${b.bonusText ? `<br>Waffenangriffe ${escapeHtml(b.bonusText)} Schaden` : ""}<br>Noch ${zahl(b.runden)} ${zahl(b.runden) === 1 ? "Runde" : "Runden"} nach dieser`;
    return `<div class="hh-buff ${zahl(b.runden) === 0 ? "is-letzte" : ""}" data-tooltip-html="${escapeHtml(tip)}" data-tooltip-direction="UP">
      <img src="${escapeHtml(b.img)}" alt=""><b>${zahl(b.runden)}</b>
    </div>`;
  }).join("")}</div>`;
}
