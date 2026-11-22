# Sunbeam Mall

Sunbeam Mall is the north–south walking street in Sunbeam Terrace, on
Thistlebrook’s west terrace. Fourteen pastel row buildings face the promenade
with shops at street level and apartments or offices above. Nell’s Corner and
The Washhouse keep their upstairs homes.

The paved promenade runs 51 m at world x −126, from z −87 to −36. It is
13.5 m wide, with a straight 6 m walking corridor between the furnishing
bands. Globe lamps, trees in planters and benches line the walk. Two chess
tables, café seating, a kiosk and a street musician share the side bays.
The north and south entrances connect to the town walking graph. The west
bus loop stays on perimeter streets.

Nell, Otis, Cleo, Rafi, Mae, Sol, Zara and Emil are selectable residents.
Their homes retain their existing parcel keys. They use the town’s shared
navigation, greetings and nighttime routines. The mall’s chess players,
strollers and café patrons use the shared clock. Pause freezes their movement,
and windows and lamps light up at dusk.

## Preview and evidence

Start Vite on an available port such as 5183.

```sh
npm run dev -- --host 127.0.0.1 --port 5183 --strictPort
node --test --test-concurrency=1 tests/astra.test.mjs tests/sunbeam.test.mjs
```

Open `/?view=sunbeam&seed=831&hour=10.4`, choose Sunbeam Mall in Explore,
or call `__astra.view('sunbeam')`. The phone view looks down at a steeper
angle so the foreground buildings leave the promenade visible. Click a
frontage for its story or a named resident to follow their day.

[Before and after stills](../shots/sunbeam-mall/) cover phone, desktop, chess
and café seating, the view down the promenade, and dusk. The
[decisions log](specs/SUNBEAM-MALL-LOG.md) records the parcel survey and
phone profile.

## Layout and rendering

- `src/astra/sunbeam-layout.js` defines the frontages, door approaches,
  plaza bounds and camera preset. The compiler reserves the mall before
  placing scenery and connects its doors to the shared walking graph.
- `src/astra/sunbeam.js` builds the architecture, paving, furnishings,
  selection bounds and ambient activity. Repeated scenery and townsfolk
  share batched or instanced geometry.
- The owned assets resolve through the existing `public/licensed` and
  `/workspace/threejs-assets` mappings.
