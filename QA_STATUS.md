# QA round 1: status per item

Tested build: 54eb4c4. These fixes landed on master in round 3.

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Leaderboard empty | Fixed | Rows and legend now go inside `setHTML`, so all 12 rows show. |
| 2 | Self-referential gossip | Fixed | `pickGossip` skips facts about the teller (or acted by them). 0 cases in a 3-day soak. |
| 3 | False rumours printed as fact | Fixed | The chronicle "false rumour" badge now also shows in the Gazette, Recap timeline, story cards, arc view and card Story tab. Relayed and viral retellings of a fake fact carry the marker. Gazette leads say "(or so the rumour goes)". A rumour never becomes the headline. |
| 4 | Black Book marked RESOLVED | Fixed | A keepsake-theft arc resolves only when the keepsake is back with its owner. This is rechecked on every recap. |
| 5 | Director cam framing roofs, walls or empty houses | Fixed | Following distance is now 11.5 m (13 m on mobile). Every 0.5 s a line-of-sight check swings the camera to a clear angle. If the subject goes indoors, the camera switches to the nearest villager outside. If everyone is in, it frames the campfire (night) or plaza. More event kinds trigger beats (theft, accusation, argument, making up, alliance), and the beat cooldown dropped from 9 s to 6 s. |
| 6 | Reload loses the village | Fixed | localStorage autosave (every 20 s, at dawn, and when the tab is hidden) and resume on load. 🌱 starts a new village. `?fresh` / `?nosave` are available. |
| 7 | DOM growth / per-row listeners | Fixed | The chronicle caps at 100 rows (minor work rows at 30). One delegated click handler covers names and story chips, and repeated lines fold into ×N. |
| 8 | Mobile card covers the villager | Fixed | Bottom sheet above the dock (it hides the chronicle while open). Compact header. The camera view is offset so the villager sits above the sheet. 3+ rows visible. |
| 9 | God-power spam | Fixed | Cooldowns with a recharge bar: gift 8 s, rain 25 s, traveller/festival 30 s. Rain is refused while it's already raining. |
| 10 | Day-1 Gazette says "Day 2" | Fixed | Before the first dawn it is labelled "Day N · Early edition, today so far" and only includes past events. |
| 11 | Headline grammar / "Nobody knows… yet" in the paper | Fixed | Names are uppercased in all-caps headlines and the pronoun is correct. Leads use only the first sentence of each beat, with no "!.". Secret-crush lines are kept out of headlines, leads and stories. "Most mischievous: Nobody, yet" when tied at 0. |
| 12 | Headline doesn't match the stories | Fixed | With no lead, the headline's own event is always the first story. Stories are de-duplicated. |
| 13 | Duplicate achievement toasts | Fixed | The same title refreshes the visible or queued toast instead of stacking. |
| 14 | Work filter empty | Fixed | Routine work (importance 1) is kept for the Work filter only, and hidden from All. |
| 15 | Free-cam zoom void / clipping | Fixed | Zoom is clamped to 4.5–72 m (was 5–120). |
| 16 | Blank portrait on select | Fixed | The selected villager jumps the portrait queue. |
| 17 | Space resumes at 1× | Fixed | Space restores the previous speed. |
| 18 | God powers while paused | Fixed | Refused with a "Time is paused" toast. |
| 19 | Relationship web clipped at 720p | Fixed | The canvas scales to fit the sheet (`height: min(560px, 88vh − 160px)`). |
| 20 | Romance repeats / mirrored friend lines | Fixed | "Quietly fallen for" is logged once per pair; a repeat is a minor line. No re-crush for 3 days after a confession. Friendship gets one line per pair, upgraded to "both ways" instead of mirrored. |
| 21 | "over what he did" | Fixed | The fight reason is now the remembered fact ("over how Tom pinched Edgar's book"). |
| 22 | Apologies to the thief | Fixed | Villagers apologise only when the other person is sore at *them*, and never to whoever holds their keepsake. |
| 23 | Clipping into stalls | Fixed (round 4) | Work spots snap to free nav cells. Villagers now separate locally (fixed-step, fixed-order, deterministic): walkers yield to each other and step around talkers, workers and fighters, and conversations open at about 1.1 m. On seed 7, from 08:00 to 18:00, one pair sample came closer than 0.45 m; before this fix there were about 20. |
| 24 | Rain visuals lag / linger | Fixed (round 4) | Rain density ramps up smoothly. When rain stops, streaks and splashes fade within about 1.2 s and are then hidden; drops fade evenly rather than from one side. The rainbow shot waits for the fade (see 26_rainbow). |
| 25 | Intro panels ghosting | Fixed | During the intro crane (and the dawn montage) the chronicle, leaderboard, card and dock are hidden. |
| 26 | Mobile tap targets | Fixed | Top bar, filter and dock buttons are 44–48 px. The one-row dock has short labels (Gift, Rain, Visitor, Fest, Web, Paper, Recap, People). |
| 27 | Justified Gazette text | Fixed | Left-aligned on mobile, and the sidebar is always left-aligned. |
| 28 | Work lines repeat | Fixed | Repeats fold into one row with ×N. |
| 29 | Thought vs relationship mismatch | Fixed | "I've had enough of X" appears only below Neutral. Envy sniping says "Who does X think he is, anyway?". |
| 30 | Plan duplicates sleep | Fixed | Contiguous identical blocks merge, and next-day blocks are marked "(tomorrow)". |
| 31 | Mind tab misses own actions | Fixed | Starting a rumour and passing on gossip are now remembered by the teller. |

## Other changes

- **Gossip share:** gossip is now about 24–26% of events (seed 7, 3 days), down from about 30%. The cooldown went from 100 to 170 minutes and the score was scaled by 0.7. More thefts happen in daylight, and confrontations come sooner.
- **Determinism:** real time uses the same fixed 1/30 s step as `fastForward`. Two concurrent runs of seed 7 at different frame rates produced identical events. `fastForward(min)` uses fine steps by default; `fastForward(min, true)` keeps the old coarse stepping.
- **Click hint:** a first-visit "Click a villager to read their mind" hint. It goes away on the first selection or after 45 s.

## Round 4

- **Camera framing (Fable):** the dawn montage is now a real flashback. Each cut restages up to 3 actors at the recorded spot, in a pose that fits the event, at render level only. Bystanders fade out. One shared `frameShot` helper serves beats, the montage and director care. It fits the subjects in the frustum, checks line of sight from each head against cached solid occluders only, and rejects cameras with avatars in the foreground, cameras inside or hugging walls, and walls that fill an edge of the frame.
- **Cinematics:** UI panels hide during beats, the montage and the intro (`body.cinematic`).
- **Codex critique items:** `fastForward(0)` no longer ticks. No beats, montage, paper or rainbow fire during fast-forward. When no path exists, villagers go to the closest reachable cell and the action aborts (no arrival effects) instead of walking through walls. `nav.lineFree` is now an exact grid traversal, which fixed the stuck "enter" loops caused by smoothed paths clipping blocked corners. Old 12-villager saves migrate by id.
- **Performance:** villagers more than 40 m from the camera swap their 12-material character for a single-draw twin with baked vertex colours. Ducks and ripple rings are instanced. Inactive rain and fx are hidden. Distant birds update less often.
- **Bigger village:** 4 new villagers (16 in total), plus about 8 background passers-by, festival visitors, washing lines and a cat in `src/world/extras.ts`. These are cosmetic only and use their own RNG.
- **Setting interactions:** 8 leisure activities: feeding the ducks, fishing off the dock at dawn, chats at the well, people-watching from benches, sketching, tending flowers, the campfire at night, stargazing, and sheltering under the tavern awning in the rain.


## Round 5

- **Montage faces and night shots:** cinematics get a temporary lift on the existing hemisphere fill (stronger in the dark) plus a small exposure boost. No extra light is toggled, so no shaders recompile per beat. Restaged actors snap to full opacity on the cut. Each cut opens the cast toward the chosen camera yaw (up to a 0.65 rad heading cheat), and `frameShot` penalises overlapping subjects.
- **Beats near walls or trunks (Codex):** occluders now include batched trees, and the camera keeps 1.6 m of nav clearance.
- **Grey statue extras (Codex):** extras use coloured stand-ins.
- **Draw calls (Codex):** each near villager is one merged mesh with 2 draws (it was 12). Same-scene plaza calls went from about 117 to 59–74.
- **Life entries (Codex):** there is a new `life` event kind with a Life filter. Its rows are folded and muted, and it is left out of captions, beats and the paper.
- **Calendar and seasons (Opus):** the week runs Moonday to Sunday with market, town-meeting, festival-eve and rest days. There are 4 seasons of 7 days each. The top bar shows the weekday, season and day, and opens a calendar popover. Seasons tint grass, foliage and sky, and in winter precipitation falls as snow (render-only).
- **Gatherings (Fable):** villagers start their own group events: proposals and weddings at the chapel (with an objection chance), a festival showdown between feuding villagers, a search party for the lost dog Biscuit, and a town meeting vote that sets the festival theme and decrees. Each gets its own beat titles, flashback poses and director headlines.
- **Fixes:** on day 1, the Moonday market invite cleared `replan` before the first plan, so everyone stayed asleep; this is fixed. Proposal readiness is re-checked at resolve time, so there are no double proposals or weddings.
- **Gallery:** new shots 29_town_meeting, 30_wedding and 31_winter.
- **Still open:** crowd performance during the market and plaza gatherings; fights and arguments are high (about 88 and 201 in 8 days); wedding crowds are small (3); the dog search doesn't find Biscuit on seed 7; full dark beards still read dark; the winter tint is subtle (the grass stays fairly green).

## Round 6

- **Drama balance (Fable, then tuned against soaks):**
  - **Grievance ladder:** every slight adds to a per-pair grievance that fades with a half-life of about 27 h. An argument needs grievance of at least 16, a sour opinion, and at least 20 h since the last argument between the same pair. A fight needs an argument between the same pair in the last 4 days, grievance above 24, hot tempers, no shame on either side, and no village-wide fight lull (2.5 days).
  - **Theft catches:** a caught thief usually gets a telling-off and hands the keepsake back. It becomes a scuffle only for a hot temper with an existing grudge.
  - **Cooling off and apologies:** the pair cools off after an argument (a day or more after a fight), and post-spat apologies are common.
  - **Mediators (`mediate`):** a kind, liked bystander can defuse a row.
  - **Shame:** fighters lose standing with witnesses and feel shame, which blocks more confrontations and makes them more likely to apologise.
  - **Cozy rivalry:** quick `contest`s (races, stone-skipping, pie-offs), harmless `prank`s (swapped hats, a frog in a bucket), a bit more flirting and a bit less pinching.
  - **Calm zones:** `sim.calmAt(x, z)` vetoes arguments, fights and pranks near a wedding, meeting, festival or market in progress.
- **8-day soak (`npm run soak`, SEEDS=7,3,11,5):**

  | | Before | After |
  |---|---|---|
  | Fights | 44 / 52 / 59 (seeds 7 / 3 / 11) | 2 / 0 / 1 / 1 |
  | Arguments | 201 / 181 / 182 | 5 / 6 / 14 / 11 |
  | Reconciliations | | 23–41 |
  | Mediations | | 2–14 |
  | Contests | | 23–27 |
  | Pranks | | 23–24 |
  | Romance | 76 (seed 7) | 56–82 |

- **Weddings (Opus):**
  - **Guests:** the whole village is invited. Anyone feuding with the bride or groom (opinion below −40) stays away, with a chronicle line saying so.
  - **Ceremony ground:** a procedural flower arch and two blocks of benches with an aisle, in a couple of merged draws. They go up on the morning of the wedding and come down after the party.
  - **Sequence:** vows, then a kiss with a petal burst, a toast (🥂) and the first dance with dancing.
  - **Beat:** a letterboxed "The Wedding" shot framed down the aisle, from the front.
- **Lost dog:** the search now sometimes finds Biscuit (3 of 7 searches across the soak seeds). The finder cheers, a "Found!" beat plays, and Biscuit turns up in front of them. Otherwise he still trots home on his own.
- **Crowd performance (Codex, two passes):**
  - **Where the time goes:** a new `terrarium.perfStats()` breaks the frame into phases. It showed JS at only about 4–6 ms of a ~130 ms SwiftShader frame, so the cost is vertex and raster work, not the sim.
  - **Characters:** the outline hull and character shadows are drawn only up close. Beyond that, the blob shadow takes over. In crowds, the single-draw far twin switches in at a shorter distance. Shadows refresh less often when a crowd is in view, and extras follow the same rules.
  - **Animation and UI:** distant and off-screen poses update less often. Floating emoji are batched onto one canvas.
  - **Result:** day-1 plaza crowd went from 469k triangles at 7.5 fps to 331k at 10.2 fps.
- **Winter (Codex, then tuned):**
  - **Snow cover:** patchy snow on the grass, caps on roofs and treetops (a shared uniform, so no shader recompiles), and cobbles only dusted.
  - **Snowfall and breath:** gentle snowfall at all times, heavier when it would otherwise rain, plus breath puffs.
  - **Season changes:** a multi-day fast-forward snaps to the new season instead of easing into it.
- **Gallery:** new shots 30b_wedding_beat and 32_found_biscuit (seed 11). The wedding shots now find the first wedding after the staged scenes.
- **Still open:**
  - Gossip is about 30% of events.
  - Thefts are still frequent (about 45–55 in 8 days); catches are now mostly telling-offs.
  - The Found! framing crops the dog.
  - The SwiftShader numbers are noisy when other jobs share the CPU.

## Round 7
- **Beat framing:**
  - `frameShot` takes extra subject boxes (the dog, the arch and the guests) and fits them between the letterbox bars.
  - The wedding searches angles within ±35° for an open front-on shot.
  - Found! frames the finder and Biscuit up close.
  - Beats re-aim every 0.5 s, and are skipped when the cast is hidden or spread out.
  - At night, the director cuts to a plaza establishing shot.
- **QA pass:** see `/workspace/terrarium-qa/round2/REPORT.md`. Six majors (M1–M6) were found and fixed. These covered:
  - beats framing nothing;
  - night walls;
  - the phone top bar and landscape card;
  - Found! and wedding framing;
  - the Storylines strip;
  - finale text, fireworks and lanterns.
- **Wow features:**
  - The **Storylines** panel works like a TV guide. You can pin a storyline so the camera follows it, and a toast shows when it resolves. The API is `terrarium.storylines()` / `pinStory(id)`.
  - **Handwritten letters** between villagers: a Letters tab, floating cards, and `terrarium.letters()`.
  - A **season finale** on each season's last evening:
    - The four finales are Blossom Fair, Midsummer Lantern Night, Harvest Moon Feast and Frost Fire Gala.
    - Each has a contest, Heart of Thistlebrook and Scoundrel awards, a grand dance, a closing toast, and fireworks (560 pooled particles in one draw call).
- **LLM hook (optional):**
  - `?llm=<OpenAI-compatible URL>&llmModel=…` or `localStorage['terrarium.llm']`.
  - It rewrites display text only (dialogue lines and reflections), with a deterministic fallback, rate limits, a timeout and backoff.
  - There are no keys in the repo, and the sim's event signature is identical with it on or off.
- **8-day soak** (seeds 7/3/11/5):

  | Measure | Seeds 7/3/11/5 |
  |---|---|
  | Fights | 2/1/0/1 |
  | Arguments | 8/10/10/11 |
  | Events | 1090/1074/1040/1078 |
  | Errors | 0 |

- **Verify** (DAYS=4): PASS, with 6.5 → 8.5 fps under SwiftShader.
