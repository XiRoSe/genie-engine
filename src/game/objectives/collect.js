// "Recover the lost arcs" objective + the ARCFALL storyline: the rogue AI THE VAULT shattered reality
// into 12 Arcs across a guardian island; recover them all (fighting its legion + the beasts) to seal the
// breach. Implements the objective interface: brief(), onPlayStart(), update().
export class CollectObjective {
  constructor(game) {
    this.game = game;
    this.total = game.cfg.objective.count || 12; // arcs are placed during level build (after this runs)
    this.collected = 0;
    const o = game.cfg.objective || {};
    this.noun = o.noun || "Arc";                 // "Arc" (ARCFALL) or "Ring" (Meeseeks Mayhem)
    this.nounU = this.noun.toUpperCase();
    this.icon = o.icon || "✦";
    this.startLabel = o.startLabel || `RECOVER THE ${this.total} ${this.nounU}S`; // big start banner
    this.startSub = o.startSub || "to repair time";
    // story beats fired as Arcs are recovered — each names a tribe whose territory holds the next Arcs
    this.beats = {
      1: "ARC SECURED — THE TIMELINE FLICKERS",
      3: "NW · THE SAURIAN BROOD WAKES IN THE RUINS",
      5: "NE · THE IRON LEGION MOBILIZES",
      7: "SE · THE HOLLOW WATCH LOCKS ONTO YOU",
      9: "S · THE VAULT GARRISON RINGS THE PALACE",
      11: "ONE ARC LEFT — TIME BEGINS TO MEND",
    };
  }

  brief() {
    return `An unexpected <b>anomaly</b> has broken <b>time</b> itself. The 12 <b>Arcs</b> that anchor the timeline ` +
      `are scattered across this fractured island — guarded by the beasts, machines and soldiers stranded here from every age: ` +
      `the <b>Saurian Brood</b> (NW), the <b>Iron Legion</b> (NE), the <b>Hollow Watch</b> (SE) and the <b>Vault Garrison</b> at the palace. ` +
      `Recover all ${this.total} Arcs to repair time and return to your own.`;
  }

  onPlayStart() {
    this.game.hud.setObjective(`Collect the ${this.total} <span class="arrow">${this.nounU}S ${this.icon}</span>`);
    this.game.hud.setCounter(this.noun + "s", `${this.collected} / ${this.total}`);
    // prominent STARTING label (center banner) — e.g. "COLLECT THE 12 WHITE RINGS · to save time"
    this.game.hud.showBanner(this.startLabel, this.startSub, 4600);
    this.game.hud.notify(`${this.startLabel} ${this.icon}`);
  }

  update(dt, t, presses) {
    const g = this.game, pp = g.driving ? g.driving.pos : g.camera.position; // works on foot or while driving
    // region-entry callout: name the tribe's territory + how many Arcs remain there
    const q = pp.x < 0 ? (pp.z >= 0 ? "NW" : "SW") : (pp.z >= 0 ? "NE" : "SE");
    if (q !== this._region) {
      this._region = q;
      const names = { NW: "NORTH RUINS · SAURIAN BROOD", NE: "EAST HIGHLANDS · IRON LEGION", SE: "SOUTH FLATS · HOLLOW WATCH", SW: "PALACE APPROACH · VAULT GARRISON" };
      const left = g.level.arcs.filter((a) => !a.taken && (a.x < 0 ? (a.z >= 0 ? "NW" : "SW") : (a.z >= 0 ? "NE" : "SE")) === q).length;
      g.hud.showBanner(names[q], `${left} ${this.nounU}${left === 1 ? "" : "S"} HERE`);
    }
    for (const a of g.level.arcs) {
      if (a.taken) continue;
      const dx = pp.x - a.x, dz = pp.z - a.z;
      if (dx * dx + dz * dz < a.r * a.r) {
        a.taken = true; a.group.visible = false;
        this.collected++;
        g.audio.arcFanfare?.(); // a big triumphant victory fanfare (no coin blip)
        g.hud.showBanner(`${this.icon} ${this.nounU} RECOVERED`, `${this.collected} / ${this.total} ${this.nounU}S COLLECTED`); // center XIII-style
        g.hud.setCounter(this.noun + "s", `${this.collected} / ${this.total}`);
        if (this.beats[this.collected]) g.hud.notify(this.beats[this.collected]);
        if (this.collected >= this.total) {
          g._win({ cinematic: true, title: 'Timeline <span class="hz">Restored</span>', sub: `All ${this.total} ${this.noun}s recovered — time mends and you return to your own` });
          return;
        }
      }
    }
  }
}
