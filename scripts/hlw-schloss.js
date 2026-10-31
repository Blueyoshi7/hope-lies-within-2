// Türen und Schlösser (Dominik 2026-10-31)
// - Geschlossene Tür ohne Schloss: Spieler sehen „Aufdrücken“, ein Klick öffnet sie.
// - Tür mit Schloss (Schwierigkeit gesetzt, verschlossen): Spieler sehen „Knacken“. Das geht nur mit einem Dietrich im Inventar
//   und mit der eigenen Figur an der Tür: Heimlichkeit (1W20 + Wert) gegen die Schwierigkeit. Natürliche 20 gelingt immer,
//   natürliche 1 misslingt immer und der Dietrich bricht. Geschafft: Der Browser des GM schließt die Tür auf und öffnet sie.
// - GM: Linksklick öffnet und schließt wie gewohnt, Rechtsklick stellt die Schwierigkeit ein (0 = kein Schloss).
// Schwierigkeit am Wall: flags["hope-lies-within-2"].schloss. Verschlossene Türen ohne Wert gelten als SCHLOSS_STANDARD.
// schlossKnacken() ist allgemein gehalten, damit später auch Truhen damit geknackt werden können.

const SYSTEM_ID = "hope-lies-within-2";
const SOCKET = `system.${SYSTEM_ID}`;
export const SCHLOSS_STANDARD = 15;
const NAEHE_FELDER = 2;   // so nah muss die eigene Figur an der Tür stehen

function zahl(wert) {
  const z = Number(wert);
  return Number.isFinite(z) ? z : 0;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function dietrichVon(actor) {
  return actor?.items?.find((i) => /dietrich/i.test(i.name) && Math.max(zahl(i.system?.quantity ?? 1), 0) > 0) ?? null;
}

// Schloss knacken: Heimlichkeit gegen die Schwierigkeit. Die Schwierigkeit erfährt der Spieler nicht.
// → { geschafft, gebrochen } oder null (kein Dietrich)
export async function schlossKnacken(actor, schwierigkeit, was = "Schloss") {
  const dietrich = dietrichVon(actor);
  if (!dietrich) {
    ui.notifications?.warn("Ohne Dietrich lässt sich das Schloss nicht knacken.");
    return null;
  }
  const wert = zahl(actor.system?.worldSkills?.heimlichkeit?.total);
  const roll = await new Roll(`1d20 + ${wert}`).evaluate();
  const natur = zahl(roll.dice?.[0]?.total);
  const geschafft = natur === 20 || (natur !== 1 && roll.total >= zahl(schwierigkeit));
  const gebrochen = natur === 1;
  const ergebnis = geschafft ? "<strong>Geknackt!</strong>" : gebrochen ? "<strong>Natürliche 1: Der Dietrich bricht.</strong>" : "<strong>Nicht geschafft.</strong>";
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${escapeHtml(was)} knacken (Heimlichkeit) · ${ergebnis}` });
  if (gebrochen) {
    const menge = Math.max(zahl(dietrich.system?.quantity ?? 1), 1);
    if (menge > 1) await dietrich.update({ "system.quantity": menge - 1 });
    else await dietrich.delete();
  }
  return { geschafft, gebrochen };
}

// ---------- Türen ----------

function tuerMitte(wall) {
  const c = wall?.document?.c ?? [0, 0, 0, 0];
  return { x: (c[0] + c[2]) / 2, y: (c[1] + c[3]) / 2 };
}

export function tuerSchloss(wallDoc) {
  const wert = zahl(wallDoc?.getFlag(SYSTEM_ID, "schloss"));
  if (wert > 0) return wert;
  return wallDoc?.ds === CONST.WALL_DOOR_STATES.LOCKED ? SCHLOSS_STANDARD : 0;
}

function tuerBlase(wall, text, art) {
  const punkt = canvas.clientCoordinatesFromCanvas(tuerMitte(wall));
  const blase = document.createElement("div");
  blase.className = `hlw-tuerblase is-${art}`;
  blase.textContent = text;
  blase.style.left = `${Math.round(punkt.x)}px`;
  blase.style.top = `${Math.round(punkt.y)}px`;
  document.body.appendChild(blase);
  window.setTimeout(() => blase.classList.add("is-weg"), 1600);
  window.setTimeout(() => blase.remove(), 2300);
}

function menueWeg() {
  document.getElementById("hlw-tuermenue")?.remove();
}

// Kleines Menü über der Tür mit einem Knopf („Aufdrücken“ oder „Knacken“)
function tuerMenue(wall, text, symbol, aktion) {
  menueWeg();
  const punkt = canvas.clientCoordinatesFromCanvas(tuerMitte(wall));
  const menue = document.createElement("div");
  menue.id = "hlw-tuermenue";
  menue.className = "hlw-tuerblase hlw-tuermenue";
  menue.style.left = `${Math.round(punkt.x)}px`;
  menue.style.top = `${Math.round(punkt.y)}px`;
  menue.innerHTML = `<button type="button"><i class="fa-solid ${symbol}"></i> ${text}</button>`;
  menue.querySelector("button").addEventListener("click", async (event) => {
    event.stopPropagation();
    menueWeg();
    await aktion();
  });
  document.body.appendChild(menue);
  window.setTimeout(() => document.addEventListener("pointerdown", (event) => {
    if (!menue.contains(event.target)) menueWeg();
  }, { once: true, capture: true }), 0);
}

// Die eigene Figur des Spielers, die an der Tür steht
function figurAnDer(wall) {
  const mitte = tuerMitte(wall);
  const reichweite = canvas.grid.size * NAEHE_FELDER;
  const eigene = canvas.tokens.placeables.filter((t) => t.actor?.isOwner && t.actor.type === "character");
  const bevorzugt = canvas.tokens.controlled.filter((t) => eigene.includes(t));
  return [...bevorzugt, ...eigene].find((t) => Math.hypot(t.center.x - mitte.x, t.center.y - mitte.y) <= reichweite) ?? null;
}

async function knacken(wall) {
  const figur = figurAnDer(wall);
  if (!figur) return ui.notifications?.warn("Stell deine Figur direkt an die Tür.");
  if (!dietrichVon(figur.actor)) return ui.notifications?.warn(`${figur.actor.name} hat keinen Dietrich dabei.`);
  const ergebnis = await schlossKnacken(figur.actor, tuerSchloss(wall.document), "Tür");
  if (!ergebnis) return;
  if (!ergebnis.geschafft) return tuerBlase(wall, ergebnis.gebrochen ? "Dietrich gebrochen" : "Hält stand", "zu");
  tuerBlase(wall, "Geknackt", "auf");
  if (game.user.isGM) return wall.document.update({ ds: CONST.WALL_DOOR_STATES.OPEN });
  if (!game.users.activeGM) return ui.notifications?.warn("Gerade ist kein GM online, der die Tür öffnen kann.");
  game.socket.emit(SOCKET, { type: "tuerOeffnen", sceneId: wall.document.parent?.id, wallId: wall.document.id, userId: game.user.id });
}

async function aufdruecken(wall) {
  if (!figurAnDer(wall)) return ui.notifications?.warn("Stell deine Figur direkt an die Tür.");
  tuerBlase(wall, "Aufgedrückt", "auf");
  return wall.document.update({ ds: CONST.WALL_DOOR_STATES.OPEN });
}

// GM: Schwierigkeit einstellen (0 = kein Schloss, die Tür lässt sich aufdrücken)
async function schlossEinstellen(wall) {
  const doc = wall.document;
  const jetzt = tuerSchloss(doc);
  const wert = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Schloss der Tür" },
    content: `<p>Schwierigkeit zum Knacken (Heimlichkeit, Dietrich nötig). <b>0</b> = kein Schloss: Spieler drücken die Tür einfach auf.</p>
      <input type="number" name="schwierigkeit" min="0" max="60" step="1" value="${jetzt}" autofocus>`,
    ok: { label: "Speichern", callback: (event, button) => Math.max(zahl(button.form.elements.schwierigkeit.value), 0) },
    rejectClose: false
  });
  if (wert === null || wert === undefined) return;
  const S = CONST.WALL_DOOR_STATES;
  if (wert > 0) {
    await doc.update({ [`flags.${SYSTEM_ID}.schloss`]: wert, ...(doc.ds === S.OPEN ? {} : { ds: S.LOCKED }) });
    tuerBlase(wall, `Schloss ${wert}`, "gm");
  } else {
    await doc.update({ [`flags.${SYSTEM_ID}.-=schloss`]: null, ...(doc.ds === S.LOCKED ? { ds: S.CLOSED } : {}) });
    tuerBlase(wall, "Kein Schloss", "gm");
  }
}

// GM-Makro: alle Türen einer Szene abschließen (Schwierigkeit) oder mit 0 alle Schlösser entfernen. Offene Türen bleiben offen.
export async function tuerenAbschliessen(schwierigkeit = SCHLOSS_STANDARD, scene = canvas.scene) {
  if (!game.user?.isGM || !scene) return;
  const S = CONST.WALL_DOOR_STATES;
  const wert = Math.max(zahl(schwierigkeit), 0);
  const updates = scene.walls.filter((w) => w.door !== CONST.WALL_DOOR_TYPES.NONE).map((w) => wert > 0
    ? { _id: w.id, [`flags.${SYSTEM_ID}.schloss`]: wert, ...(w.ds === S.OPEN ? {} : { ds: S.LOCKED }) }
    : { _id: w.id, [`flags.${SYSTEM_ID}.-=schloss`]: null, ...(w.ds === S.LOCKED ? { ds: S.CLOSED } : {}) });
  if (updates.length) await scene.updateEmbeddedDocuments("Wall", updates);
  ui.notifications?.info(wert > 0 ? `${updates.length} Türen in „${scene.name}“ haben jetzt Schloss ${wert}.` : `Alle Schlösser in „${scene.name}“ entfernt.`);
}

export function registerSchloss() {
  Hooks.once("setup", () => {
    const DoorControl = foundry.canvas?.containers?.DoorControl ?? globalThis.DoorControl;
    if (!DoorControl) return;
    const S = CONST.WALL_DOOR_STATES;
    const links = DoorControl.prototype._onMouseDown;
    DoorControl.prototype._onMouseDown = function (event) {
      if (event.button !== 0) return;
      const ds = this.wall?.document?.ds;
      const darf = game.user.can("WALL_DOORS") && !(game.paused && !game.user.isGM);
      // Spieler: geschlossene Türen nur über das Menü (Aufdrücken oder Knacken)
      if (!game.user.isGM && darf && ds !== S.OPEN) {
        event.stopPropagation();
        const wall = this.wall;
        if (ds === S.LOCKED) tuerMenue(wall, "Knacken", "fa-key", () => knacken(wall));
        else tuerMenue(wall, "Aufdrücken", "fa-hand", () => aufdruecken(wall));
        return false;
      }
      const ergebnis = links.call(this, event);
      if (darf) {
        if (ds === S.LOCKED) tuerBlase(this.wall, `Verschlossen (Schloss ${tuerSchloss(this.wall.document)})`, "zu");
        else if (ds === S.CLOSED) tuerBlase(this.wall, "Geöffnet", "auf");
        else if (ds === S.OPEN) tuerBlase(this.wall, "Geschlossen", "normal");
      }
      return ergebnis;
    };
    // GM: Rechtsklick stellt das Schloss ein (statt nur ab- und aufzusperren)
    DoorControl.prototype._onRightDown = function (event) {
      event.stopPropagation();
      if (!game.user.isGM) return;
      schlossEinstellen(this.wall);
    };
  });
  Hooks.on("canvasPan", menueWeg);
  Hooks.on("canvasTearDown", menueWeg);

  // Geknackte Tür: der aktive GM öffnet sie (Spieler dürfen verschlossene Türen nicht selbst ändern)
  Hooks.once("ready", () => game.socket.on(SOCKET, async (data) => {
    if (data?.type !== "tuerOeffnen" || !game.user?.isGM || game.users.activeGM?.id !== game.user.id) return;
    const wall = game.scenes.get(data.sceneId)?.walls.get(data.wallId);
    if (wall) await wall.update({ ds: CONST.WALL_DOOR_STATES.OPEN });
  }));
}
