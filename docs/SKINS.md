# Skins: restyle the village like a CSS theme

A **skin** is one small data file that restyles the whole village at runtime: light, palette, materials, glow, and post. It's like a stylesheet. The world (meshes, roads, people, traffic) is never rebuilt, and switching needs no reload.

| skin | id | idea |
|---|---|---|
| Cel (default) | `cel` | The current look, pixel-identical to 7c6d639. |
| Neon (cyberpunk) | `neon` | "Thistlebrook Neon" (look v2): blue-violet palette, neon windows, signs and hulls, wet streets, bloom, LUT grade. |
| Autumn storybook | `autumn` | Warm golden light, rust/amber/gold leaves, harvest ground, amber windows. |
| Winter | `winter` | Snow on every up-facing surface, slushy roads, cold light, warm windows. |

## Switching
- URL: `?skin=neon` (aliases: `cyberpunk`, `v2`, `storybook`, `snow`; the old `?look=v2` still opens neon). Post quality: `&quality=low|med|high`.
- In game: the swatch row at the bottom-left, or **K** (next) and **Shift+K** (previous). The URL's `?skin=` updates in place, so a reload or a shared link keeps the skin.
- From code or the console: `__astra.setSkin('winter')`, `__astra.skin.next()`, `__astra.skin.state`.

## How it works
- **Files.** Skin data lives in `src/skins/<id>.js` and the registry in `src/skins/index.js`; the first entry is the default. The runtime is `src/astra/skin/`: `index.js` applies a skin, `material.js` holds the styled toon patch and its uniforms, `post.js` the post chain, `lut.js` the generated grades, and `picker.js` the UI and hotkey. Light keys and halos go through `lighting.setSkin()` in `src/astra/lighting.js`.
- **null means default.** Any block set to `null` leaves the original code untouched. The `cel` skin is all-null, so the shipped look runs through exactly the old code. Its render call is the same `renderer.render(scene, camera)`.
- **Cheap switching.** All styled skins share one shader variant whose numbers are uniforms. Switching between styled skins only writes uniforms. Crossing between `cel` and a styled skin recompiles the toon programs once, which is a short hitch on first use, and they're cached after that.
- **Budget.** A skin adds no textures, meshes or requests. LUTs are generated from the numbers at switch time, so they cost 0 bytes on the wire. Post passes (3–5 draws) are paid for by hiding the per-lamp halo sprites, since bloom replaces them. So every skin draws no more than the default; `tools/grok-skins-shots.mjs` measures it.

## Writing a new skin
1. Copy the closest skin to `src/skins/<id>.js`: `autumn.js` for a warm daytime look, `neon.js` for a night or glow look.
2. Give it an `id`, a `label` and three `swatch` hexes for the picker.
3. Add it to `SKINS` in `src/skins/index.js`.
4. Open `/?skin=<id>`, press K to compare against the others, and tune the numbers.
5. Run `node --test tests/grok-skins.test.mjs`. It checks shape, ranges, hex colours, the LUT schedule, and size (< 8 KB, no asset references). Then run `node tools/grok-skins-shots.mjs --port <dev port> --tag try --skins cel,<id> --live --views wide --hours day,night` for stills plus draw calls.

Colours are sRGB hex, the same as in CSS. Every block is optional; leave one `null` to inherit the default.

```js
export default {
 id: 'dusk-rose', label: 'Dusk rose', swatch: ['#f4d6e0', '#c2577a', '#3b2a4a'],

 // Time-of-day light keys, same columns as LIGHT_KEYS in src/astra/light-cycle.js:
 // [hour, skyTop, skyHorizon, skyFill, groundBounce, key, ink, fillI, keyI, practicals(0 day..1 night), dirX, dirY, dirZ]
 // Must start at 0 and end at 24 with the same values (midnight wraps).
 keys: null,                                   // null -> the default keys
 shade: { day: '#e2c4c0', night: '#a8a8d8' },  // toon shadow tint
 halos: { visible: false, color: null },       // lamp halo sprites; hide them when post bloom is on

 material: {                                   // null -> the default three-band toon ramp
  ramp: { shadow: '#3a2418', mid: '#9a6a3c', high: '#f6e2b8' }, // locked palette ramp
  chroma: [.74, .66],          // share of each model's own colour kept (day, night); 1 = untouched
  tint: [1.06, .98, .86],      // multiplier on the kept colour
  tooth: .08,                  // world-space grain (0 = smooth)
  wrap: { lo: .36, hi: .64, floor: .42, foliageFloor: .30 },   // soft light: band start/end, shadow floor
  side: { left: '#ffcf8a', right: '#d9603a', strength: .18, day: .4, space: 'world' }, // side lights; space 'world' (default 'view') locks colours to the mesh
  rim: .06,                    // cut-edge rim, coloured by the side lights
  windows: { colors: ['#ffb347', '#ffcf6a', '#ff8c3a'], split: [.5, .85], emit: [1.0, 2.2], albedo: .6, dayFloor: 0 },
  wet: null,                   // { amount: 1, darken: .55 } -> wet grey ground (pairs with post.reflections)
  leaves: null,                // { colors: [3 hexes], amount, ground, groundColor } -> recolour green foliage
  snow: null,                  // { color, shadow, highlight, amount, road, slush, expose, lip, track }
 },

 practicals: null,             // null -> untouched; or any of:
 // { bulbs: [hexes], bulbGain, lampPools: [hexes], lampPoolGain,
 //   signs: { colors, amount, gain: [day, extraAtNight] },
 //   hulls: { colors: [3], split: [a, b], k: [day, extraAtNight] },   // building outlines -> glowing tubes
 //   spill: { colors, k: [day, extraAtNight] } }                       // one instanced ground glow per building (1 draw)

 post: {                       // null -> no post pass at all
  tilt: { focusY: .47, band: .2, soft: .35, max: .5 },               // tilt-shift band (screen y, 0 = bottom)
  bloom: { threshold: .62, gain: 1.0, night: 1.0, nightLift: .15 },
  haze: { start: .55, day: .08, night: .1, dayColor: '#f3cf9c', nightColor: '#3b2a3e' },
  reflections: null,           // { step, threshold, gain, tint: [r,g,b] } wet-ground streak reflections
  vignette: .3, grain: .008, aberration: 0,
  lut: {                       // up to 4 named grades, blended by hour
   schedule: [[0, 'night'], [5, 'night'], [6.8, 'dusk'], [9, 'day'], [15, 'day'], [17.6, 'dusk'], [19.8, 'night'], [24, 'night']],
   protect: [[.08, .06]],      // [hue 0..1, width]: hues that get `boost` saturation instead of `sat`
   grades: {
    day:   { sat: 1.08, contrast: 1.05, shadow: '#3b2a2a', shadowAmt: .2, high: '#ffe7bd', highAmt: .14, boost: 1 },
    dusk:  { sat: 1.12, contrast: 1.08, shadow: '#3a2236', shadowAmt: .3, high: '#ffb97a', highAmt: .22, boost: 1.1 },
    night: { sat: .92,  contrast: 1.06, shadow: '#1c1a30', shadowAmt: .45, high: '#ffcf8a', highAmt: .1, boost: 1.3 },
   },
  },
 },
};
```

## Rules
- Keep the default skin all-null. Change the default look in its own code path, never by giving `cel` values.
- No new assets, network requests or meshes in a skin. If you need a new effect, add a uniform to `material.js` or `post.js`, give it a neutral default so other skins are unaffected, and document it here.
- A skin that turns post on should hide halos (`halos.visible: false`) so its draw calls stay at or below the default's.
- Log tuning as `old -> new (reason)` in `docs/GROK-SKINS-LOG.md`.
