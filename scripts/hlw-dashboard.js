// Dashboard fuer den Spielstart. Aufruf als GM in der Konsole oder per Makro:
//   game.hlw.erstelleDashboard()                 // Szene „Dashboard“ und Journal „Willkommen in Gaia“ anlegen
//   game.hlw.erstelleDashboard({ neu: true })    // beides neu aufbauen
//   game.hlw.dashboardAktualisieren()            // Steckbriefe neu zeichnen (passiert sonst automatisch)
// Hintergrund mit Titel, Weltkarte (Spieleransicht des Atlas) als Kachel, Steckbriefe der Spielercharaktere
// (Bild, Name, Level, Klasse, Herkunft, Spieler) und Notizen, die die Einfuehrungsseiten oeffnen.
// Nur Spielerwissen: keine GM-Inhalte in diesen Texten.

const SYSTEM_ID = "hope-lies-within-2";
const ASSETS = `systems/${SYSTEM_ID}/assets/dashboard`;
const SZENE = "Dashboard";
const JOURNAL = "Willkommen in Gaia";

// Lage der Bereiche im Hintergrundbild (3840 × 2160, siehe assets/dashboard/dashboard.webp)
const KARTE = { x: 150, y: 200, w: 1240, h: 1860 };
const GRUPPE = { x: 1520, y: 850, w: 2170, h: 730 };
const SCHRITT_X = [1520, 1886, 2252, 2618, 2984, 3350];   // linke Kante der sechs Kaesten, je 336 breit
const SCHRITT_Y = 1784;                                    // Mitte des Rings oben im Kasten

const TINTE = "#2a1f17";
const BRAUN = "#6b5a48";
const GOLD = "#8a6a3a";

const HERKUNFT_KURZ = { A: "Dorfkind", B: "Gildenrekrut", C: "Überlebende eines Nebelfalls", D: "Flüchtlingskind" };

const SEITEN = [
  {
    name: "Willkommen", icon: "icons/svg/book.svg",
    text: `
<h2>Hope lies within</h2>
<p>Willkommen auf Gaia. Es ist die Saatwende im Jahr 792 der Zählung. Ihr seid 14 bis 16 Jahre alt und wohnt alle in <b>Lindhain</b>, einem Dorf mit etwa 180 Menschen am Südrand des Waldes der Zauberer im Königreich Arkan. Ihr kennt euch, seit ihr laufen könnt.</p>
<p>Ihr seid <b>Heroes</b>: Ihr habt einen magischen Kern, wie die meisten Kinder seit über siebzig Jahren. Was das genau heißt, lernt ihr erst noch.</p>
<p>Den langen Krieg zwischen Arkan und Valmorea kennt ihr aus eurer Kindheit. Seit 788 herrscht Waffenstillstand, der Wald ist gesperrt, und in Lindhain wohnen Flüchtlingsfamilien.</p>
<h3>So geht es los</h3>
<ul>
<li><b>Prolog:</b> Die ersten ein bis zwei Sitzungen spielen in Lindhain.</li>
<li><b>Zeitsprung:</b> Danach geht ihr drei Jahre nach Illmaris in die Ausbildung: eine Schule, die Magie-Schule oder eine Lehre, und dort euer erster Job. Pro Jahr würfelt ihr ein Ereignis aus und erzählt eine kurze Szene.</li>
<li><b>Saatwende 795:</b> Mit 17 bis 19 Jahren bekommt ihr eure Gildenkarte (Rang F) und beginnt als Abenteurer. Das erste Level danach bringt eure Klasse.</li>
<li>Titel verdient ihr euch durch euer Verhalten, Insignien durch besondere Taten. Wie, verrät euch niemand vorher.</li>
</ul>
<h3>Dieses Dashboard</h3>
<p>Links die Karte von Gaia, rechts eure Steckbriefe. Ein Doppelklick auf ein Symbol unter „Erste Schritte“ öffnet die passende Seite dieses Journals, das Symbol über der Karte öffnet sie groß zum Zoomen. Ihr findet das Journal auch jederzeit im Journal-Reiter.</p>`
  },
  {
    name: "Dein Charakter", icon: "icons/svg/mystery-man.svg",
    text: `
<h2>Herkunft</h2>
<p>Jeder wählt eine Herkunft. Sie gibt einen festen Punkt auf einen Wert.</p>
<table>
<tr><th>Herkunft</th><th>Punkt</th><th>In Lindhain</th></tr>
<tr><td>A: Dorfkind</td><td>CON +1</td><td>Auf einem Hof aufgewachsen: Felder, Tiere, die Mühle am Lindbach.</td></tr>
<tr><td>B: Gildenrekrut</td><td>EDU +1</td><td>Ein Elternteil war bei der Gilde. Du kennst das Gildenbrett und die Regeln schon.</td></tr>
<tr><td>C: Überlebende eines Nebelfalls</td><td>SOU +1</td><td>Als kleines Kind warst du im Abyss-Nebel und hast überlebt. Seitdem spürst du deinen Kern deutlicher.</td></tr>
<tr><td>D: Flüchtlingskind</td><td>SPE +1</td><td>Deine Familie kam 788 von der Grenze. Du hast gelernt, schnell zu sein.</td></tr>
</table>
<h2>Werte</h2>
<p>Es gibt zehn Werte, jeder beginnt bei 1. Du verteilst 5 freie Punkte und bekommst 1 Punkt aus der Herkunft. Am Anfang höchstens +3 pro Wert. Mit jedem Level kommen Punkte dazu (+1 pro Level, ab Level 11 +2).</p>
<table>
<tr><th>Wert</th><th>Wofür</th></tr>
<tr><td>STR Stärke</td><td>Nahkampfschaden, Tragen, Inventar</td></tr>
<tr><td>DEX Geschicklichkeit</td><td>Feine Arbeit, Dolche, Rüstwert</td></tr>
<tr><td>CON Ausdauer</td><td>Lebenspunkte, Erholung</td></tr>
<tr><td>INT Intelligenz</td><td>Magie, Erfindergeist</td></tr>
<tr><td>WIS Weisheit</td><td>Magieresistenz, Naturkunde</td></tr>
<tr><td>CHA Charisma</td><td>Reden, Tiere, Willenskraft</td></tr>
<tr><td>AGL Beweglichkeit</td><td>Fernkampf, Ausweichen</td></tr>
<tr><td>SPE Geschwindigkeit</td><td>Initiative, Bewegung</td></tr>
<tr><td>EDU Bildung</td><td>Wissen, Religion, Archäologie</td></tr>
<tr><td>SOU Seelenkraft</td><td>Kern, Magieresistenz, Willenskraft</td></tr>
</table>
<h2>Klasse</h2>
<p>Deine Klasse ergibt sich aus der Verteilung deiner Punkte, die erste ab 10 verteilten Punkten. Welche es wird, siehst du erst, wenn du gespeichert hast. Du musst dich also nicht festlegen: Spiel, was zu deinem Charakter passt. Jede Waffe und jede Fähigkeit steht dir offen, egal welche Klasse du bekommst.</p>
<h2>Was sich daraus ergibt</h2>
<table>
<tr><th>Wert</th><th>So rechnet das System</th></tr>
<tr><td>Lebenspunkte (HP)</td><td>20 + 2 × Level + 3 × CON + Rüstung</td></tr>
<tr><td>Rüstwert (RW)</td><td>8 + (AGL + DEX) ÷ 4, abgerundet, + Rüstung</td></tr>
<tr><td>Magieresistenz (MR)</td><td>8 + (WIS + SOU) ÷ 4, abgerundet</td></tr>
<tr><td>Genauigkeit (ACC)</td><td>Hauptwert des Angriffs ÷ 3, abgerundet</td></tr>
<tr><td>Bewegung</td><td>3 + SPE ÷ 6 Felder</td></tr>
<tr><td>Initiative</td><td>1W20 + SPE ÷ 2</td></tr>
<tr><td>Inventar</td><td>10 + STR Plätze</td></tr>
</table>
<h3>Drei Fragen für deinen Charakter</h3>
<ol>
<li>Wer in Lindhain ist dir am wichtigsten, und warum?</li>
<li>Was hast du in der Nacht im Jahr 788 gesehen oder gehört?</li>
<li>Willst du nach Illmaris, oder hält dich etwas im Dorf?</li>
</ol>`
  },
  {
    name: "Proben", icon: "icons/svg/d20.svg",
    text: `
<h2>World-Skills</h2>
<p>Für alles außerhalb des Kampfs: <b>1W20 + die drei Werte des Skills</b> gegen eine Schwierigkeit. Es gibt keine eigenen Skillpunkte; besser wirst du über deine Werte, deinen Job und deine Ausrüstung.</p>
<table>
<tr><th>Schwierigkeit</th><th>Wert</th></tr>
<tr><td>Leicht</td><td>10</td></tr>
<tr><td>Mittel</td><td>15</td></tr>
<tr><td>Schwer</td><td>20</td></tr>
<tr><td>Sehr schwer</td><td>25</td></tr>
<tr><td>Meisterhaft</td><td>30</td></tr>
<tr><td>Heldenhaft · Episch · Legendär</td><td>40 · 50 · 60</td></tr>
</table>
<ul>
<li>Eine natürliche 20 gelingt immer, eine natürliche 1 misslingt immer.</li>
<li>Helfen gibt +2 (höchstens +4). Bei einer Gruppenprobe muss die Hälfte schaffen.</li>
<li>Gegen jemanden (Schleichen gegen Wachsamkeit) würfeln beide; bei Gleichstand gewinnt, wer sich wehrt.</li>
</ul>
<table>
<tr><th>World-Skill</th><th>Werte</th><th>Wofür</th></tr>
<tr><td>Athletik</td><td>STR, CON, AGL</td><td>Klettern, Schwimmen, Springen, Werfen, Tragen</td></tr>
<tr><td>Wortgewandtheit</td><td>CHA, EDU, INT</td><td>Überreden, Lügen, Verhandeln, Einschüchtern</td></tr>
<tr><td>Erfindergeist</td><td>INT, WIS, DEX</td><td>Kreative Lösungen, Mechanismen, Fallen entschärfen</td></tr>
<tr><td>Naturkunde</td><td>WIS, AGL, SOU</td><td>Pflanzen, Wetter, Wege finden, Überleben</td></tr>
<tr><td>Tierkunde</td><td>CHA, SPE, SOU</td><td>Tiere beruhigen, reiten, zähmen, Spuren, Jagen</td></tr>
<tr><td>Religion</td><td>WIS, EDU, SOU</td><td>Glaube, Riten, Segen, Ahnenlehre</td></tr>
<tr><td>Scharfsinnigkeit</td><td>INT, SPE, DEX</td><td>Wahrnehmen, Suchen, Lügen durchschauen</td></tr>
<tr><td>Archäologie</td><td>EDU, STR, WIS</td><td>Ruinen, Inschriften, alte Sprachen, Runen</td></tr>
<tr><td>Handwerkskunst</td><td>DEX, STR, CON</td><td>Schmieden, Bauen, Reparieren, Kochen</td></tr>
<tr><td>Willenskraft</td><td>SOU, CHA, CON</td><td>Angst und Schmerz widerstehen, durchhalten</td></tr>
<tr><td>Heimlichkeit</td><td>DEX, AGL, SPE</td><td>Schleichen, Verstecken, Schlösser öffnen</td></tr>
</table>`
  },
  {
    name: "Kampf", icon: "icons/svg/sword.svg",
    text: `
<h2>Dein Zug</h2>
<p>Die Reihenfolge bestimmt die Initiative (1W20 + SPE ÷ 2). In deinem Zug hast du <b>Bewegung</b>, <b>eine Aktion</b> und <b>eine Schnellaktion</b>; dazu einmal pro Runde eine <b>Reaktion</b>.</p>
<ul>
<li><b>Aktion:</b> Angriff mit der Waffe oder ein Skill.</li>
<li><b>Schnellaktion:</b> Instant-Skills, Waffe wechseln, einen Gegenstand benutzen.</li>
<li><b>Reaktion:</b> Gelegenheitsangriff, vorbereitete Aktion, Reaktions-Skills.</li>
</ul>
<p>Es gibt kein Mana. Skills haben Abklingzeiten in eigenen Zügen: „3 Turns“ heißt, du setzt ihn in Zug 1 ein und wieder in Zug 4.</p>
<h2>Treffen und Schaden</h2>
<ul>
<li><b>Treffen:</b> 1W20 + Genauigkeit gegen den Rüstwert des Ziels (bei Magie gegen die Magieresistenz).</li>
<li>Eine natürliche 20 ist ein kritischer Treffer (doppelte Würfel), eine natürliche 1 geht immer daneben.</li>
<li><b>Schaden:</b> Skill + Waffe + Hauptwert ÷ 4 + Nebenwert ÷ 8, minus Blockwert des Ziels (mindestens 1). Heilung bekommt denselben Bonus.</li>
<li>Wer ein Monster besiegt, bekommt etwas EXP und einen <b>EXP-Kristall</b> ins Inventar. Den könnt ihr verwenden (mehr EXP), einem anderen geben oder bei der Gilde verkaufen. Abyss-Kristalle von korrumpierten Monstern will die Gilde haben. Das Level steigt beim nächsten Besuch in der Gilde.</li>
</ul>
<h2>Bei 0 HP</h2>
<p>Du bist <b>am Boden</b> und kannst dich nicht bewegen. Wenn du am Zug bist, drückst du im Kampf-HUD auf <b>Todeswurf</b> (1W20). Ab 10 stehst du mit 1 HP wieder auf. Darunter bist du <b>gewurzelt</b>: Du hast noch <b>3 Runden</b>. In der Zeit kann dir jemand direkt neben dir einen Heiltrank, eine Salbe oder einen Verband <b>verabreichen</b> (dich als Ziel markieren, dann im Inventar „Verabreichen“ oder im HUD „Gegenstand“) oder dich mit einem Heil-Skill heilen. Sonst stirbt dein Charakter, und du erstellst einen neuen.</p>`
  },
  {
    name: "Foundry", icon: "icons/svg/hanging-sign.svg",
    text: `
<h2>Dein Charakterbogen</h2>
<ul>
<li>Deinen Charakter findest du im Reiter <b>Actors</b>. Ein Doppelklick auf deine Figur öffnet den Bogen ebenfalls.</li>
<li><b>Punkte verteilen:</b> Steht im Bogen „Punkte frei“, verteilst du sie mit + und − und bestätigst mit <b>Speichern</b>. Gespeicherte Punkte sind fest. Danach wird deine Klasse aufgedeckt.</li>
<li>Ein Klick auf einen Gegenstand öffnet ein Menü: Ausrüsten, Benutzen, Details, An Ziel geben, Wegwerfen.</li>
<li>Ein Klick auf einen Skill zeigt alle seine Werte. <b>Skill-Orbs</b> schätzt du mit einem Klick (Appraisal: 1W20 + SOU).</li>
</ul>
<h2>Im Kampf</h2>
<ul>
<li>Wenn du dran bist, erscheint unten die <b>Kampfleiste</b>: Aktion, Schnellaktion, Reaktion, Bewegung, deine Waffen und Skills.</li>
<li><b>Ziel wählen:</b> Fahre mit der Maus über den Gegner und drücke <b>T</b>. Dann Waffe oder Skill in der Kampfleiste anklicken. Die Würfel rollen über den Bildschirm, das Ergebnis steht im Chat.</li>
<li><b>Bewegen:</b> Figur ziehen. Die Felder werden mitgezählt.</li>
</ul>
<h2>Unterwegs</h2>
<ul>
<li><b>Häuser</b> siehst du erst von innen, wenn deine Figur hineingeht.</li>
<li><b>Türen:</b> Klick auf das Türsymbol. Darüber erscheint „Geöffnet“, „Geschlossen“ oder „Verschlossen“.</li>
<li><b>Gespräche:</b> Spricht ein NSC mit euch, öffnet sich das Gesprächsfenster bei allen. Dort könnt ihr <b>Notizen der Gruppe</b> zum NSC anlegen, bei Händlern <b>kaufen und verkaufen</b> und Quests <b>annehmen</b>.</li>
</ul>`
  },
  {
    name: "Am Tisch", icon: "icons/svg/tankard.svg",
    text: `
<h2>So spielen wir</h2>
<ul>
<li>Gespielt wird über Discord, in <b>Kapiteln</b>: In einem <b>City-Chapter</b> bewegt ihr euch frei durch eine Stadt (Quests, Läden, Gasthaus). In einem <b>Movement-Chapter</b> reist ihr und trefft unterwegs Entscheidungen.</li>
<li>Levelaufstieg gibt es beim nächsten Besuch in der Gilde.</li>
<li>Würfelt offen, wenn der GM nichts anderes sagt.</li>
</ul>
<h2>Grenzen</h2>
<p>Sagt vor dem Spiel, was ihr am Tisch nicht erleben wollt. Der GM hält sich daran, und jeder darf eine Szene jederzeit anhalten.</p>
<h2>Was du am Anfang hast</h2>
<ul>
<li>Kleidung, einen Rucksack und was ein Kind aus Lindhain eben so besitzt (sprich mit dem GM).</li>
<li>Eine einfache Waffe aus dem Dorf: Holzkeule, Holzbogen oder Holz-Kampfstab (1W6).</li>
<li>Noch keine Skills. Im Prolog kämpfst du mit dem normalen Angriff und deinem Einfallsreichtum. Skills lernt ihr in Illmaris.</li>
<li>Ein paar Silber-Kes Taschengeld. Das Startkapital von 50 SK und eine Leihwaffe der Gilde gibt es mit der Gildenkarte.</li>
</ul>`
  }
];

const istSpielercharakter = (actor) => actor?.type === "character" && !actor.getFlag(SYSTEM_ID, "besitzer");
const spielerVon = (actor) => game.users.filter((u) => !u.isGM && actor.testUserPermission(u, "OWNER"));

// Charaktere, die einem Spieler gehoeren (zugewiesene zuerst, dann nach Name)
function spielercharaktere() {
  const zugewiesen = new Set(game.users.filter((u) => !u.isGM && u.character).map((u) => u.character.id));
  return game.actors
    .filter((a) => istSpielercharakter(a) && (zugewiesen.has(a.id) || spielerVon(a).length))
    .sort((a, b) => (zugewiesen.has(b.id) - zugewiesen.has(a.id)) || a.name.localeCompare(b.name, "de"));
}

function steckbriefText(actor) {
  const p = actor.system?.progression ?? {};
  const id = actor.system?.identity ?? {};
  const herkunft = String(id.origin ?? "").trim();
  const buchstabe = herkunft.match(/^([ABCD])\b/)?.[1];
  const spieler = String(id.player ?? "").trim() || spielerVon(actor).map((u) => u.name).join(", ");
  return [
    `Level ${Number(p.level) || 1} · ${String(p.class ?? "").trim() || "Klasse folgt"}`,
    buchstabe ? HERKUNFT_KURZ[buchstabe] : herkunft,
    String(id.age ?? "").trim() ? `${String(id.age).trim()} Jahre` : "",
    spieler ? `Spieler: ${spieler}` : ""
  ].filter(Boolean).join("\n");
}

function dashboardSzene() {
  return game.scenes.find((s) => s.getFlag(SYSTEM_ID, "dashboard")) ?? null;
}

// Foundry 14: Kacheln, Zeichnungen und Notizen gehoeren zu einer Ebene; Kacheln sind an ihrer Mitte verankert.
function ebeneVon(scene) {
  return scene.initialLevel?.id ?? scene.firstLevel?.id;
}

function steckbriefDaten(scene) {
  const level = ebeneVon(scene);
  const charaktere = spielercharaktere();
  const flags = { [SYSTEM_ID]: { steckbrief: true } };
  const tiles = [];
  const drawings = [];
  if (!charaktere.length) {
    drawings.push({
      shape: { type: "r", width: GRUPPE.w, height: 200 }, x: GRUPPE.x, y: GRUPPE.y + GRUPPE.h / 2 - 100,
      text: "Noch keine Spielercharaktere. Sobald der GM sie anlegt, erscheinen hier ihre Steckbriefe.",
      fontFamily: "Amiri", fontSize: 44, textColor: BRAUN, strokeWidth: 0, fillType: CONST.DRAWING_FILL_TYPES.NONE,
      levels: [level], locked: true, flags
    });
    return { tiles, drawings };
  }
  const spalten = charaktere.length <= 6 ? 3 : 4;
  const zeilen = Math.ceil(charaktere.length / spalten);
  const luecke = 40;
  const breite = Math.floor((GRUPPE.w - (spalten - 1) * luecke) / spalten);
  const hoehe = Math.min(345, Math.floor((GRUPPE.h - (zeilen - 1) * luecke) / zeilen));
  const bild = hoehe - 50;
  charaktere.forEach((actor, n) => {
    const x = GRUPPE.x + (n % spalten) * (breite + luecke);
    const y = GRUPPE.y + Math.floor(n / spalten) * (hoehe + luecke);
    const textX = x + 25 + bild + 20;
    const textBreite = breite - (textX - x) - 20;
    const kartenFlags = { [SYSTEM_ID]: { steckbrief: true, actorId: actor.id } };
    drawings.push({
      shape: { type: "r", width: breite, height: hoehe }, x, y,
      fillType: CONST.DRAWING_FILL_TYPES.SOLID, fillColor: "#fbf5e8", fillAlpha: 0.82,
      strokeWidth: 3, strokeColor: GOLD, strokeAlpha: 0.7, levels: [level], locked: true, sort: 1, flags: kartenFlags
    });
    drawings.push({
      shape: { type: "r", width: textBreite, height: Math.round(hoehe * 0.36) }, x: textX, y: y + 20,
      text: actor.name, fontFamily: "Amiri", fontSize: actor.name.length > 16 ? 44 : 54, textColor: TINTE,
      strokeWidth: 0, fillType: CONST.DRAWING_FILL_TYPES.NONE, levels: [level], locked: true, sort: 2, flags: kartenFlags
    });
    drawings.push({
      shape: { type: "r", width: textBreite, height: Math.round(hoehe * 0.52) }, x: textX, y: y + Math.round(hoehe * 0.4),
      text: steckbriefText(actor), fontFamily: "Signika", fontSize: spalten === 3 ? 30 : 26, textColor: BRAUN,
      strokeWidth: 0, fillType: CONST.DRAWING_FILL_TYPES.NONE, levels: [level], locked: true, sort: 2, flags: kartenFlags
    });
    drawings.push({
      shape: { type: "r", width: bild + 12, height: bild + 12 }, x: x + 19, y: y + 19,
      fillType: CONST.DRAWING_FILL_TYPES.SOLID, fillColor: "#3a2c20", fillAlpha: 0.92,
      strokeWidth: 3, strokeColor: GOLD, strokeAlpha: 0.9, levels: [level], locked: true, sort: 2, flags: kartenFlags
    });
    // Zeichnungen liegen bei gleicher Hoehe immer ueber Kacheln; das Bild deshalb eine Stufe hoeher.
    tiles.push({
      texture: { src: actor.img || "icons/svg/mystery-man.svg" },
      x: x + 25 + bild / 2, y: y + 25 + bild / 2, width: bild, height: bild, elevation: 1,
      levels: [level], locked: true, sort: 3, flags: kartenFlags
    });
  });
  return { tiles, drawings };
}

export async function dashboardAktualisieren() {
  if (!game.user?.isGM) return;
  const scene = dashboardSzene();
  if (!scene) return;
  const alt = (sammlung) => sammlung.filter((d) => d.getFlag(SYSTEM_ID, "steckbrief")).map((d) => d.id);
  const alteDrawings = alt(scene.drawings);
  const alteTiles = alt(scene.tiles);
  if (alteDrawings.length) await scene.deleteEmbeddedDocuments("Drawing", alteDrawings);
  if (alteTiles.length) await scene.deleteEmbeddedDocuments("Tile", alteTiles);
  const { tiles, drawings } = steckbriefDaten(scene);
  if (drawings.length) await scene.createEmbeddedDocuments("Drawing", drawings);
  if (tiles.length) await scene.createEmbeddedDocuments("Tile", tiles);
}

export async function erstelleDashboard({ neu = false } = {}) {
  if (!game.user?.isGM) return ui.notifications?.warn("Nur der GM kann Szenen anlegen.");
  if (neu) {
    await dashboardSzene()?.delete();
    await game.journal.getName(JOURNAL)?.delete();
  }
  if (dashboardSzene()) return ui.notifications?.warn("Das Dashboard gibt es schon. Neu aufbauen: game.hlw.erstelleDashboard({ neu: true })");

  const journal = game.journal.getName(JOURNAL) ?? await JournalEntry.create({
    name: JOURNAL,
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
    pages: [
      ...SEITEN.map((s, n) => ({ name: s.name, type: "text", sort: (n + 1) * 100, text: { content: s.text.trim() } })),
      {
        name: "Weltkarte", type: "image", sort: 900, src: `${ASSETS}/weltkarte.webp`,
        image: { caption: "Gaia, Kontinentalkarte im Jahr 792. 150 km sind etwa 5 Tage zu Fuß." }
      }
    ]
  });

  const scene = await Scene.create({
    name: SZENE,
    navName: "Willkommen",
    navigation: true,
    width: 3840,
    height: 2160,
    padding: 0,
    backgroundColor: "#1b140e",
    grid: { type: CONST.GRID_TYPES.GRIDLESS, size: 100 },
    tokenVision: false,
    initial: { x: 1920, y: 1080, scale: 0.45 },
    levels: [{ name: "Dashboard", background: { src: `${ASSETS}/dashboard.webp` }, textures: { fit: "fill" } }],
    flags: { [SYSTEM_ID]: { dashboard: true } }
  });
  const level = ebeneVon(scene);

  await scene.createEmbeddedDocuments("Tile", [{
    texture: { src: `${ASSETS}/weltkarte.webp` },
    x: KARTE.x + KARTE.w / 2, y: KARTE.y + KARTE.h / 2, width: KARTE.w, height: KARTE.h,
    levels: [level], locked: true, flags: { [SYSTEM_ID]: { weltkarte: true } }
  }]);

  const seite = (name) => journal.pages.getName(name)?.id ?? null;
  const notiz = (name, icon, x, y) => ({
    entryId: journal.id, pageId: seite(name), x, y, iconSize: 84, global: true,
    texture: { src: icon, tint: TINTE }, text: name, fontFamily: "Signika", fontSize: 32, textColor: "#ffffff",
    levels: [level]
  });
  await scene.createEmbeddedDocuments("Note", [
    ...SEITEN.map((s, n) => notiz(s.name, s.icon, SCHRITT_X[n] + 168, SCHRITT_Y)),
    notiz("Weltkarte", "icons/svg/direction.svg", KARTE.x + KARTE.w - 40, 150)
  ]);

  await dashboardAktualisieren();
  ui.notifications?.info(`Das Dashboard ist angelegt: Szene „${SZENE}“ mit Weltkarte, Steckbriefen und dem Journal „${JOURNAL}“.`);
  return scene;
}

// Steckbriefe automatisch nachziehen, wenn sich Name, Bild, Level, Klasse, Herkunft oder Besitzer aendern
let warten = null;
function spaeterAktualisieren() {
  if (!game.users.activeGM?.isSelf || !dashboardSzene()) return;
  clearTimeout(warten);
  warten = setTimeout(() => dashboardAktualisieren(), 1500);
}

// Texte des Journals in bestehenden Welten auf den Stand des Systems bringen (Seiten mit gleichem Namen)
export const DASHBOARD_TEXT_STAND = 1;
export async function dashboardTexteAktualisieren() {
  const journal = game.journal.getName(JOURNAL);
  if (!journal) return 0;
  const updates = SEITEN.map((s) => ({ seite: journal.pages.getName(s.name), text: s.text.trim() }))
    .filter(({ seite, text }) => seite && seite.text?.content !== text)
    .map(({ seite, text }) => ({ _id: seite.id, "text.content": text }));
  if (updates.length) await journal.updateEmbeddedDocuments("JournalEntryPage", updates);
  return updates.length;
}

export function registerDashboard() {
  Hooks.on("updateActor", (actor, changes) => {
    if (actor.type !== "character") return;
    const relevant = ["name", "img", "ownership", "system.progression", "system.identity"].some((k) => foundry.utils.hasProperty(changes, k));
    if (relevant) spaeterAktualisieren();
  });
  Hooks.on("createActor", (actor) => { if (actor.type === "character") spaeterAktualisieren(); });
  Hooks.on("deleteActor", (actor) => { if (actor.type === "character") spaeterAktualisieren(); });
  Hooks.on("updateUser", (user, changes) => { if ("character" in changes) spaeterAktualisieren(); });
}
