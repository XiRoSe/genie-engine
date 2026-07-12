// Tactical HUD + menus. Distinctive condensed military type, hazard accents.
const CSS = `
:root{
  --hud:#d8e0c8; --dim:#8d9a7e; --hz:#e0a32e; --danger:#e0463a; --ok:#6fcf73;
  --panel:rgba(18,22,16,.62); --line:rgba(216,224,200,.28);
}
#ui, #ui *{ font-family:"Rajdhani","Saira Condensed",sans-serif; }
#ui{ color:var(--hud); letter-spacing:.04em; }
.mil-title{ font-family:"Saira Condensed",sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:.14em; }

/* crosshair */
#xhair{ position:absolute; left:50%; top:50%; width:0; height:0; pointer-events:none; }
#xhair .tick{ position:absolute; background:var(--hud); box-shadow:0 0 3px rgba(0,0,0,.7); opacity:.9; }
#xhair .t-u,#xhair .t-d{ width:2px; height:9px; left:-1px; }
#xhair .t-l,#xhair .t-r{ height:2px; width:9px; top:-1px; }
#xhair .dot{ position:absolute; width:3px; height:3px; left:-1.5px; top:-1.5px; background:var(--hud); border-radius:50%; }
#hitmark{ position:absolute; left:50%; top:50%; width:0; height:0; pointer-events:none; opacity:0; }
#hitmark span{ position:absolute; width:2px; height:9px; background:#fff; }

/* vignette / damage */
#vign{ position:absolute; inset:0; pointer-events:none; box-shadow:inset 0 0 220px rgba(0,0,0,.55); }
#dmg{ position:absolute; inset:0; pointer-events:none; opacity:0;
  background:radial-gradient(120% 90% at 50% 110%, rgba(224,70,58,.55), transparent 55%); }

/* readouts */
.panel{ position:absolute; background:var(--panel); border:1px solid var(--line);
  padding:8px 14px; backdrop-filter:blur(2px); }
.panel .lbl{ font-size:11px; color:var(--dim); text-transform:uppercase; letter-spacing:.18em; }
#mission{ right:18px; top:16px; padding:8px; }
#mission .op{ font-size:15px; }
#minimap{ display:block; width:150px; height:150px; border-radius:6px; }
#mission .maptitle{ font-size:11px; color:var(--dim); letter-spacing:.18em; text-align:center; margin-top:5px; }
#hostiles{ left:18px; top:16px; text-align:left; }
#hostiles b{ font-size:26px; font-weight:700; color:var(--hz); line-height:1; }
#clock{ left:18px; top:92px; text-align:left; }
#clock b{ font-size:26px; font-weight:700; color:#ffd23a; line-height:1; font-variant-numeric:tabular-nums; }
#clock.low b{ color:var(--danger); }
#objective{ left:50%; top:18px; transform:translateX(-50%); text-align:center; position:absolute; }
#arcarrow{ position:absolute; left:100%; top:50%; margin-left:14px; transform:translateY(-50%); line-height:0; pointer-events:none; z-index:53; opacity:0; transition:opacity .2s; filter:drop-shadow(0 3px 4px rgba(0,0,0,.7)); }
#objective .arrow{ color:var(--hz); }

#health{ left:18px; bottom:18px; min-width:220px; }
#health .row{ display:flex; align-items:baseline; gap:8px; }
#health b{ font-size:30px; font-weight:700; line-height:1; }
#hpbar{ height:10px; margin-top:6px; background:rgba(0,0,0,.4); border:1px solid var(--line); }
#hpbar > i{ display:block; height:100%; width:100%; background:var(--ok); transition:width .15s, background .2s; }
#armorrow{ margin-top:6px; }
#armorbar{ height:7px; margin-top:4px; background:rgba(0,0,0,.4); border:1px solid var(--line); }
#armorbar > i{ display:block; height:100%; width:100%; background:#3a9cff; transition:width .15s; }

#ammo{ right:18px; bottom:18px; text-align:right; min-width:180px; }
#ammo .gun{ font-size:12px; color:var(--dim); letter-spacing:.2em; }
#ammo .count b{ font-size:40px; font-weight:700; line-height:.9; }
#ammo .count s{ font-size:20px; color:var(--dim); text-decoration:none; }
#ammo.low .count b{ color:var(--danger); animation:blink .6s steps(2) infinite; }
@keyframes blink{ 50%{ opacity:.35; } }

#feed{ position:absolute; right:18px; top:86px; text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px; z-index:5; }
#feed .k{ font-size:13px; color:var(--hud); background:var(--panel); border-right:3px solid var(--danger);
  padding:3px 10px; letter-spacing:.1em; animation:slideIn .25s ease; }
@keyframes slideIn{ from{ transform:translateX(20px); opacity:0; } }

/* overlays */
.overlay{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:18px; pointer-events:auto; text-align:center;
  background:radial-gradient(120% 100% at 50% 30%, rgba(20,26,18,.55), rgba(8,10,7,.88)); }
.overlay h1{ font-size:clamp(40px,8vw,92px); letter-spacing:.18em; margin:0;
  text-shadow:0 4px 24px rgba(0,0,0,.6); }
.overlay h1 .hz{ color:var(--hz); }
.overlay .sub{ font-size:18px; color:var(--dim); letter-spacing:.22em; text-transform:uppercase; }
.overlay .cta{ margin-top:10px; font-family:"Saira Condensed"; font-weight:700; text-transform:uppercase;
  letter-spacing:.18em; font-size:22px; color:#12160e; background:var(--hz); padding:14px 34px;
  border:none; cursor:pointer; clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);
  animation:pulse 1.4s ease-in-out infinite; }
.overlay .controls{ margin-top:14px; font-size:14px; color:var(--dim); letter-spacing:.12em; line-height:1.9; }
.overlay .controls kbd{ color:var(--hud); border:1px solid var(--line); padding:1px 8px; margin:0 2px; }
.overlay .stats{ font-size:20px; letter-spacing:.1em; line-height:1.8; }
@keyframes pulse{ 50%{ transform:translateY(-4px); } }

/* mission countdown (bomb) */
#timer{ left:50%; top:74px; transform:translateX(-50%); text-align:center; }
#timer .t{ font-size:30px; font-weight:700; line-height:1; font-variant-numeric:tabular-nums; }
#timer.danger .t{ color:var(--danger); animation:blink .6s steps(2) infinite; }

/* bomb disarm panel */
#defuse{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  background:rgba(8,10,7,.72); pointer-events:none; }
#defuse .box{ background:var(--panel); border:1px solid var(--line); padding:28px 46px; text-align:center; }
#defuse .ttl{ font-size:14px; color:var(--hz); letter-spacing:.22em; text-transform:uppercase; }
#defuse .code{ font-size:56px; font-weight:700; letter-spacing:.32em; font-variant-numeric:tabular-nums; margin:12px 0 6px; }
#defuse .fb{ font-size:15px; color:var(--ok); letter-spacing:.06em; min-height:24px; line-height:1.7; }
#defuse .fb b{ color:var(--hz); letter-spacing:.12em; }
#defuse .fb .bad{ color:#ff6a52; }
#defuse .hint{ font-size:13px; color:var(--dim); letter-spacing:.12em; margin-top:12px; }
#ammo .nades{ font-size:13px; color:var(--hz); letter-spacing:.14em; margin-top:5px; }
/* center action prompt (e.g. gunship inbound -> use the launcher) */
#jetfuel{ position:fixed; top:86px; left:0; right:0; text-align:center; z-index:54; pointer-events:none; font-weight:800; letter-spacing:.2em; color:#ffd23a; text-shadow:0 2px 12px rgba(0,0,0,.75); font-size:1.7vw; opacity:0; transition:opacity .15s; }
#rewindfx{ position:fixed; inset:0; z-index:60; pointer-events:none; opacity:0; transition:opacity .18s; background:radial-gradient(circle at 50% 48%, transparent 24%, rgba(90,210,235,.18) 62%, rgba(210,160,70,.42) 100%); }
#rewindfx::after{ content:""; position:absolute; inset:0; background:repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 2px, transparent 2px 5px); mix-blend-mode:overlay; }
#rewindfx .rw-label{ position:absolute; top:50%; left:0; right:0; transform:translateY(-50%); text-align:center; font-weight:900; letter-spacing:.4em; font-size:3vw; color:#bff0ff; text-shadow:0 0 24px rgba(120,220,255,.9), 0 4px 14px rgba(0,0,0,.7); animation:rwpulse .7s ease-in-out infinite; }
@keyframes rwpulse{ 0%,100%{ opacity:.55; } 50%{ opacity:1; } }
#jetfuel .fi{ filter:saturate(3.2) brightness(1.25) hue-rotate(14deg); } /* tint the flame emoji to match the gold text */
#prompt{ position:absolute; left:50%; top:44%; transform:translateX(-50%); text-align:center; pointer-events:none;
  background:rgba(18,22,16,.7); border:1px solid var(--hz); padding:10px 24px; opacity:0; transition:opacity .25s; }
#prompt .p{ font-size:20px; font-weight:700; letter-spacing:.1em; }
#prompt .p b{ color:var(--hz); }
#prompt.on{ opacity:1; }
.hidden{ display:none !important; }
`;

export class HUD {
  constructor() {
    this.root = document.getElementById("ui");
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    this.root.innerHTML = `
      <div id="vign"></div><div id="dmg"></div>
      <div id="xhair"><span class="tick t-u"></span><span class="tick t-d"></span>
        <span class="tick t-l"></span><span class="tick t-r"></span><span class="dot"></span></div>
      <div id="hitmark"><span></span><span></span><span></span><span></span></div>
      <div id="mission" class="panel"><canvas id="minimap" width="150" height="150"></canvas><div class="maptitle op">ARCFALL</div></div>
      <div id="hostiles" class="panel"><div class="lbl">Hostiles</div><b>0</b></div>
      <div id="clock" class="panel"><div class="lbl">Time</div><b>5:00</b></div>
      <div id="objective" class="panel"><div class="lbl">Objective</div><div class="obj mil-title">Eliminate hostiles · reach <span class="arrow">EXTRACTION ▲</span></div>
        <div id="arcarrow"><svg viewBox="0 0 48 52" width="44" height="48"><path d="M24 3 L44 30 L31 30 L31 48 L17 48 L17 30 L4 30 Z" fill="#ffce32" stroke="#1a1206" stroke-width="3.5" stroke-linejoin="round"/><path d="M24 9 L38 28 L28 28 L28 28 Z" fill="#fff2a0"/></svg></div></div>
      <div id="timer" class="panel hidden"><div class="lbl">Detonation</div><div class="t">3:00</div></div>
      <div id="health" class="panel"><div class="lbl">Vitals</div><div class="row"><b>100</b><span class="dim">HP</span></div><div id="hpbar"><i></i></div><div class="row" id="armorrow"><b class="arm">100</b><span class="dim">ARMOR</span></div><div id="armorbar"><i></i></div></div>
      <div id="ammo" class="panel"><div class="gun">MK-4 CARBINE</div><div class="count"><b>30</b><s> / 150</s></div><div class="nades">✦ GRENADES 5</div></div>
      <div id="prompt"><div class="p"></div></div>
      <div id="jetfuel"></div>
      <div id="rewindfx"><div class="rw-label">⏪ ARC-SAND</div></div>
      <div id="feed"></div>
      <div id="defuse" class="hidden"><div class="box">
        <div class="ttl">⚠ Bomb · Enter Disarm Code</div>
        <div class="code">_ _ _</div><div class="fb"></div>
        <div class="hint">type digits · ENTER submit · ESC cancel</div>
      </div></div>
    `;
    this.xhair = this.root.querySelector("#xhair");
    this.hitmark = this.root.querySelector("#hitmark");
    this.dmg = this.root.querySelector("#dmg");
    this.hostiles = this.root.querySelector("#hostiles b");
    this.hpNum = this.root.querySelector("#health b");
    this.hpBar = this.root.querySelector("#hpbar > i");
    this.armNum = this.root.querySelector("#health .arm");
    this.armBar = this.root.querySelector("#armorbar > i");
    this.ammoEl = this.root.querySelector("#ammo");
    this.ammoCount = this.root.querySelector("#ammo .count");
    this.feed = this.root.querySelector("#feed");
    this.app = document.getElementById("app");

    this._bloom = 0; this._dmgT = 0; this._shake = 0; this._hitT = 0;
    this.setCombatVisible(false);
  }

  setCombatVisible(v) {
    ["#xhair", "#mission", "#hostiles", "#clock", "#objective", "#health", "#ammo"].forEach((s) =>
      this.root.querySelector(s).classList.toggle("hidden", !v));
  }

  // ---- menus ----
  _overlay(html) {
    this._clearOverlay();
    const o = document.createElement("div"); o.className = "overlay"; o.id = "overlay";
    o.innerHTML = html; this.root.appendChild(o); return o;
  }
  _clearOverlay() { const e = this.root.querySelector("#overlay"); if (e) e.remove(); }

  showStart(onDeploy, opts = {}) {
    const title = opts.title || "Clear the Compound";
    const brief = opts.brief || "Push to the extraction zone. Eliminate anyone in your way.";
    const heroes = opts.heroes || null;
    const card = (h) => `<button class="herocard" data-hero="${h.id}" style="padding:11px 20px;border:2px solid ${h.id === opts.selected ? "#f0a500" : "#3a4250"};background:${h.id === opts.selected ? "rgba(240,165,0,0.22)" : "rgba(16,20,26,0.6)"};color:#e6edf4;border-radius:9px;font:inherit;letter-spacing:2px;text-transform:uppercase;cursor:pointer">${h.label}</button>`;
    const heroRow = heroes ? `<div class="sub" style="margin-top:6px">Choose your hero</div><div class="heroes" style="display:flex;gap:10px;justify-content:center;margin:10px 0 4px;flex-wrap:wrap">${heroes.map(card).join("")}</div>` : "";
    const o = this._overlay(`
      <div class="sub">Tactical Operations · Solo Deployment</div>
      <h1 class="mil-title">${title}</h1>
      ${heroRow}
      <button class="cta" id="deploy">▶ Click to Deploy</button>
      <div class="controls"><kbd>WASD</kbd>/<kbd>↑↓←→</kbd> move &nbsp; <kbd>SHIFT</kbd> sprint &nbsp; <kbd>SPACE</kbd> jump &nbsp; <kbd>E</kbd> jetpack &nbsp; <kbd>Q</kbd> weapon &nbsp; <kbd>MOUSE</kbd> aim &nbsp; <kbd>CLICK</kbd> fire &nbsp; <kbd>R</kbd> reload<br>
      ${brief}</div>`);
    o.querySelector("#deploy").addEventListener("click", () => onDeploy());
    if (heroes) o.querySelectorAll(".herocard").forEach((b) => b.addEventListener("click", () => {
      o.querySelectorAll(".herocard").forEach((x) => { x.style.border = "2px solid #3a4250"; x.style.background = "rgba(16,20,26,0.6)"; });
      b.style.border = "2px solid #f0a500"; b.style.background = "rgba(240,165,0,0.22)";
      opts.onHero && opts.onHero(b.dataset.hero);
    }));
  }
  // First screen: a dedicated hero-select (turntable preview is rendered behind by the game). Big hero
  // name + class tagline update as you pick; Confirm advances to the deploy screen.
  showHeroSelect(onConfirm, opts = {}) {
    const heroes = opts.heroes || [], cur = heroes.find((h) => h.id === opts.selected) || heroes[0] || { label: "", tag: "" };
    const card = (h) => `<button class="herocard" data-hero="${h.id}" data-label="${h.label}" data-tag="${h.tag || ""}" style="padding:13px 26px;border:2px solid ${h.id === opts.selected ? "#f0a500" : "#3a4250"};background:${h.id === opts.selected ? "rgba(240,165,0,0.22)" : "rgba(12,16,22,0.55)"};color:#e6edf4;border-radius:10px;font:inherit;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .12s">${h.label}</button>`;
    const o = this._overlay(`
      <div class="sub">Choose Your Hero</div>
      <h1 class="mil-title" id="heroName" style="margin:2px 0 0">${cur.label}</h1>
      <div class="sub" id="heroTag" style="color:#f0c873;letter-spacing:3px;margin-bottom:16px">${cur.tag || ""}</div>
      <div class="heroes" style="display:flex;gap:12px;justify-content:center;margin:6px 0 18px;flex-wrap:wrap">${heroes.map(card).join("")}</div>
      <button class="cta" id="confirm">▶ Confirm</button>`);
    o.querySelector("#confirm").addEventListener("click", () => onConfirm());
    const name = o.querySelector("#heroName"), tag = o.querySelector("#heroTag");
    o.querySelectorAll(".herocard").forEach((b) => b.addEventListener("click", () => {
      o.querySelectorAll(".herocard").forEach((x) => { x.style.border = "2px solid #3a4250"; x.style.background = "rgba(12,16,22,0.55)"; });
      b.style.border = "2px solid #f0a500"; b.style.background = "rgba(240,165,0,0.22)";
      name.textContent = b.dataset.label; tag.textContent = b.dataset.tag;
      opts.onHero && opts.onHero(b.dataset.hero);
    }));
  }
  showPause(onResume) {
    const o = this._overlay(`<div class="sub">Paused</div><h1 class="mil-title">Stand <span class="hz">By</span></h1>
      <button class="cta" id="resume">▶ Click to Resume</button>`);
    o.querySelector("#resume").addEventListener("click", onResume);
  }
  showWin(stats) {
    const rows = [];
    if (stats.timeLeft) rows.push(`BOMB DISARMED &nbsp;<b>${stats.timeLeft} TO SPARE</b>`);
    rows.push(`ENEMIES ELIMINATED &nbsp;<b>${stats.total ? stats.kills + "/" + stats.total : stats.kills}</b>`);
    rows.push(`ACCURACY &nbsp;<b>${stats.acc}%</b>`);
    const title = stats.title || 'Extraction <span class="hz">Complete</span>';
    this._overlay(`<div class="sub">Mission Accomplished</div><h1 class="mil-title">${title}</h1>
      <div class="stats">${rows.join("<br>")}</div>
      <button class="cta" id="again">▶ Redeploy</button>`);
    this.root.querySelector("#again").addEventListener("click", () => location.reload());
  }
  showLose(sub = "You were eliminated", title = 'K · <span class="hz">I</span> · A') {
    this._overlay(`<div class="sub">${sub}</div><h1 class="mil-title">${title}</h1>
      <button class="cta" id="again">▶ Redeploy</button>`);
    this.root.querySelector("#again").addEventListener("click", () => location.reload());
  }
  hideOverlay() { this._clearOverlay(); }

  // ---- live readouts ----
  setHealth(hp, max) {
    hp = Math.max(0, Math.round(hp));
    this.hpNum.textContent = hp;
    const pct = (hp / max) * 100;
    this.hpBar.style.width = pct + "%";
    this.hpBar.style.background = pct > 50 ? "var(--ok)" : pct > 25 ? "var(--hz)" : "var(--danger)";
  }
  rewindFx(on) { const el = this._rwEl || (this._rwEl = this.root.querySelector("#rewindfx")); if (el) el.style.opacity = on ? "1" : "0"; }
  setJetFuel(sec, max) {
    const el = this._jetEl || (this._jetEl = this.root.querySelector("#jetfuel")); if (!el) return;
    if (sec < max - 0.05) { el.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" style="vertical-align:-2px"><path fill="#ffd23a" d="M12 23a7 7 0 01-7-7c0-3 2-5 3-7 1 2 2 2 3 2-1-4 0-7 3-11 0 4 2 5 4 8 1 2 1 3 1 5a7 7 0 01-7 10z"/></svg> JETPACK ${sec.toFixed(1)}`; el.style.opacity = "1"; }
    else el.style.opacity = "0";
  }
  setArmor(armor, max) {
    if (!this.armNum) return;
    armor = Math.max(0, Math.round(armor));
    this.armNum.textContent = armor;
    if (this.armBar) { this.armBar.style.width = (armor / max) * 100 + "%"; this.armBar.style.background = "#3a9cff"; }
  }
  setAmmo(ammo, reserve, reloading) {
    const r = (reserve === null || reserve === undefined || reserve === "") ? "" : `<s> / ${reserve}</s>`;
    this.ammoCount.innerHTML = `<b>${reloading ? "––" : ammo}</b>${r}`;
    this.ammoEl.classList.toggle("low", !reloading && typeof ammo === "number" && ammo <= 6);
  }
  setHostiles(n) { this.hostiles.textContent = n; }
  setGrenades(n) { const e = this.root.querySelector("#ammo .nades"); if (e) e.textContent = `✦ GRENADES ${n}`; }
  setWeaponName(name) { const e = this.root.querySelector("#ammo .gun"); if (e) e.textContent = name; }
  showPrompt(html, dur = 4) { const el = this.root.querySelector("#prompt"); el.querySelector(".p").innerHTML = html; el.classList.add("on"); this._promptT = dur; }
  // Star-Wars-style perspective story crawl (used during the drop-pod descent)
  showCrawl(title, paragraphs, dur = 9500) {
    this.hideCrawl();
    const wrap = document.createElement("div");
    wrap.id = "crawl";
    wrap.style.cssText = "position:fixed;inset:0;z-index:60;overflow:hidden;pointer-events:none;perspective:380px;perspective-origin:50% 0%;";
    const fade = document.createElement("div"); // top fade so text dissolves into the sky
    fade.style.cssText = "position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(10,2,24,0.95) 0%,rgba(10,2,24,0) 42%);";
    const inner = document.createElement("div");
    inner.style.cssText = "position:absolute;top:100%;left:50%;width:62%;transform-origin:50% 0%;transform:translateX(-50%) rotateX(32deg);color:#ffd23a;font-weight:800;text-align:center;text-shadow:0 0 18px rgba(255,170,30,0.55);font-family:'Segoe UI',system-ui,sans-serif;line-height:1.5;";
    inner.innerHTML = `<div style="font-size:5.2vw;letter-spacing:0.14em;margin-bottom:0.6em;">${title}</div>`
      + paragraphs.map((p) => `<p style="font-size:2.5vw;margin:0 0 1.1em;">${p}</p>`).join("");
    wrap.appendChild(inner); wrap.appendChild(fade); document.body.appendChild(wrap);
    inner.animate(
      [
        { transform: "translateX(-50%) rotateX(32deg) translateY(0%)", opacity: 1 },
        { offset: 0.8, transform: "translateX(-50%) rotateX(32deg) translateY(-235%)", opacity: 1 },
        { transform: "translateX(-50%) rotateX(32deg) translateY(-320%)", opacity: 0 }, // fully scroll off + fade out
      ],
      { duration: dur, easing: "linear", fill: "forwards" },
    );
    // auto-remove once the crawl has run (belt-and-braces so nothing lingers on screen)
    this._crawlT = setTimeout(() => this.hideCrawl(), dur + 200);
    this._crawl = wrap;
  }
  hideCrawl() { if (this._crawlT) { clearTimeout(this._crawlT); this._crawlT = null; } if (this._crawl) { this._crawl.remove(); this._crawl = null; } }

  // ── VICTORY CINEMATIC pieces ──
  flashCut() { // a quick white flash-cut (the "big spaces" between rewound moments)
    const el = this._flashEl || (this._flashEl = (() => { const d = document.createElement("div"); d.style.cssText = "position:fixed;inset:0;z-index:70;background:#fff;opacity:0;pointer-events:none;"; this.root.appendChild(d); return d; })());
    el.style.transition = "none"; el.style.opacity = "0.9";
    requestAnimationFrame(() => { el.style.transition = "opacity .22s ease-out"; el.style.opacity = "0"; });
  }
  collapseToDot(dur = 1400) { // everything implodes to a single bright point of light on black
    const wrap = document.createElement("div"); wrap.id = "collapse";
    wrap.style.cssText = "position:fixed;inset:0;z-index:71;background:#000;opacity:0;pointer-events:none;display:flex;align-items:center;justify-content:center;";
    const dot = document.createElement("div");
    dot.style.cssText = "width:70vw;height:70vw;border-radius:50%;background:radial-gradient(circle,#dff1ff 0%,#7cc0ff 28%,rgba(80,150,255,0.25) 52%,transparent 70%);";
    wrap.appendChild(dot); this.root.appendChild(wrap); this._collapse = wrap;
    wrap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.55, fill: "forwards" });
    dot.animate([{ transform: "scale(1)", opacity: 0.95 }, { transform: "scale(0.015)", opacity: 1 }], { duration: dur, easing: "cubic-bezier(.65,0,.85,1)", fill: "forwards" });
  }
  // the closing Star-Wars crawl over a starfield; onDone fires when the crawl is most of the way up
  showEndCrawl(title, paragraphs, onDone, dur = 42000) { // slow scroll — comfortably readable
    if (this._collapse) { this._collapse.remove(); this._collapse = null; }
    const wrap = document.createElement("div"); wrap.id = "endcrawl";
    wrap.style.cssText = "position:fixed;inset:0;z-index:72;overflow:hidden;background:radial-gradient(ellipse at 50% 60%,#0b0826 0%,#04020c 70%);perspective:420px;perspective-origin:50% 0%;";
    let stars = ""; for (let i = 0; i < 180; i++) { const x = (Math.random() * 100).toFixed(2), y = (Math.random() * 100).toFixed(2), s = (Math.random() * 2 + 0.5).toFixed(1), o = (0.25 + Math.random() * 0.75).toFixed(2); stars += `<i style="position:absolute;left:${x}%;top:${y}%;width:${s}px;height:${s}px;background:#fff;border-radius:50%;opacity:${o};box-shadow:0 0 ${s * 2}px #cfe6ff;"></i>`; }
    const sky = document.createElement("div"); sky.style.cssText = "position:absolute;inset:0;"; sky.innerHTML = stars; wrap.appendChild(sky);
    sky.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1400, fill: "forwards" });
    const inner = document.createElement("div");
    inner.style.cssText = "position:absolute;top:100%;left:50%;width:66%;transform-origin:50% 0%;transform:translateX(-50%) rotateX(34deg);color:#ffd23a;font-weight:800;text-align:center;text-shadow:0 0 24px rgba(255,180,40,.6);font-family:'Segoe UI',system-ui,sans-serif;line-height:1.6;";
    inner.innerHTML = `<div style="font-size:5vw;letter-spacing:.16em;margin-bottom:.8em;">${title}</div>` + paragraphs.map((p) => `<p style="font-size:2.35vw;margin:0 0 1.25em;">${p}</p>`).join("");
    wrap.appendChild(inner); this.root.appendChild(wrap); this._endCrawl = wrap;
    const crawlAnim = inner.animate([{ transform: "translateX(-50%) rotateX(34deg) translateY(0%)", opacity: 1 }, { offset: 0.92, transform: "translateX(-50%) rotateX(34deg) translateY(-330%)", opacity: 1 }, { transform: "translateX(-50%) rotateX(34deg) translateY(-380%)", opacity: 0 }], { duration: dur, easing: "linear", fill: "forwards" });
    if (onDone) crawlAnim.finished.then(onDone).catch(() => {}); // reveal the REDEPLOY card only AFTER the crawl text animation has fully finished (clean starfield)
  }
  showEndButton(line = "The Arc-bearer's name passes into legend") {
    // CENTERED end card: a soft radial glow blooms in, the line + button rise and scale into place, the button breathes
    const w = document.createElement("div"); w.style.cssText = "position:fixed;inset:0;z-index:73;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;";
    const glow = document.createElement("div");
    glow.style.cssText = "position:absolute;left:50%;top:50%;width:60vw;height:60vw;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(120,200,255,.16) 0%,transparent 60%);opacity:0;";
    w.appendChild(glow);
    w.insertAdjacentHTML("beforeend",
      `<div class="el" style="position:relative;color:#cdf3ff;font-weight:800;letter-spacing:.32em;text-align:center;margin-bottom:1.7em;text-shadow:0 0 26px rgba(120,220,255,.95);font-size:1.7vw;opacity:0;">${line}</div>`
      + `<button id="enddeploy" class="el" style="position:relative;pointer-events:auto;opacity:0;background:#ffd23a;color:#1a1206;border:none;padding:.78em 1.8em;font-weight:900;letter-spacing:.16em;font-size:1.28vw;cursor:pointer;border-radius:4px;box-shadow:0 0 22px rgba(255,210,60,.5);">▶ REDEPLOY</button>`);
    this.root.appendChild(w);
    glow.animate([{ opacity: 0, transform: "translate(-50%,-50%) scale(.6)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }], { duration: 1600, easing: "ease-out", fill: "forwards" });
    w.querySelectorAll(".el").forEach((e, i) => e.animate(
      [{ opacity: 0, transform: "scale(.9) translateY(16px)" }, { opacity: 1, transform: "scale(1) translateY(0)" }],
      { duration: 950, delay: 250 + i * 380, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" }));
    const btn = w.querySelector("#enddeploy");
    btn.animate([{ boxShadow: "0 0 16px rgba(255,210,60,.4)" }, { boxShadow: "0 0 36px rgba(255,210,60,.95)" }, { boxShadow: "0 0 16px rgba(255,210,60,.4)" }], { duration: 2000, iterations: Infinity, delay: 1100 });
    btn.addEventListener("click", () => location.reload());
  }
  // clean centered XIII-style banner (map-section entry etc.): bold text on a gold rule, sweeps in + fades
  showBanner(title, sub = "", dur = 2600) {
    this.hideBanner();
    const el = document.createElement("div");
    el.id = "xbanner";
    el.style.cssText = "position:fixed;top:22%;left:0;right:0;z-index:55;text-align:center;pointer-events:none;font-family:'Segoe UI',system-ui,sans-serif;";
    el.innerHTML = `<div style="font-weight:800;letter-spacing:0.2em;font-size:2.5vw;color:#ffd23a;text-shadow:0 2px 16px rgba(0,0,0,0.8);">${title}</div>`
      + (sub ? `<div style="margin-top:0.45em;font-weight:700;letter-spacing:0.16em;font-size:1.3vw;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,0.8);">${sub}</div>` : "");
    document.body.appendChild(el); this._banner = el;
    el.animate([{ opacity: 0, transform: "translateY(-14px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 380, easing: "ease-out", fill: "forwards" });
    this._bannerT = setTimeout(() => { if (this._banner === el) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, fill: "forwards" }).finished.then(() => el.remove()).catch(() => {}); }, dur);
  }
  hideBanner() { if (this._banner) { this._banner.remove(); this._banner = null; } if (this._bannerT) clearTimeout(this._bannerT); }
  // generic top-left counter (e.g. "Hostiles" remaining, or "Eliminated" kill count)
  setCounter(label, value) { this.root.querySelector("#hostiles .lbl").textContent = label; this.hostiles.textContent = value; }
  setClock(sec) {
    const el = this._clockEl || (this._clockEl = this.root.querySelector("#clock")); if (!el) return;
    sec = Math.max(0, sec); const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    el.querySelector("b").textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
    el.classList.toggle("low", sec <= 60);
  }
  setObjective(html) { const o = this.root.querySelector("#objective .obj"); if (o) o.innerHTML = html; }
  setArcArrow(rad) { // rotate the yellow arrow toward the nearest arc; pass null to hide
    const el = this._arcEl || (this._arcEl = this.root.querySelector("#arcarrow")); if (!el) return;
    if (rad === null || rad === undefined) { el.style.opacity = "0"; return; }
    el.style.opacity = "1"; el.style.transform = `translateY(-50%) rotate(${rad}rad)`;
  }
  setOperation(name) { const o = this.root.querySelector("#mission .op"); if (o) o.textContent = name; }
  // top-left minimap: a PLAYER-CENTRED radar (only ~range metres around you, so it's not crowded) —
  // the player sits at the centre (facing arrow), with nearby enemy dots (red) and Arc dots (gold).
  drawMinimap({ px, pz, yaw, range = 50, enemies = [], arcs = [], terrain = null, sea = 0 }) {
    const cv = this._mini || (this._mini = this.root.querySelector("#minimap")); if (!cv) return;
    const x = this._miniCtx || (this._miniCtx = cv.getContext("2d")), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2;
    const rad = W * 0.47, sc = (rad - 3) / range; // pixels per world metre
    x.clearRect(0, 0, W, H);
    x.save(); x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.clip();
    x.fillStyle = "rgba(20,12,32,0.6)"; x.fillRect(0, 0, W, H);
    // greenish terrain shading by elevation (water → beach → grass → mountain)
    if (terrain) {
      const N = 13, cell = (rad * 2) / N;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const sx = cx - rad + (i + 0.5) * cell, sy = cy - rad + (j + 0.5) * cell;
        if ((sx - cx) ** 2 + (sy - cy) ** 2 > rad * rad) continue;
        const h = terrain(px + (sx - cx) / sc, pz + (sy - cy) / sc);
        let col;
        if (h < sea) col = "#2a93b4";                                   // turquoise sea (matches the water)
        else if (h < 1.2) col = "#e6d6a4";                              // sandy beach
        else if (h > 16) col = "#847d70";                               // rocky mountain
        else { const tt = Math.min(1, (h - 1.2) / 14); col = `rgb(${198 - (tt * 55) | 0},${110 - (tt * 2) | 0},${42 - (tt * 20) | 0})`; } // orange grass → dark-yellow higher (matches the island)
        x.fillStyle = col; x.fillRect(sx - cell / 2 - 0.5, sy - cell / 2 - 0.5, cell + 1, cell + 1);
      }
    }
    const dot = (wx, wz, col, r) => { const dx = (wx - px) * sc, dy = (wz - pz) * sc; if (dx * dx + dy * dy > (rad - 2) * (rad - 2)) return; x.fillStyle = col; x.beginPath(); x.arc(cx + dx, cy + dy, r, 0, 7); x.fill(); };
    for (const a of arcs) if (!a.taken) dot(a.x, a.z, "#ffd23a", 2.6);
    for (const e of enemies) if (!e.dead) dot(e.pos.x, e.pos.z, e.boss ? "#ff8a2a" : "#ff3b30", e.boss ? 4.5 : 3);
    x.restore();
    x.strokeStyle = "rgba(130,110,160,0.5)"; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.stroke(); // range ring
    // player facing-arrow, fixed at the centre
    x.save(); x.translate(cx, cy); x.rotate(yaw); x.fillStyle = "#ffffff";
    x.beginPath(); x.moveTo(0, -6); x.lineTo(4, 5); x.lineTo(0, 2); x.lineTo(-4, 5); x.closePath(); x.fill(); x.restore();
  }

  // ---- bomb objective ----
  showTimer(v) { this.root.querySelector("#timer").classList.toggle("hidden", !v); }
  setMissionTimer(sec) {
    sec = Math.max(0, sec);
    const el = this.root.querySelector("#timer");
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    el.querySelector(".t").textContent = m + ":" + String(s).padStart(2, "0");
    el.classList.toggle("danger", sec <= 30);
  }
  showDefuse(len = 3) { this._defLen = len; this.root.querySelector("#defuse").classList.remove("hidden"); this.updateDefuse("", ""); }
  updateDefuse(typed, feedback) {
    const d = this.root.querySelector("#defuse"); const len = this._defLen || 3;
    let s = ""; for (let i = 0; i < len; i++) s += (i < typed.length ? typed[i] : "_") + (i < len - 1 ? " " : "");
    d.querySelector(".code").textContent = s;
    d.querySelector(".fb").innerHTML = feedback || "";
  }
  hideDefuse() { this.root.querySelector("#defuse").classList.add("hidden"); }

  showLoading(bgStyle) {
    const o = this._overlay(`<div style="position:relative;z-index:2;text-align:center"><div class="sub">Preparing deployment</div><h1 class="mil-title">Loading<span class="hz">…</span></h1>
      <div class="sub" id="loadpct">0%</div></div>`);
    // a themed backdrop behind the text (per-level), with a slow cinematic push-in + a dark vignette so the text reads
    const bg = document.createElement("div");
    bg.style.cssText = `position:absolute;inset:0;z-index:0;background:${bgStyle || "#0c0a16 url('/loading.jpg') center/cover no-repeat"};`;
    const veil = document.createElement("div");
    veil.style.cssText = "position:absolute;inset:0;z-index:1;background:radial-gradient(ellipse at 50% 42%,rgba(6,4,16,.30),rgba(6,4,16,.90));";
    o.insertBefore(veil, o.firstChild); o.insertBefore(bg, o.firstChild);
    bg.animate([{ transform: "scale(1.14)" }, { transform: "scale(1)" }], { duration: 16000, easing: "ease-out", fill: "forwards" });
  }
  setLoadingProgress(done, total) {
    const el = this.root.querySelector("#loadpct");
    if (el) el.textContent = Math.round((done / total) * 100) + "%";
  }

  hitmarker(killed) {
    this.hitmark.style.opacity = "1";
    this.hitmark.querySelectorAll("span").forEach((s) => s.style.background = killed ? "var(--danger)" : "#fff");
    this._hitT = 0.18;
    const g = 7;
    const m = this.hitmark.querySelectorAll("span");
    m[0].style.cssText = `transform:translate(-${g}px,-${g}px) rotate(45deg)`;
    m[1].style.cssText = `transform:translate(${g}px,-${g}px) rotate(-45deg)`;
    m[2].style.cssText = `transform:translate(-${g}px,${g}px) rotate(-45deg)`;
    m[3].style.cssText = `transform:translate(${g}px,${g}px) rotate(45deg)`;
    this.hitmark.querySelectorAll("span").forEach((s) => { s.style.position = "absolute"; s.style.width = "2px"; s.style.height = "10px"; });
  }
  killFeed(text) {
    const d = document.createElement("div"); d.className = "k"; d.textContent = "✖ " + text;
    this.feed.appendChild(d);
    setTimeout(() => d.remove(), 3000);
  }
  // positive notification (e.g. ammo pickup) — green accent, no ✖
  notify(text) {
    const d = document.createElement("div"); d.className = "k"; d.textContent = "✚ " + text;
    d.style.borderRightColor = "var(--ok)";
    this.feed.appendChild(d);
    setTimeout(() => d.remove(), 2500);
  }
  damageFlash() { this._dmgT = 0.5; this._shake = Math.max(this._shake, 6); }
  bloom() { this._bloom = Math.min(this._bloom + 4, 14); this._shake = Math.max(this._shake, 2.5); }

  update(dt) {
    // crosshair bloom
    this._bloom += (0 - this._bloom) * Math.min(1, dt * 10);
    const g = 5 + this._bloom;
    this.xhair.querySelector(".t-u").style.transform = `translateY(-${g + 9}px)`;
    this.xhair.querySelector(".t-d").style.transform = `translateY(${g}px)`;
    this.xhair.querySelector(".t-l").style.transform = `translateX(-${g + 9}px)`;
    this.xhair.querySelector(".t-r").style.transform = `translateX(${g}px)`;
    // hitmarker fade
    if (this._hitT > 0) { this._hitT -= dt; this.hitmark.style.opacity = Math.max(0, this._hitT / 0.18); }
    // action prompt timeout
    if (this._promptT > 0) { this._promptT -= dt; if (this._promptT <= 0) this.root.querySelector("#prompt").classList.remove("on"); }
    // damage vignette
    if (this._dmgT > 0) { this._dmgT -= dt; this.dmg.style.opacity = Math.max(0, this._dmgT / 0.5); }
    // screen shake
    if (this._shake > 0.05) {
      this._shake *= Math.pow(0.001, dt);
      const sx = (Math.random() - 0.5) * this._shake, sy = (Math.random() - 0.5) * this._shake;
      this.app.style.transform = `translate(${sx}px,${sy}px)`;
    } else { this.app.style.transform = ""; }
  }
}
