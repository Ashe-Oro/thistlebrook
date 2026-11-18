# Villager animations decisions and evidence

- The branch started from `2c52827`. The seed-831 gold views use the default Thistlebrook entry point. The app's existing `src/astra/` directory holds that entry point and its life executor.
- The owned source bundle supplied the bind skeleton and wardrobe. I authored 15 shared clips in code because the local bundle contains no Studio clips. The two generators keep their original static output mode and accept `--rigged` for the 12 townsfolk and 12 Edo bodies. Crowds that rely on static instancing continue to use the original mesh URLs.
- I projected the shared licensed directory into this worktree with symlinks and wrote the generated rigs into a local `characters/rigged/` directory. Each GLB holds one Draco-compressed, vertex-coloured skinned mesh, zero embedded animations and the 65 original colon-prefixed joint names. three.js sanitizes the colon at runtime. The character body and its ink hull use the same cloned skeleton.
- The downtown benches use the kit's two measured geometry-sampled seats per bench. Service and customer points share the rendered Corner Cup front counter. Harbor fishing inherits the existing dawn routine, and the rod follows the hand on the measured pier surface. Stillwater hikers use the pole clip on trail segments and Walk on roads.
- The gold captures stage residents at nearby graph nodes, then run real walk, slot reservation and activity requests. The historical baseline predates the new bench leases and service counter, so the comparable stills place its cast at the corresponding positions. The initial baseline capture used the unmodified app with the ordinary default cast.
- The shared asset root now contains City and Railway packs from outside this change. The existing catalog test compares its inventory to every source file on disk. I reran the required suite with `ASTRA_ASSET_ROOT` pointed at a catalog-only symlink projection so that its exact-inventory check used the source packs tracked by this branch.
- The package dry run reported 451 model files and a 26.2 MB tarball. The private upload succeeded and the tarball contains all 24 rigged characters. The temporary credentials file was removed.

## Seed 831

- The four after stills show nine clips. The bench shows Sit, Walk, Look Around and Seated Eat. The café adds Counter and Idle, the pier adds Fish, and the path adds Wave and Play.
- Ada and Finn sit in the two measured slots on one Founders Fountain bench. Rowan walks past. Bea serves Hazel at Corner Cup and Maren fishes on the pier. Fern and Rose wave at Little Oak while Theo walks and Pip plays. The camera's foreground cast uses townsfolk, so the Edo rigs were checked at export without placing Edo characters in these views.
- The noon-to-1 p.m. browser sweep took 600 steps at 10 Hz and sampled 36,000 rig poses. It found zero bind poses, a maximum seated-hip error below 0.001 mm and maximum straight-line planted-foot drift of 0.038 mm. The video is an eight-second bench and pier sequence. The four after stills also had zero bind poses.
- The blind self-review shuffled each before/after pair independently. I selected bench B, counter B, pier A and path A for readable sitting, serving, fishing and waving. All four matched the after key. I corrected the ink hull to deform with the body, cleared the pier bollard from the fisher's footing and moved the bench walker out of the foreground occlusion before the final comparison.
- The 24 rigged Draco files total 910,556 bytes. The corresponding static source GLBs total 19,236,172 bytes before the deployment compression pass. On the dev page, character transfers were 8,978,460 bytes before and 7,688,960 bytes after. Of the latter, 271,756 bytes were the runtime rigged URLs.
- The catalog-scoped Node suite passed all 186 tests. `npm run test:checks` and the production build also passed. The road audit reported zero open findings and its injected-fault test covered all four TOWN-09 conditions. The collision simulation recorded zero events across 5,400 samples.

## Rendering probe

The table reports medians from Chrome with SwiftShader at 1200 × 800. Each timed sample draws the staged frame and reads back a pixel after the warm-up draw. The repeat downtown comparison used five samples per view. The pier and path used two.

| View | Before frame, ms | After frame, ms | Before draw calls | After draw calls |
| --- | ---: | ---: | ---: | ---: |
| Founders Fountain bench | 3337.4 | 2970.1 | 543 | 497 |
| Corner Cup counter | 3355.5 | 3001.4 | 442 | 424 |
| Saltwind pier | 2702.5 | 2772.9 | 261 | 253 |
| Little Oak path | 2624.9 | 2581.1 | 351 | 333 |

The downtown medians improved by 11.0% and 10.6% in the repeat. The pier sample was 2.6% slower. The probes measure software rendering with the staged scene held still. The hour sweep separately sampled the running mixers. Raw observations and cast records are in `shots/villager-anims/{before,after}-probe.json`.
