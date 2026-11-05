// Karte von Gaia (Dominik 2026-11-05): ein Gegenstand, den der GM verteilt („Gegenstand geben“ oder aus der Item-Sidebar ziehen).
// Im Inventar „Karte ansehen“ öffnet ein Fenster mit der Weltkarte: Mausrad zoomt (zur Mausposition), Ziehen verschiebt,
// Stift malt in mehreren Farben, Radierer löscht ganze Striche, Rückgängig nimmt den letzten Schritt zurück.
// Jede Karte ist ein eigener Gegenstand: Was ein Spieler draufmalt, steht nur auf seiner Karte (der GM sieht alle).
// Gespeichert am Gegenstand: flags["hope-lies-within-2"].karte = "gaia", .striche = [{ f: Farbe, d: Breite, p: [x, y, x, y, …] }]
// (Koordinaten in Kartenpixeln, also unabhängig von Zoom und Fenstergröße).

const SYSTEM_ID = "hope-lies-within-2";
const ApplicationV2 = foundry.applications.api.ApplicationV2;

export const KARTEN = {
  gaia: { name: "Karte von Gaia", bild: `systems/${SYSTEM_ID}/assets/dashboard/weltkarte.webp`, img: "icons/tools/navigation/map-marked-brown.webp",
    text: "Kontinentalkarte von Gaia, Stand 792. Im Inventar „Karte ansehen“: zoomen, verschieben und eigene Notizen draufmalen." }
};
const FARBEN = ["#b3261e", "#1f4e9c", "#1d6b3a", "#1b1b1b", "#f2efe6", "#e0a100"];
const BREITEN = { fein: 3, mittel: 6, dick: 12 };   // Bildschirmpixel beim Malen; gespeichert wird die Breite auf der Karte

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function istKarte(item) {
  return !!KARTEN[item?.getFlag?.(SYSTEM_ID, "karte")];
}

function striche(item) {
  const s = item?.getFlag(SYSTEM_ID, "striche");
  return Array.isArray(s) ? s : [];
}

export class HopeLiesWithinKarte extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["hope-lies-within", "hlw-karte"],
    tag: "div",
    window: { icon: "fa-solid fa-map", resizable: true },
    position: { width: 760, height: 860 }
  };

  constructor(item) {
    super({ id: `hlw-karte-${item.parent?.id ?? "welt"}-${item.id}`, window: { title: item.name } });
    this.item = item;
    this.karte = KARTEN[item.getFlag(SYSTEM_ID, "karte")];
    this.werkzeug = item.isOwner ? "stift" : "hand";
    this.farbe = FARBEN[0];
    this.breite = "mittel";
    this.ansicht = null;          // { s, x, y } – Zoom und Verschiebung
    this.verlauf = [];            // frühere Stände für „Rückgängig“
    this.liste = striche(item).map((s) => ({ ...s, p: [...s.p] }));
  }

  static oeffnen(item) {
    const id = `hlw-karte-${item.parent?.id ?? "welt"}-${item.id}`;
    const app = foundry.applications.instances.get(id) ?? new HopeLiesWithinKarte(item);
    app.render({ force: true });
    return app;
  }

  async _renderHTML() {
    const malen = this.item.isOwner;
    const knopf = (wz, icon, titel) => `<button type="button" data-wz="${wz}" class="${this.werkzeug === wz ? "is-aktiv" : ""}" data-tooltip="${titel}" aria-label="${titel}"><i class="fa-solid ${icon}"></i></button>`;
    return `
      <div class="kt-leiste">
        ${knopf("hand", "fa-hand", "Verschieben (oder rechte Maustaste halten)")}
        ${malen ? `${knopf("stift", "fa-pen", "Malen")}${knopf("radierer", "fa-eraser", "Radieren (ganze Striche)")}
        <span class="kt-farben">${FARBEN.map((f) => `<button type="button" data-farbe="${f}" class="${this.farbe === f ? "is-aktiv" : ""}" style="--kt-farbe:${f}" aria-label="Farbe ${f}"></button>`).join("")}</span>
        <select data-breite aria-label="Strichstärke">${Object.keys(BREITEN).map((b) => `<option value="${b}" ${this.breite === b ? "selected" : ""}>${b}</option>`).join("")}</select>
        <button type="button" data-rueck data-tooltip="Rückgängig (Strg+Z)" aria-label="Rückgängig"><i class="fa-solid fa-rotate-left"></i></button>
        <button type="button" data-leeren data-tooltip="Alles wegradieren" aria-label="Alles wegradieren"><i class="fa-solid fa-trash"></i></button>` : ""}
        <span class="kt-platz"></span>
        <button type="button" data-zoom="-1" data-tooltip="Herauszoomen" aria-label="Herauszoomen"><i class="fa-solid fa-minus"></i></button>
        <button type="button" data-zoom="1" data-tooltip="Hineinzoomen" aria-label="Hineinzoomen"><i class="fa-solid fa-plus"></i></button>
        <button type="button" data-einpassen data-tooltip="Ganze Karte" aria-label="Ganze Karte"><i class="fa-solid fa-expand"></i></button>
      </div>
      <div class="kt-flaeche" tabindex="0">
        <div class="kt-inhalt">
          <img src="${escapeHtml(this.karte.bild)}" alt="${escapeHtml(this.karte.name)}" draggable="false">
          <canvas></canvas>
        </div>
      </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    this.flaeche = content.querySelector(".kt-flaeche");
    this.inhalt = content.querySelector(".kt-inhalt");
    this.leinwand = content.querySelector("canvas");
    const bild = content.querySelector("img");
    const bereit = () => {
      this.bw = bild.naturalWidth; this.bh = bild.naturalHeight;
      this.leinwand.width = this.bw; this.leinwand.height = this.bh;
      this.inhalt.style.width = `${this.bw}px`; this.inhalt.style.height = `${this.bh}px`;
      // Erst einpassen, wenn das Fenster wirklich auf dem Bildschirm steht (sonst ist die Fläche noch 0 × 0)
      if (!this.ansicht || this.eingepasst) this.einpassen(); else this.anwenden();
      this.zeichnen();
    };
    // Fenstergröße ändert sich: solange niemand gezoomt hat, bleibt die ganze Karte sichtbar
    this._beobachter?.disconnect();
    this._beobachter = new ResizeObserver(() => { if (this.bw && (!this.ansicht || this.eingepasst)) this.einpassen(); });
    this._beobachter.observe(this.flaeche);
    if (bild.complete && bild.naturalWidth) bereit(); else bild.addEventListener("load", bereit, { once: true });

    content.querySelectorAll("[data-wz]").forEach((b) => b.addEventListener("click", () => { this.werkzeug = b.dataset.wz; this.leisteAktualisieren(content); }));
    content.querySelectorAll("[data-farbe]").forEach((b) => b.addEventListener("click", () => { this.farbe = b.dataset.farbe; if (this.werkzeug !== "stift") this.werkzeug = "stift"; this.leisteAktualisieren(content); }));
    content.querySelector("[data-breite]")?.addEventListener("change", (e) => { this.breite = e.target.value; });
    content.querySelector("[data-rueck]")?.addEventListener("click", () => this.rueckgaengig());
    content.querySelector("[data-leeren]")?.addEventListener("click", () => this.leeren());
    content.querySelectorAll("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
      const r = this.flaeche.getBoundingClientRect();
      this.zoomen(Number(b.dataset.zoom) > 0 ? 1.4 : 1 / 1.4, r.width / 2, r.height / 2);
    }));
    content.querySelector("[data-einpassen]")?.addEventListener("click", () => this.einpassen());
    this.flaeche.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = this.flaeche.getBoundingClientRect();
      this.zoomen(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    this.flaeche.addEventListener("contextmenu", (e) => e.preventDefault());
    this.flaeche.addEventListener("pointerdown", (e) => this.druecken(e));
    this.flaeche.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.stopPropagation(); this.rueckgaengig(); }
    });
  }

  leisteAktualisieren(content) {
    content.querySelectorAll("[data-wz]").forEach((b) => b.classList.toggle("is-aktiv", b.dataset.wz === this.werkzeug));
    content.querySelectorAll("[data-farbe]").forEach((b) => b.classList.toggle("is-aktiv", b.dataset.farbe === this.farbe));
    this.flaeche.dataset.werkzeug = this.werkzeug;
  }

  // --- Ansicht ---
  einpassen() {
    const r = this.flaeche.getBoundingClientRect();
    if (!r.width || !r.height) { setTimeout(() => this.einpassen(), 50); return; }
    const s = Math.min(r.width / this.bw, r.height / this.bh);
    this.ansicht = { s, x: (r.width - this.bw * s) / 2, y: (r.height - this.bh * s) / 2 };
    this.eingepasst = true;
    this.anwenden();
  }

  zoomen(faktor, px, py) {
    const a = this.ansicht; if (!a) return;
    const r = this.flaeche.getBoundingClientRect();
    const min = Math.min(r.width / this.bw, r.height / this.bh) * 0.8, max = 4;
    const s = Math.min(max, Math.max(min, a.s * faktor));
    // Der Punkt unter der Maus bleibt stehen
    this.ansicht = { s, x: px - (px - a.x) * (s / a.s), y: py - (py - a.y) * (s / a.s) };
    this.eingepasst = false;
    this.anwenden();
  }

  anwenden() {
    const { s, x, y } = this.ansicht;
    this.inhalt.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    this.flaeche.dataset.werkzeug = this.werkzeug;
  }

  kartenPunkt(e) {
    const r = this.flaeche.getBoundingClientRect(), { s, x, y } = this.ansicht;
    return [Math.round((e.clientX - r.left - x) / s), Math.round((e.clientY - r.top - y) / s)];
  }

  // --- Malen, Radieren, Verschieben ---
  druecken(e) {
    if (!this.ansicht) return;
    this.flaeche.focus({ preventScroll: true });
    const verschieben = e.button === 2 || e.button === 1 || this.werkzeug === "hand";
    if (e.button !== 0 && !verschieben) return;
    e.preventDefault();
    this.flaeche.setPointerCapture(e.pointerId);
    let bewegen, loslassen;
    if (verschieben) {
      const start = { cx: e.clientX, cy: e.clientY, x: this.ansicht.x, y: this.ansicht.y };
      bewegen = (ev) => { this.ansicht.x = start.x + ev.clientX - start.cx; this.ansicht.y = start.y + ev.clientY - start.cy; this.eingepasst = false; this.anwenden(); };
      loslassen = () => {};
    }
    else if (this.werkzeug === "stift") {
      const strich = { f: this.farbe, d: Math.max(1, Math.round(BREITEN[this.breite] / this.ansicht.s)), p: this.kartenPunkt(e) };
      const vorher = this.liste.map((s) => ({ ...s, p: [...s.p] }));
      this.liste.push(strich);
      this.zeichnen();
      bewegen = (ev) => {
        const [x, y] = this.kartenPunkt(ev), n = strich.p.length;
        if (Math.hypot(x - strich.p[n - 2], y - strich.p[n - 1]) < Math.max(2, strich.d / 3)) return;
        strich.p.push(x, y);
        this.strichZeichnen(strich, n - 2);
      };
      loslassen = () => { this.verlauf.push(vorher); this.speichern(); };
    }
    else {
      const vorher = this.liste.map((s) => ({ ...s, p: [...s.p] }));
      let geaendert = false;
      const radieren = (ev) => {
        const [x, y] = this.kartenPunkt(ev), r = 10 / this.ansicht.s;
        const rest = this.liste.filter((s) => !s.p.some((v, i) => i % 2 === 0 && Math.hypot(v - x, s.p[i + 1] - y) < r + s.d / 2));
        if (rest.length !== this.liste.length) { this.liste = rest; geaendert = true; this.zeichnen(); }
      };
      radieren(e);
      bewegen = radieren;
      loslassen = () => { if (geaendert) { this.verlauf.push(vorher); this.speichern(); } };
    }
    this.malt = true;
    const ende = (ev) => {
      this.flaeche.removeEventListener("pointermove", bewegen);
      this.flaeche.removeEventListener("pointerup", ende);
      this.flaeche.removeEventListener("pointercancel", ende);
      this.malt = false;
      loslassen(ev);
    };
    this.flaeche.addEventListener("pointermove", bewegen);
    this.flaeche.addEventListener("pointerup", ende);
    this.flaeche.addEventListener("pointercancel", ende);
  }

  zeichnen() {
    const ctx = this.leinwand?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, this.leinwand.width, this.leinwand.height);
    for (const s of this.liste) this.strichZeichnen(s, 0);
  }

  strichZeichnen(s, ab) {
    const ctx = this.leinwand.getContext("2d");
    ctx.strokeStyle = s.f; ctx.fillStyle = s.f; ctx.lineWidth = s.d; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (s.p.length === 2) { ctx.beginPath(); ctx.arc(s.p[0], s.p[1], s.d / 2, 0, Math.PI * 2); ctx.fill(); return; }
    ctx.beginPath();
    ctx.moveTo(s.p[ab], s.p[ab + 1]);
    for (let i = ab + 2; i < s.p.length; i += 2) ctx.lineTo(s.p[i], s.p[i + 1]);
    ctx.stroke();
  }

  async speichern() {
    if (this.verlauf.length > 40) this.verlauf.shift();
    this.eigenesUpdate = true;
    await this.item.setFlag(SYSTEM_ID, "striche", this.liste);
  }

  async rueckgaengig() {
    if (!this.item.isOwner || !this.verlauf.length) return;
    this.liste = this.verlauf.pop();
    this.zeichnen();
    this.eigenesUpdate = true;
    await this.item.setFlag(SYSTEM_ID, "striche", this.liste);
  }

  async leeren() {
    if (!this.liste.length) return;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Karte leeren" }, content: "<p>Alles, was auf dieser Karte gemalt ist, wegradieren? (Rückgängig geht danach noch.)</p>", rejectClose: false });
    if (!ok) return;
    this.verlauf.push(this.liste);
    this.liste = [];
    this.zeichnen();
    await this.speichern();
  }

  // Jemand anderes (z. B. der GM am selben Gegenstand) hat gemalt: neu zeichnen, Zoom bleibt
  _onClose(options) {
    this._beobachter?.disconnect();
    super._onClose?.(options);
  }

  vonAussen() {
    if (this.eigenesUpdate) { this.eigenesUpdate = false; return; }
    if (this.malt) return;
    this.liste = striche(this.item).map((s) => ({ ...s, p: [...s.p] }));
    this.zeichnen();
  }
}

export function karteOeffnen(item) {
  if (!istKarte(item)) return null;
  return HopeLiesWithinKarte.oeffnen(item);
}

// GM (beim Start): die Karte als Gegenstand in der Welt anlegen, damit sie in „Gegenstand geben“ und in der Item-Sidebar steht
export async function kartenAnlegen() {
  if (!game.user?.isGM) return;
  for (const [id, k] of Object.entries(KARTEN)) {
    if (game.items.some((i) => i.getFlag(SYSTEM_ID, "karte") === id)) continue;
    await Item.create({ name: k.name, type: "junk", img: k.img, system: { description: k.text, priceSk: 0, quantity: 1 }, flags: { [SYSTEM_ID]: { karte: id, striche: [] } } });
  }
}

export function registerKarte() {
  Hooks.on("updateItem", (item, changes) => {
    if (!foundry.utils.hasProperty(changes, `flags.${SYSTEM_ID}.striche`)) return;
    const app = foundry.applications.instances.get(`hlw-karte-${item.parent?.id ?? "welt"}-${item.id}`);
    app?.vonAussen();
  });
}
