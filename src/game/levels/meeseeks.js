import { buildArcfallIsland } from "./arcfall.js";

// MEESEEKS MAYHEM — ARCFALL, re-skinned for Rick & Morty: it's the same island + the 12 arcs + the
// scavenged-weapon economy, but you're RICK (3rd-person, visible, holding a gun) and the guardians are
// Mr. MEESEEKS — regular ones plus HUGE tanky ones. Existing weapons only (Arc Blade + scattered guns).
export const meeseeks = {
  id: "meeseeks_mayhem",
  name: "MEESEEKS MAYHEM",
  config: {
    view: "third",                                              // 3rd-person: you see Rick + his gun
    scene: { sky: "day", fog: { color: 0x9a7fb0, near: 240, far: 1300 }, fov: 75 },
    intro: { enabled: true, style: "droppod", spottedCalloutAt: 4.5 }, // drop-pod cinematic + Rick's broke-time crawl
    objective: { type: "collect", count: 12, noun: "Ring", icon: "◯", startLabel: "COLLECT THE 12 WHITE RINGS", startSub: "to save the time" }, // 12 white magic rings
    helicopter: { spawnDelay: 99999 },
    // Rick starts with ONLY his innate GREEN palm-lasers (infinite) — the real blasters are scavenged from the island
    player: { grenades: 4, startLoadout: ["handlaser"], bannedWeapons: ["smg", "laser", "railgun", "flak"] },
    // sci-fi blaster names (they fire energy/laser bolts)
    weaponNames: { rifle: "PHOTON CARBINE", minigun: "TACHYON REPEATER", burst: "ION BURSTER", plasma: "PLASMA CANNON", launcher: "FUSION LAUNCHER" },
    music: "schwifty",                                          // this level's in-game track
    reinforce: "meeseeks",                                      // the sky-drop reinforcements are Meeseeks (mostly regular, some huge)
    messages: { deployHint: "CLICK TO DEPLOY — grab the 12 white magic rings, poof the Meeseeks, un-break time", hostileDown: "MEESEEKS POOFED" },
  },

  build(b) {
    buildArcfallIsland(b, { bossKind: "meeseeks" });            // the full ARCFALL island + arcs + weapons, with a HUGE Meeseeks guardian
    // no welcome party — Meeseeks rain from the sky every 5s during play (main._dropReinforcement)
    // Rick starts with only his GREEN palm-lasers (weakest) — the real blasters are SCAVENGED, and there are MANY
    // spawns dotted across the whole island (walk over a crate to acquire; Q to cycle). Harder guns hit much harder.
    const WEAPON_SPOTS = [
      ["rifle", 0, 40], ["rifle", 28, -70], ["rifle", -60, 70], ["rifle", 96, 4], ["rifle", -20, -110], ["rifle", 130, 40],
      ["minigun", -46, -10], ["minigun", 120, -8], ["minigun", 40, 100], ["minigun", -110, -40], ["minigun", 70, -90],
      ["burst", 54, 18], ["burst", -96, 40], ["burst", 10, 120], ["burst", -40, -30], ["burst", 100, 90],
      ["plasma", -24, 92], ["plasma", 110, 60], ["plasma", -80, -70], ["plasma", 50, -40], ["plasma", -130, 20],
      ["launcher", 88, -34], ["launcher", -70, -58], ["launcher", 20, 70], ["launcher", -100, 80], ["launcher", 60, 30],
    ];
    for (const [kind, x, z] of WEAPON_SPOTS) b.giftCrate(x, z, kind);
    // extra ammo caches dotted across the island (Rick burns through the scavenged arsenal fast)
    for (const [x, z] of [[0, 60], [-50, 4], [50, 6], [-30, -40], [42, -42], [-80, 34], [82, 30], [4, -72], [-110, -8], [122, 22], [-22, 130], [62, 112], [102, -50], [-92, 82], [18, 14], [-58, -64]]) b.giftCrate(x, z, "ammo");
  },
};
