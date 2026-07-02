---
name: ship-changes
description: Use to build, validate, commit, and deploy a change to production (Railway). Covers the lint+build gate, the commit author convention, deploying the static dist behind server.js, and confirming the new build is actually live. Invoke after verifying a change in-browser.
---

# Ship a change

The validate → commit → deploy loop for this kit. Verify gameplay first (see `verify-in-browser`).

## 1. Validate (both must pass)

```bash
npm run lint     # must print 0 problems — also enforces the engine/kit/game import boundary
npm run build    # must end "✓ built"  (a dropped brace shows as a Vite "invalid JS syntax" error at file:line)
```

## 2. Commit

The reference project commits as a specific author (no CI footer):

```bash
git -c user.email=anihamail@gmail.com -c user.name=XiRoSe commit -q -m "<concise what + why>"
```

Keep the engine/kit/game boundary intact in every change. Don't commit working artifacts — `shots/`,
`.gpframes/`, `stats.json`, `*.log` are gitignored. Only commit **CC0/royalty-free** assets.

## 3. Deploy (Railway — static `dist/` behind `server.js`)

```bash
git push origin master
railway up --detach --service CS_WEB_DEMO
```

`server.js` is a tiny zero-dependency static server (also hosts the `/crm` analytics dashboard + `/api/track`).
Persistent data (CRM stats) lives on a Railway volume at `/data` so it survives redeploys.

## 4. Confirm it's actually live

The JS bundle filename is content-hashed, so poll the live page until it serves the new hash:

```bash
TARGET=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' dist/index.html | head -1)
# loop curl https://genie-web-game-engine.up.railway.app/?t=$i until it returns $TARGET, then report "live"
```

For a **server.js-only** change (no client bundle change) the hash won't move — instead poll for a marker
the new server emits (e.g. a new route/element in the response).

Live URLs: ARCFALL `…/?level=arcfall`, NightOps `…/?level=desert-base`, CRM `…/crm`.

## Notes

- This shell is Git Bash on Windows. `curl` POST can fail with libcurl "bad argument" (exit 43) — that's a
  client quirk, not a server failure; verify POST endpoints with a browser `fetch` via Playwright instead.
- Run an interactive login (e.g. `railway login`) yourself with the `!` prefix if the CLI needs auth.
