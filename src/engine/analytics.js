// Minimal play analytics (best-effort, fire-and-forget): counts a play when gameplay starts and reports
// the session duration when the game ends or the player leaves — PER GAME. Feeds the /crm dashboard in server.js.
let t0 = 0, active = false, sent = false, game = { id: "unknown", name: "Unknown" };

function post(obj, beacon) {
  const body = JSON.stringify(obj);
  try {
    if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    else fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: !!beacon }).catch(() => {});
  } catch { /* offline / blocked — ignore */ }
}

// gameId/gameName identify which game this session is for, so the CRM can break stats down per game.
export function trackStart(gameId, gameName) {
  if (gameId) game = { id: String(gameId), name: String(gameName || gameId) };
  if (active) return;            // one session per page load
  active = true; sent = false; t0 = Date.now();
  post({ type: "start", game: game.id, name: game.name });
}

export function trackEnd(finished = false) {
  if (!active || sent) return;
  sent = true; active = false;
  const ms = Date.now() - t0;
  post({ type: "end", ms, finished: !!finished, game: game.id, name: game.name }, true); // finished = actually beat the game
}

// catch the player leaving (close tab, navigate away, mobile background) — leaving mid-game is NOT a finish
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => trackEnd(false));
  window.addEventListener("beforeunload", () => trackEnd(false));
}
