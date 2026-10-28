// NSC-Gespraech: rahmenloses Fenster ueber der Karte.
// Links das Portraet, rechts was die Gruppe ueber den NSC weiss und eigene Notizen pro Spieler.
// Daten am Actor: flags["hope-lies-within-2"].talk = { portrait, role, facts: [{ id, text, revealed, highlight }] }
// Notizen am User:  flags["hope-lies-within-2"].talkNotes[actorId] = "..."
// Namen am User:    flags["hope-lies-within-2"].talkNames[actorId] = "..." (bis der GM den echten Namen freigibt, steht dort „???“)

const SYSTEM_ID = "hope-lies-within-2";
const SOCKET = `system.${SYSTEM_ID}`;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function getTalkData(actor) {
  const talk = actor?.getFlag(SYSTEM_ID, "talk") ?? {};
  return {
    portrait: talk.portrait || actor?.img || "icons/svg/mystery-man.svg",
    role: talk.role ?? "",
    nameRevealed: !!talk.nameRevealed,
    facts: Array.isArray(talk.facts) ? talk.facts : []
  };
}

export function hasTalk(actor) {
  return actor?.type === "npc" && !!actor.getFlag(SYSTEM_ID, "talk");
}

function getNotes(actorId) {
  return game.user?.getFlag(SYSTEM_ID, `talkNotes.${actorId}`) ?? "";
}

function getOwnName(actorId) {
  return game.user?.getFlag(SYSTEM_ID, `talkNames.${actorId}`) ?? "";
}

const ApplicationV2 = foundry.applications.api.ApplicationV2;

export class HopeLiesWithinTalkApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["hope-lies-within", "hlw-talk"],
    tag: "div",
    window: { frame: false, positioned: false }
  };

  constructor(actor, options = {}) {
    super({ ...options, id: `hlw-talk-${actor.id}` });
    this.actor = actor;
    this._notesTimer = null;
  }

  static openFor(actor) {
    if (!actor) return null;
    const existing = foundry.applications.instances.get(`hlw-talk-${actor.id}`);
    if (existing) {
      existing.render({ force: true });
      return existing;
    }
    const app = new HopeLiesWithinTalkApp(actor);
    app.render({ force: true });
    return app;
  }

  static closeFor(actorId) {
    foundry.applications.instances.get(`hlw-talk-${actorId}`)?.close();
  }

  async _renderHTML() {
    const isGM = game.user?.isGM;
    const talk = getTalkData(this.actor);
    const facts = isGM ? talk.facts : talk.facts.filter((fact) => fact.revealed);

    const factList = facts.length
      ? facts.map((fact) => isGM ? this._gmFactRow(fact) : `
          <li class="${fact.highlight ? "hlw-talk-new" : ""}">${fact.highlight ? "<b>Neu:</b> " : ""}${escapeHtml(fact.text)}</li>`).join("")
      : `<li class="hlw-talk-empty">${isGM ? "Noch keine Einträge." : "Ihr wisst noch nichts über diese Person."}</li>`;

    const gmTools = isGM ? `
      <div class="hlw-talk-gm">
        <input type="text" name="newFact" placeholder="Neuer Eintrag (erst sichtbar, wenn du ihn freigibst)">
        <button type="button" data-hlw="add">Hinzufügen</button>
      </div>
      <div class="hlw-talk-gm">
        <input type="text" name="role" value="${escapeHtml(talk.role)}" placeholder="Rolle (z. B. Wirtin)">
        <button type="button" data-hlw="portrait">Porträt wählen</button>
        <button type="button" data-hlw="show">Allen zeigen</button>
        <button type="button" data-hlw="hide">Bei allen schließen</button>
      </div>` : "";

    return `
      <div class="hlw-talk-backdrop" data-hlw="close"></div>
      <img class="hlw-talk-portrait" src="${escapeHtml(talk.portrait)}" alt="${escapeHtml(this.actor.name)}">
      <section class="hlw-talk-panel">
        ${this._nameHtml(isGM, talk)}
        <div class="hlw-talk-role">${escapeHtml(talk.role)}</div>
        <h2>${isGM ? "Einträge (Haken = für Spieler sichtbar)" : "Was ihr wisst"}</h2>
        <ul class="hlw-talk-facts">${factList}</ul>
        ${gmTools}
        <h2>Deine Notizen</h2>
        <textarea name="notes" placeholder="Nur du siehst diese Notizen …">${escapeHtml(getNotes(this.actor.id))}</textarea>
        <div class="hlw-talk-hint">Klick neben das Fenster oder Esc, um es zu schließen.</div>
      </section>`;
  }

  _nameHtml(isGM, talk) {
    if (isGM) {
      return `<h1>${escapeHtml(this.actor.name)}</h1>
        <label class="hlw-talk-namecheck"><input type="checkbox" data-hlw="nameRevealed" ${talk.nameRevealed ? "checked" : ""}> Name für Spieler freigegeben</label>`;
    }
    if (talk.nameRevealed) return `<h1>${escapeHtml(this.actor.name)}</h1>`;
    return `<input class="hlw-talk-name" type="text" name="ownName" value="${escapeHtml(getOwnName(this.actor.id))}" placeholder="???" title="Wie heißt diese Person? Trag ein, was du weißt.">`;
  }

  _gmFactRow(fact) {
    return `
      <li class="hlw-talk-gmfact" data-fact="${escapeHtml(fact.id)}">
        <label><input type="checkbox" data-hlw="reveal" ${fact.revealed ? "checked" : ""}> sichtbar</label>
        <label><input type="checkbox" data-hlw="highlight" ${fact.highlight ? "checked" : ""}> neu</label>
        <span>${escapeHtml(fact.text)}</span>
        <button type="button" data-hlw="delete" title="Löschen">×</button>
      </li>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    this._bindEvents(content);
  }

  _bindEvents(root) {
    root.querySelector("[data-hlw='close']")?.addEventListener("click", () => this.close());
    root.querySelector("textarea[name='notes']")?.addEventListener("input", (event) => {
      clearTimeout(this._notesTimer);
      const text = event.currentTarget.value;
      this._notesTimer = setTimeout(() => game.user.setFlag(SYSTEM_ID, `talkNotes.${this.actor.id}`, text), 600);
    });
    // Esc in der Capture-Phase abfangen, bevor Foundrys Tastatursteuerung es verarbeitet.
    root.querySelector("input[name='ownName']")?.addEventListener("change", (event) => {
      game.user.setFlag(SYSTEM_ID, `talkNames.${this.actor.id}`, event.currentTarget.value.trim());
    });
    this._keyHandler ??= (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      this.close();
    };
    window.addEventListener("keydown", this._keyHandler, true);

    if (!game.user?.isGM) return;
    root.querySelectorAll("[data-hlw='reveal'], [data-hlw='highlight'], [data-hlw='delete']").forEach((element) => {
      element.addEventListener(element.tagName === "BUTTON" ? "click" : "change", (event) => this._onFactChange(event));
    });
    root.querySelector("[data-hlw='add']")?.addEventListener("click", () => this._addFact(root));
    root.querySelector("[data-hlw='nameRevealed']")?.addEventListener("change", (event) => this._updateTalk({ nameRevealed: event.currentTarget.checked }));
    root.querySelector("input[name='newFact']")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this._addFact(root);
    });
    root.querySelector("input[name='role']")?.addEventListener("change", (event) => this._updateTalk({ role: event.currentTarget.value }));
    root.querySelector("[data-hlw='portrait']")?.addEventListener("click", () => this._pickPortrait());
    root.querySelector("[data-hlw='show']")?.addEventListener("click", () => {
      game.socket.emit(SOCKET, { type: "talkOpen", actorId: this.actor.id });
      ui.notifications?.info(`Gespräch mit ${this.actor.name} wird allen gezeigt.`);
    });
    root.querySelector("[data-hlw='hide']")?.addEventListener("click", () => game.socket.emit(SOCKET, { type: "talkClose", actorId: this.actor.id }));
  }

  async _updateTalk(changes) {
    const talk = getTalkData(this.actor);
    await this.actor.setFlag(SYSTEM_ID, "talk", { ...this.actor.getFlag(SYSTEM_ID, "talk"), portrait: talk.portrait, role: talk.role, nameRevealed: talk.nameRevealed, facts: talk.facts, ...changes });
  }

  async _onFactChange(event) {
    const id = event.currentTarget.closest("[data-fact]")?.dataset.fact;
    const action = event.currentTarget.dataset.hlw;
    let facts = foundry.utils.deepClone(getTalkData(this.actor).facts);
    if (action === "delete") facts = facts.filter((fact) => fact.id !== id);
    else facts = facts.map((fact) => fact.id === id ? { ...fact, [action === "reveal" ? "revealed" : "highlight"]: event.currentTarget.checked } : fact);
    await this._updateTalk({ facts });
  }

  async _addFact(root) {
    const input = root.querySelector("input[name='newFact']");
    const text = input?.value?.trim();
    if (!text) return;
    const facts = [...getTalkData(this.actor).facts, { id: foundry.utils.randomID(), text, revealed: false, highlight: false }];
    await this._updateTalk({ facts });
  }

  _pickPortrait() {
    const Picker = foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    new Picker({
      type: "image",
      current: getTalkData(this.actor).portrait,
      callback: (path) => this._updateTalk({ portrait: path })
    }).render(true);
  }

  async _onClose(options) {
    if (this._keyHandler) window.removeEventListener("keydown", this._keyHandler, true);
    clearTimeout(this._notesTimer);
    const text = this.element?.querySelector("textarea[name='notes']")?.value;
    if (text !== undefined && text !== getNotes(this.actor.id)) await game.user.setFlag(SYSTEM_ID, `talkNotes.${this.actor.id}`, text);
    const ownName = this.element?.querySelector("input[name='ownName']")?.value?.trim();
    if (ownName !== undefined && ownName !== getOwnName(this.actor.id)) await game.user.setFlag(SYSTEM_ID, `talkNames.${this.actor.id}`, ownName);
    return super._onClose?.(options);
  }
}

export function registerTalk() {
  game.socket.on(SOCKET, (data) => {
    if (data?.type === "talkOpen" && !game.user?.isGM) HopeLiesWithinTalkApp.openFor(game.actors.get(data.actorId));
    if (data?.type === "talkClose") HopeLiesWithinTalkApp.closeFor(data.actorId);
  });

  // Doppelklick eines Spielers auf eine NSC-Figur oeffnet das Gespraech statt des Bogens.
  const TokenClass = CONFIG.Token.objectClass;
  const originalDoubleClick = TokenClass.prototype._onClickLeft2;
  TokenClass.prototype._onClickLeft2 = function (event) {
    if (!game.user?.isGM && hasTalk(this.actor)) return HopeLiesWithinTalkApp.openFor(this.actor);
    return originalDoubleClick.call(this, event);
  };

  // Offene Gespraeche aktualisieren, wenn der GM etwas freigibt.
  Hooks.on("updateActor", (actor, changes) => {
    if (!foundry.utils.hasProperty(changes, `flags.${SYSTEM_ID}.talk`)) return;
    foundry.applications.instances.get(`hlw-talk-${actor.id}`)?.render();
  });
}

// GM: Knopf im Token-HUD von NSC-Figuren.
Hooks.on("renderTokenHUD", (hud, html) => {
  if (!game.user?.isGM) return;
  const actor = hud.object?.actor;
  if (actor?.type !== "npc") return;
  const root = html?.[0] ?? html;
  const column = root?.querySelector?.(".col.left") ?? root;
  if (!column || column.querySelector("[data-hlw-talk]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "control-icon";
  button.dataset.hlwTalk = "true";
  button.title = "Gespräch öffnen";
  button.innerHTML = '<i class="fa-solid fa-comments"></i>';
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    if (!actor.getFlag(SYSTEM_ID, "talk")) await actor.setFlag(SYSTEM_ID, "talk", { portrait: actor.img, role: "", facts: [] });
    HopeLiesWithinTalkApp.openFor(actor);
  });
  column.appendChild(button);
});
