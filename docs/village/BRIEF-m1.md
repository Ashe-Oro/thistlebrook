# Living Village — Milestone 1 implementation (ambitious 2-day build)

Work only in `/workspace/cel-town`. Do not buy anything, do not git push, do not deploy, do not commit. Do not copy licensed GLBs anywhere except `public/licensed/` (already gitignored). No API keys. Do not touch `/workspace/tailgate-games`, Thistlebrook, Agent Pixel, Crayon, or any RTX 4090 / Windows machine (nvidia-smi is not available on this box). You may `npm install` / add a devDependency (e.g. esbuild is already present via Vite) if needed for the character generator. You may run `npm run catalog:bounds`, `node tools/inspect-glb.mjs`, compile (`node tools/compile.mjs`), `npm run test:checks`, `npm run test:parity`, `npm run build`, and any new village shot script you add.

When finished, write a short report to `out/codex-village-m1-report.md`.

## Context — pick the base, do not start over

The latest and best base for this work is the **compiled large cozy town**:

- Play URL today: `/?size=large&seed=1234` (also `/compile.html?size=large&seed=1234`).
- `specs/large.json` already produces ~20 houses + 7 civic buildings around a plaza, with a connected street graph (green-approach, south-lane, west-lane, upper-street, orchard-street, market-street, farm-track), door paths, gates, market stalls, streetlamps, benches, a farm, and a windmill.
- Civic IDs already placed on this seed's layout: `cv-bakery`, `cv-tavern` (the inn), `cv-chapel`, `cv-store`, `cv-blacksmith`, `cv-market-hall`, `cv-windmill`. Houses are Cozy Village dwellings. Streetlamps are `cv-streetlamp`.
- Look: `MeshToonMaterial` + 3-step ramp + inverted-hull outlines via `src/toon.js`. Post chain in `src/post/`. Keep it.

There is also a later **Edo neighborhood** (`?district=edo`) with 12 Japanese villagers (idle weight-shift only, no schedules) and night lantern fixtures used by an external render script. Edo is an attached optional district, not the M1 village. Keep it working. Do not spawn samurai / miko / ronin into the cozy town.

**Reuse, don't rebuild:** street graph in `src/compiler/districts.js`, compiler/runtime, catalog + loader, toon/post/stage hooks, the owned Character Model Basic + Wardrobe pipeline in `tools/generate-edo-villagers.mjs` (bake dressed GLBs into `public/licensed/characters/`), and shot tooling in `tools/shots.mjs` / `tools/shots-large.mjs` (Playwright + Vite preview + system Chrome / SwiftShader).

node_modules is already installed. Chrome is at `/usr/bin/google-chrome`. ffmpeg is on PATH.

## Hard non-regression rules

- Default hamlet (`/`) and default large compile **without** the new life/play flag must stay behavior-compatible. Compiled JSON for large/hamlet seeds 1, 1234, and 7 with life **off** must stay **byte-identical**.
- Keep `window.__stage`, `__town`, `__post`, `__scene`, `__THREE`, `__renderer`, `__ready`, `?prmax`, `?shadowMap`, `?cam=`, `?target=`. Do not "simplify" these.
- `npm run test:checks` and `npm run test:parity` must pass. Do not weaken existing checks.
- The existing `edo-villagers` check currently implies "when edo is off, zero villagers". Update it carefully so it constrains **Edo** villagers only (`edo-villager-*`): edo on → exactly those 12; edo off → zero `edo-villager-*`. Cozy townsfolk are a separate id prefix and only appear when the life flag is on.
- Villagers/townsfolk stay `kind: 'villager'`, are excluded from instancing, are not added to `CORE_KINDS`, and must not intersect building footprints or sit inside walls. They may stand on walks.
- Licensed assets stay under `public/licensed/` (gitignored). Do not vendor the character-engine TypeScript into tracked `src/` if you can generate GLBs the same way `tools/generate-edo-villagers.mjs` does.
- Fog, camera fit, and hooks for default hamlet / default large (no life, no edo) stay unchanged.

## First: write the 2-day plan

Create `/workspace/cel-town/docs/village/PLAN.md`. This is an ambitious high-throughput build through tonight (Mon Nov 16), not a minimal demo. Codex quota resets ~8:30 PM ET, so the plan should keep coding work dense until then.

Map **4–5 milestones**. Be concrete (files, URL, what "done" looks like, what screenshots prove). Suggested shape — refine, don't inflate with fluff:

1. **M1 — Living village foundation (this run).** Playable large town with walk camera, day/night + lit windows/lamps, 12+ townsfolk on home/work/plaza/home schedules following roads. Solid enough to show Ashe.
2. **M2 — Richer lives.** Greetings, chatting in pairs, shopping at stalls, eating at the inn, kids playing; more schedule variety; NPC awareness of each other; names/roles readable.
3. **M3 — Interiors & props.** Open doors, enter bakery / inn / store / smithy (simple but handsome toon interiors), shop counters, use market stalls, lanterns you can light, door triggers.
4. **M4 — Visual polish + playtest.** Street-level toon look, night atmosphere, camera collision, locomotion (walk bob or cycle), lighting bugs, floating/clipping fixes. Codex review, fix P0/P1, screenshot pass.
5. **M5 — Evening lock + optional Edo walk.** Combined life+edo walk into the Japanese district, leftover polish, final shots/video, README. Stop rather than start a new system after ~8 PM ET.

Each milestone: goal, in-scope / out-of-scope, key files, how to run, proof (shots), risks. M1 is in scope for this run. M2–M5 are plan-only in this run (do not implement them now).

## Then: implement Milestone 1

### Playable entry

Add a **life/play mode** gated by query flag `life=1` (also accept `village=1` as an alias). Main play URL:

```
/?size=large&seed=1234&life=1
```

When `life=1` is set, `size` defaults to `large` if omitted, so `/?life=1&seed=1234` also works. compile.html should honor the same flags so debugging stays possible.

HUD (short, gamer-style, not wordy): town name, analog/digital clock or "2:40 PM", day/night hint, controls (`WASD` move, mouse look, `Tab` or `M` overview, `F` or scroll cycle time? — pick one and document it). Keep the existing Look panel.

Headless hooks (required for shots/video after you exit):

- `window.__life = { hour, setHour(h), timescale, setTimescale(s), mode }` where `hour` is `[0, 24)`, `mode` is `'walk' | 'overview'`.
- `?hour=14` / `?hour=21.5` starts at that time and may pause time (`timescale=0`) unless `?timescale=` is also set.
- `?timescale=60` runs the clock 60× (a full day in 24s) so a 15s video can show motion and a time shift.
- `?view=overview` (default for still overviews) or `?view=walk` with optional `?cam=` / `?target=` still honored.
- `__ready` still flips after the first presented frame of the built town + people.

### 1. Walkable camera

Third-person preferred (so the toon town and a simple player figure are visible). WASD + mouse look. Hold a key or use Tab/`M` to toggle the existing orbit **overview**. Pointer-lock on click in walk mode; Escape releases and may stay in walk with unlocked mouse, or return to overview — pick something that feels good and document it.

- Stay on the ground plane. Simple collision against building / landmark / fence / gate footprints so the player does not walk through walls. Walking on roads and grass is fine.
- Do not clip the camera underground. A short spring-arm that pulls in when it hits a wall is welcome but not mandatory if a high-ish third-person angle already stays clear.
- Optional: a simple toon player figure (reuse the townsfolk pipeline or a compact capsule + toon material). If you add a player mesh, keep it on-brand.
- Overview mode keeps OrbitControls (current behavior) and frames the town as today.

### 2. Day / night cycle

A continuous 24h clock that drives lighting:

- Sun direction and color (warm noon, amber golden hour, cool moonlight).
- Sky / fog / hemisphere + ambient intensities and colors. Night must still be readable, not a black soup — moon + residual fill, plus lamps.
- **Lit windows at night.** Add warm emissive window glow on houses and civic buildings as night falls (procedural window quads aligned to facades are fine if the imported meshes have no isolated window materials; do not texture-map `style-ref.jpg`). Glow intensity ramps with sun elevation, fully on after dusk, off after dawn.
- **Streetlamps light up at night.** `cv-streetlamp` instances already line the streets. Put a warm point light on each (modest range/intensity so we don't kill perf or blow out the toon bands). Lights are tied to real lamp meshes, never bare orbs in mid-air.
- Sky/cloud colors should shift. Don't rewrite the post stack unless a small grade tweak at night clearly helps; keep `?post=0` working.

### 3. 12+ cozy townsfolk with daily schedules and path following

Create a new cozy population (not the Edo roster). About 12 distinct people, readable at a glance, dressed from the owned Character Model Basic + Wardrobe (recolors + existing items: tunic, vest, apron, robe, straw-hat, breeches, sandals, satchel, etc.). Procedural props only where the pack is missing something (baker's tray, hammer, broom, basket). Western / cozy village look — no katana, no miko hakama.

Suggested roles (adapt as needed, keep them distinct): baker, blacksmith, innkeeper, shopkeeper, stall merchant, miller or farmer, shepherd or farmhand, carpenter or labourer, child, elder, chapel keeper or herbalist, night watch or lamplighter. Ids like `townsfolk-baker`, catalog names are display names.

Placement and schedules are **seeded** and compiled when `life=1` (and `size=large` / large spec). Attach each person to:

- a **home** (a residential house door / front path snap),
- a **workplace** (bakery, smithy, market stall or hall, inn, store, windmill/farm, chapel — spread them),
- a **plaza / wander** set (well, benches, market street).

Schedule (24h game time, with per-person seeded offsets so they don't all move at once), something in this spirit:

- night / early morning: at home (idle by the door or in the front yard — interiors come in M3, do not fake being inside a closed mesh)
- morning: walk to work along the **street graph + door paths**
- work hours: idle / small work-loop at the workplace (baker at bakery door/front, smith at blacksmith, merchant at a stall, etc.)
- late afternoon: plaza, well, or a wander along a street
- evening: walk home
- night: home again

**Path following is required.** Build a walkable graph from compiled street segments (`streetId`, endpoints via existing path strips in `districts.js`) plus door paths that join buildings to those streets. NPCs pathfind (simple waypoint / BFS / A* on the graph) and follow the centerline with a little lateral offset so two people can pass. Face the direction of travel. A grounded walk bob / weight shift is enough — no skeletal walk cycle required in M1. They must **visibly translate** along roads, not just sway in place.

They must not walk through buildings, fences, or gates (stay on the walk graph; gates are on front paths — prefer the street and the door-path strip, and treat a closed-looking gate as passable for M1 if the lot is entered via the path). If a destination is unreachable, snap them to the nearest node and log once, don't throw.

Add a hard check `life-townsfolk` (only when life is on): at least 10 (prefer 12) distinct `townsfolk-*` villagers, each with a home, a workplace, and a schedule; all on the walk graph; none intersecting architecture. Prove it with a negative in `tools/check-negatives.mjs`. When life is off, zero `townsfolk-*`. Existing edo checks stay green.

Runtime animator goes in (or next to) `src/compiler/villager-runtime.js` and must run on the **main page** in life mode, not only on compile.html. Edo idle animator stays working for `?district=edo` without life.

### 4. Shot / video script

Add `tools/shots-village-m1.mjs` that:

- `npm run build` is a prerequisite (document it); the script starts `vite preview` like `tools/shots-large.mjs`, launches Chrome the same way (SwiftShader flags, `/usr/bin/google-chrome`).
- Writes into `/workspace/cel-town/shots/village-m1/` (create the dir).
- Captures at least:
  1. `day-overview.png` — high overview, mid-morning or noon (`hour≈11`)
  2. `street-level.png` — walk/street camera on a road with buildings and at least one NPC in frame
  3. `market-day.png` — market street / stalls, NPCs at work
  4. `golden-hour.png` — late afternoon light
  5. `night-windows.png` — night overview or street, **windows and streetlamps clearly lit**
  6. `npcs-work.png` — closer shot of 2+ townsfolk at workplaces
- Also writes a **10–20s mp4** `village-life.mp4`: one Playwright page, `timescale` high enough that NPCs walk and the clock advances (day toward dusk or dusk toward night is ideal). Capture frames (e.g. 10–15 fps for 12–18s) and stitch with ffmpeg (`-pix_fmt yuv420p`, reasonably compressed, 1280 or 1600 wide). Hold a cinematic camera (overview slowly orbiting, or a street-level view that sees walkers). The video must show **people moving** and **time/lighting changing**.

You do not have to personally inspect the PNGs for beauty, but the script must actually produce them and exit 0. If a shot never reaches `__ready`, save a `-failed.png` and fail.

Optional npm script: `"shots:village-m1": "node tools/shots-village-m1.mjs"`.

### 5. README

Update `README.md` with a short "Living village (playable)" section: the play URL, controls, time-of-day flags, and the shot command. Keep existing sections accurate. Mention that licensed packs stay private.

## Implementation notes

- Prefer a few clear new modules (`src/life/camera.js`, `src/life/daynight.js`, `src/life/graph.js`, `src/life/schedules.js`, townsfolk catalog + generator) over dumping everything into `main.js` / `districts.js`.
- `spawnVillagers` for Edo stays edo-only. Add a sibling spawn for townsfolk that runs when life is on, after dressing, with the same obstruction helper (or a shared one).
- Do not change plaza slot order, RNG draws, or district placement when life is off. If life-on compile needs extra RNG, derive a separate stream (`deriveSeed`) so the building layout of seed 1234 stays identical to life-off.
- If generating 12 new GLBs is slow, that's fine; don't block the rest of the system on it. Placeholders that are obviously boxes are not acceptable in the final M1 scene — people must look like dressed toon villagers.
- Keep performance reasonable on SwiftShader (instancing stays for trees/props; don't add 50 un-attenuated point lights at full shadow). Lamp lights: no shadow maps, limited count, modest distance.

## Done means

- `docs/village/PLAN.md` written (4–5 milestones through tonight).
- `/?size=large&seed=1234&life=1` is a walkable, day/night, populated medium village on the existing large-town layout.
- 12+ distinct townsfolk visibly walk the roads on schedules.
- Windows and streetlamps light at night.
- Existing tests green; life-off JSON unchanged; Edo still works.
- Shot script exists and you have run `npm run build`. If time remains, run the shot script once and fix any crash. If the environment cannot open a browser, leave the script ready and say so in the report.
- Report at `out/codex-village-m1-report.md`: what landed, how to run, known issues, leftover for M2.

Implement M1 fully. Do not start M2–M5 in this run.
