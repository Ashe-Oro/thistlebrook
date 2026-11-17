# Living town review polish

Base: `0c8d983`. Scope: the six review items on the 18-district integration. Use the existing
private asset mappings; no licensed models are included in this commit.

- Merrymead: three picnic circles, two ring-toss stalls with flower carts, and
  a skittles lane fill lawn gaps. Existing owned crates, produce, benches,
  stalls and townsfolk supply the dressing. The added guests sway during
  daytime visits and leave overnight. Shared routes and ride queues stay clear.
- West Works: the activity panel and happenings card read the same live
  workers/commuters state through `workStatus`. The counters explicitly describe
  session output, so a fresh visit can show zero without claiming active
  production. The mobile update also guards the legacy tab removed by the
  grouped navigator. Production still requires residents physically working at their
  assigned stations; stock is never invented from the clock.
- Coral Coast: beach fabric stays outside the static bake. Canopies fold from
  7pm until 7am and reopen on clock jumps, including while paused.
- Overview: resizing the canvas clears its WebGL drawing buffer. The resize
  handler now draws immediately, including when the capture runner disables
  animation frames. Camera fitting and the quarter-turn transforms are intact.
  The previously blank rotated overview has been recaptured.
- Navigation: the menu has an opaque background; mobile copy and activity cards
  hide while it is open. The grouped menu remains scrollable and dismissible.
- Tour: 24 frames per stop at 8fps gives each of the 20 stops three seconds
  (60 seconds total). The existing transitions retain their duration; the hold
  is longer. The Works caption uses live staffing copy.

## Evidence and reproduction

Run the dev server with `npm run dev -- --port 5200 --strictPort`.
`node tools/capture-sol-polish.mjs after` saves review screenshots and browser
assertions under `shots/sol-polish/`; `before-*` preserves the baseline.
The baseline rotated overview is the blank artifact supplied for review;
a fresh baseline capture also established that quarter-turn fitting was sound.

`node tools/film-astra-round3.mjs` records
`shots/astra/95-world-tour-slower.mp4` and its companion
`round3-tour-slower-evidence.json`. Frames remain ignored under `.frames/`.
The script uses port 5200.

Validation: production build; all 89 pre-existing Astra tests; the added staffing
status regression test; browser checks for registry coverage, live production
and shipping, matching status cards, folding umbrellas, and all four overview
rotations after canvas resizing. Browser results are saved with the captures.

The morning production run at 10:24am reached 34 produce crates and 26 timber
loads in stock, with 32 shipped; four residents were working and one commuting.
The corresponding desktop capture is `after-works-producing.png`. All twelve
beach umbrellas were open at 18:59 and folded at 19:00, then reopened at 07:00.
