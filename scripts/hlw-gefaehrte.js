// Zähmen und Gefährten (Bestiarium, Ergänzung 2026-10-29).
// Nur Tier-Klassen zähmen (Klassen-Skill „Zähmen“). Der Gefährte belegt die Nebenhand, wird per Schnellaktion
// gerufen und bleibt so viele Runden auf dem Feld, wie die Klasse erlaubt. Er handelt im Zug seines Besitzers.
// Alles, was Figuren oder fremde Actors anlegt oder löscht, macht der GM-Client (Socket).

const SYSTEM_ID = "hope-lies-within-2";
const SOCKET = `system.${SYSTEM_ID}`;
const RAENGE = ["E", "D", "C", "B", "A", "S", "SS"];
const PAUSE_NACH_RUF = 2;

function zahl(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function html(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// Der Gefährte gehört immer zum Charakter selbst, nicht zur Kopie einer nicht verknüpften Figur.
function basis(actor) {
  return actor?.isToken ? (game.actors?.get(actor.id) ?? actor) : actor;
}

export function gefaehrteVon(actor) {
  const g = basis(actor)?.system?.companion ?? {};
  if (!g.actorId) return null;
  const begleiter = game.actors?.get(g.actorId) ?? null;
  const token = g.tokenId ? game.scenes?.get(g.sceneId)?.tokens?.get(g.tokenId) : null;
  return { ...g, actor: begleiter, token, aufFeld: Boolean(token) };
}

export function besitzerVon(actor) {
  const id = actor?.getFlag?.(SYSTEM_ID, "besitzer");
  return id ? game.actors?.get(id) ?? null : null;
}

// Beste Zähm-Fähigkeit des Charakters aus seinen Klassen-Skills „Zähmen“ (Klassenliste data/klassen.json).
export function zaehmFaehigkeit(actor, klassen) {
  let beste = null;
  for (const item of actor?.items ?? []) {
    if (item.type !== "classSkill" || item.system?.skillType !== "Zähmen") continue;
    const info = klassen.find((k) => k.name === item.system?.className)?.zaehmen;
    if (info && (!beste || RAENGE.indexOf(info.maxRang) > RAENGE.indexOf(beste.maxRang))) beste = { ...info, klasse: item.system.className };
  }
  return beste;
}

// Klassen-Skill „Zähmen“ für eine Tier-Klasse
export function zaehmSkillDaten(klasse) {
  const z = klasse.zaehmen;
  return {
    name: "Zähmen",
    type: "classSkill",
    img: `systems/${SYSTEM_ID}/assets/icons/klassen/tierische-synergie.webp`,
    system: {
      className: klasse.name,
      skillType: "Zähmen",
      activation: "active",
      castTime: "action",
      rank: { Basic: "E", T1: "D", T2: "C", T3: "B" }[klasse.category] ?? "",
      range: 1,
      effect: `Aktion, Ziel in 1 Feld: 1W20 + Tierkunde${z.bonus ? ` + ${z.bonus}` : ""} gegen den Probenwert des Monsters. Zähmbar bis Rang ${z.maxRang}. Der Gefährte belegt die Nebenhand und bleibt nach dem Rufen ${z.runden} Runden auf dem Feld.`,
      description: `Tier-Klasse ${klasse.name}: zähmt Monster bis Rang ${z.maxRang}.`,
      price: "nicht verkäuflich"
    }
  };
}

function abstandInFeldern(a, b) {
  const g = canvas.grid?.size || 100;
  const ca = a.center ?? { x: a.x, y: a.y };
  const cb = b.center ?? { x: b.x, y: b.y };
  return Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y)) / g;
}

function anGM(data) {
  if (game.user?.isGM) return gmAktion(data);
  if (!game.users?.activeGM) {
    ui.notifications?.warn("Dafür muss ein GM online sein.");
    return null;
  }
  game.socket.emit(SOCKET, data);
  return null;
}

// ---------- Zähmen ----------
// Gibt true zurück, wenn die Aktion verbraucht werden soll.
export async function zaehmen(figurActor, klassen) {
  const actor = basis(figurActor);
  const faehigkeit = zaehmFaehigkeit(actor, klassen);
  if (!faehigkeit) {
    ui.notifications?.warn("Zähmen können nur Tier-Klassen (Tierbändiger, Tiermeister, Bestienmeister, Bestienkönig).");
    return false;
  }
  const ziel = Array.from(game.user?.targets ?? []).find((t) => t.actor?.type === "monster");
  if (!ziel) {
    ui.notifications?.warn("Bitte das Monster als Ziel markieren (Taste T).");
    return false;
  }
  const quelle = figurActor.getActiveTokens?.()[0];
  if (quelle && abstandInFeldern(quelle, ziel) > 1.5) {
    ui.notifications?.warn("Das Monster muss in 1 Feld Umkreis stehen.");
    return false;
  }
  const m = ziel.actor.system?.monster ?? {};
  if (!m.tameable) {
    ui.notifications?.warn(`${ziel.name} lässt sich nicht zähmen.`);
    return false;
  }
  if (RAENGE.indexOf(m.rank) > RAENGE.indexOf(faehigkeit.maxRang)) {
    ui.notifications?.warn(`${faehigkeit.klasse} zähmt Monster bis Rang ${faehigkeit.maxRang}; ${ziel.name} ist Rang ${m.rank}.`);
    return false;
  }
  if (ziel.actor.getFlag(SYSTEM_ID, "zaehmFehlschlag") === actor.id) {
    ui.notifications?.warn("Dieses Monster lässt dich erst nach einer langen Rast wieder heran.");
    return false;
  }
  const hp = ziel.actor.system?.resources?.hp ?? {};
  const imKampf = Boolean(game.combat?.started && game.combat.combatants.some((c) => c.tokenId === ziel.id));
  const ruhig = ["friedlich", "scheu"].includes(m.behavior);
  const geschwaecht = zahl(hp.max) > 0 && zahl(hp.value) < zahl(hp.max) / 2;
  if (!ruhig && imKampf && !geschwaecht) {
    ui.notifications?.warn(`${ziel.name} ist im Kampf noch zu stark (erst unter 50 % HP zähmbar).`);
    return false;
  }

  const tierkunde = zahl(actor.system?.worldSkills?.tierkunde?.total);
  const roll = await new Roll(`1d20 + ${tierkunde} + ${zahl(faehigkeit.bonus)}`).evaluate();
  const natur = zahl(roll.dice?.[0]?.total);
  const ziel_wert = zahl(m.probe) || 15;
  const erfolg = natur === 20 || (natur !== 1 && roll.total >= ziel_wert);
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<div class="hlw-chat-card"><h2>Zähmen: ${html(ziel.name)}</h2><p>Tierkunde ${tierkunde}${faehigkeit.bonus ? ` + ${faehigkeit.bonus} (${html(faehigkeit.klasse)})` : ""} gegen ${ziel_wert}${natur === 20 ? " · Natürliche 20" : natur === 1 ? " · Natürliche 1" : ""}</p><p><strong>${erfolg ? `${html(ziel.name)} ist jetzt ${html(actor.name)}s Gefährte.` : `${html(ziel.name)} wehrt sich und wird aggressiv.`}</strong></p></div>`
  });
  anGM({
    type: erfolg ? "gefaehrteAnlegen" : "zaehmFehlschlag",
    ownerId: actor.id,
    tokenUuid: ziel.document.uuid,
    monsterId: ziel.document.actorId,
    runden: faehigkeit.runden
  });
  return true;
}

// ---------- Rufen und Zurückrufen ----------
export async function rufen(figurActor) {
  const actor = basis(figurActor);
  const g = gefaehrteVon(actor);
  if (!g?.actor) return ui.notifications?.warn("Kein Gefährte vorhanden.");
  if (g.aufFeld) return ui.notifications?.info(`${g.name} ist schon auf dem Feld.`);
  if (g.exhausted) return ui.notifications?.warn(`${g.name} ist verletzt und braucht eine lange Rast.`);
  if (zahl(g.cooldown) > 0) return ui.notifications?.warn(`${g.name} braucht noch ${g.cooldown} Runde(n) Pause.`);
  const token = figurActor.getActiveTokens?.()[0] ?? canvas.tokens?.placeables.find((t) => t.document.actorId === actor.id);
  if (!token) return ui.notifications?.warn("Bitte zuerst die eigene Figur auf die Szene stellen.");
  const amZug = game.combat?.started && game.combat.combatant?.actor?.id === actor.id;
  if (game.combat?.started) {
    if (!amZug) return ui.notifications?.warn("Den Gefährten rufst du in deinem Zug.");
    // Aktionen zählen an der Figur im Kampf (bei nicht verknüpften Figuren deren Kopie)
    const kampfActor = game.combat.combatant.actor;
    if (kampfActor.system?.actions?.quick?.available === false) return ui.notifications?.warn("Die Schnellaktion ist schon verbraucht.");
    await kampfActor.update({ "system.actions.quick.available": false });
  }
  anGM({ type: "gefaehrteRufen", ownerId: actor.id, sceneId: token.document.parent.id, tokenId: token.id });
}

export async function zurueckrufen(figurActor) {
  const actor = basis(figurActor);
  const g = gefaehrteVon(actor);
  if (!g?.aufFeld) return;
  anGM({ type: "gefaehrteZurueck", ownerId: actor.id, pause: true });
}

export async function langeRast(figurActor) {
  if (!game.user?.isGM) return;
  const actor = basis(figurActor);
  const g = gefaehrteVon(actor);
  if (!g?.actor) return;
  await g.actor.update({ "system.resources.hp.value": zahl(g.actor.system?.resources?.hp?.max) });
  await actor.update({ "system.companion.exhausted": false, "system.companion.cooldown": 0 });
  ui.notifications?.info(`${g.name} ist erholt.`);
}

export async function freilassen(figurActor) {
  if (!game.user?.isGM) return;
  const actor = basis(figurActor);
  const g = gefaehrteVon(actor);
  if (!g) return;
  const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Gefährten freilassen?" }, content: `<p>${html(g.name)} wirklich freilassen? Der Gefährte verschwindet aus der Welt.</p>` });
  if (!ok) return;
  await gmAktion({ type: "gefaehrteFreilassen", ownerId: actor.id });
}

// ---------- GM-Seite ----------
async function gmAktion(data) {
  if (!game.user?.isGM) return;
  const owner = game.actors.get(data.ownerId);
  if (!owner) return;
  const g = owner.system?.companion ?? {};

  if (data.type === "zaehmFehlschlag") {
    const ziel = await fromUuid(data.tokenUuid);
    if (ziel?.actor) {
      await ziel.actor.update({ "system.monster.behavior": "aggressiv" });
      await ziel.actor.setFlag(SYSTEM_ID, "zaehmFehlschlag", owner.id);
    }
    return;
  }

  if (data.type === "gefaehrteAnlegen") {
    if (g.actorId) await gmAktion({ type: "gefaehrteFreilassen", ownerId: owner.id });
    const vorlage = game.actors.get(data.monsterId);
    const ziel = await fromUuid(data.tokenUuid);
    const quelle = ziel?.actor ?? vorlage;
    if (!quelle) return;
    const daten = (vorlage ?? quelle).toObject();
    delete daten._id;
    const ordner = game.folders.find((f) => f.type === "Actor" && f.name === "Gefährten") ?? await Folder.create({ name: "Gefährten", type: "Actor" });
    const besitzer = Object.fromEntries(Object.entries(owner.ownership ?? {}).filter(([id, level]) => id !== "default" && level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER));
    daten.folder = ordner.id;
    daten.name = quelle.name;
    daten.ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, ...besitzer };
    daten.flags = { ...(daten.flags ?? {}), [SYSTEM_ID]: { besitzer: owner.id } };
    daten.prototypeToken = { ...(daten.prototypeToken ?? {}), name: quelle.name, actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY };
    foundry.utils.setProperty(daten, "system.monster.behavior", "friedlich");
    foundry.utils.setProperty(daten, "system.resources.hp.value", zahl(daten.system?.monster?.hp) || zahl(daten.system?.resources?.hp?.max));
    const [begleiter] = await Actor.createDocuments([daten]);
    await owner.update({
      "system.companion": {
        actorId: begleiter.id, name: begleiter.name, img: begleiter.prototypeToken?.texture?.src || begleiter.img,
        maxRounds: zahl(data.runden) || 2, rounds: 0, cooldown: 0, exhausted: false, tokenId: "", sceneId: ""
      }
    });
    // Die Nebenhand gehört jetzt dem Gefährten: zweite Waffe, Schild und Rucksack ablegen.
    const nebenhand = (i) => (i.type === "armor" && /schild/i.test(`${i.system?.slot} ${i.name}`)) || (i.type === "equipment" && /rucksack/i.test(`${i.system?.slot} ${i.name}`));
    const haende = owner.items.filter((i) => (i.type === "weapon" || nebenhand(i)) && (i.system?.equipped === true || i.system?.equipped === "true"));
    const weg = haende.filter((i) => i.type !== "weapon").concat(haende.filter((i) => i.type === "weapon").slice(1));
    if (weg.length) await owner.updateEmbeddedDocuments("Item", weg.map((i) => ({ _id: i.id, "system.equipped": false })));
    if (ziel) {
      const kampf = game.combat?.combatants?.find((c) => c.tokenId === ziel.id);
      if (kampf) await kampf.delete();
      await ziel.delete();
    }
    return;
  }

  if (data.type === "gefaehrteRufen") {
    const begleiter = game.actors.get(g.actorId);
    const szene = game.scenes.get(data.sceneId);
    const ownerToken = szene?.tokens.get(data.tokenId);
    if (!begleiter || !ownerToken) return;
    const gs = szene.grid.size;
    const belegt = (x, y) => szene.tokens.some((t) => Math.abs(t.x - x) < gs / 2 && Math.abs(t.y - y) < gs / 2);
    const nachbarn = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => [ownerToken.x + dx * gs, ownerToken.y + dy * gs]);
    const [x, y] = nachbarn.find(([nx, ny]) => !belegt(nx, ny)) ?? nachbarn[0];
    const td = await begleiter.getTokenDocument({ x, y, level: ownerToken.level });
    const [neu] = await szene.createEmbeddedDocuments("Token", [td.toObject()]);
    await begleiter.update({ "system.resources.actionPoints.value": Math.max(zahl(begleiter.system?.resources?.actionPoints?.max), 1), "system.combat.movementSpent": 0, "system.actions.quick.available": true });
    await owner.update({ "system.companion.tokenId": neu.id, "system.companion.sceneId": szene.id, "system.companion.rounds": zahl(g.maxRounds) || 2 });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: owner }), content: `<div class="hlw-chat-card"><h2>${html(begleiter.name)} kommt!</h2><p>${html(owner.name)} ruft den Gefährten für ${zahl(g.maxRounds) || 2} Runden aufs Feld.</p></div>` });
    return;
  }

  if (data.type === "gefaehrteZurueck") {
    const token = g.tokenId ? game.scenes.get(g.sceneId)?.tokens.get(g.tokenId) : null;
    if (token) await token.delete();
    await owner.update({
      "system.companion.tokenId": "", "system.companion.sceneId": "", "system.companion.rounds": 0,
      "system.companion.cooldown": data.pause ? PAUSE_NACH_RUF : 0,
      ...(data.erschoepft ? { "system.companion.exhausted": true } : {})
    });
    if (data.erschoepft) ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: owner }), content: `<div class="hlw-chat-card"><h2>${html(g.name)} ist verletzt</h2><p>Der Gefährte kehrt zurück und kann erst nach einer langen Rast wieder gerufen werden.</p></div>` });
    return;
  }

  if (data.type === "gefaehrteFreilassen") {
    const token = g.tokenId ? game.scenes.get(g.sceneId)?.tokens.get(g.tokenId) : null;
    if (token) await token.delete();
    await game.actors.get(g.actorId)?.delete();
    await owner.update({ "system.companion": { actorId: "", name: "", img: "", maxRounds: 0, rounds: 0, cooldown: 0, exhausted: false, tokenId: "", sceneId: "" } });
  }
}

// Zugbeginn des Besitzers (GM): Runden zählen, Gefährten auffrischen oder zurückschicken.
export async function zugbeginn(figurActor) {
  if (!game.user?.isGM) return;
  const owner = basis(figurActor);
  const g = gefaehrteVon(owner);
  if (!g) return;
  if (g.aufFeld) {
    const rest = zahl(g.rounds) - 1;
    if (rest <= 0) return gmAktion({ type: "gefaehrteZurueck", ownerId: owner.id, pause: true });
    await owner.update({ "system.companion.rounds": rest });
    const b = g.actor;
    if (b) {
      await b.update({ "system.resources.actionPoints.value": Math.max(zahl(b.system?.resources?.actionPoints?.max), 1), "system.combat.movementSpent": 0, "system.actions.quick.available": true, "system.actions.reaction.available": true });
      const cds = b.items.filter((i) => zahl(i.system?.cooldown?.value) > 0).map((i) => ({ _id: i.id, "system.cooldown.value": zahl(i.system.cooldown.value) - 1 }));
      if (cds.length) await b.updateEmbeddedDocuments("Item", cds);
      for (const t of b.getActiveTokens?.() ?? []) CONFIG.HLW?.movementSpentCache?.delete?.(t.id);
    }
  }
  else if (zahl(g.cooldown) > 0) await owner.update({ "system.companion.cooldown": zahl(g.cooldown) - 1 });
}

export function registerGefaehrte() {
  game.socket.on(SOCKET, (data) => {
    if (!game.user?.isGM || game.users.activeGM?.id !== game.user.id) return;
    if (["gefaehrteAnlegen", "zaehmFehlschlag", "gefaehrteRufen", "gefaehrteZurueck"].includes(data?.type)) gmAktion(data);
  });

  // Gefährte auf 0 HP: kehrt verletzt zurück.
  Hooks.on("updateActor", (actor, changes) => {
    if (!game.user?.isGM || game.users.activeGM?.id !== game.user.id) return;
    if (!foundry.utils.hasProperty(changes, "system.resources.hp.value")) return;
    const owner = besitzerVon(actor);
    if (!owner || zahl(actor.system?.resources?.hp?.value) > 0) return;
    gmAktion({ type: "gefaehrteZurueck", ownerId: owner.id, pause: false, erschoepft: true });
  });

  // Kampfende: alle Gefährten kehren ohne Pause zurück.
  Hooks.on("deleteCombat", () => {
    if (!game.user?.isGM || game.users.activeGM?.id !== game.user.id) return;
    for (const owner of game.actors.filter((a) => a.system?.companion?.tokenId)) gmAktion({ type: "gefaehrteZurueck", ownerId: owner.id, pause: false });
  });
}
