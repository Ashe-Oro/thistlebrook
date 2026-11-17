# Downtown and Friday night

The district extension lives in `src/astra/downtown.js`; its batching and drawing
helpers live in `src/astra/downtown-kit.js`. `districts.js` builds it, calls its
update function, and exposes its stats and audit. The only other runtime edit is
a slightly wider desktop Downtown camera in `main.js`, keeping the bakery's
rooftop clear of the toolbar. Mobile retains its original framing.

## What to look for

- Seven sculpted rooftop trade signs: a loaf, boot, open book, coffee cup,
  bouquet, envelope, and civic columns. Their elevation follows the measured kit
  roof. Shop displays leave the central door corridors clear. Roof signs are clickable
  and open the same shop details as their buildings.
- Nineteen additional daytime customers and people running errands on the
  existing downtown sidewalks. The coffee cup releases little steam puffs.
- Lantern Quay's continuous lantern promenade, entry arches, venue marquees,
  beer mug, record and ice-cream silhouettes, terrace planters, and a stocked
  cocktail counter inside the Lantern Room. Forty-eight added evening visitors
  queue, stroll, linger at tables, and join the riverside audience.
- Two full stadium stands, green-and-gold scarves, travelling crowd bounces,
  Owls flags, lit scoreboard trim, floodlight halos, an entrance marquee, and
  corner snack counters. The extension adds 214 spectators and eight vendors
  and customers, alongside the original twelve spectators and ten players.

Daytime customers appear 07:00–19:00; quay visitors 17:00–01:00; the game crowd
18:00–22:00. The existing town clock labels the day Friday. These are authored
activity loops, not a new calendar, ticket economy, or competitive football
simulation. All animations use the shared elapsed time and freeze when paused.
People in this extension are ambient crowds; named residents retain their
existing navigation and selection behavior.

## Integration and assets

No changes to the map compiler, parcels, resident routing, owned asset library,
or other districts' geometry. The counters occupy the ends of the stadium
concourse and leave its centre entrance open. The original twelve north-stand
spectators are explicitly left space in the new crowd.

Crowds use instanced owned `townsfolk-*` meshes, including their ink hulls.
Instances are grouped by role and opening period; closed groups are hidden and
district bounding spheres enable camera culling. Static furnishings share
geometry and materials and are baked to instances. No raw models are included.

## Evidence

Start the server with `npm run dev -- --port 5180 --strictPort`, then run
`node tools/shots-astra-downtown.mjs`. The runner exclusively uses port 5180,
writes desktop/mobile captures and `evidence.json` to `shots/astra-downtown/`,
and checks asset responses, seven roof identities, opening/closing times,
pause/resume, original shop picking, and the size of the evening crowds.

The existing `npm run test:astra` covers map connectivity and clear parcels
across 100 seeds; `npm run build` checks production bundling. Licensed assets
remain excluded from the production bundle and must be served privately as
before.
