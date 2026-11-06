// Nähe-Sprachchat (Dominik 2026-11-06)
// Mit Foundrys eingebautem Sprachchat hören sich Spieler nur, wenn ihre Figuren nah beieinander stehen:
// bis 4 Felder voll, dann immer leiser, ab 12 Feldern nichts mehr. Durch Wände (und geschlossene Türen) halb so laut.
// Der GM hört immer alle, und alle hören immer den GM. Wer keine Figur auf der Szene hat, hört nur den GM.
// Der GM schaltet das in der Tageszeit-Leiste oben an und aus (Welt-Einstellung "naeheChat").
// Jeder Browser regelt nur, wie laut er die anderen abspielt; der eigene Lautstärkeregler pro Person bleibt die Obergrenze.

const SYSTEM_ID = "hope-lies-within-2";
export const NAEHE = { voll: 4, still: 12, wand: 0.5 };

export function naeheAn() {
  return !!game.settings.get(SYSTEM_ID, "naeheChat");
}

// Die Figur eines Benutzers auf der angezeigten Szene: zugewiesener Charakter, sonst eine eigene Charakterfigur.
// Für sich selbst zählt zuerst die ausgewählte Figur.
function figurVon(user) {
  if (!canvas?.ready) return null;
  const figuren = canvas.tokens.placeables.filter((t) => t.actor && !t.document.hidden);
  if (user.isSelf) {
    const gewaehlt = canvas.tokens.controlled.find((t) => t.actor?.type === "character" && t.isOwner);
    if (gewaehlt) return gewaehlt;
  }
  const charakter = user.character;
  return (charakter && figuren.find((t) => t.actor.id === charakter.id))
    ?? figuren.find((t) => t.actor.type === "character" && t.actor.testUserPermission(user, "OWNER"))
    ?? null;
}

function wandDazwischen(a, b) {
  const backend = CONFIG.Canvas.polygonBackends?.sound;
  try {
    return !!backend?.testCollision(a.center, b.center, { type: "sound", mode: "any" });
  } catch {
    return false;
  }
}

// Wie laut höre ich diesen Benutzer (0 bis 1)?
export function naeheFaktor(user) {
  if (!naeheAn() || game.user.isGM || user.isGM) return 1;
  const ich = figurVon(game.user);
  const er = figurVon(user);
  if (!ich || !er) return 0;
  const felder = Math.hypot(ich.center.x - er.center.x, ich.center.y - er.center.y) / canvas.grid.size;
  let faktor = felder <= NAEHE.voll ? 1 : felder >= NAEHE.still ? 0 : 1 - (felder - NAEHE.voll) / (NAEHE.still - NAEHE.voll);
  if (faktor > 0 && wandDazwischen(ich, er)) faktor *= NAEHE.wand;
  return faktor;
}

// Lautstärke aller Mitspieler in diesem Browser setzen; Kamerakacheln von Leuten außer Hörweite werden blass
function anwenden() {
  if (!game.webrtc?.client || !ui.webrtc?.getUserVideoElement) return;
  for (const user of game.users.filter((u) => u.active && !u.isSelf)) {
    const video = ui.webrtc.getUserVideoElement(user.id);
    if (!video) continue;
    const faktor = naeheFaktor(user);
    const ziel = (game.webrtc.settings.getUser(user.id)?.volume ?? 1) * faktor;
    if (Math.abs(video.volume - ziel) > 0.01) video.volume = ziel;
    ui.webrtc.getUserCameraView?.(user.id)?.classList.toggle("hlw-ausser-hoerweite", faktor === 0);
  }
}

async function melden(an) {
  if (!game.users.activeGM?.isSelf) return;
  await ChatMessage.create({
    content: `<div class="hlw-chat-card hlw-chat-kurz"><h2><i class="fa-solid fa-ear-listen"></i> Nähe-Chat ${an ? "an" : "aus"}</h2><p>${an
      ? `Ihr hört euch nur, wenn eure Figuren nah beieinander stehen (bis ${NAEHE.voll} Felder deutlich, ab ${NAEHE.still} Feldern nichts mehr). Den GM hört ihr immer.`
      : "Alle hören sich wieder normal."}</p></div>`
  });
}

export function registerNaehe() {
  game.settings.register(SYSTEM_ID, "naeheChat", {
    scope: "world", config: false, type: Boolean, default: false,
    onChange: (an) => { anwenden(); melden(an); }
  });
  Hooks.once("ready", () => window.setInterval(anwenden, 400));
}
