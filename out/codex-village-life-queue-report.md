# Village arrival queue fix

Date: 2026-11-16. Worktree: `/workspace/cel-town-wt/life-queue`, branch `village/life-queue`, based on main `9dfc5f0`.

Fixed the P2 shared-entry stacking from the day-in-the-life review. Each resident now has a stable slot for each registry place they visit. Slots form a small staggered frontage around the registry entry, with at least 0.95m between roots, at most 3m from the entry, and less than 3.95m between participants so the existing four-metre speech precondition still passes. Assignments use sorted place/resident IDs and the seeded town geometry; they remain unchanged across hours, repeated seeks, and resident iteration order. A resident changing activity at the same place keeps their slot.

`src/life/arrival-slots.js` creates runtime-only navigation leaves connected to the registry entry. Candidates stay within the town ground boundary and clear the existing navigation blockers, fences, and every registry building footprint. Short approach segments are sampled every 0.05m with 0.33m clearance, exceeding navigation's 0.30m clearance even between samples. Unavailable space fails explicitly rather than overlapping residents or placing them inside a building.

There is one marked life-queue hook in each shared runtime file touched:

- `people.js` supplies the resolved catalog to the new helper.
- `routine-runtime.js` installs slots after reservations are built and passes the resolver into the tool world.
- `destinations.js` resolves the place and its reachable registry entry first, then selects that resident's slot. Registry callers without the runtime resolver retain entry-node behavior. A populated registry still cannot fall back to symbolic destinations.

Reservations point to the same slots used by movement, preserving social arrival checks without changing `social.js`. Ordinary walking follows graph routes into slots; seeking uses the existing people seek path. No hardcoded world coordinates, compiler/catalog/props/camera changes, compiled JSON changes, or frozen hash edits.

## Validation

| Check | Result |
| --- | --- |
| `npm run test:life-routines` | PASS, 9/9 |
| `npm run test:checks` | PASS: negative checks, batches, medium seeds 1/7/1234, browser/Node JSON parity |
| `npm run test:parity` | PASS: 31 hamlet seeds, four large seeds, forward/reverse, frozen fixtures, one-ulp perturbation |
| `npm run test:world-registry` | PASS, 11/11 |
| `git diff --check` | PASS |

The focused regression checks twelve distinct tavern positions for seeds 1, 7, and 1234, approach clearance, speech range, unchanged registry entries, and identical assignments with reversed resident iteration. The runtime seek regression checks actual adapter positions against slot nodes, all schedule boundaries, assigned home/work identity, repeated seeks, and distinct positions for everyone sharing a place.

An additional local Vite SSR smoke check instantiated the actual `createPeople` implementation with Three.js scene roots. After seeking to lunch, it ticked movement into the 13.5 work beat; then it sought to 17.99 and ticked the 18.0 supper transition. Residents walked before acting and all twelve finished supper at distinct positions.

Local Chrome/SwiftShader captures use seed 1234, Wednesday/clear, post enabled. `node tools/shots-village-life-queue.mjs` (with Vite at localhost:5178) checks scene root positions against contexts, all twelve completed actions, distinct positions, repeatable seeks, and active social events. Lunch retains chat, shopping, meals, and play. Zero page errors. Evidence and three stills are under `shots/village-life-queue/`: `plaza.png` (16.5), `family-supper.png` (18.75), and `lunch.png` (12.021). Evening lighting remains dark; the lunch still provides the brighter view of the inn frontage.

An exploratory allocation smoke also passed seed 42. Seed 99 fails earlier in the unchanged routine binding with `Unreachable routine destination: townsfolk-baker tavern`, before arrival-slot installation; that existing destination reachability issue is outside this fix.

Work stayed in this worktree. Existing untracked launcher, dependency, and licensed-asset entries were left alone. Local commit only; no merge, push, deploy, purchase, external model call, or GPU service.
