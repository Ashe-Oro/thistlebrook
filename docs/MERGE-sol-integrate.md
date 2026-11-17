# Sol registry / polish integration

Base: `village/sol-registry2` at `896450e`. Merged `village/sol-polish`
(`30801f4`) with both parents retained. Development and every browser capture in
this lane use **5201**, with strict port selection. Licensed assets remain in the
ignored private mapping; the commit contains source, placement metadata and
rendered evidence only. Existing untracked `SOL.md` and `sol-out.txt` are excluded.

## Merge resolution

The textual conflict was in Coral Coast's umbrella builder. Keep the registry's
furniture identities on the pole, finial and canopy, while retaining the polish
branch's separate, animated beach fabric. Static batching still preserves IDs;
beach canopies fold at 19:00 and reopen at 07:00, including paused clock jumps.

Merrymead's eleven new owned model placements from the polish branch also needed
manifest reconciliation. Recaptured and reviewed the manifest: 261 static models,
plus seed-authored woodland placements. The registry continues to reject unknown
models rather than assigning an unrelated assembly identity. The polish branch's
lawn games, picnic circles, live Works status, resize redraw, opaque menu and
slower tour are retained. Its existing screenshots and movie remain merge assets.

## Requested fixes

- **Switchyard:** the rest stop now occupies the flat pedestrian deck inside the
  skatepark, behind the entrance sign and beyond the street rail. Its measured
  reservation fits local `[-9.4,8.7]` to `[-3.8,14.1]`, clear of the bowl,
  pump track and riding line. Connect from the actual venue entry; the previous
  airport-side forecourt connector disappears. Preserve the seat's registry ID
  and exclusive resident lease. Raise props, paving and seat height with the
  0.2m deck. Finn walks about 167m from home and sits on this bench in evidence.
- **Merrymead:** two compiler-authored scenes fill the southeast entrance lawn:
  a low picnic table with basket and flowers, and a drum with flower cart and
  picnic supplies. Recipe membership and companion gaps come from the catalog.
  Candidate reservations stay inside explicit lawn bounds and clear model/venue
  envelopes, shared paths and other scenes. The existing front aisle and slot
  clearance rules apply. Both activities join the pedestrian graph and use the
  resident executor. Ada and Theo walk about 269m and 265m and acquire real slots.
  Music uses the existing generic `work` pose; there is no separate music scheduler.
- **Mobile:** the hero's navigation override lost to later base CSS at equal
  specificity, leaving text both visible through and below Explore. A scoped
  `.astra-ui .intro` rule reserves space below the control, and its surface is
  opaque. Closed-menu text clears the control; opening the menu hides underlying
  copy/cards with the merged polish rule.

The town has 21 catalog scenes, 61 member props and 25 catalog activity slots.
Seed 831 has **687/687 models**, **1,444/1,444 logical placements**, and 1,604
registry records. Regenerated [inventory](REGISTRY-INVENTORY.md) documents them.

## Validation and evidence

```sh
npm run dev -- --port 5201 --strictPort
npm run test:astra
node --test tests/astra-registry-expansions.test.mjs
npm run build
npm run inventory:astra:registry -- --write-doc
node tools/capture-sol-integrate.mjs after
ASTRA_SHOTS=shots/sol-integrate/polish node tools/capture-sol-polish.mjs after
```

The full existing suite passes 93 tests. The expanded registry file passes four
checks, including the added deck/lawn regression over seeds 0, 831 and 99.
Production build passes with the existing chunk-size and mixed-import warnings.

Before/after captures are in [shots/sol-integrate](../shots/sol-integrate/):
`before/after-skatepark-resident.png`, `before/after-fair.png`,
`before/after-mobile.png` and `before/after-mobile-menu.png`. The lawn close-up
also shows Ada and Theo at their activity props. Baselines were captured from
`896450e` before applying the integration changes.

`after-evidence.json` records model/furniture render coverage, navigation aliases,
all executable slot routes, rejected interactions, resident journeys with pace
checks, mobile separation, and seeds 0/99. `polish/after-evidence.json` records
four overview rotations after resize, umbrella clock boundaries, matching Works
status, and actual worker-produced/shipped goods. The capture runner accepts
`ASTRA_URL`/`ASTRA_SHOTS` for isolated verification without overwriting historical
polish evidence.

Final browser results: 421/421 expansion models at seed 831, 412/412 at
seed 0 and 415/415 at seed 99; no missing furniture, render IDs, failed
slot routes, rejected interactions or page/network errors. Mobile hero top is
168px, below the navigator bottom at 145px. All twelve beach umbrellas follow
the clock boundaries. Overview rotations have 78/25/78/32 sampled colors after
resize. Four workers produce about 34.82 crates and 26.59 timber loads, with
32 loads shipped; the two Works status displays agree.
