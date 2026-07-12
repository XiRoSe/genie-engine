// "Destroy the boss" objective — win when the single BOSS enemy (enemy.boss === true) is dead. Used by the
// Collective arena (Rick vs THE COLLECTIVE). Shows a live boss-HP readout; the drones don't count toward the win.
export class SlayObjective {
  constructor(game) {
    this.game = game;
    const o = game.cfg.objective || {};
    this.noun = o.noun || "THE COLLECTIVE";
    this.startLabel = o.startLabel || `DESTROY ${this.noun}`;
    this.startSub = o.startSub || "shatter the hive-mind's core";
    this._boss = null; this._max = 0; this._done = false;
  }

  brief() {
    return this.game.cfg.briefText ||
      `<b>THE COLLECTIVE</b> — a hive-mind of cube-headed cosmic freaks — wants to assimilate every Rick in the ` +
      `multiverse. Its meditating <b>core</b> floats on the far dais, spawning drone-bodies and hurling psychic ` +
      `energy. Grab a blaster, cross the temple, and <b>blow the core apart</b> to break the hive.`;
  }

  onPlayStart() {
    this.game.hud.setObjective(`Destroy <span class="arrow">${this.noun} ☯</span>`);
    this.game.hud.setCounter(this.noun, `100%`);
    this.game.hud.showBanner(this.startLabel, this.startSub, 4600);
    this.game.hud.notify(`${this.startLabel} ☯`);
  }

  update() {
    if (this._done) return;
    // latch the boss the first time it appears in the enemy list, and remember its full HP for the % bar
    if (!this._boss) { this._boss = this.game.combat.enemies.find((e) => e.boss); if (this._boss) this._max = this._boss.hp || 1; }
    if (!this._boss) return;

    const pct = Math.max(0, Math.round((this._boss.hp / this._max) * 100));
    this.game.hud.setCounter(this.noun, `${pct}%`);

    if (this._boss.dead) {
      this._done = true;
      this.game.hud.setCounter(this.noun, `0%`);
      this.game._win({ cinematic: true, title: 'The Collective <span class="hz">Shattered</span>', sub: "The hive-mind is individual again — which, for them, is basically death" });
    }
  }
}
