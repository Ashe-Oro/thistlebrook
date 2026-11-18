// OWNER: grok-skins lane (Grok). Skin "neon" — "Thistlebrook Neon", the
// cyberpunk miniature-diorama look from the grok-style lane (dd9fda7), moved
// into skin data. Rules: docs/GROK-STYLE.md. Same numbers as look v2.
const magenta = '#ff2fa8', cyan = '#20e6ff', acid = '#c6ff3a';
export default {
 id: 'neon',
 label: 'Neon (cyberpunk)',
 swatch: ['#191433', magenta, cyan],
 // hour, sky top / horizon, sky fill / ground bounce, key, ink,
 // fill strength, key strength, practicals (night), light direction (x,y,z)
 keys: [
  [0,   '#0b0a1f','#2a1446','#5040a8','#1a1234','#7f8cff','#07040f', .9,.45,1,   60,100,45],
  [4.5, '#0f0d27','#341a52','#5143a0','#1a1232','#9cb0ff','#07040f', .95,.6,1,    60,100,45],
  [5.4, '#2a2458','#8a3f80','#7a6cc0','#2a2246','#ff9cc4','#100a1c', 1.0,.85,.75, 95,48,35],
  [6.3, '#4a4a7a','#b0709f','#a49ad6','#3a3358','#ffc2d8','#120c20', 1.1,1.15,.4, 115,48,40],
  [8,   '#5f5f8c','#a9a3c9','#b9b2e6','#463e6e','#e2dcff','#151024', 1.05,1.15,.12, 85,90,40],
  [11,  '#5f5f8c','#a9a3c9','#b9b2e6','#463e6e','#e2dcff','#151024', 1.05,1.15,.1,  20,130,50],
  [14,  '#5f5f8c','#aba2c8','#b9b2e6','#463e6e','#e6dcff','#151024', 1.05,1.15,.1, -50,115,45],
  [16,  '#625888','#c6a2c6','#c2b4e2','#4e4270','#ffd4ea','#160e24', 1.15,1.3,.2, -95,72,35],
  [17.4,'#2e2862','#c45a94','#9a86d4','#30244e','#ff8fbe','#140a20', .9,.85,.62,-105,54,65],
  [18.4,'#2a2360','#a8478a','#8a7cd0','#2a1f4a','#ff74b2','#10081c', 1.0,.9,.65, -115,42,55],
  [19.3,'#171846','#5e2a70','#6a5fc0','#1c1638','#b49cff','#0a0616', .95,.7,.88, -85,52,35],
  [20.5,'#0b0a1f','#2a1446','#5040a8','#1a1234','#7f8cff','#07040f', .9,.45,1,   30,90,45],
  [22,  '#0b0a1f','#2a1446','#5040a8','#1a1234','#7f8cff','#07040f', .9,.45,1,   60,100,45],
  [24,  '#0b0a1f','#2a1446','#5040a8','#1a1234','#7f8cff','#07040f', .9,.45,1,   60,100,45],
 ],
 shade: { day: '#8f86c4', night: '#5a4fa8' },
 halos: { visible: false, color: '#ff2ea8' }, // bloom replaces the halo sprites
 material: {
  ramp: { shadow: '#191433', mid: '#4a4880', high: '#c9c4ea' },
  chroma: [.30, .22],          // share of the model's own colour kept, day / night
  tint: [.84, .82, 1.10],      // multiplier on the kept colour
  tooth: .10,                  // world-space paper/plaster grain
  wrap: { lo: .30, hi: .74, floor: .40, foliageFloor: .30 },
  side: { left: cyan, right: magenta, strength: .9, day: .3, space: 'view' },  // camera-fixed on buildings; scenery still world-locked
  rim: .12,
  windows: { colors: [cyan, magenta, acid], split: [.45, .85], emit: [1.4, 2.4], albedo: .55, dayFloor: .55 },
  wet: { amount: 1, darken: .55 },
  leaves: null, snow: null,
 },
 practicals: {
  bulbs: [magenta, cyan, magenta, acid], bulbGain: 1.6,
  lampPools: [magenta, cyan], lampPoolGain: 1.3,
  signs: { colors: [cyan, magenta], amount: .55, gain: [1.1, 1.1] },
  hulls: { colors: [magenta, cyan, acid], split: [.45, .85], k: [.18, .32] },
  spill: { colors: [magenta, cyan, magenta, acid], k: [.06, .34] },
 },
 post: {
  tilt: { focusY: .47, band: .16, soft: .32, max: .68 },
  bloom: { threshold: .5, gain: 1.6, night: 1.2, nightLift: .25 },
  haze: { start: .5, day: .07, night: .14, dayColor: '#a7a3c8', nightColor: '#3a2468' },
  reflections: { step: .009, threshold: .25, gain: 2.6, tint: [.035, .03, .07] },
  vignette: .34, grain: .006, aberration: 0,
  lut: {
   schedule: [[0, 'night'], [5, 'night'], [6.5, 'dusk'], [8.5, 'day'], [13, 'day'], [15.5, 'smog'], [17.6, 'dusk'], [19.8, 'night'], [24, 'night']],
   protect: [[.9, .07], [.52, .06]],   // hues kept saturated: magenta, cyan
   grades: {
    day:   { sat: .86, contrast: 1.06, shadow: '#2c2a48', shadowAmt: .30, high: '#e6e2ff', highAmt: .10, boost: 1.15 },
    smog:  { sat: .74, contrast: .98,  shadow: '#353150', shadowAmt: .38, high: '#f0d8ea', highAmt: .16, boost: 1.15 },
    dusk:  { sat: 1.08, contrast: 1.08, shadow: '#24183f', shadowAmt: .42, high: '#ff9ccc', highAmt: .18, boost: 1.3 },
    night: { sat: 1.12, contrast: 1.14, shadow: '#140f2e', shadowAmt: .55, high: '#9feaff', highAmt: .12, boost: 1.45 },
   },
  },
 },
};
