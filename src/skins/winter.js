// OWNER: grok-skins lane (Grok). Skin "winter" — a snowy, cold village:
// snow settles on every up-facing surface (roofs, ground, tree tops) in the
// shader, roads keep a slushy grey, cold blue light with warm windows at night.
const night0 = [0, '#0f1a30','#2c3d5c','#8fb0e0','#56657e','#a8c4ff','#1a2233', .85,.7,1, 60,100,45];
export default {
 id: 'winter',
 label: 'Winter',
 swatch: ['#eef4fb', '#7f93ad', '#ffc46b'],
 keys: [
  night0,
  [4.5, '#18223e','#465676','#a0b4dc','#5f6a84','#b8c8f0','#222a3c', .85,.7,1,    60,100,45],
  [5.4, '#5a6a8e','#d8b4b0','#c4cce6','#7a8298','#ffc8b0','#303648', .95,1.0,.7,  95,48,35],
  [6.3, '#9fb2cc','#f2d8cc','#dbe4f2','#9aa4b8','#ffdcc2','#2e3444', 1.05,1.3,.3,  115,48,40],
  [8,   '#b7cadc','#e8eef4','#eef3f8','#b4bccb','#fff4e6','#323a46', 1.0,1.35,0,   85,90,40],
  [11,  '#bccfe0','#eef2f6','#f2f6fa','#b8c0cc','#fff6ea','#2e3642', 1.02,1.4,0, 20,130,50],
  [14,  '#bccbdc','#eceff4','#f0f2f6','#b8bec8','#fff2e0','#30363f', 1.0,1.4,0, -50,115,45],
  [16,  '#b4bccc','#ecdcd0','#e4e4ee','#aaa8b4','#ffe2c4','#32303c', 1.0,1.4,.05,-95,72,35],
  [17.4,'#8e96b6','#e8c0b0','#d4cce4','#948ca4','#ffc8a4','#302a3a', 1.0,1.3,.25,-105,54,65],
  [18.4,'#5e6a92','#c09aa8','#bcc0e4','#7a7894','#f4b8a8','#2a2a3c', 1.05,1.15,.55,-115,42,55],
  [19.3,'#2e3c64','#7a7c9c','#a8bce8','#646e88','#d2c4e6','#222838', .9,.85,.88, -85,52,35],
  [20.5,'#14203a','#3a4a6a','#94b2e4','#5a6882','#b0c8ff','#1c2434', .85,.72,1,   30,90,45],
  [22, ...night0.slice(1)],
  [24, ...night0.slice(1)],
 ],
 shade: { day: '#b8c6e6', night: '#8ea4d8' },
 halos: { visible: false, color: '#ffc46b' },
 material: {
  ramp: { shadow: '#26324a', mid: '#7f93ad', high: '#eef4fb' },
  chroma: [.62, .55],
  tint: [.92, .97, 1.08],
  tooth: .06,
  wrap: { lo: .34, hi: .68, floor: .52, foliageFloor: .38 },
  side: { left: '#bfe3ff', right: '#ffd6a8', strength: .10, day: .5 },
  rim: .10,
  windows: { colors: ['#ffc46b', '#ffdb8a', '#ff9f4a'], split: [.5, .85], emit: [1.2, 2.6], albedo: .55, dayFloor: 0 },
  wet: null,
  leaves: null,
  snow: { color: '#e4ebf4', amount: .9, road: .3, slush: '#8d95a3' },
 },
 practicals: null,
 post: {
  tilt: { focusY: .47, band: .18, soft: .34, max: .55 },
  bloom: { threshold: .72, gain: .9, night: 1.3, nightLift: .2 },
  haze: { start: .45, day: .14, night: .12, dayColor: '#dfe8f3', nightColor: '#1d2a44' },
  reflections: null,
  vignette: .28, grain: .007, aberration: 0,
  lut: {
   schedule: [[0, 'night'], [5, 'night'], [6.8, 'dusk'], [9, 'day'], [15, 'day'], [17.6, 'dusk'], [19.8, 'night'], [24, 'night']],
   protect: [[.09, .06]],
   grades: {
    day:   { sat: .9, contrast: 1.08, shadow: '#2a3a55', shadowAmt: .30, high: '#e8f0ff', highAmt: .06, boost: 1.1 },
    dusk:  { sat: .96, contrast: 1.06, shadow: '#2c2a4a', shadowAmt: .34, high: '#ffd2b0', highAmt: .18, boost: 1.2 },
    night: { sat: .86, contrast: 1.08, shadow: '#101a33', shadowAmt: .50, high: '#cfe2ff', highAmt: .10, boost: 1.35 },
   },
  },
 },
};
