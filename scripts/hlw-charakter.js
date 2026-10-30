// Spielercharaktere: Anlegen durch den GM, Punkte verteilen durch die Spieler (mit Speichern und Klassen-Enthüllung)
// und Skill-Appraisal (Spieler sehen neue Skills zuerst nur ungenau).

const SYSTEM_ID = "hope-lies-within-2";

export const HERKUNFT = {
  A: { label: "A: Dorfkinder", attr: "con", text: "+1 CON – Harte Arbeit auf dem Hof" },
  B: { label: "B: Gildenrekruten", attr: "edu", text: "+1 EDU – Grundausbildung der Gilde" },
  C: { label: "C: Überlebende eines Nebelfalls", attr: "sou", text: "+1 SOU – Der Kern ist erwacht" },
  D: { label: "D: Kinder ruinierter Familien", attr: "spe", text: "+1 SPE – Wer flieht, lernt zu rennen" }
};

// Probenwert nach Rang (wie im Bestiarium)
const PROBENWERT = { E: 15, D: 20, C: 25, B: 30, A: 40, S: 50, SS: 60 };

function zahl(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function html(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// ---------- Spielercharakter anlegen (GM) ----------
export async function spielercharakterAnlegen() {
  if (!game.user?.isGM) return;
  const spieler = game.users.filter((u) => !u.isGM);
  const content = `
    <div class="hlw-anlegen">
      <label>Name <input name="name" type="text" placeholder="Name des Charakters" autofocus></label>
      <label>Spieler
        <select name="spieler">${spieler.map((u) => `<option value="${u.id}">${html(u.name)}</option>`).join("")}<option value="">— noch niemand —</option></select>
      </label>
      <label>Herkunft
        <select name="herkunft">${Object.entries(HERKUNFT).map(([k, h]) => `<option value="${k}">${html(h.label)} (${html(h.text.split(" – ")[0])})</option>`).join("")}</select>
      </label>
      <label>Token-Bild (rund, für die Karte)
        <span class="hlw-bildwahl"><input name="token" type="text" placeholder="optional"><button type="button" data-bild="token" title="Bild wählen"><i class="fa-solid fa-folder-open"></i></button></span>
      </label>
      <label>Figur (ganzer Körper, für den Bogen)
        <span class="hlw-bildwahl"><input name="figur" type="text" placeholder="optional"><button type="button" data-bild="figur" title="Bild wählen"><i class="fa-solid fa-folder-open"></i></button></span>
      </label>
      <p>Der Spieler verteilt seine Punkte danach selbst im Bogen und sieht seine Klasse erst beim Speichern. Beide Bilder kannst du später im Bogen ändern (Klick auf das Bild oben links bzw. auf die Figur).</p>
    </div>`;
  const daten = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Spielercharakter anlegen" },
    classes: ["hope-lies-within", "hlw-detail-dialog"],
    content,
    ok: { label: "Anlegen", icon: "fa-solid fa-user-plus", callback: (event, button) => Object.fromEntries(new FormData(button.form)) },
    rejectClose: false,
    render: (event, dialog) => {
      const root = dialog.element ?? event?.target?.element;
      root?.querySelectorAll("[data-bild]").forEach((knopf) => knopf.addEventListener("click", () => {
        const feld = root.querySelector(`input[name='${knopf.dataset.bild}']`);
        const Picker = foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
        new Picker({ type: "image", current: feld.value, callback: (pfad) => (feld.value = pfad) }).render(true);
      }));
    }
  });
  if (!daten) return;
  const name = String(daten.name || "").trim() || "Neuer Charakter";
  const h = HERKUNFT[daten.herkunft] ?? HERKUNFT.A;
  const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
  if (daten.spieler) ownership[daten.spieler] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  const ordner = game.folders.find((f) => f.type === "Actor" && f.name === "Spielercharaktere") ?? await Folder.create({ name: "Spielercharaktere", type: "Actor" });
  const actor = await Actor.create({
    name,
    type: "character",
    folder: ordner.id,
    ownership,
    system: {
      identity: { origin: h.label, player: game.users.get(daten.spieler)?.name ?? "" },
      progression: { level: 1, classAuto: true },
      // Der Herkunftspunkt steckt schon im passenden Wert; die 5 freien Punkte verteilt der Spieler.
      attributes: { [h.attr]: { value: 2 } }
    },
    ...(daten.token ? { img: daten.token } : {}),
    ...(daten.figur ? { flags: { "hope-lies-within-2": { figur: daten.figur } } } : {}),
    prototypeToken: {
      name, actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER, sight: { enabled: true },
      ...(daten.token ? { texture: { src: daten.token } } : {})
    }
  });
  if (daten.spieler) await game.users.get(daten.spieler)?.update({ character: actor.id });
  ui.notifications?.info(`${name} angelegt${daten.spieler ? ` und ${game.users.get(daten.spieler)?.name} zugewiesen` : ""}.`);
  actor.sheet.render(true);
  return actor;
}

// ---------- Klasse enthüllen ----------
export function klasseEnthuellen(actor, klasse, alteKlasse) {
  document.querySelector(".hlw-enthuellung")?.remove();
  const neu = Boolean(alteKlasse && alteKlasse !== klasse.name);
  const el = document.createElement("div");
  el.className = "hope-lies-within hlw-enthuellung";
  el.innerHTML = `
    <div class="he-karte">
      <div class="he-kopf">${neu ? `Aus ${html(alteKlasse)} wird` : "Deine Klasse"}</div>
      <div class="he-bild"><img src="${html(klasse.img || "")}" alt=""></div>
      <h2>${html(klasse.name)}</h2>
      <div class="he-stufe">${html(klasse.category)} · ${html(klasse.role || "")}</div>
      <div class="he-skill"><strong>${html(klasse.skill)}</strong><span>${html(klasse.effect)}</span></div>
      <button type="button">Weiter</button>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-offen"));
  const zu = () => { el.classList.remove("is-offen"); setTimeout(() => el.remove(), 400); };
  el.addEventListener("click", (event) => { if (event.target === el || event.target.closest("button")) zu(); });
}

// ---------- Skill-Orbs ----------
// Der GM gibt Skill-Orbs T1–T3 (Verbrauchsgegenstände). Appraisal ist ein Glücksspiel (Kanon: Punktesystem):
// 1W20 + SOU gegen 10 / 15 / 20. Gelingt es, verschwindet der Orb und ein bestimmter Skill-Orb wird zufällig gezogen
// (T1: D, 5 % C · T2: D oder C, 5 % B · T3: C oder B, 5 % A; nie Klassen- oder Abyss-Skills). Misslingt es, bleibt der Orb.
// Ein bestimmter Skill-Orb ist ein noch nicht gelernter Skill im Inventar; er zeigt Namen und alle Werte.
export const ORB_STUFEN = ["ungenau", "Art bekannt", "Art, Reichweite und Schaden", "alles bekannt (Gilde)"];

const ELEMENTE = [
  [/feuer|flamm|glut|brand|phönix|himmelsfeuer/i, "nach Feuer und Asche"], [/eis|frost|kälte/i, "nach Frost"], [/blitz|donner|sturm|funke/i, "nach Gewitter"],
  [/erde|stein|fels|beben|sand/i, "nach Erde und Stein"], [/schatten|dunkel|nacht/i, "nach Schatten"], [/licht|heilig|gött|gnade|glaube/i, "nach warmem Licht"],
  [/gift|säure|faul|spore/i, "bitter und giftig"], [/wind|luft|sprung/i, "nach Wind"], [/wasser|regen|flut|träne/i, "nach Wasser"],
  [/natur|baum|efeu|dorn|blatt/i, "nach Wald und Moos"], [/seele|geist/i, "nach etwas Fremdem in der eigenen Seele"], [/abyss|void|leere/i, "falsch, wie violetter Nebel"],
  [/blut/i, "nach Eisen und Blut"], [/klinge|schnitt|hieb|stoß|schlag/i, "nach Stahl"], [/pfeil|schuss/i, "nach gespannter Sehne"]
];
const STAERKE = { E: "schwach", D: "spürbar", C: "kräftig", B: "stark", A: "gewaltig", S: "überwältigend", SS: "überwältigend" };
const ART_NAME = { Magie: "Magie", Nahkampf: "Nahkampf", Fernkampf: "Fernkampf", Heilung: "Heilung", Verteidigung: "Verteidigung", Verstärkung: "Verstärkung", Schwächung: "Schwächung", Passive: "Passiv" };

export function istOrb(item) {
  return item?.type === "playerSkill" && item.parent?.type === "character" && !(item.system?.learned === true || item.system?.learned === "true");
}

export function orbStufe(item) {
  return Math.min(Math.max(zahl(item?.system?.appraisal?.stufe), 0), 3);
}

export function orbName(item) {
  return `Skill-Orb: ${item.name}`;
}

export function vageBeschreibung(item) {
  const s = item.system ?? {};
  const text = `${item.name} ${s.description ?? ""} ${s.effect ?? ""} ${s.element ?? ""}`;
  const element = ELEMENTE.find(([muster]) => muster.test(text))?.[1];
  const staerke = STAERKE[String(s.rank ?? "").toUpperCase()] ?? "unklar";
  return `Im Orb schimmert etwas${element ? `; es fühlt sich ${element} an` : ""}. Die Kraft darin wirkt ${staerke}.`;
}

// Was der Spieler über einen Orb weiß (der GM sieht immer alles)
export function orbWissen(item) {
  const s = item.system ?? {};
  // Seit dem Glücksspiel-Appraisal zeigt ein bestimmter Skill-Orb immer alles
  const stufe = 3;
  const zeilen = [vageBeschreibung(item)];
  if (stufe >= 1) zeilen.push(`Art: ${ART_NAME[s.skillType] ?? s.skillType ?? "unklar"}`);
  if (stufe >= 2) {
    zeilen.push(`Reichweite: ${s.range || "–"}`);
    zeilen.push(`Schaden: ${s.damageText || s.damage || "–"}`);
  }
  if (stufe >= 3) zeilen.splice(0, 1, `${item.name}: ${s.effect || s.description || ""}`);
  return { stufe, zeilen };
}

export async function orbUntersuchen(actor, item) {
  if (!istOrb(item)) return;
  if (item.system?.appraisal?.versucht && !game.user?.isGM) {
    ui.notifications?.warn("Diesen Orb hast du schon untersucht. Ein neuer Versuch nur mit Erlaubnis des GM, oder die Gilde sieht ihn sich an.");
    return;
  }
  const sou = zahl(actor.system?.attributes?.sou?.value);
  const roll = await new Roll(`1d20 + ${sou}`).evaluate();
  const ergebnis = roll.total >= 20 ? 2 : roll.total >= 10 ? 1 : 0;
  const neu = Math.max(orbStufe(item), ergebnis);
  await item.update({ "system.appraisal.stufe": neu, "system.appraisal.versucht": true });
  const wissen = orbWissen({ ...item, name: item.name, system: { ...item.system, appraisal: { stufe: neu } } });
  // Nur der Spieler und der GM sehen das Ergebnis
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<div class="hlw-chat-card"><h2>Appraisal: ${html(orbName(item))}</h2><p>1W20 + Seelenkraft (${sou}) · unter 10 ungenau · 10–19 Art · ab 20 Art, Reichweite, Schaden</p><p><strong>${html(ORB_STUFEN[neu])}</strong></p><p>${wissen.zeilen.map(html).join("<br>")}</p></div>`
  }, { rollMode: CONST.DICE_ROLL_MODES.PRIVATE });
}

// ---------- Skill-Orbs T1–T3: Appraisal als Glücksspiel ----------
const ORB_SCHWELLE = { 1: 10, 2: 15, 3: 20 };
const ORB_RAENGE = { 1: { normal: ["D"], selten: "C" }, 2: { normal: ["D", "C"], selten: "B" }, 3: { normal: ["C", "B"], selten: "A" } };
const SELTEN_CHANCE = 0.05;
let skillPool = null;

export function orbTier(item) {
  const m = String(item?.name ?? "").match(/^Skill-Orb T([123])$/i);
  return item?.type === "consumable" && m ? Number(m[1]) : 0;
}

export function orbTierVersucht(item) {
  return Boolean(item?.getFlag?.(SYSTEM_ID, "appraisalVersucht"));
}

async function skillsZumZiehen() {
  if (!skillPool) {
    const liste = await (await fetch(`systems/${SYSTEM_ID}/import/skills.json`)).json();
    // Nur Spieler-Skills; Abyss-Skills (SS) gibt es nie aus einem Orb
    skillPool = liste.filter((s) => s.type === "playerSkill" && !["S", "SS"].includes(s.system?.rank));
  }
  return skillPool;
}

function zufall(liste) {
  return liste[Math.floor(Math.random() * liste.length)];
}

async function skillZiehen(tier) {
  const pool = await skillsZumZiehen();
  const raenge = ORB_RAENGE[tier];
  const selten = Math.random() < SELTEN_CHANCE;
  const rang = selten ? raenge.selten : zufall(raenge.normal);
  return { skill: zufall(pool.filter((s) => s.system?.rank === rang)), selten, rang };
}

function hatAdlerauge(actor) {
  return actor.items.some((i) => i.type === "playerSkill" && i.name === "Adlerauge" && (i.system?.learned === true || i.system?.learned === "true"));
}

export async function orbGluecksspiel(actor, item) {
  const tier = orbTier(item);
  if (!tier) return;
  if (orbTierVersucht(item) && !game.user?.isGM) {
    ui.notifications?.warn("Bei diesem Orb ist das Appraisal schon misslungen. Ein neuer Versuch nur mit Erlaubnis des GM.");
    return;
  }
  const schwelle = ORB_SCHWELLE[tier];
  const sou = zahl(actor.system?.attributes?.sou?.value);
  const adlerauge = hatAdlerauge(actor);
  const roll = await new Roll(`1d20 + ${sou}`).evaluate();
  const gelungen = adlerauge || roll.total >= schwelle;
  const kopf = `<h2>Appraisal: Skill-Orb T${tier}</h2><p>1W20 + Seelenkraft (${sou}) gegen ${schwelle}${adlerauge ? " · Adlerauge: gelingt immer" : ""}</p>`;

  if (!gelungen) {
    // Nur dieser eine Orb gilt als versucht; der Rest des Stapels bleibt unberührt.
    const menge = zahl(item.system?.quantity) || 1;
    if (menge > 1) {
      await item.update({ "system.quantity": menge - 1 });
      const daten = item.toObject();
      delete daten._id;
      daten.system.quantity = 1;
      daten.flags = { ...(daten.flags ?? {}), [SYSTEM_ID]: { ...(daten.flags?.[SYSTEM_ID] ?? {}), appraisalVersucht: true } };
      await actor.createEmbeddedDocuments("Item", [daten]);
    } else await item.setFlag(SYSTEM_ID, "appraisalVersucht", true);
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="hlw-chat-card">${kopf}<p><strong>Misslungen.</strong> Der Orb bleibt versiegelt.</p></div>`
    });
    return;
  }

  const { skill, selten, rang } = await skillZiehen(tier);
  if (!skill) return ui.notifications?.error(`Kein Rang-${rang}-Skill zum Ziehen gefunden.`);
  const menge = zahl(item.system?.quantity) || 1;
  if (menge > 1) await item.update({ "system.quantity": menge - 1 });
  else await item.delete();
  const system = foundry.utils.deepClone(skill.system);
  system.learned = false;
  system.appraisal = { stufe: 3, versucht: true };
  system.mastery = { ...(system.mastery ?? {}), value: 0 };
  await actor.createEmbeddedDocuments("Item", [{ name: skill.name, type: "playerSkill", img: skill.img, system }]);
  const wert = zahl(skill.system?.priceSk);
  const orbWert = zahl(item.system?.priceSk);
  const vergleich = orbWert ? (wert > orbWert ? "mehr wert als der Orb" : wert < orbWert ? "weniger wert als der Orb" : "genau so viel wert wie der Orb") : "";
  const content = `<div class="hlw-chat-card">${kopf}
    ${adlerauge ? "" : `<p>Wurf: ${roll.total}</p>`}
    <p><strong>Gelungen!</strong>${selten ? " <em>Ein seltener Fund!</em>" : ""}</p>
    <p>Im Orb steckt: <strong>${html(skill.name)}</strong> (Rang ${html(rang)}${wert ? `, Marktwert ${html(kesText(wert))}` : ""}${vergleich ? `, ${vergleich}` : ""}).</p>
    <p>${html(skill.system?.description || "")}</p></div>`;
  if (adlerauge) await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
  else await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: content });
}

function kesText(sk) {
  const gk = Math.floor(sk / 100);
  const rest = sk % 100;
  return [gk ? `${gk} GK` : "", rest || !gk ? `${rest} SK` : ""].filter(Boolean).join(" ");
}

// ---------- Skill-Ansicht (Spieler und GM) ----------
const EINSATZ_TEXT = { action: "Aktion", quick: "Schnellaktion", reaction: "Reaktion" };

function abklingText(s) {
  if (s.einmalProKampf === true || s.einmalProKampf === "true") return s.cooldownText || "einmal pro Kampf";
  const max = zahl(s.cooldown?.max);
  if (!max) return s.cooldownText || "–";
  return max === 1 ? "jeden Zug" : `${max} Züge`;
}

// Alle festen Werte eines Skills als Zeilen [Bezeichnung, Wert]
export function skillZeilen(item) {
  const s = item.system ?? {};
  const passiv = String(s.activation ?? "").toLowerCase() === "passive";
  const heilung = /heil/i.test(String(s.skillType ?? ""));
  const reichweite = s.range === 0 || s.range === "0" ? "du selbst" : s.range ? `${s.range} Felder` : "";
  const skalierung = [s.scaling?.primary, s.scaling?.secondary, s.scaling?.tertiary].filter(Boolean).join(" / ");
  const zeilen = [
    ["Rang", s.rank],
    ["Art", ART_NAME[s.skillType] ?? s.skillType],
    ["Einsatz", passiv ? "Passiv · wirkt immer" : EINSATZ_TEXT[s.castTime] ?? "Aktion"],
    ["Reichweite", passiv ? "" : reichweite],
    ["Abklingzeit", passiv ? "" : abklingText(s)],
    [heilung ? "Heilung" : "Schaden", s.heilung || s.damageText || s.damage],
    ["Schutz", s.schutz],
    ["Ziele", zahl(s.ziele) > 1 ? `${zahl(s.ziele)} verschiedene` : ""],
    ["Fläche", s.flaeche],
    ["Dauer", s.dauer],
    ["Skaliert mit", skalierung],
    ["Klasse", item.type === "classSkill" ? s.className : ""],
    ["Bei 100 % Meisterung", s.mastery?.effect]
  ];
  return zeilen.filter(([, wert]) => wert !== undefined && wert !== null && String(wert).trim() !== "");
}

export async function zeigeSkill(item, { aktionen = [] } = {}) {
  const s = item.system ?? {};
  const zeilen = skillZeilen(item);
  const orb = istOrb(item);
  const content = `
    <div class="hlw-item-detail hlw-skill-detail">
      <img src="${html(item.img || "")}" alt="">
      <div>
        <h2>${html(orb ? orbName(item) : item.name)}</h2>
        <p class="hs-text">${html(s.description || s.effect || "Keine Beschreibung.")}</p>
        <dl>${zeilen.map(([k, v]) => `<dt>${html(k)}</dt><dd>${html(v)}</dd>`).join("")}</dl>
        ${orb ? `<p class="hs-hinweis">Noch nicht gelernt. Lernen verbraucht den Orb und belegt einen Skill-Slot.${zahl(s.priceSk) ? ` Marktwert ${html(kesText(zahl(s.priceSk)))}.` : ""}</p>` : ""}
      </div>
    </div>`;
  const knoepfe = [...aktionen.map(([action, label, icon]) => ({ action, label, icon: `fa-solid ${icon}` })), { action: "ok", label: "Schließen", icon: "fa-solid fa-check", default: true }];
  const fenster = new foundry.applications.api.DialogV2({
    window: { title: item.name },
    classes: ["hope-lies-within", "hlw-detail-dialog"],
    content,
    buttons: knoepfe,
    submit: (ergebnis) => aktionen.find(([action]) => action === ergebnis)?.[3]?.()
  });
  await fenster.render({ force: true });
  fenster.setPosition({ width: 500, height: "auto", left: (window.innerWidth - 500) / 2, top: window.innerHeight / 6 });
}

export async function orbLernen(actor, item, slots) {
  if (!istOrb(item)) return;
  if (slots.used >= slots.max) {
    ui.notifications?.warn(`Alle Skill-Slots sind belegt (${slots.used} / ${slots.max}). Erst einen Skill aufgeben oder Level steigern.`);
    return;
  }
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Skill-Orb aufnehmen?" },
    classes: ["hope-lies-within", "hlw-detail-dialog"],
    content: `<p>Dein Kern nimmt den Orb auf. Er belegt einen Skill-Slot (${slots.used + 1} / ${slots.max}) und ist danach verbraucht.</p>`
  });
  if (!ok) return;
  await item.update({ "system.learned": true, "system.mastery.value": 0 });
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="hlw-chat-card"><h2>Neuer Skill: ${html(item.name)}</h2><p>${html(actor.name)} nimmt den Skill-Orb auf.</p><p>${html(item.system?.effect || item.system?.description || "")}</p></div>` });
}

// ---------- Meisterung ----------
export function meisterung(item) {
  const m = item?.system?.mastery ?? {};
  const wert = Math.min(Math.max(zahl(m.value), 0), 100);
  return { wert, fertig: wert >= 100, text: m.effect || "", bonus: m.bonus ?? {} };
}

export function istGelernterSkill(item) {
  return item?.type === "playerSkill" && item.parent?.type === "character" && !istOrb(item);
}

export async function meisterungPlus(actor, item, schritte = 1) {
  if (!istGelernterSkill(item)) return;
  const vorher = meisterung(item).wert;
  if (vorher >= 100) return;
  const neu = Math.min(vorher + schritte, 100);
  await item.update({ "system.mastery.value": neu });
  if (neu >= 100) {
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="hlw-chat-card"><h2>${html(item.name)} gemeistert!</h2><p>Zusatzeffekt ab jetzt: <strong>${html(item.system?.mastery?.effect || "")}</strong></p></div>` });
  }
}
