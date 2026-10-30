// Fertige Szenen fuer den Kampagnenstart. Aufruf als GM in der Konsole oder per Makro:
//   game.hlw.erstelleLindhain()
// Legt die Szene „Lindhain“ an: Dorfboden, Gebaeude als Kacheln mit Waenden und Tueren,
// die Dorf-NSC mit Gespraechsdaten und eine Ortsliste im Journal (ohne Marker auf der Karte).

import { nscAusstatten, lindhainWerte } from "./hlw-nsc.js";

const SYSTEM_ID = "hope-lies-within-2";
const ASSETS = `systems/${SYSTEM_ID}/assets`;
const GRID = 64;            // 1 Feld = 64 px = 1,5 m
const SIZE = 4096;          // 64 × 64 Felder

// Gebaeude: Bild, Position (oben links, px), Groesse in Feldern, Drehung (0 = Tuer unten, 180 = Tuer oben).
// wallRight: Anteil rechts, der nicht zum Haus gehoert (Wasserrad der Muehle).
const GEBAEUDE = [
  { id: "gasthaus", name: "Gasthaus „Zum Lindenblatt“", text: "Wirtin Hanne Brook. Essen, Betten, Gerüchte.", x: 820, y: 600, w: 13, h: 10, rot: 0 },
  { id: "kraeuterhaus", name: "Kräuterhaus", text: "Oma Wendel und ihr Garten.", x: 360, y: 900, w: 7, h: 7, rot: 0 },
  { id: "schmiede", name: "Schmiede", text: "Jorun Feldt repariert und schmiedet.", x: 2240, y: 760, w: 9, h: 8, rot: 0 },
  { id: "aeltestenhaus", name: "Haus der Dorfältesten", text: "Mira Holm.", x: 2850, y: 820, w: 9, h: 8, rot: 0 },
  { id: "schrein", name: "Hüter-Schrein", text: "Bruder Aled kommt jede Season.", x: 900, y: 2160, w: 7, h: 7, rot: 180 },
  { id: "wohnhaus-a", name: "Wohnhaus", text: "Eine Bauernfamilie.", x: 360, y: 2160, w: 8, h: 6, rot: 180 },
  { id: "fluechtlingshof", name: "Flüchtlingshof", text: "Seit 788 bewohnt.", x: 2560, y: 2160, w: 10, h: 8, rot: 180 },
  { id: "wohnhaus-b", name: "Wohnhaus", text: "Eine Familie mit Kindern.", x: 2300, y: 2780, w: 8, h: 6, rot: 180 },
  { id: "muehle", name: "Mühle am Lindbach", text: "Hier wird das Korn des Dorfs gemahlen.", x: 3230, y: 2800, w: 8, h: 7, rot: 0, wallRight: 0.2 },
  { id: "wachturm", name: "Wachturm der Gilde", text: "Am Rand des gesperrten Waldes.", x: 2040, y: 300, w: 4, h: 4, rot: 0 }
];

const ORTE_OHNE_GEBAEUDE = [
  { name: "Dorfplatz", text: "Die alte Linde in der Mitte. Hier wird zur Saatwende gefeiert." }
];

// Nur Eintraege, die die Spieler sofort sehen. Verdecktes GM-Wissen (siehe GM-Kampagnenstart) traegt der GM
// im Gespraechsfenster selbst ein, damit es nicht im oeffentlichen Code steht.
// Warum Kessa da ist (Dominik 2026-10-30): wegen des Fests, und weil die Gilde junge Leute mit der Fähigkeit sucht
const KESSA_GRUND = "Ist wegen der Saatwende in Lindhain. Die Gilde sucht junge Leute mit der Fähigkeit und bringt sie nach Illmaris an ihre Schulen, als Vorbereitung auf ein Leben für die Gilde und als Abenteurer.";
const KESSA_GRUND_ALT = "Kam zum Saatwendefest nach Lindhain, um Hero-Kinder für die Schulen in Illmaris zu finden.";

// Kessas Strohpuppen für die erste Lektion (Hof hinter dem Schrein)
const STROHPUPPEN = [{ x: 1000, y: 2800 }, { x: 1200, y: 2800 }, { x: 1400, y: 2800 }];

const LINDHAIN_NSC = [
  {
    name: "Kessa Dorn", bild: "kessa-dorn", role: "Werberin der Abenteurergilde", x: 1940, y: 2140,
    facts: [
      [KESSA_GRUND, true],
      ["Prüft junge Leute mit einem Kristall, der bei einem magischen Kern leuchtet.", true]
    ]
  },
  {
    name: "Mira Holm", bild: "mira-holm", role: "Dorfälteste", x: 3138, y: 1076,
    facts: [
      ["Hat als Hebamme fast alle Kinder im Dorf auf die Welt geholt.", true],
      ["Will nicht, dass die Kinder von Lindhain in einen Krieg gezogen werden.", true],
    ]
  },
  {
    name: "Hanne Brook", bild: "hanne-brook", role: "Wirtin „Zum Lindenblatt“", x: 1236, y: 960,
    facts: [
      ["Kennt jede Geschichte, die Reisende im Gasthaus erzählen.", true],
      ["Ihre Gerstensuppe ist die beste im Umkreis.", true]
    ]
  },
  {
    name: "Jorun Feldt", bild: "jorun-feldt", role: "Schmiedin", x: 2528, y: 1016,
    facts: [
      ["Repariert die Waffen der Grenzwachen.", true],
      ["Sucht einen Lehrling, der keine Angst vor Feuer hat.", true]
    ]
  },
  {
    name: "Oma Wendel", bild: "oma-wendel", role: "Kräuterfrau", x: 584, y: 1124,
    facts: [
      ["Kam vor langer Zeit aus dem Norden.", true],
      ["Singt abends ein altes Wiegenlied.", true],
    ]
  },
  {
    name: "Bruder Aled", bild: "bruder-aled", role: "Hüter des Gleichgewichts", x: 1124, y: 2340,
    facts: [
      ["Kommt jede Season ins Dorf, segnet und tröstet.", true],
      ["Bringt Kranke nach Eldora, damit sie im Licht Athreas erlöst werden.", true]
    ]
  },
  {
    name: "Hauptmann Rell", bild: "hauptmann-rell", role: "Wachposten der Gilde am Waldrand", x: 2168, y: 428,
    facts: [
      ["Bewacht das Sperrgebiet im Wald der Zauberer.", true],
      ["Spricht nicht über die Nacht im Jahr 788.", true],
    ]
  },
  {
    name: "Toma", bild: "toma", role: "Flüchtlingsjunge, 10 Jahre", x: 2880, y: 2416,
    facts: [
      ["Kam 788 mit seiner Familie von der Grenze nach Lindhain.", true],
      ["Will unbedingt mit den Großen mitgehen.", true]
    ]
  },
  {
    name: "Ivo Brandt", bild: "ivo-brandt", role: "Wache der Gilde am Südtor", x: 1740, y: 3800,
    facts: [["Bewacht mit Lene die Straße nach Süden, solange Hauptmann Rell oben am Wald steht.", true], ["Steht seit zwanzig Jahren an diesem Tor.", true]]
  },
  {
    name: "Lene Asch", bild: "lene-asch", role: "Wache der Gilde am Südtor", x: 2290, y: 3800,
    facts: [["Die jüngste Wache im Dorf. Träumt von der Gilde in Illmaris.", true]]
  },
  {
    name: "Gerold Wiese", bild: "gerold-wiese", role: "Bauer am Kornfeld", x: 1570, y: 3460,
    facts: [["Sein Kornfeld liegt an der Straße nach Süden.", true]]
  }
];

async function getOrCreateFolder(name, type) {
  return game.folders.find((folder) => folder.type === type && folder.name === name)
    ?? Folder.create({ name, type });
}

// Punkt um die Mitte eines Rechtecks drehen (nur 0/90/180/270 Grad).
function drehe(px, py, cx, cy, rot) {
  const rad = (rot * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return [Math.round(cx + dx * Math.cos(rad) - dy * Math.sin(rad)), Math.round(cy + dx * Math.sin(rad) + dy * Math.cos(rad))];
}

// Waende entlang des Gebaeuderands, mit einer Tuer (1 Feld breit) in der Mitte der Unterseite.
function waendeFuer(geb, level) {
  const w = geb.w * GRID;
  const h = geb.h * GRID;
  const inset = 10;
  const left = geb.x + inset;
  const top = geb.y + inset;
  const right = geb.x + w * (1 - (geb.wallRight ?? 0)) - inset;
  const bottom = geb.y + h - inset;
  const doorMid = (left + right) / 2;
  const half = GRID / 2;
  const cx = geb.x + w / 2;
  const cy = geb.y + h / 2;
  const segmente = [
    [left, top, right, top, false],
    [right, top, right, bottom, false],
    [right, bottom, doorMid + half, bottom, false],
    [doorMid + half, bottom, doorMid - half, bottom, true],
    [doorMid - half, bottom, left, bottom, false],
    [left, bottom, left, top, false]
  ];
  return segmente.map(([x1, y1, x2, y2, tuer]) => ({
    c: [...drehe(x1, y1, cx, cy, geb.rot), ...drehe(x2, y2, cx, cy, geb.rot)],
    door: tuer ? CONST.WALL_DOOR_TYPES.DOOR : CONST.WALL_DOOR_TYPES.NONE,
    ds: CONST.WALL_DOOR_STATES.CLOSED,
    levels: [level]
  }));
}

// Ortsmarker (Notizen) auf Karten entfernen, die auf die Ortsliste „Lindhain – Orte“ zeigen.
// Die Ortsliste selbst bleibt im Journal; auf der Karte stören die Buch-Symbole nur.
export async function entferneOrtsmarker() {
  if (!game.user?.isGM) return 0;
  const journal = game.journal.getName("Lindhain – Orte");
  if (!journal) return 0;
  let anzahl = 0;
  for (const scene of game.scenes) {
    const ids = scene.notes.filter((note) => note.entryId === journal.id).map((note) => note.id);
    if (ids.length) await scene.deleteEmbeddedDocuments("Note", ids);
    anzahl += ids.length;
  }
  return anzahl;
}

// NSC aus der Liste anlegen (oder den vorhandenen im Ordner nehmen) und einmal ausstatten
async function nscAnlegen(nsc, actorFolder) {
  const token = `${ASSETS}/npc/${nsc.bild}-token.webp`;
  const actor = game.actors.find((a) => a.name === nsc.name && a.folder?.id === actorFolder.id)
    ?? await Actor.create({
      name: nsc.name,
      type: "npc",
      img: token,
      folder: actorFolder.id,
      prototypeToken: {
        name: nsc.name,
        actorLink: true,
        displayName: CONST.TOKEN_DISPLAY_MODES.OWNER,
        disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        texture: { src: token },
        sight: { enabled: false }
      },
      flags: {
        [SYSTEM_ID]: {
          talk: {
            portrait: `${ASSETS}/npc/${nsc.bild}.webp`,
            role: nsc.role,
            nameRevealed: false,
            facts: nsc.facts.map(([text, revealed]) => ({ id: foundry.utils.randomID(), text, revealed, highlight: false }))
          }
        }
      }
    });
  // Level, Werte, Waffen, Waren und Quests (einmal pro NSC)
  if (!actor.getFlag(SYSTEM_ID, "ausgestattet")) {
    await nscAusstatten(actor, lindhainWerte(nsc.name));
    await actor.setFlag(SYSTEM_ID, "ausgestattet", true);
  }
  return actor;
}

// Übungsziel für Kessas erste Lektion: greift nicht an, lässt keine Kristalle und gibt keine EXP
async function strohpuppeActor() {
  const vorhanden = game.actors.find((a) => a.type === "monster" && a.name === "Strohpuppe");
  if (vorhanden) return vorhanden;
  const ordner = await getOrCreateFolder("Lindhain", "Actor");
  return Actor.create({
    name: "Strohpuppe", type: "monster", img: `${ASSETS}/monster/strohpuppe.webp`, folder: ordner.id,
    system: {
      monster: { rank: "E", role: "Diener", size: "Mittel", category: "Tier", corrupted: 0, hp: 12, rw: 8, mr: 8, acc: 0, damage: "–", initiative: 0, movement: 0, reach: 1,
        probe: 15, exp: 0, traits: "Harmlos", habitat: "Lindhain", special: "Kessas Übungspuppe. Greift nicht an, bewegt sich nicht.", harmless: true, behavior: "friedlich", tameable: false },
      resources: { hp: { value: 12, max: 12 } }
    },
    flags: { [SYSTEM_ID]: { uebung: true } },
    prototypeToken: { name: "Strohpuppe", actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL, displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
      texture: { src: `${ASSETS}/monster/strohpuppe-token.webp` }, sight: { enabled: false } }
  });
}

async function strohpuppenAufstellen(scene) {
  if (scene.tokens.some((t) => t.name === "Strohpuppe")) return;
  const actor = await strohpuppeActor();
  const level = scene.initialLevel?.id ?? scene.firstLevel?.id;
  const tokens = [];
  for (const p of STROHPUPPEN) tokens.push((await actor.getTokenDocument({ x: p.x - GRID / 2, y: p.y - GRID / 2, level })).toObject());
  await scene.createEmbeddedDocuments("Token", tokens);
}

// Bestehendes Lindhain auf den Stand von Kapitel 1 bringen: neue NSC (Wachen am Südtor, Bauer), Strohpuppen,
// Kessas neuer Grund (nur wenn der alte Text unverändert ist). Eigene Änderungen des GM bleiben.
export async function lindhainErgaenzen() {
  if (!game.user?.isGM) return;
  const kessa = game.actors.find((a) => a.type === "npc" && a.name === "Kessa Dorn");
  const talk = kessa?.getFlag(SYSTEM_ID, "talk");
  if (talk?.facts?.some((f) => f.text === KESSA_GRUND_ALT)) {
    await kessa.setFlag(SYSTEM_ID, "talk", { ...talk, facts: talk.facts.map((f) => (f.text === KESSA_GRUND_ALT ? { ...f, text: KESSA_GRUND } : f.text === "Prüft Kinder mit einem Kristall, der bei einem magischen Kern leuchtet." ? { ...f, text: "Prüft junge Leute mit einem Kristall, der bei einem magischen Kern leuchtet." } : f)) });
  }
  const scene = game.scenes.getName("Lindhain");
  if (!scene) return;
  const actorFolder = await getOrCreateFolder("Lindhain", "Actor");
  const level = scene.initialLevel?.id ?? scene.firstLevel?.id;
  const tokens = [];
  for (const nsc of LINDHAIN_NSC) {
    const actor = await nscAnlegen(nsc, actorFolder);
    if (scene.tokens.some((t) => t.actorId === actor.id)) continue;
    tokens.push((await actor.getTokenDocument({ x: nsc.x - GRID / 2, y: nsc.y - GRID / 2, level })).toObject());
  }
  if (tokens.length) await scene.createEmbeddedDocuments("Token", tokens);
  await strohpuppenAufstellen(scene);
}

export async function erstelleLindhain({ neu = false } = {}) {
  if (!game.user?.isGM) return ui.notifications?.warn("Nur der GM kann Szenen anlegen.");
  if (neu) {
    // Szene und Ortsliste neu aufbauen; die NSC (mit ihren freigegebenen Eintraegen) bleiben erhalten.
    await game.scenes.getName("Lindhain")?.delete();
    await game.journal.getName("Lindhain – Orte")?.delete();
  }
  if (game.scenes.getName("Lindhain")) return ui.notifications?.warn("Die Szene „Lindhain“ gibt es schon. Neu aufbauen: game.hlw.erstelleLindhain({ neu: true })");

  const actorFolder = await getOrCreateFolder("Lindhain", "Actor");
  const actors = [];
  for (const nsc of LINDHAIN_NSC) {
    const actor = await nscAnlegen(nsc, actorFolder);
    actors.push([actor, nsc]);
  }

  const orte = [...GEBAEUDE.map((g) => ({ name: g.name, text: g.text })), ...ORTE_OHNE_GEBAEUDE];
  const journal = await JournalEntry.create({
    name: "Lindhain – Orte",
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
    pages: orte.map((ort) => ({ name: ort.name, type: "text", text: { content: `<p>${ort.text}</p>` } }))
  });

  const scene = await Scene.create({
    name: "Lindhain",
    width: SIZE,
    height: SIZE,
    padding: 0,          // ohne Rand: Bildkoordinaten = Szenenkoordinaten
    grid: { type: CONST.GRID_TYPES.SQUARE, size: GRID, distance: 1.5, units: "m" },
    tokenVision: false,
    levels: [{ name: "Dorf", background: { src: `${ASSETS}/lindhain/lindhain-boden.webp` }, textures: { fit: "fill" } }]
  });
  // Foundry 14: Figuren, Kacheln, Waende und Notizen muessen einer Ebene (Level) der Szene zugeordnet sein.
  const level = scene.initialLevel?.id ?? scene.firstLevel?.id;

  // Foundry 14: x/y einer Kachel ist ihre Mitte (Ankerpunkt 0,5), nicht die linke obere Ecke.
  await scene.createEmbeddedDocuments("Tile", GEBAEUDE.map((geb) => ({
    texture: { src: `${ASSETS}/lindhain/gebaeude/${geb.id}.webp` },
    x: geb.x + (geb.w * GRID) / 2,
    y: geb.y + (geb.h * GRID) / 2,
    width: geb.w * GRID,
    height: geb.h * GRID,
    rotation: geb.rot,
    levels: [level]
  })));
  // Daecher liegen ueber den Figuren und blenden aus, sobald eine eigene Figur darunter steht.
  // NSC im Haus bleiben so verborgen, bis die Spieler eintreten.
  const dachHoehe = scene.initialLevel?.elevation?.top ?? 20;
  await scene.createEmbeddedDocuments("Tile", GEBAEUDE.map((geb) => {
    const breite = Math.round(geb.w * GRID * (1 - (geb.wallRight ?? 0)));
    const verschiebung = geb.rot === 180 ? geb.w * GRID - breite : 0;
    return {
      texture: { src: `${ASSETS}/lindhain/daecher/${geb.id}.webp` },
      x: geb.x + verschiebung + breite / 2,
      y: geb.y + (geb.h * GRID) / 2,
      width: breite,
      height: geb.h * GRID,
      rotation: geb.rot,
      elevation: dachHoehe,
      occlusion: { modes: [CONST.OCCLUSION_MODES.FADE], alpha: 0 },
      levels: [level]
    };
  }));
  await scene.createEmbeddedDocuments("Wall", GEBAEUDE.flatMap((geb) => waendeFuer(geb, level)));

  const tokens = [];
  for (const [actor, nsc] of actors) {
    const token = await actor.getTokenDocument({ x: nsc.x - GRID / 2, y: nsc.y - GRID / 2, level });
    tokens.push(token.toObject());
  }
  await scene.createEmbeddedDocuments("Token", tokens);
  await strohpuppenAufstellen(scene);

  ui.notifications?.info(`Lindhain ist angelegt: Dorf mit 10 Gebäuden samt Dächern, ${LINDHAIN_NSC.length} NSC und der Ortsliste.`);
  return scene;
}

// Die vier Wege aus Lindhain hinaus, je eine Karte (4096 px, 64 × 64 Felder wie das Dorf).
// „zumDorf“ = Bildrand, an dem der Weg ins Dorf zurückführt.
const WEGE = [
  { id: "nord", name: "Lindhain – Nordweg", zumDorf: "unten", text: "Waldpfad in den Wald der Zauberer: Schranke und Wachposten der Gilde, dahinter alte Bäume, leuchtende Pilze und eine Lichtung." },
  { id: "sued", name: "Lindhain – Straße nach Illmaris", zumDorf: "oben", text: "Karrenweg zwischen den Feldern nach Süden. An der Gabelung der alte Wegstein im Steinkreis, daneben Bank und Eiche." },
  { id: "ost", name: "Lindhain – Ostweg", zumDorf: "links", text: "Über die Brücke am Lindbach hinaus: Weiden mit Steinmauern, ein Birkenhain, ein Teich und ein Wegweiser zum Pfad nach Norden." },
  { id: "west", name: "Lindhain – Westweg", zumDorf: "rechts", text: "Trampelpfad am Waldrand entlang. Eine verfallene Scheune ohne Dach und eine aufgewühlte Suhle mitten in der Wiese." }
];

export async function erstelleWege({ neu = false } = {}) {
  if (!game.user?.isGM) return ui.notifications?.warn("Nur der GM kann Szenen anlegen.");
  const ordner = await getOrCreateFolder("Wege um Lindhain", "Scene");
  const angelegt = [];
  for (const weg of WEGE) {
    if (neu) await game.scenes.getName(weg.name)?.delete();
    if (game.scenes.getName(weg.name)) continue;
    angelegt.push(await Scene.create({
      name: weg.name,
      folder: ordner.id,
      width: SIZE,
      height: SIZE,
      padding: 0,
      grid: { type: CONST.GRID_TYPES.SQUARE, size: GRID, distance: 1.5, units: "m" },
      tokenVision: false,
      levels: [{ name: "Weg", background: { src: `${ASSETS}/lindhain/wege/weg-${weg.id}.webp` }, textures: { fit: "fill" } }],
      flags: { [SYSTEM_ID]: { weg: weg.id, zumDorf: weg.zumDorf } }
    }));
  }
  // Kurzbeschreibung für den GM (Journal nur für den GM sichtbar)
  if (angelegt.length && !game.journal.getName("Wege um Lindhain")) {
    await JournalEntry.create({
      name: "Wege um Lindhain",
      pages: WEGE.map((weg) => ({ name: weg.name, type: "text", text: { content: `<p>${weg.text}</p><p>Zurück ins Dorf: Bildrand ${weg.zumDorf}.</p>` } }))
    });
  }
  const orte = await erstelleQuestOrte({ neu });
  if (!angelegt.length && !orte.length) return ui.notifications?.warn("Die Wege gibt es schon. Neu aufbauen: game.hlw.erstelleWege({ neu: true })");
  ui.notifications?.info(`${angelegt.length + orte.length} Karten um Lindhain angelegt (Ordner „Wege um Lindhain“).`);
  return [...angelegt, ...orte];
}

// ---------- Quest-Orte hinter den Wegen ----------
// Nord: Lichtung mit dem Dornenschrat (schwerster Kampf), dahinter versteckt die alte Hütte mit Finn.
// Ost: der korrumpierte Hirte auf verdorbenem Boden. West: eine Kopierkatze, getarnt als verletztes Kleinhorn.
// Figuren liegen verborgen auf der Karte; der GM deckt sie auf, wenn es so weit ist.
const QUEST_ORTE = [
  {
    id: "nord-lichtung", name: "Lindhain – Lichtung im Norden", navigation: true,
    figuren: [{ monster: "Dornenschrat", x: 2048, y: 1500 }],
    text: "Hinter dem Nordweg, tief im Wald der Zauberer: eine große Lichtung, Kratzspuren an den Stämmen. Hier lauert der <b>Dornenschrat</b> (Rang C, schwerster Kampf des Kapitels). Feuer und Licht stoppen seine Regeneration (Tipp über Oma Wendel oder Bruder Aled).<br>Oben rechts verschwindet ein Wildwechsel im Farn: <b>Scharfsinnigkeit 20</b> findet ihn, er führt zur alten Hütte."
  },
  {
    id: "nord-versteck", name: "Lindhain – Alte Hütte", navigation: false,
    figuren: [{ nsc: "Finn", x: 1660, y: 1700 }],
    // Hütte ohne Dach: Wände mit Tür unten in der Mitte
    waende: [[1340, 990, 2920, 990], [2920, 990, 2920, 2480], [2920, 2480, 2200, 2480], [2200, 2480, 1880, 2480, true], [1880, 2480, 1340, 2480], [1340, 2480, 1340, 990]],
    text: "Versteckt hinter der Lichtung (nicht in der Szenenleiste). In der alten Jägerhütte hat sich <b>Finn</b> versteckt, mit dem Schwert des Hauptmanns. Er hat Angst vor dem Wesen mit den grünen Augen und davor, dass Rell ihn bestraft.<br>Wem die Spieler das Schwert geben (Toma: „Wo ist Finn?“ oder Rell: „Mein Schwert“), entscheiden sie selbst."
  },
  {
    id: "ost-weide", name: "Lindhain – Weide im Osten", navigation: true,
    figuren: [{ monster: "Korrumpierter Hirte", x: 3200, y: 1664 }],
    text: "Hinter dem Ostweg: eine Weide mit leerem Pferch, tote Schafe am Rand eines verdorbenen Flecks. Der <b>Korrumpierte Hirte</b> steht mitten im verdorbenen Boden (dort heilt er am Zugbeginn 1W6). Die erste korrumpierte Person, der die Gruppe begegnet. Lockt man ihn heraus, verliert er die Heilung."
  },
  {
    id: "west-senke", name: "Lindhain – Senke im Westen", navigation: true,
    figuren: [{ monster: "Kopierkatze", x: 2000, y: 2000, tarnung: { name: "Verletztes Kleinhorn", bild: `${ASSETS}/monster/kleinhorn-token.webp` } }],
    text: "Hinter dem Westweg: eine Senke voller toter Tiere. In der Mitte liegt scheinbar ein <b>verletztes Kleinhorn</b>. In Wahrheit eine <b>Kopierkatze</b> (Scharfsinnigkeit 25 durchschaut sie). Wer sich zu ihr hinunterbeugt, wird überrascht.<br>Tarnung aufheben: Figur auswählen und <code>game.hlw.tarnungAufheben()</code>."
  }
];

// Gegnerdaten aus dem Bestiarium (Import-Liste des Systems)
let monsterCache = null;
async function monsterDaten(name) {
  if (!monsterCache) {
    try {
      const antwort = await fetch(`systems/${SYSTEM_ID}/import/monsters.json`);
      monsterCache = antwort.ok ? await antwort.json() : [];
    } catch {
      monsterCache = [];
    }
  }
  return monsterCache.find((m) => m.name === name) ?? null;
}

// Gegner der Welt nehmen (z. B. aus dem importierten Bestiarium) oder neu im Ordner „Lindhain – Begegnungen“ anlegen
async function gegnerActor(name) {
  const vorhanden = game.actors.find((a) => a.type === "monster" && a.name === name);
  if (vorhanden) return vorhanden;
  const daten = await monsterDaten(name);
  if (!daten) return null;
  const ordner = await getOrCreateFolder("Lindhain – Begegnungen", "Actor");
  const groesse = { "Groß": 2, "Riesig": 3 }[daten.system?.monster?.size] ?? 1;
  return Actor.create({
    name: daten.name, type: "monster", img: daten.img, folder: ordner.id, system: daten.system, items: daten.items ?? [],
    prototypeToken: { name: daten.name, actorLink: false, width: groesse, height: groesse, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
      displayName: CONST.TOKEN_DISPLAY_MODES.HOVER, texture: { src: daten.token || daten.img }, sight: { enabled: false } }
  });
}

// Das Schwert, das Finn aus dem Wachturm mitgenommen hat (Grundlage: Eisenschwert, Genauigkeit +1)
async function schwertDesHauptmanns() {
  let basis = null;
  try {
    const antwort = await fetch(`systems/${SYSTEM_ID}/import/weapons.json`);
    basis = antwort.ok ? (await antwort.json()).find((w) => w.name === "Eisenschwert") : null;
  } catch {
    basis = null;
  }
  return {
    name: "Schwert des Hauptmanns", type: "weapon",
    img: basis?.img ?? `${ASSETS}/icons/waffen/eisenschwert.webp`,
    system: { ...(basis?.system ?? { damage: "2d6", weaponClass: "melee", range: 1, slot: "Schwert", damageCategory: "physical" }),
      rank: "C", priceSk: 500, price: "5 GK", quantity: 1, equipped: false, source: "Quest Lindhain",
      description: "Hauptmann Rells Dienstschwert mit dem Löwenknauf der Gildenwache. Genauigkeit +1.", effect: "Genauigkeit +1", bonuses: { acc: 1 } }
  };
}

const FINN = {
  name: "Finn", bild: "finn", role: "Tomas kleiner Bruder",
  facts: [["Tomas kleiner Bruder, acht Jahre alt.", true], ["Seit drei Tagen verschwunden.", true]]
};

const PLAKAT = `${ASSETS}/lindhain/quests/vermisst-finn.webp`;

// Vermisst-Plakat: Journal mit Bild (alle dürfen es sehen) und ein Aushang neben dem Dorfplatz in Lindhain
async function plakatAushaengen() {
  if (!game.journal.getName("Vermisst: Finn")) {
    await JournalEntry.create({
      name: "Vermisst: Finn",
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
      pages: [{ name: "Vermisst: Finn", type: "image", src: PLAKAT, image: { caption: "Hängt an der Linde auf dem Dorfplatz." } }]
    });
  }
  const dorf = game.scenes.getName("Lindhain");
  if (!dorf || dorf.tiles.some((t) => t.texture?.src === PLAKAT)) return;
  const level = dorf.initialLevel?.id ?? dorf.firstLevel?.id;
  await dorf.createEmbeddedDocuments("Tile", [{ texture: { src: PLAKAT }, x: 1480, y: 2010, width: 74, height: 96, rotation: -4, levels: level ? [level] : undefined }]);
}

export async function erstelleQuestOrte({ neu = false } = {}) {
  if (!game.user?.isGM) return [];
  const ordner = await getOrCreateFolder("Wege um Lindhain", "Scene");
  const nscOrdner = await getOrCreateFolder("Lindhain", "Actor");
  const angelegt = [];
  for (const ort of QUEST_ORTE) {
    if (neu) await game.scenes.getName(ort.name)?.delete();
    if (game.scenes.getName(ort.name)) continue;
    const scene = await Scene.create({
      name: ort.name,
      folder: ordner.id,
      navigation: ort.navigation,
      width: SIZE,
      height: SIZE,
      padding: 0,
      grid: { type: CONST.GRID_TYPES.SQUARE, size: GRID, distance: 1.5, units: "m" },
      tokenVision: false,
      levels: [{ name: "Ort", background: { src: `${ASSETS}/lindhain/quests/karte-${ort.id}.webp` }, textures: { fit: "fill" } }],
      flags: { [SYSTEM_ID]: { questOrt: ort.id } }
    });
    const level = scene.initialLevel?.id ?? scene.firstLevel?.id;
    if (ort.waende) {
      await scene.createEmbeddedDocuments("Wall", ort.waende.map(([x1, y1, x2, y2, tuer]) => ({
        c: [x1, y1, x2, y2], door: tuer ? CONST.WALL_DOOR_TYPES.DOOR : CONST.WALL_DOOR_TYPES.NONE, ds: CONST.WALL_DOOR_STATES.CLOSED, levels: [level]
      })));
    }
    const tokens = [];
    for (const figur of ort.figuren ?? []) {
      let actor = null;
      if (figur.nsc === "Finn") {
        actor = await nscAnlegen(FINN, nscOrdner);
        if (!actor.items.some((i) => i.name === "Schwert des Hauptmanns")) await actor.createEmbeddedDocuments("Item", [await schwertDesHauptmanns()]);
      } else {
        actor = await gegnerActor(figur.monster);
      }
      if (!actor) continue;
      const breite = actor.prototypeToken.width ?? 1;
      const daten = (await actor.getTokenDocument({ x: figur.x - (breite * GRID) / 2, y: figur.y - (breite * GRID) / 2, hidden: true, level })).toObject();
      if (figur.tarnung) {
        daten.name = figur.tarnung.name;
        daten.texture = { ...daten.texture, src: figur.tarnung.bild };
        daten.disposition = CONST.TOKEN_DISPOSITIONS.NEUTRAL;
        foundry.utils.setProperty(daten, `flags.${SYSTEM_ID}.tarnung`, { name: daten.name, echt: actor.prototypeToken.name, bild: actor.prototypeToken.texture.src });
      }
      tokens.push(daten);
    }
    if (tokens.length) await scene.createEmbeddedDocuments("Token", tokens);
    angelegt.push(scene);
  }
  // GM-Notizen ins Journal „Wege um Lindhain“ (fehlende Seiten ergänzen)
  const journal = game.journal.getName("Wege um Lindhain") ?? await JournalEntry.create({ name: "Wege um Lindhain" });
  const seiten = QUEST_ORTE.filter((ort) => !journal.pages.getName(ort.name)).map((ort) => ({ name: ort.name, type: "text", text: { content: `<p>${ort.text}</p>` } }));
  if (seiten.length) await journal.createEmbeddedDocuments("JournalEntryPage", seiten);
  await plakatAushaengen();
  return angelegt;
}

// GM: Tarnung der ausgewählten Figuren aufheben (z. B. die Kopierkatze als „verletztes Kleinhorn“)
export async function tarnungAufheben(tokens = canvas.tokens?.controlled ?? []) {
  if (!game.user?.isGM) return;
  const getarnt = tokens.map((t) => t.document ?? t).filter((t) => t.getFlag(SYSTEM_ID, "tarnung"));
  if (!getarnt.length) return ui.notifications?.warn("Wähle eine getarnte Figur aus.");
  for (const token of getarnt) {
    const t = token.getFlag(SYSTEM_ID, "tarnung");
    // Neue Figur statt Bildwechsel: Foundry zeigt einen geänderten Token-Bildpfad nicht in jedem Browser sofort an.
    const daten = token.toObject();
    delete daten._id;
    daten.name = t.echt;
    daten.texture = { ...daten.texture, src: t.bild };
    daten.disposition = CONST.TOKEN_DISPOSITIONS.HOSTILE;
    daten.hidden = false;
    delete daten.flags?.[SYSTEM_ID]?.tarnung;
    const [neu] = await token.parent.createEmbeddedDocuments("Token", [daten]);
    const combatant = game.combats.contents.flatMap((c) => c.combatants.contents).find((c) => c.tokenId === token.id);
    if (combatant && neu) await combatant.update({ tokenId: neu.id, name: t.echt, img: t.bild });
    await token.delete();
    await ChatMessage.create({ content: `<div class="hlw-chat-card hlw-chat-kurz"><h2>${t.name}?</h2><p>Die Gestalt verzerrt sich. Es ist eine <b>${t.echt}</b>!</p></div>` });
  }
}
