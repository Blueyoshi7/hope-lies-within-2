// GM-Fenster „Skill geben“ / „Gegenstand geben“: Suchliste aller Skills bzw. Gegenstaende der Welt.
// Ein Klick legt eine Kopie beim Charakter an. Skill-Slots nach dem Punktesystem werden geprueft.

const SKILL_TYPES = ["playerSkill", "classSkill"];
const GEAR_TYPES = ["weapon", "armor", "accessory", "equipment", "consumable", "foodDrink", "material", "natural", "mineral", "junk"];
const TYPE_LABELS = {
  playerSkill: "Skill", classSkill: "Klassen-Skill", weapon: "Waffe", armor: "Rüstung", accessory: "Accessoire", equipment: "Ausrüstung",
  consumable: "Verbrauch", foodDrink: "Essen & Trinken", material: "Material", natural: "Pflanze", mineral: "Mineral", junk: "Müll"
};

// Skill-Slots nach Level (Punktesystem): Level 1: 3 · 4: 4 · 8: 5 · 13: 6 · 18: 7 · 23: 8 · 30: 9 · 37: 10. Klassen-Skills brauchen keinen Slot.
const SKILL_SLOTS = [[37, 10], [30, 9], [23, 8], [18, 7], [13, 6], [8, 5], [4, 4], [1, 3]];

export function skillSlots(actor) {
  const level = Math.max(Number(actor.system?.progression?.level) || 1, 1);
  const max = SKILL_SLOTS.find(([ab]) => level >= ab)?.[1] ?? 3;
  const used = actor.items.filter((item) => item.type === "playerSkill" && (item.system?.learned === true || item.system?.learned === "true")).length;
  return { used, max };
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const ApplicationV2 = foundry.applications.api.ApplicationV2;

export class HopeLiesWithinGebenApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["hope-lies-within", "hlw-geben"],
    tag: "div",
    window: { resizable: true },
    position: { width: 560, height: 680 }
  };

  constructor(actor, mode = "skills") {
    super({ id: `hlw-geben-${actor.id}-${mode}`, window: { title: `${mode === "skills" ? "Skill geben" : "Gegenstand geben"}: ${actor.name}` } });
    this.actor = actor;
    this.mode = mode;
  }

  get types() {
    return this.mode === "skills" ? SKILL_TYPES : GEAR_TYPES;
  }

  async _renderHTML() {
    const items = (game.items?.contents ?? [])
      .filter((item) => this.types.includes(item.type))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
    const slots = this.mode === "skills" ? skillSlots(this.actor) : null;
    const rows = items.map((item) => {
      const sys = item.system ?? {};
      const zusatz = item.type === "classSkill" ? sys.className : sys.skillType || sys.slot || "";
      const suchtext = `${item.name} ${TYPE_LABELS[item.type]} ${zusatz} ${sys.rank ?? ""}`.toLowerCase();
      return `<li data-item-id="${item.id}" data-suche="${escapeHtml(suchtext)}">
        <img src="${escapeHtml(item.img)}" alt="">
        <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(TYPE_LABELS[item.type] ?? item.type)}${zusatz ? ` · ${escapeHtml(zusatz)}` : ""}${sys.rank ? ` · Rang ${escapeHtml(sys.rank)}` : ""}</small></span>
        <button type="button" data-geben>Geben</button>
      </li>`;
    }).join("");
    return `
      <div class="hlw-geben-kopf">
        <input type="search" name="suche" placeholder="Suchen (Name, Art, Klasse, Rang) …" autofocus>
        ${slots ? `<span class="hlw-geben-slots">Skill-Slots ${slots.used} / ${slots.max}</span>
        <label class="hlw-geben-orb"><input type="checkbox" name="orb" checked> als Skill-Orb (Spieler lernt ihn selbst)</label>` : ""}
      </div>
      <p class="hlw-geben-hinweis">Tipp: Du kannst Einträge auch aus der Item-Sidebar auf den Charakterbogen ziehen.</p>
      <ol class="hlw-geben-liste">${rows || "<li>Keine Einträge in der Welt. Erst „HLW JSON Import“ ausführen.</li>"}</ol>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    const suche = content.querySelector("input[name='suche']");
    suche?.addEventListener("input", () => {
      const begriffe = suche.value.toLowerCase().split(/\s+/).filter(Boolean);
      for (const li of content.querySelectorAll("li[data-suche]")) {
        li.hidden = !begriffe.every((b) => li.dataset.suche.includes(b));
      }
    });
    content.querySelectorAll("[data-geben]").forEach((button) => {
      button.addEventListener("click", (event) => this._geben(event.currentTarget.closest("[data-item-id]")?.dataset.itemId));
    });
    suche?.focus();
  }

  async _geben(itemId) {
    const item = game.items.get(itemId);
    if (!item) return;
    if (item.type === "classSkill" && this.actor.items.some((owned) => owned.name === item.name && owned.type === item.type)) {
      return ui.notifications?.warn(`${this.actor.name} hat ${item.name} schon.`);
    }
    const alsOrb = item.type === "playerSkill" && this.element?.querySelector?.("input[name='orb']")?.checked !== false;
    if (item.type === "playerSkill" && !alsOrb) {
      const slots = skillSlots(this.actor);
      if (slots.used >= slots.max) {
        return ui.notifications?.warn(`Skill-Slots voll (${slots.used} / ${slots.max}). Erst einen Skill entfernen, Level steigern oder als Skill-Orb geben.`);
      }
    }
    const data = item.toObject();
    delete data._id;
    delete data.folder;
    if (item.type === "playerSkill") {
      foundry.utils.setProperty(data, "system.learned", !alsOrb);
      foundry.utils.setProperty(data, "system.appraisal", { stufe: 0, versucht: false });
      foundry.utils.setProperty(data, "system.mastery.value", 0);
    }
    await this.actor.createEmbeddedDocuments("Item", [data]);
    ui.notifications?.info(`${item.name}${item.type === "playerSkill" && alsOrb ? " (als Skill-Orb)" : ""} an ${this.actor.name} gegeben.`);
    if (this.mode === "skills") this.render();
  }
}
