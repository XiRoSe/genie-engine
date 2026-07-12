import { compound } from "./compound.js";
import { desertBase } from "./desert-base.js";
import { arcfall } from "./arcfall.js";
import { meeseeks } from "./meeseeks.js";
import { rickCollective } from "./rick-collective.js";

// Level registry. Add a level here and it's selectable via ?level=<id>.
export const levels = {
  compound,
  "desert-base": desertBase,
  arcfall,
  meeseeks_mayhem: meeseeks,
  rick_and_morty_vs_collective: rickCollective,
  arcfall_rick_and_morty: meeseeks, // legacy alias so old links still resolve
};
export const DEFAULT_LEVEL = "desert-base";
