import { DefuseObjective } from "./defuse.js";
import { ExfilObjective } from "./exfil.js";
import { CollectObjective } from "./collect.js";
import { SlayObjective } from "./slay.js";

// Objective registry. Each objective is { brief(), onPlayStart(), update(dt, t, presses) } and decides
// the win/lose CONDITIONS (the runner owns the state transitions). Add a type here to make it usable
// via a level's config.objective.type.
export function makeObjective(type, game) {
  if (type === "defuse") return new DefuseObjective(game);
  if (type === "collect") return new CollectObjective(game);
  if (type === "slay") return new SlayObjective(game);
  return new ExfilObjective(game);
}
