# Phone opening view

## Reference
Ashe's phone screenshot (Nov 21, 10:11 AM ET): after loading, the page opens on the whole island as a small shape in the middle of a big teal screen, with roughly half the screen empty water. It reads as a map thumbnail, not a place. /workspace/scratch/fast-load/compare-phone-opening.png shows the same thing before and after the fast-load work.

## Details
- First view on phone (portrait, about 390x844) opens close on the village centre (the main square and its houses) so the buildings fill the screen width edge to edge and you can see villagers and individual houses. Desktop opens on the same spot at a zoom where the village fills most of the screen (not the whole island).
- The home button still returns to this opening view; zooming out still shows the whole island; a `#x=..&y=..` hash in the URL still wins over the default.
- Because the opening view is smaller, the first-view streaming from FAST-LOAD should need fewer districts before ready. Keep the nearest-first streaming for the rest.
- Keep everything else the same: the camera angle, the look, and the controls.

## Tools
Existing camera/view code in the repo, tools/load-probe.mjs, and the headless capture already used for /workspace/scratch/fast-load.

## How to work
Blind critic loop: capture phone and desktop opening stills, then judge them blind against "does this feel like standing in a cozy village, with no big empty water". Measurable targets: on the phone opening, at most 15% of pixels are background water/sky. Phone transfer before ready is no higher than today's 3.59 MB, and lower is better. test:ci is green with the scoped asset root. The home and hash tests are added or updated.

## Deliver
Local commits on village/fast-load only: no push, no deploy, no models:upload. Add a CHANGELOG entry. Put the stills in /workspace/scratch/phone-opening/ as before-phone.png, after-phone.png, before-desktop.png and after-desktop.png, plus probe.json.
