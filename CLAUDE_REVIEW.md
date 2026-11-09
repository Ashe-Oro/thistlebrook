# Thistlebrook — Design & Graphics Critique

**Verdict:** In full daylight Thistlebrook is genuinely charming and immediately readable — the cozy low-poly village, the floating name tags, the live chronicle and the tabloid Gazette sell a "watch a tiny society" fantasy that mostly works, and the underlying agent sim produces real arcs (Jen's snoop→thief→pariah spiral, Tom's unrequited pining for Mara, alliances forming on-screen). But the presentation collapses in exactly the moments the game leans on most: characters turn into black silhouettes at dawn/dusk/indoors, which breaks every portrait in the card, gallery and relationship web (shots 10–16, 22), and the chronicle drowns in near-duplicate gossip spam that buries the good stories. Fix the lighting/portrait pipeline and throttle the gossip feed and this jumps from "nice tech demo" to "genuinely compelling to watch."

## Top 15 suggestions
*(ranked by impact ÷ effort)*

### 1. Avatars render pure-black in low light, and every portrait is broken
**What's wrong:** At 6:15 AM the villager at his door is a solid black silhouette (`22_mobile.png`). Worse, the portrait system renders the villager *in place in the world scene*, so during rain (everyone indoors, `10–16` all captured Day 3 ~1 PM rain) nearly every portrait is a dark, faceless box or an empty plaza — the relationship web (`14`) is a ring of black heads with glowing eyes, the villager gallery (`16`) is mostly unrecognizable, and the selected-card portrait (`10/11/12`) shows background, not Jen's face. The card portrait is the headline UI feature and it fails whenever it's not high noon.
**Fix:** Two parts. (a) Global fill: raise the hemisphere/ambient floor so vertical faces never go black — `sky.ts:17` + `sky.ts:39-45` (clamp `hemiI` to a higher minimum, lerp ground color less aggressively at night), or add a faint camera-locked fill light. (b) Portraits: in `portrait()` (`main.ts:60-71`) render against a controlled setup — clear the `WebGLRenderTarget` to a solid backdrop color and parent a small `PointLight`/`DirectionalLight` to `pcam` for the render, then remove it; this also kills the indoor-occlusion/darkness problem because the subject is lit regardless of where it physically stands.
**Effort:** M

### 2. The chronicle is a gossip firehose
**What's wrong:** The feed is dominated by near-identical lines: "Jen whispered to X that Y (It isn't true.)", "X told Y that Z", and "Word travels fast: N villagers now know…" (`08_night`, `13_feed_drama`, `15_recap`). Each gossip hand-off logs a line *and* a viral milestone fires, so one juicy fact generates 6–8 feed entries. Real drama (a theft, a confession) scrolls away under rumor chatter.
**Fix:** In `tellGossip` (`social.ts:212-214`) stop logging every hop — only log hop 1 (origin) and the single viral milestone, and demote re-tells to `imp:1` so `addFeed`'s `imp<=1` filter (`ui.ts:56`) drops them. Collapse chains with the existing "then" merge (`sim.ts:54`) across gossip too. Cap the "Word travels fast" announcement to one per fact (already guarded by `viral`), but also suppress it for low-stakes fake rumors.
**Effort:** M

### 3. Speech bubbles and tags clip off the top of the screen
**What's wrong:** In `20_scuffle.png` the "No Way!" bubble is sliced off at the very top edge; the fight itself is near the frame bottom. `ui.ts:84-85` positions bubbles/tags purely from the projected point with `translate(-50%,-100%)` and no viewport clamp.
**Fix:** Clamp `p.x`/`p.y` in `UI.frame` (`ui.ts:80-92`) to a safe inset (e.g. keep y above ~70px so it clears the topbar, and within `innerWidth`). Flip the bubble below the head when near the top edge. Cheap, high polish payoff.
**Effort:** S

### 4. Fights are illegible
**What's wrong:** "Rosa finally had it out with Jen…" (`20`/`21`) renders as two bodies clipping *into each other and through a lamppost*, with faint translucent beige blobs. There's no clear read of a fight. `startFight` (`sim.ts:262-278`) freezes both fighters at wherever they collided — often against a prop — and `separate()` doesn't meaningfully pull them apart.
**Fix:** In `startFight`, reposition both combatants to a clear spot: midpoint snapped via `world.nav.nearestFree`, then place them ~1.1 apart facing each other. Beef up the signal — bigger/longer dust (`sim.ts:265` already calls `fx.dust(mx,mz,30,1.6)` but the per-frame top-up at `sim.ts:187` is sparse; raise rate) and add a floating "💥"/"💢" icon via `sim.icon`. Have the director frame it from a higher polar angle.
**Effort:** M

### 5. "Festival!" reads as an empty plaza
**What's wrong:** `17_festival.png` fires the banner "Festival! …Ollie was chosen to lead the dancing," the bunting looks great — but the plaza is deserted except Mara walking *away*, and the clock still shows the rain icon. `startFestival` (`god.ts:50-56`) schedules the party at `clock+10` and relies on normal attendance ramp (`sim.ts:287` ~35%+ rolls), so there's a long dead window, and it never clears weather.
**Fix:** On festival start, force-clear rain (`sim.rainUntil = sim.clock`), and immediately route non-sleeping villagers toward the plaza (seed their `attend` action now rather than waiting for `partyTick`). Guarantee a visible dancing cluster by snapping a few to `dance`/`cheer` anims around the well. 
**Effort:** M

### 6. The director frames obstructed subjects
**What's wrong:** `18_storyteller.png` is dominated by Tom with a **box carried over his head** hiding his face, while Old Nell (the actual event) is a barely-visible figure by a horse. `03_work_chop.png` close-up frames the woodcutter from the side, mid-walk, not obviously chopping. The director's scorer (`director.ts:40`) and close-up (`main.ts:closeUp`) don't consider whether the subject's face/action is visible or carrying an occluding prop.
**Fix:** Penalize candidates whose `carryKind` covers the head in `director.pick` scoring, and when focusing an *event* (traveller/festival) point at the event anchor, not a random attendee (`spawnTraveller` focus is `focusPoint(-19,5)` in `main.ts:77` but director then overrides). Bias close-up yaw toward the subject's facing + current action target.
**Effort:** S–M

### 7. Mobile layout clips controls and the feed eats the view
**What's wrong:** `22_mobile.png`: the bottom dock overflows horizontally — "Gazette" is cut to "Ga…" and god-powers/views are only partially reachable; the chronicle covers ~40% of the screen; there's no leaderboard. Combined with the black-silhouette villager it's a rough first impression on phones.
**Fix:** Make the dock wrap or use a compact icon-only row on `(pointer:coarse)`; cap feed height to ~30vh on mobile; add a collapse toggle for the chronicle. (CSS in the web shell + `mobile` flag already exists at `main.ts:17`.)
**Effort:** M

### 8. The bottom caption duplicates the top of the feed
**What's wrong:** On high-importance events the center-bottom caption shows the same text that's already the top feed item (e.g. `07/08` "Jen snatched Edgar's little black book…" appears in both). It's redundant and adds clutter.
**Fix:** In `captionText`/`addFeed` (`ui.ts:62`) only promote to caption when the event isn't already visible at the top of the feed, or style the caption as a transient "now" banner that fades fast and skip it when the feed filter would show it anyway.
**Effort:** S

### 9. Thought bubbles contradict what the villager is doing
**What's wrong:** Jen's card (`10/11/12`) shows thought "Ugh, this rain! Better get inside." while her status is "sheltering in the Tipsy Thistle (inside)" — she's already inside. The thought is set when the *decision* is made (`brain.ts:72`) and never updated once sheltered.
**Fix:** When an `enter`-to-shelter action completes its walk, replace `v.thought` with an "inside" line (e.g. "Cozier in here with the rain outside."). More broadly, clear stale `thought` on action transitions in `tickVillager` (`sim.ts:154`).
**Effort:** S

### 10. The forge has a duplicate anvil and the hammer clips through the head
**What's wrong:** `05_work_forge.png`: there's the forge's built-in anvil *and* the standalone prop anvil (`makeAnvil` added at `main.ts:44`), so two anvils read oddly; and Tom's raised hammer passes through his own face. The smith stands at `sm+1.2` but faces/strikes the prop at `sm+2.0` (`sim.ts:226`), and `setTool` uses a generic hammer offset (`avatar.ts:33-39`).
**Fix:** Remove or hide the forge's decorative interior anvil (keep one), and tune the hammer tool offset/rotation for the `hammer` anim so the head clears the face at full raise (`avatar.ts:38-39`, `avatar.ts:86-92`).
**Effort:** S

### 11. A single villager becomes a pariah almost instantly
**What's wrong:** Jen craters to **−34 / −26** on the Liked board within ~3 days (`14`, `15`, `17`) largely via rumor loops and theft witness penalties stacking. The recap graph (`15`) shows one line nose-diving while everyone else clusters — dramatic once, but it happens every run and flattens the social landscape into "everyone hates Jen."
**Fix:** Add diminishing returns on repeated negative gossip about the same target (`bump` in `social.ts:207`), a slow opinion-recovery drift toward 0, and cap how often one agent can be the rumor *subject*. Let reconciliation/time heal faster so pariahs can climb back.
**Effort:** M

### 12. Work actions don't read as work at a glance
**What's wrong:** Without a selected card, a chopping/mining/forging villager just looks like someone standing near a tree/rock (`03`, `04`). The tool helps but the action intent isn't legible from the default director distance.
**Fix:** The ingredients exist (ambient work log lines at `imp:1` in `sim.ts:216` are filtered out). Occasionally surface a short work speech bubble ("Timber!", "Swing, swing…") via `sim.say` during long work actions, and keep the determined expression you already compute (`main.ts:98`). Low cost, big readability gain on the "day in the village" shots.
**Effort:** S–M

### 13. Rumor content repeats verbatim
**What's wrong:** "snores loud enough to wake the hens," "kicked a chicken," "secret sweetheart in the next village" recur across `01`, `08`, `13`, `15`, `17` — the fixed 8-line `lies` array (`social.ts:157`) is small and unweighted, so the same gags loop within a single run.
**Fix:** Expand the list, and track used lies per-subject so a villager isn't re-slandered with the same line; optionally tailor the lie to the target's job/trait (a thief rumor about the honest shepherd lands harder).
**Effort:** S

### 14. Night/campfire scenes need rim or fill so characters pop
**What's wrong:** `07_party_night.png` is atmospheric, but the villagers around the campfire are dim and muddy; the fire's glow (`fx.flame`/`ember`) doesn't actually light them (particles are additive sprites, not lights). Characters nearly merge with the dark grass.
**Fix:** Add a cheap flickering `PointLight` at active campfires/forges (toggle with `smokeUntil`/party state), and/or a subtle world-space rim term. This compounds with #1 and makes the signature "party at night" shot sing.
**Effort:** S–M

### 15. Standings labels are opaque and bars go negative awkwardly
**What's wrong:** The leaderboard "Liked / Influence / Mischief" (`01`, `08`) shows raw numbers (23, −34) and the negative "Liked" bars render as a short red stub with no baseline (`ui.ts:101`). A new viewer doesn't know what "Influence 21" means or why Jen is −34.
**Fix:** Add a one-line tooltip/legend per mode, draw a center baseline for signed bars, and consider a small trend arrow (↑/↓ vs yesterday from `sim.history`). Clarifies the gamified layer that's otherwise a strength.
**Effort:** S

## Bugs spotted
- **Portraits render the live world, not an isolated subject** — indoor/night villagers come back as dark/occluded boxes across card, gallery and web (`main.ts:60-71`; shots `10–16`). Highest-severity visual bug. (See #1.)
- **Avatars can render fully black** at low sun angles (`22_mobile.png`, 6:15 AM) — insufficient fill lighting (`sky.ts:39-45`).
- **Speech bubble clipped off top of viewport** (`20_scuffle.png`) — no on-screen clamp (`ui.ts:84-85`).
- **Fighters clip through each other and world props** (lamppost in `20/21`) — `startFight` doesn't relocate combatants to clear ground (`sim.ts:262-264`).
- **Rain + Festival run simultaneously** — festival banner while clock still shows 🌧️ (`17`); `startFestival` never clears weather (`god.ts:50-56`).
- **Duplicate anvil at the smithy** and hammer-through-head clip (`05`; `main.ts:44`, `sim.ts:226`, `avatar.ts:86-92`).
- **Stale thought bubble**: "Ugh, this rain! Better get inside." shown while already sheltered (`10/11/12`; `brain.ts:72`).
- **Mobile dock overflow**: "Gazette" truncated, items unreachable (`22`).
- **Dead code**: `const tags = ui ? null : null; void tags;` in `portrait()` (`main.ts:66`).

## Quick polish list
- Clamp all overlay elements (tags, bubbles, icons) to a safe viewport inset under the topbar.
- De-duplicate the center caption against the feed's top item.
- Add a fire/forge point light; it fixes night mood cheaply.
- Expand and de-repeat the rumor/lie pool; vary the "Word travels fast" phrasing.
- Give the leaderboard a baseline for negative bars + a mode tooltip and day-over-day trend arrows.
- Occasional work speech bubbles so chop/mine/forge read without opening a card.
- Director: skip candidates carrying head-height props; aim event cams at the event, not a bystander.
- Clear/raise the hemisphere floor so no character ever goes 100% black.
- On festival start, force-clear rain and pre-seat a visible dancing cluster at the well.
- Remove the decorative duplicate anvil; nudge the forge tool offset so the hammer clears the face.
- Update `v.thought` on action transitions so bubbles match current state.
- Mobile: wrap/compact the dock, cap chronicle height (~30vh), add a collapse toggle.
