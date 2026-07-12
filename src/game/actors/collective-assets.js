import { PropAsset } from "../../engine/assets.js";

// THE COLLECTIVE — a Meshy "Janus Knight" (cube-headed armoured being). ONE static model, reused at two
// scales: a colossal meditating CORE (spawn.boss — the Collective itself) and normal-size DRONES (the hive
// bodies that swarm Rick). No skeleton/animations → posed + bobbed procedurally by the actor. 626KB / 13.6k tris.
export const JANUS_MODEL = new PropAsset("/models/creatures/janus_knight.glb", { height: 2.0 });

export function collectiveJobs() { return [JANUS_MODEL.preload()]; }
