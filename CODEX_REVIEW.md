<!-- Round 3 Codex critique of master ea5c5f3 (codex exec, read-only sandbox, 2026-11-09 18:59 EST). The round-2 review is in git history. -->

# Thistlebrook — round-2 critique

Static source review against README.md and QA_STATUS.md. No files modified, no network used, and no access to `licensed/`. Findings below are code-derived; performance estimates are unmeasured.

## 1. Correctness bugs

| Priority | Location | Problem → concrete fix |
|---|---|---|
| **P0** | `src/core/save.ts:66` | **Failed saves alter the running village.** Any storage exception—including disabled storage—halves memories and story logs, up to three times. This changes subsequent reflections and decisions. Thin a detached save snapshot; never mutate live state during serialization. Distinguish quota errors from other failures. |
| **P0** | `src/core/save.ts:82` | **Resume strands indoor villagers.** Actions are cleared while `v.inside` and `doing` survive. Only completing an `enter` action clears `inside`; a subsequent outdoor action can leave someone permanently invisible and excluded from social interactions. Restore declarative actions, or normalize indoor state and rebuild place occupancy before replanning. |
| **P1** | `src/core/save.ts:81` | **Resume silently cancels active interventions.** Gifts disappear; visitor/festival timers reset, while festival parties and attendance survive. Restore these set pieces from simulation state and regenerate their visuals. |
| **P1** | `src/core/save.ts:77` | **Invalid saves can partially overwrite live villagers.** `decode()` mutates them before version validation; later failure returns `false` without rollback. Decode into detached records, validate version/schema/references, then commit atomically. |
| **P1** | `src/main.ts:391` | **`fastForward(0)` and negative inputs still advance one tick.** Every call rounds upward and ignores `simAcc`, so splitting a duration into calls changes elapsed simulation time. Reject invalid/negative inputs, make zero a no-op, and share the accumulator. Restore `ui.quiet` with `try/finally`. |
| **P1** | `src/main.ts:341` | **Fast-forward can launch dawn presentation.** `quiet` suppresses toasts and beats but does not guard the dawn montage/paper listener. Advancing several days synchronously can overwrite montage callbacks and create competing paper timers. Gate dawn presentation during fast-forward; optionally show one final recap afterward. |
| **P1** | `src/main.ts:294` | **Camera obstruction tests include decorative geometry.** Whole-scene raycasts treat fish, birds, transparent effects, and meshes under invisible parents as blockers; checking only `object.visible` misses ancestor visibility. Use an explicit obstruction layer containing buildings, trees, and solid props. |
| **P1** | `src/main.ts:201` | **Director clearance tests a different camera position.** `off.length()` is a spherical distance, but `clearYaw()` treats it as horizontal distance and adds height separately. Test with `Math.hypot(off.x, off.z)` and the actual camera height. |
| **P1** | `src/main.ts:307` | **Beat clearance becomes stale.** `yawOff` is computed once while subjects, yaw, and camera distance continue moving. Recheck periodically against the proposed camera position. If every candidate is blocked, raise/pull back instead of returning indistinguishable offset `0`. |
| **P1** | `src/ui/ui.ts:226` | **Open cards stop updating their substantive contents.** The early return refreshes mood, thought, action, and needs only. Relationships, inventory, romance, plan, memories, and Story remain frozen until switching tabs or villagers. Refresh affected sections using state revisions. |
| **P1** | `src/ui/ui.ts:108` | **Updated gossip keeps its old filter category.** A viral row can acquire a false-rumour badge through `eventUpdate` but retain `data-cat="social"`, disappearing from Drama. Recompute category, importance class, minor status, and filtering on updates. |
| **P2** | `src/ui/ui.ts:95` | **Folded rows retain the first event’s identity.** Time/count change, but `data-id` and arc chip still identify the original event. Later updates target the wrong occurrence or no row. Track represented event IDs explicitly and refresh the chip/count consistently. |
| **P2** | `src/ui/ui.ts:105` | **Important captions disappear on collapsed mobile feeds.** “Visible” checks the filter only, ignoring chronicle collapse and cinematic hiding. Check actual panel visibility before suppressing captions. |
| **P2** | `src/ui/ui.ts:130` | **Toast “refresh” does not refresh lifetime.** A duplicate arriving just before 4.2 seconds updates text and immediately fades. Store and reset both dismissal timers. |
| **P1** | `src/sim/director.ts:22` | **The Gazette can still headline a forbidden event.** `?? evs[0]` restores a secret crush or fabricated rumour when no eligible event exists. Fall back to a quiet-day headline and omit its story. |
| **P1** | `src/sim/director.ts:30` | **Yesterday’s paper can contain today’s developments.** Secondary stories use live `at.top()` and its latest beats, constrained only by current clock. Limit all newspaper beats to the issue’s reporting window; calculate heat within that window. |
| **P1** | `src/sim/arcs.ts:133` | **Arc event indices corrupt after beat eviction.** `beats.shift()` leaves every stored `byEvent.idx` unchanged. Updates can overwrite a different beat, and chips report incorrect beat numbers. Store stable beat references/IDs and prune mappings when evicting beats and arcs. |
| **P1** | `src/sim/sim.ts:98` | **Failed navigation becomes walking through obstacles.** A null path falls back to the direct destination. Fail/retry the action or choose a reachable alternative; never substitute an unchecked straight path. |

**Ambient-specific:** `src/world/ambient.ts:20` chooses positive rotation in both ternary branches; use `-1` for one branch if mixed circling was intended. Birds use wall-clock phase (`:44`), while birds/fish continue during pause (`:42`, `:53`). That can be intentional ambient animation, but replay and pause semantics should be explicit. The rainbow’s reversed-edge `smoothstep(1., .82, t)` (`:32`) is undefined GLSL behavior; replace it with `1. - smoothstep(.82, 1., t)`.

## 2. Determinism risks

- **The seed does not initialize the simulation RNG.** `src/main.ts:45` seeds global `Math.random`; `src/sim/sim.ts:17` always constructs `RNG(20261109)`. Initialize dedicated simulation/world streams from the requested seed.
- **Rendered world state feeds decisions.** The dog moves in `World.update()` (`src/world/world.ts:329`), while `UtilityBrain.ambient()` targets its current position (`src/sim/brain.ts:135`). Different frame rates, speeds, or fast-forward change navigation and action timing. Move decision-relevant animal state into fixed simulation ticks.
- **World RNG mixes rendering and simulation.** Leaf selection, animal destinations, and ducks consume `world.rng` per render (`src/world/world.ts:303`, `:323`, `:342`); brain decisions read world state. Separate cosmetic randomness completely.
- **Random comparators are unstable.** Resource selection consumes `sim.rng` inside sorting comparisons (`src/sim/brain.ts:173`, `:178`, `:183`). Comparison counts/order can vary by engine. Assign one random score per candidate, then sort deterministically.
- **Camera activity changes wall-time progression.** Beat cooldowns use `performance.now()`, while beats/montages slow simulation (`src/main.ts:276`, `:359`). Same seed at equal wall time can diverge in elapsed game time even if fixed-tick events match. Define replay guarantees by tick count and log interventions at ticks.
- **Save/resume is not a deterministic continuation.** Actions/callbacks, world state/RNG, accumulator, memory ID counter, and editorial RNG are not restored. Clearing actions changes the next RNG-consuming choices.
- **Gazette randomness depends on viewing.** Camera picks and paper generation share module-global `ED` (`src/sim/director.ts:9`). Opening early editions or changing camera behavior changes later newspaper wording. Derive editorial randomness from seed/day/event IDs.
- **Async interventions depend on microtask timing.** Traveller/festival gameplay changes occur after asset awaits (`src/sim/god.ts:26`, `:51`). Commit gameplay immediately at a simulation tick; load visuals independently.
- **Optional LLM mode is inherently asynchronous.** Responses apply to live state without request-day/revision checks (`src/sim/llm.ts:44`). Reject stale results and record accepted outputs for replay.

## 3. Performance hot spots

Estimates indicate likely impact, not benchmark results.

| Location | Hot spot | Estimated impact / improvement |
|---|---|---|
| `main.ts:294` | Up to ten recursive whole-scene raycasts per clearance check, including merged scenery and instanced borders. | **High hitch risk:** potentially multi-millisecond bursts. Raycast simplified obstruction meshes; reuse hit buffers and spatially shortlist candidates. |
| `core/save.ts:58` | Synchronous graph encoding and localStorage writes. Keeping 400 `events` does not bound `dayStats`, which still references historical events. | **High over long sessions:** growing pauses and eventual quota failure. Bound retained days and serialize a deliberate snapshot schema. |
| `sim/arcs.ts:128` | Evicted arcs remain reachable through `byEvent`; `seen` also grows indefinitely. | **Medium long-session memory risk.** Remove expired mappings and bound event retention. |
| `ui/ui.ts:135` | Every bubble forces layout through `offsetWidth`; fast-forward still queues conversations and creates icons/bubbles. | **Medium burst cost:** several layouts/DOM mutations during social peaks. Suppress transient presentation during catch-up and batch animation restarts. |
| `ui/ui.ts:166` | Bubble positioning parses CSS transforms back into numbers, allocates rectangles, and repeatedly scans nearby bubbles. | **Low–medium at 12 villagers.** Keep numeric layout records and perform measurements before writes. |
| `main.ts:77` | Portraits render the whole scene, up to twice per frame. | **High transient GPU cost**, especially software rendering. Use a small studio scene and cached portrait assets. |
| `agents/avatar.ts:35` | Tool/carry changes allocate new geometry/materials without disposal; `props.ts` builds many separate meshes. | **Medium cumulative GPU-memory risk.** Cache prop variants per avatar or dispose owned resources on replacement. |
| `world/nav.ts:38` | Each path allocates grid-sized typed arrays; pursuing social targets repath every 2.5 game minutes. | **Medium at 16×**, with GC bursts. Reuse search buffers and avoid repathing until targets move meaningfully. |
| `main.ts:132`, `world/world.ts:317` | Per-frame expression arrays/sorts, vectors, plot colors, and avatar arrays. | **Low individually.** Reuse scratch values after fixing raycasts, portraits, and saves. |

## 4. Drama / storytelling quality

- **Give events structured causes.** Arc grouping currently infers causality from prose and actor pairs. Add `factId`, `causeEventId`, `keepsakeId`, and outcome fields; use them for reliable “because…” summaries.
- **Separate truth, belief, and public knowledge.** A false-rumour badge tells the viewer the truth, but the interesting question is who believes it and why. Show the source, believers, doubters, and the first contradictory witness.
- **Make consequences persist visibly.** Alliances mostly grant banners and influence; give them small behavioral effects: defending members, refusing invitations, or helping recover keepsakes.
- **Broaden resolutions.** Add witnessed restitution, reluctant truces, rejected peace offerings with returned keepsakes, and private reconciliation that the village has not heard about.
- **Make the montage honest.** `main.ts:248` films yesterday’s coordinates populated by today’s world. Save a tiny event snapshot—participants, poses, positions—or present illustrated memory cards instead of implying a replay.
- **Preserve character specificity.** Let arguments reference the remembered deed in dialogue, not only narration; gate romantic gestures and forgiveness by relationship history.

## 5. Cheap wow-factor ideas

- **“Why now?” chip:** one sentence linking an action to its strongest memory or need.
- **Rumour trail:** briefly animate existing relationship-web edges as news spreads.
- **Before/after relationship badges:** “Trust −22 · heard from Jen,” attached to major beats.
- **Dawn postcards:** save one small screenshot at major events; montage existing images with restrained camera movement.
- **Unfinished-business strip:** three open threads with a concrete question: “Will Edgar get his book back?”
- **Distinct reaction shots:** nearby witnesses turn toward a confession, theft, or accusation; reuse existing expressions and animations.

## 6. Top 10 prioritized action list

1. **M — Make saving side-effect-free and loading transactional.** Include storage-failure and malformed-save checks.
2. **M — Repair resume invariants.** Restore indoor occupancy, interventions, claims, and letter reservations; verify reload during sleep, delivery, and parties.
3. **L — Establish deterministic simulation ownership.** Seed sim/world explicitly; move decision-relevant world state into fixed ticks; isolate presentation RNG.
4. **M — Unify real-time and fast-forward stepping.** Preserve fractional time, validate durations, suppress catch-up presentation, and compare event hashes across chunk sizes.
5. **M — Replace whole-scene camera raycasts.** Use obstruction geometry, correct distance semantics, periodic rechecks, and an elevated fallback.
6. **M — Refresh open-card sections from state revisions.** Prioritize relationships, keepsakes, romance, and plans.
7. **M — Repair arc identity and retention.** Stable beat references, bounded maps, and structured causal IDs.
8. **S — Fix Gazette eligibility and reporting windows.** Include all-unprintable and dawn-boundary cases.
9. **S — Finish chronicle/toast behavior.** Reclassify updated rows, preserve folded identities, respect collapsed visibility, and reset toast timers.
10. **M — Add legible causal feedback.** Ship “Why now?”, relationship deltas, and three unresolved story questions before adding more event volume.