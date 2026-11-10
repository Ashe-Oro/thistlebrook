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
