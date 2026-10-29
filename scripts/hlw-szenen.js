// Fertige Szenen fuer den Kampagnenstart. Aufruf als GM in der Konsole oder per Makro:
//   game.hlw.erstelleLindhain()
// Legt die Szene „Lindhain“ an: Dorfboden, Gebaeude als Kacheln mit Waenden und Tueren,
// die Dorf-NSC mit Gespraechsdaten und eine Ortsliste im Journal (ohne Marker auf der Karte).

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
const LINDHAIN_NSC = [
  {
    name: "Kessa Dorn", bild: "kessa-dorn", role: "Werberin der Abenteurergilde", x: 1940, y: 2140,
    facts: [
      ["Kam zum Saatwendefest nach Lindhain, um Hero-Kinder für die Schulen in Illmaris zu finden.", true],
      ["Prüft Kinder mit einem Kristall, der bei einem magischen Kern leuchtet.", true]
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

  ui.notifications?.info("Lindhain ist angelegt: Dorf mit 10 Gebäuden samt Dächern, 8 NSC und der Ortsliste.");
  return scene;
}
