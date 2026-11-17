# Sol merge 4

Merged `village/sol-assets` (`cff3bbf`) and `village/opus-review` (`a8eded7`)
into `village/sol-merge4`, based on `5e9d64c`. The base already includes the
registry, polish and integration fixes. Development and browser checks use
**port 5204** with `--strictPort`. No licensed assets are committed or pushed.

## Resolution

The scene catalog keeps both Merrymead lawn recipes and their bounded placements,
as well as the asset branch’s groups, recipes and vignette specifications.
The compiler still places Switchyard’s rest stop on the pedestrian deck and
retains the fair’s picnic garden and rhythm corner. All 17 asset vignettes survive,
with 56 member props and independently reservable activity points. The complete
catalog has 38 placed scenes, 117 members and 81 activity slots at seed 831.

The inventory conflict was resolved by regeneration from the combined compiler,
rather than choosing either branch’s generated rows. Seed 831 registers
**743/743 models** and **1,624/1,624 logical placements**, with 1,857 registry
records and no missing placements. Scenery uses 136 of 561 owned model records;
331 of 467 individual models remain unused. The review branch contributes its
report and rendered evidence without changing runtime code.

## Item 9 fixes

- Registry activities and follow cards share readable activity copy, including
  “Playing the taiko drum,” “Sorting the harvest,” and “Warming hands at the
  campfire.” Walking to an interaction describes that activity; prop asset keys
  remain metadata. Explicit vignette labels are retained.
- `eat` now says breakfast from 05:00–11:00, lunch from 11:00–16:00, supper from
  16:00–22:00, and a late snack otherwise. The executor’s meal text is tested at
  07:00, noon, 19:00, 21:00, 23:00 and 02:00.
- Ordinary homes and the Washhouse no longer advertise meal shopping; Nell’s
  actual corner grocer retains it. This removes the accidental
  Washhouse grocery destination. Routine restocking begins at a deterministic
  per-resident time between 08:00 and 11:00; urgent hunger still takes priority,
  and work shifts retain their existing start times.

The requested three quick fixes are included. The review’s broader proposals,
including closing-time trip budgets and redesigned district populations, remain
outside this merge.

The full suite exposed two pre-existing legacy `life-props` failures: player
`walkTo`, `buy` and `eat` collided with canonical resident tools. Player tools now
have a separate scope selected by the existing props world adapter. Resident
implementations remain intact; both the player tests and resident routine tests
pass together. This also validates the player target schema without requiring a
resident ID on the player context.

## Validation

```sh
npm run dev -- --host 0.0.0.0 --port 5204 --strictPort
node --test tests/*.test.mjs tools/*.test.mjs
npm run test:checks
npm run test:parity
npm run build
npm run inventory:astra:registry -- --write-doc
node tools/capture-merge4-integrate.mjs after
node tools/verify-merge4-assets.mjs after
node tools/capture-merge4-copy.mjs before
node tools/capture-merge4-copy.mjs after
```

All **131 tests pass**. Compiler negative, batching and medium checks pass.
Parity checks match full compiler JSON across 31 seeds in both orders, including
one-ulp math perturbation. Production build passes with the existing mixed-import
and bundle-size warnings.

Browser evidence lives in [shots/sol-merge4](../shots/sol-merge4/). The integration
runner checks rendered registry identities, furniture, all activity routes,
navigation aliases, mobile menu separation, and seeds 0/99. Mabel and Bram reach
the harbor/fair stops; Finn reaches the Switchyard deck bench; Ada and Theo reach
the Merrymead picnic and music activities. The asset runner checks every placed
vignette and sends Mabel to the garden exchange, Bram to the woodcutters and Finn
to the hay delivery. Their walks obey pace limits, acquire exclusive leases, use
the expected poses and complete activity cycles.

`integrate/before-*` and `assets/before-*` show the merged scene before text fixes;
`after-*` shows the final result. The copy runner recreates baseline behavior by
serving the four original registry/life modules from `5e9d64c` over the merged
world. Its morning, 21:00 meal and music stills compare the old and new copy;
JSON files retain the exact activities and destinations. In the fresh 07:00
sample after 60 simulation seconds, walking residents drop from 25 to 7 and
residents resting at home rise from 8 to 32; the remaining walks include real
work commutes. This is a fresh-load sample rather than a replay of the review’s
full-day Washhouse sample. The baseline module
substitution is local to the Playwright page and does not alter source files.

Only source, metadata, documentation and rendered evidence are staged. Existing
untracked `SOL.md` and `sol-out.txt`, ignored private asset mappings, models,
build output and generated `out/` files are excluded. Everything stays local.
