import { RiggedAsset } from "../../engine/assets.js";
import { preloadGunModels } from "./gunmodels.js";

// Rigged model pack for the Rick & Morty level. Rick is a clean UE4-skeleton mesh with REAL Mixamo
// animations authored for that exact mesh (no retargeting): rick.glb = mesh + Idle; walk/run/gun are
// tiny animation-only clips that bind onto it by bone name. "hand_r" = right hand (holds the gun).
export const RICK_MODEL = new RiggedAsset("/models/rick.glb?v=mixamo3", 1.95); // mesh + Idle clip (UVs re-synced to fix garbled texture)
export const RICK_WALK = new RiggedAsset("/models/rick_walk.glb?v=v2", 1.95); // v2 = root motion stripped (in-place)
export const RICK_RUN = new RiggedAsset("/models/rick_run.glb?v=v2", 1.95);
export const RICK_GUN = new RiggedAsset("/models/rick_gun.glb?v=v2", 1.95);
export const RICK_DANCE = new RiggedAsset("/models/rick_dance.glb?v=v1", 1.95); // Salsa Dancing — played weaponless on the deploy screen
export const RICK_JUMP = new RiggedAsset("/models/rick_jump.glb?v=v1", 1.95); // Jump pose — played while airborne from a jump
export const MEESEEKS_MODEL = new RiggedAsset("/models/meeseeks.glb", 2.0);
export const RM_HAND_BONE = "hand_r";

export function rickMortyJobs() { return [RICK_MODEL.preload(), RICK_WALK.preload(), RICK_RUN.preload(), RICK_GUN.preload(), RICK_DANCE.preload(), RICK_JUMP.preload(), MEESEEKS_MODEL.preload(), preloadGunModels()]; }

// pull extra animation clips off an already-preloaded RiggedAsset (same skeleton → they retarget by bone name)
export function clipsOf(asset) { return (asset._asset && asset._asset.animations) || []; }
