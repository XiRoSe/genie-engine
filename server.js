// Tiny zero-dependency static server for the built app (Railway/production).
// Also hosts: a GENIE landing page at "/", a PER-GAME CRM at "/crm", and "/api/track" that records sessions.
import { createServer } from "http";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { extname, join, normalize } from "path";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(ROOT, "dist");
const PORT = process.env.PORT || 8080;

// The games GENIE ships (id = ?level=, used to link + to label the CRM). Extend this list per new game.
const GAMES = [
  { id: "meeseeks_mayhem", name: "MEESEEKS MAYHEM", tag: "3rd-person · Rick & Morty", blurb: "You're Rick. Time's broken (again) — recover the 12 white magic rings, fend off a rain of Mr. Meeseeks (regular, huge & kaiju-sized giants), and poof the blue idiots with infinite green hand-lasers." },
  { id: "the_collective", name: "THE COLLECTIVE", tag: "3rd-person · Rick & Morty · boss fight", blurb: "You're Rick, storming a vast enclosed purple meditation-temple to fight THE COLLECTIVE — a cube-headed cosmic hive-mind. It never fires — it just births endless drone-bodies of itself that swarm, chase and grab you. Fight through the horde and shatter the colossal meditating core." },
  { id: "arcfall", name: "ARCFALL", tag: "1st-person · island survival", blurb: "Drop onto a time-fractured daytime island, recover the 12 lost Arcs, and survive the dinosaurs and giant mechs that guard them." },
  { id: "desert-base", name: "NIGHTOPS", tag: "1st-person · night raid", blurb: "Infiltrate a desert military base under cover of night and reach & disarm the bomb before it detonates." },
];
const GAME_NAME = Object.fromEntries(GAMES.map((g) => [g.id, g.name]));

// ── analytics store ── persisted to the Railway volume at /data (survives redeploys), else locally.
// Shape: { first, games: { [id]: { name, plays, totalMs, completed, finished, lastPlayed, days:{ [YYYY-MM-DD]:{plays,completed,finished,ms} } } } }
const DATA_DIR = existsSync("/data") ? "/data" : ROOT;
const STATS_FILE = join(DATA_DIR, "stats.json");
const stats = { first: Date.now(), games: {} };
try { Object.assign(stats, JSON.parse(await readFile(STATS_FILE, "utf8"))); } catch { /* first run */ }
if (!stats.games) stats.games = {};
// migrate the OLD single-bucket schema (pre per-game) into a legacy bucket so history isn't lost
if (stats.plays !== undefined && !Object.keys(stats.games).length) {
  stats.games["_legacy"] = { name: "All levels (before per-game split)", plays: stats.plays || 0, totalMs: stats.totalMs || 0, completed: stats.completed || 0, finished: stats.finished || 0, lastPlayed: stats.lastPlayed || 0, days: stats.days || {} };
}
for (const k of ["plays", "totalMs", "completed", "finished", "lastPlayed", "days"]) delete stats[k];

let _saveT = null;
function saveStats() { clearTimeout(_saveT); _saveT = setTimeout(() => { writeFile(STATS_FILE, JSON.stringify(stats)).catch(() => {}); }, 400); }
function readBody(req) { return new Promise((res) => { let d = ""; req.on("data", (c) => { d += c; if (d.length > 1e5) req.destroy(); }); req.on("end", () => res(d)); req.on("error", () => res("")); }); }
function fmtDur(ms) { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function bucket(id, name) {
  let b = stats.games[id];
  if (!b) b = stats.games[id] = { name: name || GAME_NAME[id] || id, plays: 0, totalMs: 0, completed: 0, finished: 0, lastPlayed: 0, days: {} };
  if (name) b.name = name; else if (GAME_NAME[id]) b.name = GAME_NAME[id];
  return b;
}

// ── the GENIE landing page (root) ──
function homePage() {
  const links = GAMES.map((g) => `
    <a class="game" href="/?level=${g.id}">
      <div class="gt">${esc(g.name)}</div>
      <div class="gtag">${esc(g.tag)}</div>
      <div class="gb">${esc(g.blurb)}</div>
      <div class="gplay">▶ Play</div>
    </a>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GENIE — a Generative Engine for Native Interactive Experiences</title>
<style>
  :root{--gold:#ffd23a;--bg:#0b0a14;--card:#161422;--line:#2a2740;--ink:#e7e3f5}
  *{box-sizing:border-box}body{margin:0;background:radial-gradient(1200px 600px at 50% -10%,#1a1330 0%,var(--bg) 60%);color:var(--ink);font:16px/1.6 'Segoe UI',system-ui,sans-serif;min-height:100vh}
  .wrap{max-width:960px;margin:0 auto;padding:56px 22px 60px}
  .logo{font-size:13vw;line-height:1;text-align:center;margin:0}
  @media(min-width:700px){.logo{font-size:84px}}
  h1{font-size:34px;letter-spacing:.14em;text-align:center;margin:.2em 0 .1em;color:var(--gold);text-shadow:0 0 30px rgba(255,180,30,.35)}
  .tag{text-align:center;opacity:.75;margin:0 0 6px;font-size:16px}
  .wish{text-align:center;opacity:.5;font-style:italic;margin:0 0 34px}
  .lead{max-width:680px;margin:0 auto 40px;text-align:center;opacity:.92}
  .lead b{color:#fff}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.14em;opacity:.55;margin:36px 0 14px;text-align:center}
  .games{display:grid;grid-template-columns:1fr;gap:16px}
  @media(min-width:720px){.games{grid-template-columns:1fr 1fr}}
  .game{display:block;text-decoration:none;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px 22px;transition:transform .15s,border-color .15s,box-shadow .15s}
  .game:hover{transform:translateY(-3px);border-color:var(--gold);box-shadow:0 10px 30px rgba(0,0,0,.4)}
  .gt{font-size:22px;font-weight:800;letter-spacing:.06em;color:#fff}
  .gtag{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--gold);opacity:.85;margin:2px 0 10px}
  .gb{opacity:.75;font-size:14.5px}
  .gplay{margin-top:14px;font-weight:800;color:var(--gold);letter-spacing:.1em;font-size:13px}
  .feat{display:grid;grid-template-columns:1fr 1fr;gap:8px 26px;max-width:680px;margin:6px auto 0;opacity:.85;font-size:14.5px;list-style:none;padding:0}
  @media(max-width:560px){.feat{grid-template-columns:1fr}}
  .feat li::before{content:'✦ ';color:var(--gold)}
  .foot{opacity:.5;font-size:13px;text-align:center;margin-top:46px}
  .foot a{color:var(--gold)}
  code{background:#00000055;padding:2px 6px;border-radius:5px;font-size:13px}
</style></head>
<body><div class="wrap">
  <p class="logo">🧞</p>
  <h1>GENIE</h1>
  <p class="tag">a <b>G</b>enerative <b>E</b>ngine for <b>N</b>ative <b>I</b>nteractive <b>E</b>xperiences</p>
  <p class="wish">make a wish, ship a game</p>
  <p class="lead">GENIE is an <b>AI-first web game engine</b> — <b>Three.js + Vite</b>, no framework, no build magic.
    It runs <b>first- and third-person</b> games in the browser, and ships a toolkit of <b>skills</b> your AI pair
    runs to conjure your own game: add a level, weapon, enemy or audio, verify it in-browser, and ship. Every game
    below runs on the same engine — proof it generalizes across views, genres and art styles.</p>
  <ul class="feat">
    <li>First- &amp; third-person controller + rigged, animated avatars</li>
    <li>Energy weapons, force-field VFX, size-tiered enemies</li>
    <li>Levels-as-data (<code>?level=&lt;id&gt;</code>), objectives, per-game music</li>
    <li>Skills library so an AI agent extends it safely</li>
  </ul>
  <h2>Play the games</h2>
  <div class="games">${links}</div>
  <p class="foot">Built with Three.js + Vite · <a href="/crm">📊 Player CRM</a> · <a href="https://github.com/XiRoSe/genie-engine">source on GitHub</a></p>
</div></body></html>`;
}

// ── the per-game CRM dashboard ──
function crmPage() {
  const ids = Object.keys(stats.games).sort((a, b) => (stats.games[b].plays || 0) - (stats.games[a].plays || 0));
  let TP = 0, TF = 0, TMS = 0, TC = 0, last = 0;
  for (const id of ids) { const g = stats.games[id]; TP += g.plays || 0; TF += g.finished || 0; TMS += g.totalMs || 0; TC += g.completed || 0; last = Math.max(last, g.lastPlayed || 0); }
  const card = (label, val) => `<div class="card"><div class="num">${val}</div><div class="lbl">${label}</div></div>`;
  const fmtTs = (ts) => ts ? new Date(ts).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—";
  const section = (id) => {
    const g = stats.games[id], nm = g.name || GAME_NAME[id] || id, avg = g.completed ? g.totalMs / g.completed : 0;
    const days = Object.entries(g.days || {}).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
    const rows = days.map(([d, v]) => `<tr><td>${d}</td><td>${v.plays || 0}</td><td>${v.finished || 0}</td><td>${v.completed ? fmtDur(v.ms / v.completed) : "—"}</td></tr>`).join("") || `<tr><td colspan="4" style="opacity:.4">no data yet</td></tr>`;
    return `<section class="game"><div class="ghead"><h2>${esc(nm)}</h2><span class="glast">🕒 ${fmtTs(g.lastPlayed)}</span></div>
      <div class="cards">${card("Plays", g.plays || 0)}${card("Finished", g.finished || 0)}${card("Avg time", g.completed ? fmtDur(avg) : "—")}${card("Total time", fmtDur(g.totalMs || 0))}</div>
      <table><thead><tr><th>Day</th><th>Plays</th><th>Finished</th><th>Avg time</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  };
  const sections = ids.length ? ids.map(section).join("") : `<p style="opacity:.5">No plays recorded yet.</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="30"><title>GENIE · CRM</title>
<style>body{margin:0;background:#0b0a14;color:#e7e3f5;font:15px/1.5 'Segoe UI',system-ui,sans-serif}.wrap{max-width:820px;margin:0 auto;padding:32px 20px 60px}a{color:#ffd23a}h1{font-size:22px;letter-spacing:.12em;color:#ffd23a;margin:0 0 4px}.sub{opacity:.55;margin:0 0 26px;font-size:13px}.cards{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 22px}.card{flex:1;min-width:120px;background:#161422;border:1px solid #2a2740;border-radius:12px;padding:16px}.num{font-size:26px;font-weight:800;color:#fff}.lbl{opacity:.6;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:10px}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #221f33}th{opacity:.5;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.06em}.game{border-top:1px solid #221f33;padding-top:20px;margin-top:26px}.ghead{display:flex;align-items:baseline;justify-content:space-between;gap:10px}h2{font-size:16px;letter-spacing:.08em;color:#fff;margin:0 0 12px}.glast{opacity:.5;font-size:12px;white-space:nowrap}.overall h2{color:#ffd23a}.foot{opacity:.4;font-size:12px;margin-top:30px}</style></head>
<body><div class="wrap"><h1>🧞 GENIE · PLAYER CRM</h1><p class="sub">live since ${new Date(stats.first).toISOString().slice(0, 10)} · auto-refreshes every 30s · <a href="/">← home</a></p>
<section class="overall"><h2>All games</h2><div class="cards">${card("Total plays", TP)}${card("Games finished", TF)}${card("Avg play time", TC ? fmtDur(TMS / TC) : "—")}${card("Total play time", fmtDur(TMS))}</div><p class="glast" style="opacity:.5">Last played anywhere: ${fmtTs(last)}</p></section>
${sections}
<p class="foot">A "play" = a session that reached gameplay. "Finished" = the player actually beat that game. Avg/total time covers every session with a real duration (win, loss, or leaving). One dashboard section per game we ship — new games appear automatically as they get played.</p></div></body></html>`;
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".ico": "image/x-icon", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".glb": "model/gltf-binary",
  ".hdr": "application/octet-stream", ".ktx2": "application/octet-stream", ".woff2": "font/woff2",
};

const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://x");
    let p = decodeURIComponent(u.pathname);

    // ── CRM endpoints ──
    if (p === "/api/track" && req.method === "POST") {
      let j = {}; try { j = JSON.parse(await readBody(req)); } catch { /* ignore */ }
      const id = String(j.game || "unknown").slice(0, 60);
      const b = bucket(id, j.name ? String(j.name).slice(0, 60) : null);
      const day = new Date().toISOString().slice(0, 10);
      const d = b.days[day] || (b.days[day] = { plays: 0, completed: 0, finished: 0, ms: 0 });
      if (j.type === "start") { b.plays++; d.plays++; b.lastPlayed = Date.now(); saveStats(); }
      else if (j.type === "end") {
        const ms = Math.max(0, Math.min(6 * 3600 * 1000, +j.ms || 0));
        if (ms > 1500) { b.totalMs += ms; b.completed++; d.completed++; d.ms += ms; } // any session with a real duration
        if (j.finished) { b.finished++; d.finished++; }                              // only an actual win = finished
        if (ms > 1500 || j.finished) saveStats();
      }
      res.writeHead(204); return res.end();
    }
    if (p === "/crm" || p === "/crm/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      return res.end(crmPage());
    }
    // ── landing page at the bare root (no ?level=) ──
    if ((p === "/" || p === "/index.html") && !u.searchParams.has("level")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      return res.end(homePage());
    }

    // ── static files (the built game) ──
    if (p === "/") p = "/index.html";
    let file = normalize(join(DIST, p));
    if (!file.startsWith(DIST)) { res.writeHead(403); return res.end("forbidden"); }
    let data;
    try { data = await readFile(file); }
    catch { file = join(DIST, "index.html"); data = await readFile(file); } // SPA fallback → the game
    res.writeHead(200, {
      "Content-Type": MIME[extname(file)] || "application/octet-stream",
      "Cache-Control": extname(file) === ".html" ? "no-cache" : "public, max-age=86400",
    });
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end("server error");
  }
});
server.listen(PORT, () => console.log(`GENIE serving dist/ on :${PORT}`));
