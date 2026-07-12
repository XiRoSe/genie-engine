import { buildCollectiveArena } from "./collective-arena.js";

// RICK vs THE COLLECTIVE — a 3rd-person boss arena (you're Rick, all his animations) set in a vast square
// purple meditation-temple. THE COLLECTIVE is a cube-headed Janus-Knight hive: one colossal meditating CORE
// (the boss) floating on the far dais, plus the drone-bodies it summons. Blow the core apart to break the hive.
export const rickCollective = {
  id: "rick_and_morty_vs_collective",
  name: "RICK vs THE COLLECTIVE",
  config: {
    view: "third",                                              // 3rd-person Rick (idle/walk/run/gun/dance/jump)
    scene: { sky: "night", fog: { color: 0x2a1440, near: 40, far: 260 }, fov: 75 }, // dark base; the arena repaints a purple haze
    intro: { enabled: true, style: "droppod", spottedCalloutAt: 4.5 }, // Rick drops into the temple + his own crawl
    objective: { type: "slay", noun: "THE COLLECTIVE", startLabel: "DESTROY THE COLLECTIVE", startSub: "shatter the hive-mind's core" },
    helicopter: { spawnDelay: 99999 },                          // no gunship in the temple
    reinforce: "none",                                          // no sky drops — the boss summons its OWN drones
    enemyBolt: 0xc46bff,                                        // the Collective fires PURPLE psychic bolts
    music: "schwifty",
    player: { grenades: 4, startLoadout: ["handlaser"], bannedWeapons: ["smg", "laser", "railgun", "flak"] },
    weaponNames: { rifle: "PHOTON CARBINE", minigun: "TACHYON REPEATER", burst: "ION BURSTER", plasma: "PLASMA CANNON", launcher: "FUSION LAUNCHER" },
    crawlTitle: "RICK vs THE COLLECTIVE",
    introCrawl: [
      "Okay Morty, real quick — I <b>maybe</b> insulted <b>THE COLLECTIVE</b>. Cube-headed cosmic hive-mind. Zero chill.",
      "Now they wanna <b>assimilate</b> every Rick in the multiverse into one big boring group-brain. Hard pass.",
      "See the giant meditating jackass on the throne? That's the <b>core</b> — everything else is just its fingers.",
      "Grab a blaster, cross the temple, and blow that smug cube <b>apart</b>, Morty. *buuurp*",
    ],
    victoryTitle: "HIVE, BROKEN",
    victoryCrawl: [
      "And <b>THAT'S</b> how you delete a hive-mind, Morty!",
      "The Collective's just a pile of confused individuals now — basically an existential crisis with legs.",
      "Wubba lubba dub dub — we are <b>outta</b> here.",
    ],
    messages: { deployHint: "CLICK TO DEPLOY — cross the temple, blow the Collective's core apart", hostileDown: "COLLECTIVE BODY SHATTERED" },
  },

  build(b) {
    const spots = buildCollectiveArena(b);
    // BOSS: push the spawn directly (bypassing b.enemy's collider-shove) so the core stays centred on its dais
    b.enemySpawns.push({ kind: "janus", boss: true, x: spots.bossSpawn.x, z: spots.bossSpawn.z });
    // an opening squad of drones spread across the floor (the boss summons more during the fight)
    for (const s of spots.droneSpawns) b.enemy({ kind: "janus", x: s.x, z: s.z });
  },
};
