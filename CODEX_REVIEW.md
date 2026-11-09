> **Round 2 status (Nov 9, 2026, 4:31 PM ET):** the round-2 Codex critique could not run. `codex exec` returned "You've hit your usage limit … try again at Nov 11th, 2026 5:14 AM" (it also logged an expired auth token). The round-1 Codex review below is unchanged. Round 2's perf and wow work followed CLAUDE_REVIEW.md (round 2) plus our own profiling (tools/perf.mjs).

Thistlebrook already has an appealing miniature-village identity: the architecture, parchment UI, and campfire lighting make it inviting to watch. Its strongest emerging story—Jen’s thefts, damaged reputation, and unreturned affection—is more compelling in the chronicle than in the world, where framing, broken portraits, and ambiguous reactions hide the causes and consequences. Prioritize reliable character presentation, readable event staging, and causal storytelling before adding more systems; this was a read-only review, `licensed/` was excluded, and `verify-report.json` was absent.

## Top 15 suggestions

Ranked by expected impact relative to implementation effort. **S** = localized change, **M** = coordinated changes, **L** = substantial system work.

### 1. Give portraits a dedicated rendering scene

**What’s wrong:** In `10_card_relationships.png`, Jen’s portrait shows rainy scenery; in `14_relationship_web.png`, most portraits show roads or lamps. This breaks recognition across the card, relationship web, and cast browser. `src/main.ts:60–69` renders the entire world through a camera beside the live avatar, allowing buildings and props to obstruct it.

**Concrete fix:** Replace that render with an isolated portrait scene containing a presentation copy of the character, a neutral background, and fixed key/fill lights. Frame from head bounds, update transforms before rendering, and cache by outfit/expression. Indoor characters must remain recognizable.

**Effort:** M

### 2. Separate presentation randomness from simulation randomness

**What’s wrong:** `src/sim/director.ts:40–41` consumes `sim.rng` inside a sort comparator; newspaper generation also consumes it at `:20`, `:32`, and `:46`. Watching in Director mode or opening a newspaper can therefore change subsequent agent decisions. Random comparator evaluations also make camera ranking inconsistent.

**Concrete fix:** Give the director and editorial layer separate seeded RNGs. Compute each candidate’s camera score once before sorting. Move simulation-relevant party rolls off shared `Math.random`, which rendering also consumes.

**Effort:** S

### 3. Make the mobile interface a collapsible viewer

**What’s wrong:** `22_mobile.png` loses much of the screen to the header, chronicle, and dock; the dock cuts off Gazette and later controls. Horizontal scrolling exists, but its discoverability is poor, and the fixed feed offset assumes a particular dock height.

**Concrete fix:** In `public/style.css:78–81` and `src/ui/ui.ts:37–46`, use a compact header, a collapsed “Latest event” strip, and a bottom sheet for Chronicle/Cast/Views. Put powers behind one expandable button. Use measured header/dock heights and safe-area insets instead of fixed offsets.

**Effort:** M

### 4. Stop announcing outcomes before scenes finish

**What’s wrong:** `20_scuffle.png` announces Rosa’s victory while the fight is still happening. `src/sim/sim.ts:267–270` logs the winner and applies the loser’s dizzy state at fight start. Likewise, `src/sim/social.ts:89` says Tom “walked home alone” before his dialogue and homeward action finish.

**Concrete fix:** Split dramatic events into start, resolution, and aftermath. Emit “Rosa confronted Jen” at initiation; publish the winner and apply dizziness when the fight ends. Narrate departure when the character actually departs.

**Effort:** S

### 5. Frame both participants and avoid foreground obstructions

**What’s wrong:** A lamp dominates `20_scuffle.png`, directly obscuring the fight. In `02_plaza_lunch.png`, Tom is pushed into the lower edge. The camera follows one position with a preserved viewing direction and fixed distance (`src/main.ts:135–139`), regardless of the event’s participants or UI footprint.

**Concrete fix:** Add an event shot target using participant bounds and the available screen rectangle. Test several yaw angles with raycasts against buildings and tall props; choose the least obstructed composition. Hold that shot through the interaction and briefly through its aftermath.

**Effort:** M

### 6. Show the cause and relationship consequence of drama

**What’s wrong:** `13_feed_drama.png` contains theft, accusation, confrontation, pursuit, and fighting, but viewers must reconstruct their connections manually. The data often already carries the cause: `factId` and `why` in `src/sim/brain.ts:208`, and facts in `src/sim/social.ts:103–112`.

**Concrete fix:** Carry a stable incident ID through theft → discovery → accusation → confrontation → resolution. Add expandable context such as “Because Jen took Edgar’s book” and “Rosa’s opinion of Jen −20.” Let the event row focus the scene; keep name clicks for character inspection.

**Effort:** M

### 7. Make the Drama filter match viewer expectations

**What’s wrong:** `13_feed_drama.png` includes ordinary weather entries, while fabricated rumors and their spread fall under Social. `src/ui/ui.ts:54` classifies solely by broad event kind, hiding some of the game’s central drama from its own filter.

**Concrete fix:** Add explicit event tags for conflict, romance, deception, gathering, and weather. Include lies, exposure, and consequential gossip in Drama; keep routine rain in All. Distinguish “false rumor” from “confirmed deed” with compact badges rather than repeated parenthetical prose.

**Effort:** S

### 8. Turn the gazette and recap into story summaries

**What’s wrong:** `09_gazette.png` headlines Jen’s theft but devotes its body to alliances and a gathering, omitting the headline’s explanation. `15_recap.png` spends its limited slots on early invitations and rumor reach, omitting later payoffs because `src/ui/ui.ts:149` takes the first eight qualifying events.

**Concrete fix:** In `src/sim/director.ts:15–17`, reserve the lead paragraph for the headline incident, then choose distinct secondary stories. For recap, select complete incident arcs before sorting them chronologically. Add a numbered opinion axis and incident markers to connect graph changes with events.

**Effort:** M

### 9. Distinguish affection from romance

**What’s wrong:** Ordinary gifts add `.5` love and display hearts (`src/sim/social.ts:57–65`). Combined with the heart-eye expression in `06_expressions.png`, friendship, gratitude, and attraction share the same visual language. Viewers cannot reliably infer romantic intent.

**Concrete fix:** Make ordinary gifts primarily increase joy and gratitude; reserve strong love, pink hearts, and bashful poses for attraction. Add unmistakable body cues: a tentative lean for flirting, recoil for rejection, slumped shoulders for heartbreak, and guarded posture for suspicion.

**Effort:** S

### 10. Preserve seated poses during conversation

**What’s wrong:** `src/sim/sim.ts:176` switches seated characters to full-body `talk`; party seating does the same at `:311`. `src/agents/avatar.ts:113–114` gives only `sit` the seated hip and leg pose. Characters can consequently rise out of their seats while still occupying them.

**Concrete fix:** Separate the lower-body seating pose from upper-body gestures. Retain seated hips and legs while blending talking arms, head turns, drinking, or laughter. Apply this consistently to benches and campfire seats.

**Effort:** S

### 11. Make rain immediately recognizable

**What’s wrong:** `19_rain.png` looks sunny and dry ten simulated minutes after a “summoned storm”; the header still shows sunshine. Some delay is intentional: simulation rain ramps over game time (`src/sim/sim.ts:132`), then particle rain ramps again over wall time (`src/world/fx.ts:100`).

**Concrete fix:** Trigger an immediate cloud-shadow and audio transition when a storm starts, then fade in drops. Drive the weather icon from an explicit incoming/raining/clearing state. Add subtle ground darkening and stronger rain-dependent sunlight suppression in `src/world/sky.ts:36–45`.

**Effort:** S

### 12. Make sheltering a visible behavioral response

**What’s wrong:** “Everyone ran for cover” is asserted unconditionally (`src/sim/sim.ts:134`), but rain only sets `replan`; existing actions generally continue. Shelter selection is probabilistic and excludes events (`src/sim/brain.ts:70–72`), so the narrated urgency exceeds the behavior.

**Concrete fix:** Narrate “Villagers are seeking shelter,” then interrupt eligible outdoor routines with a shelter action. Keep personality exceptions visible—one stubborn worker stays out—and provide a readable destination cue. Give outdoor parties an explicit shelter, relocation, or cancellation rule.

**Effort:** M

### 13. Keep suspicion separate from knowledge

**What’s wrong:** The theft sequence has good story potential, but `src/sim/social.ts:174–177` tells the victim exactly who stole the item whenever any witness sees it, even if the victim did not. Confrontation dialogue then largely uses generic taunts (`src/sim/social.ts:149`), wasting the remembered incident.

**Concrete fix:** Give observations only to actual witnesses; transfer knowledge to the victim through a warning. Store source, confidence, and evidence per listener. Pass the grievance into dialogue: “Mara saw you take Edgar’s book” communicates much more than “You’re a menace.”

**Effort:** M

### 14. Show directional relationships

**What’s wrong:** `14_relationship_web.png` says “Who likes whom,” but `src/ui/web.ts:8` averages both opinions. Admiration and rejection can cancel into a neutral or invisible edge—the exact asymmetry needed to understand Tom/Mara and Jen/Ollie.

**Concrete fix:** On selecting a node, show outgoing and incoming feelings separately, with arrowheads and values. Keep mutual relationships as the quiet default, but give crushes and partnerships distinct symbols. Show the latest cause of a change on edge selection.

**Effort:** M

### 15. Give gatherings differentiated social beats

**What’s wrong:** `07_party_night.png` has the strongest atmosphere, but attendance mostly cycles through fixed poses, generic banter, and small opinion gains (`src/sim/sim.ts:311–317`). The system gathers personalities together without fully using their conflicting histories.

**Concrete fix:** Add a few contextual party beats: the host welcomes a late arrival, a crush chooses a nearby seat, an enemy refuses a toast, or someone leaves after gossip. Score these from existing relationships and memories, with cooldowns and quiet intervals. Preserve peaceful gatherings as a valid outcome.

**Effort:** M

## Bugs spotted

- **Party attendance can repeatedly cancel its own approach.** `src/sim/sim.ts:285–288` checks active `attend` actions but not queued ones, then resets accepted guests every tick. Interruption of an indoor `enter` action also skips cleanup of `v.inside` and `place.inside`. Introduce an attendance commitment and a centralized action-cancellation path that cleans up occupancy and reservations.

- **The pursuer’s fight action can be discarded immediately.** In `src/sim/sim.ts:183`, `caught()` can replace the pursuer’s action with `fight`, but the old chase returns `true`; `:155` then clears `v.act`. Clear a completed action only if it is still the action that was executed.

- **Failed navigation becomes obstacle-crossing movement.** `src/sim/sim.ts:92` substitutes a straight line when A* fails. Return a failure result and retry a reachable destination instead of walking through blocked geometry.

- **Overlapping conversations can execute out of order.** `src/ui/ui.ts:25` appends dialogue schedules, while `:77` processes only the queue head. A later-appended conversation’s early lines can wait behind another conversation’s future lines. Maintain a time-sorted queue.

- **Gossip hop count is shared across branches.** `src/sim/social.ts:198` mutates the shared fact’s `hops`; `src/agents/memory.ts:15` stores the same fact object for every listener. Separate transfers inflate one global count and incorrectly suppress later event importance. Store provenance per listener or transmission.

- **Work effects have two strike drivers.** `src/sim/sim.ts:210` invokes `onHit`, while `src/agents/avatar.ts:91` and `:100` also invoke it from animation phase crossings. This permits duplicate or speed-dependent effects and audio. Make one clock authoritative.

- **Routine schedules overlap beyond midnight.** `src/sim/brain.ts:25` adds the tavernkeeper’s sleep through hour 33, then `:35` appends another sleep block from 24–30. Generate one non-overlapping schedule, including explicit overnight carryover.

- **Live card refresh replaces interactive DOM every 350 ms.** `src/ui/ui.ts:94–96` calls `renderCard()`, which rebuilds its contents at `:119–128`. This can disrupt focus and ongoing interaction. Preserve the shell and update changed values.

- **Relationship graph is a stale snapshot.** `src/ui/ui.ts:134` draws it only when opened while the simulation continues. Refresh it on relevant changes or label/pause the snapshot.

## Quick polish list

- **Reduce ground contrast:** `02_plaza_lunch.png` is dominated by pale cobbles. Lower their highlight contrast in `src/world/groundpaint.ts:19–23` so characters lead the eye.
- **Improve character lighting:** `07_party_night.png` has appealing warm light, but several faces read nearly black. Add restrained face fill and review avatar shadow reception in `src/agents/avatar.ts:29`.
- **Use a consistent identity accent:** Outfit colors and UI identity colors differ enough to slow recognition. Add a small consistent trim or badge without recoloring whole costumes.
- **Respect UI safe regions:** Clamp bubbles below the header and outside panels in `src/ui/ui.ts:81–91`; `20_scuffle.png` has speech clipped at the top.
- **Label negative leaderboard bars:** `src/ui/ui.ts:101` draws absolute magnitude in the same direction. Use a zero-centered bar and show recent change.
- **Explain influence:** Expose the contributors from `src/sim/sim.ts:86`, such as allies, admirers, and fear, through a compact score breakdown.
- **Add day separators to Chronicle:** Repeated clock times across days make `13_feed_drama.png` harder to follow (`src/ui/ui.ts:58`).
- **Keep the newspaper readable:** Replace the unconditional nine-second dismissal in `src/main.ts:120` with user dismissal or a reading-aware timer.
- **Make festival anticipation explicit:** `17_festival.png` shows bunting over an almost empty plaza. Display “Guests arriving” and attendee count before promising a celebration.
- **Ground dialogue in current conditions:** Gate greetings and weather lines in `src/sim/lines.ts:36–46` by time and weather; avoid claims about tree felling when v1 keeps trees standing.
- **Remove accidental economy cues:** “One copper” in `src/ui/ui.ts:142` implies a transaction in a deliberately economy-free game. “Village morning edition” fits the intended scope.