# Thistlebrook — Design & Graphics Critique (Round 2)

**Verdict:** Round 1's worst wounds are healed — the studio-lit portrait pipeline makes the card, Gazette, gallery and relationship web all read cleanly (`09`,`10`,`14`,`16`), the campfire point-light turns night into the signature shot it always wanted to be (`07`), and bubbles, mobile layout, festival-weather and the leaderboard baseline are all fixed. What's left is a performance problem and an ambition problem: the renderer still leans on a per-frame shadow pass, an inverted-hull character outline and frustum-culling-disabled skinned meshes that together eat most of the GPU, and the *presentation* of drama is still ambient — the sim generates real arcs but the camera never cuts, stages or punches in on them, so a brawl (`20`) reads as two people standing close and the storyteller (`18`) is framed as the back of a market stall. Fix the three rendering costs to buy headroom, spend that headroom on more villagers + a cinematic "beat" camera, and this goes from "lovely toy" to "I can't stop watching."

---

## Performance plan
Ranked by expected gain. Headless numbers are SwiftShader CPU-raster (`verify-report.json`: 27→20 fps; profiling: freeze shadow 2.8→4.4, hide the 8 villagers 4.8→7.6, half-res+no-UI ~15). On a real laptop GPU these ratios hold even if absolute fps is higher; the three dominant costs are **shadows, character outline, and fill-rate**.

1. **Decouple + throttle the shadow map — biggest measured win (2.8→4.4, ≈ +57%).** `renderer.shadowMap` is on with `PCFSoftShadowMap` (`main.ts:24`) and `autoUpdate` left at its default `true`, while the sun is *re-aimed every frame* to follow the camera focus (`sky.ts:43`). So the full shadow pass over every caster runs 60×/s for no visual benefit when the camera is still. Snap the sun target to a grid exactly like the rain volume already does (`fx.ts:104`), set `renderer.shadowMap.autoUpdate = false`, and flip `renderer.shadowMap.needsUpdate = true` only when the snapped focus cell or the hour-bucket changes. Also shrink the shadow frustum from 120×90 (`sky.ts:19`) to ~70×50 and the map from 2048/1024 to 1536/768 (`sky.ts:18`) — tighter frustum *and* fewer updates means crisper shadows for less. **Expect +40–60%.**

2. **Drop or cheapen the inverted-hull outline (hiding villagers = 4.8→7.6; the outline is ~half of that).** Each dressed character ships a `CharacterOutline` child (`main.ts:74`) — a second inverted-hull pass that roughly doubles the ~11k-tri character to ~22k, ×8 ≈ 90k of the scene's 240–340k triangles. Hide `CharacterOutline` on mobile and above a camera-distance / below-fps threshold (the toggle hook already exists at `main.ts:74`). To keep the look at close range, gate it to the *followed/selected* villager only. **Expect to recover ~1.5–2× the character cost in wide shots.**

3. **Re-enable frustum culling on avatars.** `avatar.ts:31` sets `m.frustumCulled = false` on every character mesh, so all 8 villagers **and** their outlines are submitted even when off-screen — which is most of them in director/close free-cam. Give each skinned mesh (or `root`) a generous manual `boundingSphere` and restore culling. In zoomed views this culls 3–6 of 8 characters; compounds with #2. **Expect large in the default director/close cam.**

4. **Adaptive resolution — the single biggest lever for "60 on a laptop / acceptable mobile."** Pixel ratio is `min(dpr, 1.75)` desktop / `1.25` mobile (`main.ts:23`); profiling shows half-res ≈ doubled fps. Add a dynamic `setPixelRatio` that eases toward 1.0 when `fpsAvg < 50` and back up when `> 58` (you already track `fpsAvg`, `main.ts:135`), and force `antialias:false` while scaled. Fill-bound work scales almost linearly. **Expect large on laptops and phones.**

5. **Instance/merge repeated static props to cut draw calls (170–270 now).** `town.ts` reuses `home_cottage_01` ×3, `market_stall_01` ×2, `streetlamp_01` ×6, `rail_fence` ×10+, `log_bench` ×4, barrels/crates — each a separate draw, even though `loader.ts:13` already dedupes materials into `sharedMat`. The border-plant batcher (`world.ts:61–79`) is the exact pattern; extend it to in-town repeated lots sharing geometry+material. **Expect −60–120 draw calls (CPU/mobile win).**

6. **Stop the 8× full-scene render spike when opening Villagers / Relationships.** `portrait()` renders the *entire town with shadows* into a canvas corner (`main.ts:64–78`); the gallery and web views call it for all 8 villagers back-to-back in one task (`ui.ts:201`, `ui.ts:204`), so opening either view does 8 full-scene renders synchronously → a visible hitch. Render portraits against a stripped scene (hide world/shadows for the portrait pass) or stagger the 8 across frames. **Expect to kill a frame stall on every view-open.**

7. **Prune shadow casters.** `loader.ts:14` marks *every* mesh `castShadow = true`. Barrels, fences, flower beds, hay don't need to cast. Flag only buildings, trees, well/windmill and characters as casters so the shadow pass (which #1 still pays on update) is cheaper. **Small, free.**

---

## Top 12 wow / gameplay suggestions
Ranked by impact ÷ effort. No economy anywhere.

### 1. A cinematic "beat" camera that cuts, frames and holds on drama — **S–M**
The director just lazily eases toward a followed villager and auto-rotates (`main.ts:143–147`), even though it already *scores and finds* the hottest recent event (`director.ts:48–49`). Add `cinematicCut()`: when an `imp ≥ 7` event fires (fight, confession, theft reveal, breakup, accusation), snap to a framed 2–3s shot — close, slight low angle, yaw biased toward the subject's facing/action — drop CSS letterbox bars + the existing caption, ease a small push-in, then release to ambient. Evidence: `18`/`20` are framed blandly despite the machinery existing. Highest WOW-per-hour change in the project: it converts "ambient terrarium" into "directed soap opera."

### 2. Bigger Smallville: 12–14 villagers + a 4th district — **M** (do *after* perf #2–#4)
The data is fully parameterised — `villagers.ts:1` literally says "the sim scales to N," and `town.ts` districts are auto-ingested by world, nav and sim. Add 4–6 cast with fresh roles (herbalist, fisher, miller, schoolteacher) and a "Riverside" / "Chapel Green" district with one new gathering place (a dock, a chapel service). Characters are the GPU cost, so gate on the outline/culling/resolution fixes. The owner's #1 ask, and mostly content.

### 3. Fight & confrontation staging pass for legibility — **S–M**
Shot `20`: a "Village Brawl" where two figures stand side-by-side and the dust is faint translucent blobs. `startFight` already squares them off on clear ground (`sim.ts:264–273`) — build on it: during the `fight` action (`sim.ts:187`) orbit both around the midpoint, raise the dust rate, spawn `💥`/`💢` via `sim.icon` on each hit, add a ~150ms camera shake, reuse the "VS" title card. Same brief face-off pose for `argue`/`accuse`. You simulate the drama; this makes it *read*.

### 4. Interactable set-pieces at props that are currently scenery — **M**
The well, notice board, pond, laundry line and market stalls are walked-past, not used. Add short Actions (the `work()` tool/anim vocabulary already supports this — `brain.ts:130`, `avatar.ts`): draw water at the well (bucket + ripple), **pin the morning Gazette headline on the notice board**, hang laundry, skip stones at the pond, browse a stall. ~15 lines each; makes the town inhabited rather than decorated.

### 5. Animals that roam the whole village and get petted — **M**
Critters are penned in the farmstead only (`world.ts:184–195`). Add a village dog/cat that wanders the plaza and trots after whoever's nearest, birds that scatter off rooftops, ducks on the pond. Let a villager `feed`/pet them (reuse the `feed` action). Cheap, charming, answers "more interactions with nature/animals."

### 6. Lighting beats: golden hour + storm punch — **S–M**
`sky.ts` has a clean keyframe day/night system and night (`07`) proves the craft. Add (a) a stronger dawn/dusk golden-hour grade (push `toneMappingExposure` + sun tint for ~20 game-min around 6.5h/18.5h) the dawn-Gazette cam can lean into, and (b) a lightning flash + brief hemi dip during heavy rain (`summonRain`). A few lines each; the requested "lighting beats."

### 7. Landmark labels + a 10s establishing fly-through — **S**
On load (and when free-cam pulls far) float building name labels — places carry names (`town.ts`) — and run a short dolly across the three districts before handing to the director. Orients new viewers and shows off the "bigger map."

### 8. Make the festival a real dance set-piece — **M**
Festival raises bunting (`world.ts:211`) and `attend()` already picks `dance`/`cheer` (`sim.ts:323`), but the plaza looks thin (`17`). Stage dancers in a ring around the well, string lanterns, light the stalls, add a maypole. With the night fireflies/flames you have, this becomes a second signature cinematic moment.

### 9. Background "extras" for density without sim cost — **M** (gated on perf)
A handful of non-simulated walkers (kids chasing a ball, an old couple on a bench) on set paths make the village feel populous. Ride on the character perf fixes; use the cheapest LOD (no outline, culled). Sells "bigger Smallville" far cheaper than more full agents.

### 10. Weather variety: dawn mist + post-rain rainbow — **S–M**
The fog system exists (`sky.ts:29`,`sky.ts:48`). Add low ground mist at dawn that burns off by ~9am, and a brief rainbow arc (one textured half-torus) as rain clears. Tiny code, postcard moments for the Gazette and recaps.

### 11. Dawn "highlight reel" montage — **L**
At dawn the Gazette pops; pair it with a 15–20s auto montage cutting through the top-3 arcs' locations with captions — a "previously, in Thistlebrook." Ranking exists (`director.ts:26`, `arcs`); the work is a small cut-sequencer reusing `closeUp()` (`main.ts:161`) + stored event positions. High WOW, more plumbing.

### 12. Ambient life + seasonal touches — **S**
Leaves already fall (`fx.leaf`). Add pond ripples, an occasional fish jump, dust motes in sunbeams, and nudge the border-foliage tint by in-game day to imply season. Pure atmosphere that photographs beautifully.

---

## Bugs spotted
- **Duplicate anvil at the smithy** (`05`): the blacksmith building ships an interior anvil *and* `makeAnvil()` adds a standalone prop ~0.8 m away (`main.ts:44`). Two anvils read oddly and the smith works the prop while the built-in one sits unused. Round-1 item #10 — **still unfixed**. Hide the interior anvil or drop the prop.
- **Storyteller scene is unreadable** (`18`): the event cam frames the back of the market stall + a horse; Old Nell and the crowd aren't visible. `spawnTraveller` gathers villagers at (-18.9, 2.2) — *exactly* where Nell stands (`god.ts:38`, `main.ts:139`) so they overlap her, and `focusPoint(-19, 5)` (`main.ts:85`) aims at the cart, not the teller. Aim the cam at Nell and arc the crowd *in front* of her.
- **Merged gossip line produces ". , then" and repeats the identical clause** (`17`, 9:40 AM): "Edgar whispered to Jen that Tom has been reading the mayor's mail. , then told Ollie that Tom has been reading the mayor's mail." The "then" chain-merge (`sim.ts:54–56`) concatenates two near-identical gossip events, and `cleanLie`'s punctuation fix (`ui.ts:17`) doesn't run on the merged `eventUpdate` path. Strip the duplicated clause and the ". ," artifact when merging.
- **Fights don't read as fights** (`20`): combatants stand nearly parallel and the dust is a faint blob; the `fight` anim + sparse top-up dust (`sim.ts:187`) don't sell contact. Legibility defect — see wow #3.
- **Opening Villagers/Relationships stutters**: 8 synchronous full-scene renders (`ui.ts:201`,`ui.ts:204` → `main.ts:64`). Perf #6; a user-visible hitch, not just a number.

## Quick polish
- Demote one of the two gossip-virality lines — "The whole village is whispering: X" **and** "Word travels fast: N villagers now know" both fire for one fact (`07`,`08`,`18`); keep one. The feed is still a touch firehose despite the FALSE-RUMOUR badges and "then" merges that landed from Round 1.
- The blacksmith appears to keep a prop on his back while hammering (`05`) — `busyHands` includes `hammer` (`main.ts:115`) so `setCarry('')` should clear it; verify it isn't the outfit's outerwear reading as a stuck carry.
- Open card can overlap world speech bubbles in the left third (`10`): inset bubbles clear of the card panel (the anti-stack pass at `ui.ts:130–135` only de-collides tracked bubbles, not the card).
- Festival banner fires at `clock+1` with attendees ramping in (`god.ts:54`); pre-seat 3–4 dancers at the well so the first ~30s after "Festival!" isn't an empty plaza.
- Golden-hour grade + storm lightning (wow #6) double as cheap "lighting beat" polish.
- Forge: once the duplicate anvil is gone, nudge the hammer tool offset so the head clears the face at full raise (`avatar.ts:44`).
