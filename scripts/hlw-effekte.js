// Spezialeffekte (Dominik 2026-11-06)
// Der GM öffnet das Effekte-Fenster (Knopf in der linken Werkzeugleiste bei den Figuren oder game.hlw.effekte())
// und spielt dort Effekte ab, die bei allen gleichzeitig über den Bildschirm laufen.
// „Party“: Luftballons steigen auf, Konfetti regnet und knallt aus zwei Kanonen, optional ein Festtext.
// „Gewitter“: Donner grollt, dann schlägt ein Blitz ein (nicht auf der Karte): der Bildschirm blitzt auf und die Karte
// ist für einen Moment hell, auch nachts. Der Donner wird im Browser erzeugt und läuft über den Umgebungs-Regler.
// Weitere Effekte kommen als neuer Eintrag in EFFEKTE dazu (Name, Text, Symbol, Funktion).

const SYSTEM_ID = "hope-lies-within-2";
const ApplicationV2 = foundry.applications.api.ApplicationV2;

const FARBEN = ["#f94144", "#f3722c", "#f8961e", "#f9c74f", "#90be6d", "#43aa8b", "#4cc9f0", "#577590", "#9b5de5", "#f15bb5", "#ffffff"];
const zufall = (a, b) => a + Math.random() * (b - a);
const eines = (liste) => liste[Math.floor(Math.random() * liste.length)];

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const laufend = new Map();   // Effekt-ID → stoppen() des laufenden Effekts (verschiedene Effekte dürfen gleichzeitig laufen)

export function effektStoppen(id = null) {
  for (const [key, stoppen] of [...laufend]) {
    if (id && key !== id) continue;
    stoppen();
    laufend.delete(key);
  }
}

// ---------- Party ----------

function konfettiTeil(x, y, vx, vy) {
  return { x, y, vx, vy, w: zufall(6, 12), h: zufall(3, 7), rot: zufall(0, Math.PI * 2), vrot: zufall(-8, 8), phase: zufall(0, Math.PI * 2), flatter: zufall(6, 12), farbe: eines(FARBEN) };
}

function ballon(breite, hoehe) {
  const r = zufall(22, 40);
  return { x: zufall(r, breite - r), y: hoehe + r * 3, r, vy: -zufall(70, 130), phase: zufall(0, Math.PI * 2), schwing: zufall(12, 30), farbe: eines(FARBEN.slice(0, -1)) };
}

function ballonMalen(ctx, b, t) {
  const kippen = Math.sin(t * 1.4 + b.phase) * 0.12;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(kippen);
  // Schnur
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, b.r * 1.2);
  ctx.quadraticCurveTo(Math.sin(t * 2 + b.phase) * 10, b.r * 2.2, 0, b.r * 3.2);
  ctx.stroke();
  // Knoten und Ballon
  ctx.fillStyle = b.farbe;
  ctx.beginPath();
  ctx.moveTo(-5, b.r * 1.28);
  ctx.lineTo(5, b.r * 1.28);
  ctx.lineTo(0, b.r * 1.12);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, b.r, b.r * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Glanzlicht
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(-b.r * 0.35, -b.r * 0.45, b.r * 0.22, b.r * 0.34, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function party({ dauer = 10, text = "" } = {}) {
  effektStoppen("party");
  const ebene = document.createElement("div");
  ebene.className = "hlw-effekt";
  const leinwand = document.createElement("canvas");
  ebene.appendChild(leinwand);
  if (text) {
    const titel = document.createElement("div");
    titel.className = "hlw-effekt-text";
    titel.textContent = text;
    ebene.appendChild(titel);
  }
  document.body.appendChild(ebene);

  const ctx = leinwand.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  let breite = 0;
  let hoehe = 0;
  const groesse = () => {
    breite = window.innerWidth;
    hoehe = window.innerHeight;
    leinwand.width = breite * dpr;
    leinwand.height = hoehe * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  groesse();
  window.addEventListener("resize", groesse);

  const teile = [];
  const ballone = [];
  const kanone = (x, richtung, anzahl = 90) => {
    for (let i = 0; i < anzahl; i++) {
      const winkel = zufall(-1.35, -0.75);   // schräg nach oben ins Bild
      const tempo = zufall(650, 1150);
      teile.push(konfettiTeil(x, hoehe + 10, Math.cos(winkel) * tempo * richtung, Math.sin(winkel) * tempo));
    }
  };
  const salven = [0, 2.6, 5.2].filter((s) => s < dauer - 3);
  let naechsteSalve = 0;
  let regen = 0;
  let ballonZaehler = 0;
  const start = performance.now();
  let aus = false;
  let frame = 0;

  const ende = () => {
    aus = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", groesse);
    ebene.remove();
    if (laufend.get("party") === ende) laufend.delete("party");
  };

  // Bewegung in kleinen Zeitschritten, damit der Effekt auch auf langsamen Rechnern gleich schnell läuft
  const bewegen = (dt, t) => {
    if (naechsteSalve < salven.length && t >= salven[naechsteSalve]) {
      kanone(0, 1);
      kanone(breite, -1);
      naechsteSalve += 1;
    }
    if (t < dauer - 3) {
      regen += dt * 70;
      for (; regen >= 1; regen -= 1) teile.push(konfettiTeil(zufall(0, breite), -15, zufall(-30, 30), zufall(60, 140)));
      ballonZaehler += dt * 2.4;
      for (; ballonZaehler >= 1; ballonZaehler -= 1) ballone.push(ballon(breite, hoehe));
    }
    for (let i = ballone.length - 1; i >= 0; i--) {
      const b = ballone[i];
      b.y += b.vy * dt;
      b.x += Math.cos(t * 1.3 + b.phase) * b.schwing * dt;
      if (b.y < -b.r * 4) ballone.splice(i, 1);
    }
    for (let i = teile.length - 1; i >= 0; i--) {
      const k = teile[i];
      k.vy += 520 * dt;                                  // Schwerkraft
      k.vx *= 1 - 1.6 * dt;                              // Luftwiderstand
      if (k.vy > 150) k.vy -= (k.vy - 150) * 3 * dt;     // Konfetti segelt langsam
      k.x += (k.vx + Math.sin(t * 3 + k.phase) * 25) * dt;
      k.y += k.vy * dt;
      k.rot += k.vrot * dt;
      if (k.y > hoehe + 30 || k.x < -60 || k.x > breite + 60) teile.splice(i, 1);
    }
  };

  let simZeit = 0;
  const schritt = (jetzt) => {
    if (aus) return;
    const t = (jetzt - start) / 1000;
    const rest = Math.min(0.25, t - simZeit);
    const n = Math.max(1, Math.ceil(rest / 0.03));
    for (let i = 0; i < n; i++) bewegen(rest / n, simZeit + (rest * (i + 1)) / n);
    simZeit = t;

    ctx.clearRect(0, 0, breite, hoehe);
    ctx.globalAlpha = t > dauer - 1.5 ? Math.max(0, (dauer + 0.5 - t) / 2) : 1;
    for (const b of ballone) ballonMalen(ctx, b, t);
    for (const k of teile) {
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.rotate(k.rot);
      ctx.scale(1, Math.cos(t * k.flatter + k.phase));
      ctx.fillStyle = k.farbe;
      ctx.fillRect(-k.w / 2, -k.h / 2, k.w, k.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (t > dauer + 0.5) return ende();
    frame = requestAnimationFrame(schritt);
  };
  frame = requestAnimationFrame(schritt);
  laufend.set("party", ende);
}


// ---------- Gewitter ----------

// Rauschen als Grundstoff für den Donner
function rauschen(ctx, sekunden) {
  const puffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * sekunden), ctx.sampleRate);
  const daten = puffer.getChannelData(0);
  let braun = 0;
  for (let i = 0; i < daten.length; i++) {
    braun = (braun + 0.02 * (Math.random() * 2 - 1)) / 1.02;   // „braunes“ Rauschen: tief und rollend
    daten[i] = braun * 3.5;
  }
  return puffer;
}

// Ein Donnerlaut: Rauschen durch einen Tiefpass, mit Hüllkurve. stark = 0..1
function donner(ctx, ziel, start, { dauer = 3, stark = 1, hell = 0, grollen = false } = {}) {
  const quelle = ctx.createBufferSource();
  quelle.buffer = rauschen(ctx, dauer + 0.5);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(grollen ? 160 : 900 + hell * 2500, start);
  filter.frequency.exponentialRampToValueAtTime(grollen ? 90 : 140, start + dauer);
  const laut = ctx.createGain();
  laut.gain.setValueAtTime(0.0001, start);
  if (grollen) {
    laut.gain.exponentialRampToValueAtTime(0.5 * stark, start + dauer * 0.35);
    laut.gain.exponentialRampToValueAtTime(0.0001, start + dauer);
  } else {
    laut.gain.exponentialRampToValueAtTime(1.6 * stark, start + 0.02);        // Knall
    laut.gain.exponentialRampToValueAtTime(0.7 * stark, start + 0.35);
    // Nachrollen in Wellen
    for (let w = 1; w <= 3; w++) laut.gain.exponentialRampToValueAtTime((0.75 - w * 0.15) * stark, start + 0.35 + w * dauer * 0.18);
    laut.gain.exponentialRampToValueAtTime(0.0001, start + dauer);
  }
  quelle.connect(filter).connect(laut).connect(ziel);
  quelle.start(start);
  quelle.stop(start + dauer + 0.5);
  return quelle;
}

// Die Karte kurz aufhellen (nur in diesem Browser, die Szene bleibt unverändert)
function karteAufhellen(an) {
  if (!canvas?.ready || !canvas.scene) return;
  const nacht = canvas.scene._source.environment?.darknessLevel ?? 0;
  if (nacht <= 0) return;
  canvas.environment.initialize({ environment: { darknessLevel: an ? 0 : nacht } });
}

function gewitter({ anzahl = 1 } = {}) {
  effektStoppen("gewitter");
  const ebene = document.createElement("div");
  ebene.className = "hlw-effekt hlw-blitz";
  document.body.appendChild(ebene);
  const timer = [];
  const quellen = [];
  let aus = false;
  const spaeter = (ms, fn) => timer.push(window.setTimeout(() => !aus && fn(), ms));

  // Ton über den Umgebungs-Kanal (Regler „Umgebung“ jedes Spielers)
  const ctx = game.audio?.environment;
  const ziel = ctx?.gainNode ?? ctx?.destination;
  if (ctx?.state === "suspended") ctx.resume?.();
  const jetzt = () => ctx?.currentTime ?? 0;

  // Erst grollt es in der Ferne, dann schlägt es ein
  if (ctx) quellen.push(donner(ctx, ziel, jetzt() + 0.05, { dauer: 2.4, stark: 0.8, grollen: true }));
  const einschlaege = [];
  let t = 1700;
  for (let i = 0; i < Math.max(1, Math.min(3, anzahl)); i++) {
    einschlaege.push(t);
    t += zufall(1600, 2600);
  }

  const blitz = () => {
    // Flackern: hell, kurz dunkler, noch einmal hell, dann ausblenden
    ebene.classList.remove("is-aus");
    ebene.style.opacity = "0.9";
    karteAufhellen(true);
    if (ctx) quellen.push(donner(ctx, ziel, jetzt(), { dauer: zufall(3.2, 4.2), stark: 1, hell: 1 }));
    window.setTimeout(() => { ebene.style.opacity = "0.25"; }, 70);
    window.setTimeout(() => { ebene.style.opacity = "0.75"; }, 150);
    window.setTimeout(() => { ebene.classList.add("is-aus"); ebene.style.opacity = "0"; }, 260);
    window.setTimeout(() => karteAufhellen(false), 520);
  };
  for (const ms of einschlaege) spaeter(ms, blitz);

  const ende = () => {
    aus = true;
    timer.forEach((id) => window.clearTimeout(id));
    quellen.forEach((q) => { try { q.stop(); } catch { /* schon zu Ende */ } });
    karteAufhellen(false);
    ebene.remove();
    if (laufend.get("gewitter") === ende) laufend.delete("gewitter");
  };
  spaeter(t + 3000, ende);
  laufend.set("gewitter", ende);
}

// ---------- Liste der Effekte ----------

export const EFFEKTE = [
  {
    id: "party",
    name: "Party",
    icon: "fa-solid fa-champagne-glasses",
    text: "Luftballons steigen auf, Konfetti regnet und knallt aus zwei Kanonen. Mit Text wird zusätzlich groß ein Festspruch eingeblendet.",
    optionen: { dauer: { min: 5, max: 30, standard: 10 }, text: "z. B. Frohe Saatwende!" },
    abspielen: party
  },
  {
    id: "gewitter",
    name: "Gewitter",
    icon: "fa-solid fa-cloud-bolt",
    text: "Donner grollt, dann schlägt ein Blitz ein: der Bildschirm blitzt auf und die Karte ist kurz hell, auch nachts. Der Blitz trifft nichts auf der Karte.",
    optionen: { anzahl: { min: 1, max: 3, standard: 1, label: "Blitze" } },
    abspielen: gewitter
  }
];

// Bei allen abspielen (der GM schickt, jeder Browser zeichnet selbst)
export function effektSenden(id, optionen = {}) {
  if (!game.user?.isGM) return;
  const daten = { type: "effekt", id, optionen };
  game.socket.emit(`system.${SYSTEM_ID}`, daten);
  effektEmpfangen(daten);
}

function effektEmpfangen(daten) {
  if (daten?.type === "effektStopp") return effektStoppen();
  if (daten?.type !== "effekt") return;
  EFFEKTE.find((e) => e.id === daten.id)?.abspielen(daten.optionen ?? {});
}

export function effekteStoppenAlle() {
  if (!game.user?.isGM) return;
  game.socket.emit(`system.${SYSTEM_ID}`, { type: "effektStopp" });
  effektStoppen();
}

// ---------- Fenster (nur GM) ----------

export class HopeLiesWithinEffekte extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "hlw-effekte",
    classes: ["hope-lies-within", "hlw-effekte"],
    tag: "div",
    window: { title: "Spezialeffekte (GM)", icon: "fa-solid fa-burst", resizable: true },
    position: { width: 460, height: "auto" }
  };

  static oeffnen() {
    if (!game.user?.isGM) return ui.notifications?.warn("Die Spezialeffekte sind nur für den GM.");
    const app = foundry.applications.instances.get("hlw-effekte") ?? new HopeLiesWithinEffekte();
    app.render({ force: true }).then(() => app.bringToFront?.());
    return app;
  }

  async _renderHTML() {
    const karten = EFFEKTE.map((e) => `
      <section class="ef-karte" data-effekt="${e.id}">
        <header><i class="${e.icon}"></i><h3>${escapeHtml(e.name)}</h3></header>
        <p>${escapeHtml(e.text)}</p>
        ${e.optionen?.dauer ? `<label class="ef-zeile">Dauer <input type="range" data-dauer min="${e.optionen.dauer.min}" max="${e.optionen.dauer.max}" value="${e.optionen.dauer.standard}"><span data-dauer-wert>${e.optionen.dauer.standard} s</span></label>` : ""}
        ${e.optionen?.anzahl ? `<label class="ef-zeile">${e.optionen.anzahl.label} <input type="range" data-anzahl min="${e.optionen.anzahl.min}" max="${e.optionen.anzahl.max}" value="${e.optionen.anzahl.standard}"><span data-anzahl-wert>${e.optionen.anzahl.standard}</span></label>` : ""}
        ${e.optionen?.text ? `<label class="ef-zeile">Text <input type="text" data-text placeholder="${escapeHtml(e.optionen.text)}"></label>` : ""}
        <button type="button" data-abspielen="${e.id}"><i class="fa-solid fa-play"></i> Bei allen abspielen</button>
      </section>`).join("");
    return `<div class="ef-inhalt">
      <p class="ef-hinweis">Effekte laufen bei allen Spielern gleichzeitig über den Bildschirm. Weitere Effekte kommen nach und nach dazu.</p>
      ${karten}
      <button type="button" class="ef-stopp" data-stoppen><i class="fa-solid fa-stop"></i> Alle Effekte stoppen</button>
    </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    content.querySelectorAll("[data-dauer]").forEach((regler) => regler.addEventListener("input", () => {
      regler.closest(".ef-karte").querySelector("[data-dauer-wert]").textContent = `${regler.value} s`;
    }));
    content.querySelectorAll("[data-anzahl]").forEach((regler) => regler.addEventListener("input", () => {
      regler.closest(".ef-karte").querySelector("[data-anzahl-wert]").textContent = regler.value;
    }));
    content.querySelectorAll("[data-abspielen]").forEach((knopf) => knopf.addEventListener("click", () => {
      const karte = knopf.closest(".ef-karte");
      const dauer = Number(karte.querySelector("[data-dauer]")?.value) || undefined;
      const text = karte.querySelector("[data-text]")?.value.trim() ?? "";
      const anzahl = Number(karte.querySelector("[data-anzahl]")?.value) || undefined;
      effektSenden(knopf.dataset.abspielen, { dauer, text, anzahl });
    }));
    content.querySelector("[data-stoppen]")?.addEventListener("click", () => effekteStoppenAlle());
  }
}

export function registerEffekte() {
  Hooks.on("getSceneControlButtons", (controls) => {
    const figuren = controls.tokens ?? controls.token;
    if (!figuren?.tools || !game.user?.isGM) return;
    figuren.tools.hlwEffekte = {
      name: "hlwEffekte",
      order: Object.keys(figuren.tools).length + 1,
      title: "Spezialeffekte (GM)",
      icon: "fa-solid fa-burst",
      button: true,
      visible: true,
      onChange: () => HopeLiesWithinEffekte.oeffnen()
    };
  });
  Hooks.once("ready", () => game.socket.on(`system.${SYSTEM_ID}`, effektEmpfangen));
}
