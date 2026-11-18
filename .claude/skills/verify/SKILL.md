---
name: verify
description: How to run nooi.ai locally and drive it as a customer and as the owner to verify a change at runtime.
---
# Verifying a change in the running site

**Launch** (no keys needed): make a temp folder with `data/` and `media/`, symlink `public`, `node_modules`, `lib`,
`providers` into it, copy `package.json`, then from that folder run
`PORT=8801 SECRET_KEY=<40 chars> FIREBASE_PROJECT_ID= FREE_PERIOD=false NV_AUTOCHECK=false ADMIN_EMAILS=boss@dev.local node <repo>/server.js`.
Strip real provider keys from the environment first. Wait for `/v1/health`.

**Who you are**: header `X-Dev-User: boss` is the owner (staff); any other name is a customer (`dev_<name>` in `data/db.json`,
seed credits there). In the page, sign in with
`S.langAsked=true;S.lang='en';S.user={name:'T',method:'google'};AU.showAuth=false;renderAll()`.

**Drive it** with Python Playwright (already installed; never run `playwright install`). Click the real side menu
(`#sb253 [data-go="<view>"]`) rather than calling `go()`, so navigation itself is exercised. One browser at a time.

**Video engine stand-in**: set `SEEDANCE_API_KEY` and `SEEDANCE_BASE_URL=http://127.0.0.1:<port>/api/v3`; answer
`POST /contents/generations/tasks` with `{id}` and `GET …/tasks/<id>` with `{status:"succeeded",content:{video_url}}`.
Serve a VP9 WebM (the test browser has no H.264). Record the request bodies: they are the evidence of what was sent.

**Gotchas**
- No picture engine is stood in, so anything that first makes a character's look stops with "provider unavailable" (refunded).
- `setUILang('ar')` opens the dialect sheet; clear `#modalRoot` before clicking.
- The genre chip on Templates is remembered; press "All" before looking for a shot of another genre.
- Log every HTTP response ≥ 400 per session; a customer session should show none on `/v1/admin/`.
- Clean up: `pkill -f "[n]ode <repo>/server.js"` and remove the temp folder.
