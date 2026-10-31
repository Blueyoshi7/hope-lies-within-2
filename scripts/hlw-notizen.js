// Gruppennotizen (Dominik 2026-10-31): ein gemeinsamer Notizbereich für alle Spieler und den GM.
// Jeder kann Notizen schreiben, ändern und löschen; alle sehen Änderungen sofort.
// Gespeichert am Journal „Gruppennotizen“ (alle sind Besitzer), jede Notiz unter eigenem Schlüssel:
// flags["hope-lies-within-2"].notizen[id] = { text, autor, zeit, geaendertVon, geaendert }.
// Eigene Schlüssel statt einer Liste: Schreiben zwei Spieler gleichzeitig, geht nichts verloren.
// Öffnen: Notizblock in der linken Werkzeugleiste (Figuren), Makro-Platz 3 oder game.hlw.notizen().

const SYSTEM_ID = "hope-lies-within-2";
const ApplicationV2 = foundry.applications.api.ApplicationV2;

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function zeitText(ms) {
  if (!ms) return "";
  return new Date(ms).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function notizJournal() {
  return game.journal.find((j) => j.getFlag(SYSTEM_ID, "gruppennotizen")) ?? null;
}

// GM (beim Start): Journal anlegen, falls es fehlt; alle Spieler dürfen hineinschreiben
export async function notizJournalAnlegen() {
  if (!game.user?.isGM) return;
  const vorhanden = notizJournal();
  if (vorhanden) {
    if (vorhanden.ownership.default !== CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) await vorhanden.update({ "ownership.default": CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER });
    return;
  }
  await JournalEntry.create({
    name: "Gruppennotizen",
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
    pages: [{ name: "Hinweis", type: "text", text: { content: "<p>Die Notizen der Gruppe stehen im Fenster „Gruppennotizen“ (Makro-Platz 3 oder Notizblock in der Werkzeugleiste).</p>" } }],
    flags: { [SYSTEM_ID]: { gruppennotizen: true, notizen: {} } }
  });
}

function notizen() {
  const daten = notizJournal()?.getFlag(SYSTEM_ID, "notizen") ?? {};
  return Object.entries(daten).filter(([, n]) => n?.text).map(([id, n]) => ({ id, ...n })).sort((a, b) => (b.zeit ?? 0) - (a.zeit ?? 0));
}

export class HopeLiesWithinNotizen extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "hlw-notizen",
    classes: ["hope-lies-within", "hlw-notizen"],
    tag: "div",
    window: { title: "Gruppennotizen", icon: "fa-solid fa-note-sticky", resizable: true },
    position: { width: 520, height: 640 }
  };

  // Was gerade getippt wird, bleibt erhalten, wenn jemand anderes eine Notiz speichert
  entwurf = "";
  bearbeiten = null;   // { id, text }

  static oeffnen() {
    const app = foundry.applications.instances.get("hlw-notizen") ?? new HopeLiesWithinNotizen();
    app.render({ force: true });
    return app;
  }

  async _renderHTML() {
    const journal = notizJournal();
    if (!journal) return `<p class="nz-leer">Die Gruppennotizen werden beim nächsten Start des GM angelegt.</p>`;
    const liste = notizen().map((n) => {
      const amBearbeiten = this.bearbeiten?.id === n.id;
      const fuss = `${escapeHtml(n.autor ?? "")} · ${zeitText(n.zeit)}${n.geaendert ? ` · geändert von ${escapeHtml(n.geaendertVon ?? "")} ${zeitText(n.geaendert)}` : ""}`;
      return `
        <article class="nz-notiz" data-nz-id="${escapeHtml(n.id)}">
          ${amBearbeiten
            ? `<textarea data-nz-bearbeiten rows="4">${escapeHtml(this.bearbeiten.text)}</textarea>
               <div class="nz-knoepfe"><button type="button" data-nz-speichern><i class="fa-solid fa-check"></i> Speichern</button><button type="button" data-nz-abbrechen>Abbrechen</button></div>`
            : `<p>${escapeHtml(n.text).replaceAll("\n", "<br>")}</p>`}
          <footer><small>${fuss}</small>
            ${amBearbeiten ? "" : `<span><button type="button" data-nz-aendern title="Ändern"><i class="fa-solid fa-pen"></i></button><button type="button" data-nz-loeschen title="Löschen"><i class="fa-solid fa-trash"></i></button></span>`}
          </footer>
        </article>`;
    }).join("");
    return `
      <div class="nz-neu">
        <textarea data-nz-neu rows="3" placeholder="Neue Notiz für alle … (Strg+Enter speichert)">${escapeHtml(this.entwurf)}</textarea>
        <button type="button" data-nz-hinzu><i class="fa-solid fa-plus"></i> Eintragen</button>
      </div>
      <div class="nz-liste">${liste || `<p class="nz-leer">Noch keine Notizen. Hier kann jeder mitschreiben.</p>`}</div>`;
  }

  async neueNotiz() {
    const text = this.entwurf.trim();
    const journal = notizJournal();
    if (!text || !journal) return;
    this.entwurf = "";
    await journal.update({ [`flags.${SYSTEM_ID}.notizen.${foundry.utils.randomID()}`]: { text, autor: game.user.name, zeit: Date.now() } });
  }

  async speichern() {
    const journal = notizJournal();
    if (!journal || !this.bearbeiten) return;
    const { id, text } = this.bearbeiten;
    this.bearbeiten = null;
    if (!text.trim()) return this.render();
    await journal.update({ [`flags.${SYSTEM_ID}.notizen.${id}`]: { text: text.trim(), geaendertVon: game.user.name, geaendert: Date.now() } });
  }

  async loeschen(id) {
    const journal = notizJournal();
    const notiz = notizen().find((n) => n.id === id);
    if (!journal || !notiz) return;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Notiz löschen" }, content: `<p>Diese Notiz für alle löschen?</p><blockquote>${escapeHtml(notiz.text.slice(0, 200))}</blockquote>`, rejectClose: false });
    if (ok) await journal.update({ [`flags.${SYSTEM_ID}.notizen.-=${id}`]: null });
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    const neu = content.querySelector("[data-nz-neu]");
    neu?.addEventListener("input", () => { this.entwurf = neu.value; });
    neu?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); this.neueNotiz(); }
    });
    content.querySelector("[data-nz-hinzu]")?.addEventListener("click", () => this.neueNotiz());
    const feld = content.querySelector("[data-nz-bearbeiten]");
    if (feld) {
      feld.addEventListener("input", () => { this.bearbeiten.text = feld.value; });
      feld.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); this.speichern(); }
        if (event.key === "Escape") { event.stopPropagation(); this.bearbeiten = null; this.render(); }
      });
      if (!this._fokusGesetzt) { feld.focus(); feld.setSelectionRange(feld.value.length, feld.value.length); this._fokusGesetzt = true; }
    }
    content.querySelector("[data-nz-speichern]")?.addEventListener("click", () => this.speichern());
    content.querySelector("[data-nz-abbrechen]")?.addEventListener("click", () => { this.bearbeiten = null; this.render(); });
    content.querySelectorAll("[data-nz-aendern]").forEach((knopf) => knopf.addEventListener("click", () => {
      const id = knopf.closest("[data-nz-id]").dataset.nzId;
      this.bearbeiten = { id, text: notizen().find((n) => n.id === id)?.text ?? "" };
      this._fokusGesetzt = false;
      this.render();
    }));
    content.querySelectorAll("[data-nz-loeschen]").forEach((knopf) => knopf.addEventListener("click", () => this.loeschen(knopf.closest("[data-nz-id]").dataset.nzId)));
  }
}

export function registerNotizen() {
  Hooks.on("getSceneControlButtons", (controls) => {
    const figuren = controls.tokens ?? controls.token;
    if (!figuren?.tools) return;
    figuren.tools.hlwNotizen = {
      name: "hlwNotizen",
      order: Object.keys(figuren.tools).length + 1,
      title: "Gruppennotizen",
      icon: "fa-solid fa-note-sticky",
      button: true,
      visible: true,
      onChange: () => HopeLiesWithinNotizen.oeffnen()
    };
  });
  // Neu zeichnen, wenn jemand eine Notiz schreibt, ändert oder löscht. Das Eingabefeld behält dabei seinen Text.
  const neuZeichnen = (journal) => {
    if (!journal.getFlag(SYSTEM_ID, "gruppennotizen")) return;
    const app = foundry.applications.instances.get("hlw-notizen");
    if (!app?.rendered) return;
    const aktiv = document.activeElement;
    const welches = ["[data-nz-neu]", "[data-nz-bearbeiten]"].find((sel) => aktiv?.matches?.(sel) && app.element.contains(aktiv));
    const pos = welches ? aktiv.selectionStart : null;
    app.render().then(() => {
      if (!welches) return;
      const feld = app.element.querySelector(welches);
      feld?.focus();
      feld?.setSelectionRange(pos, pos);
    });
  };
  Hooks.on("updateJournalEntry", neuZeichnen);
  Hooks.on("createJournalEntry", neuZeichnen);
}
