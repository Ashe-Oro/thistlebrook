// OWNER: grok-skins lane (Grok). Skin "autumn" — "Autumn storybook": a warm,
// golden-hour-leaning storybook take on the cel village. Leaves turn
// rust/amber/gold in the shader, the ground goes harvest-gold, windows glow
// amber at night. No new textures, no new meshes.
const night0 = [0, '#1b1d36','#4a4560','#9aa6d8','#5a5068','#b8c0f0','#22202e', .8,.78,1, 60,100,45];
export default {
 id: 'autumn',
 label: 'Autumn storybook',
 swatch: ['#f6d4a8', '#d9622b', '#e8a33a'],
 keys: [
  night0,
  [4.5, '#2a2a48','#7a6680','#aaa8d4','#685868','#c4c0e8','#2e2a3a', .8,.72,1,    60,100,45],
  [5.4, '#7a6a8a','#e8a888','#d0bcd4','#8c7478','#ffb47c','#3e3036', .95,1.1,.75, 95,48,35],
  [6.3, '#c0a8b4','#f8cc98','#e8d4dc','#a48c80','#ffc888','#3a2e30', 1.2,1.8,.3,  115,48,40],
  [8,   '#c8d0cc','#f4e2c0','#eee6dc','#ac9e80','#ffe6b8','#3c3430', 1.14,1.95,0, 85,90,40],
  [11,  '#ccd6d0','#f6e8c8','#f2ece0','#aa9e80','#ffe8c0','#38302c', 1.18,1.95,0, 20,130,50],
  [14,  '#ccd2c8','#f6e4c0','#f2e8d6','#b0a07e','#ffe0b0','#3a322c', 1.14,2.0,0, -50,115,45],
  [16,  '#cabcb0','#f6d4a8','#eadcd8','#ae9480','#ffcc8c','#3c2e2c', 1.22,2.1,0, -95,72,35],
  [17.4,'#c0a0a0','#f8bc84','#e6c8cc','#a88070','#ffb066','#3c2a2a', 1.26,2.3,.1, -105,54,65],
  [18.4,'#9a7c94','#ec9c7c','#d0b4d0','#906c78','#ffa070','#36283a', 1.12,1.75,.45,-115,42,55],
  [19.3,'#5a5278','#b07c88','#b8b0e0','#76627c','#eaa8a8','#2a2438', .88,.85,.88, -85,52,35],
  [20.5,'#2a2c4c','#6a6078','#a4acdc','#625670','#c0c4f4','#242233', .8,.8,1,     30,90,45],
  [22, ...night0.slice(1)],
  [24, ...night0.slice(1)],
 ],
 shade: { day: '#e2c4c0', night: '#a8a8d8' },
 halos: { visible: false, color: '#ffa13d' },
 material: {
  ramp: { shadow: '#3a2418', mid: '#9a6a3c', high: '#f6e2b8' },
  chroma: [.74, .66],
  tint: [1.06, .98, .86],
  tooth: .08,
  wrap: { lo: .36, hi: .64, floor: .42, foliageFloor: .30 },
  side: { left: '#ffcf8a', right: '#d9603a', strength: .18, day: .4, space: 'world' },
  rim: .06,
  windows: { colors: ['#ffb347', '#ffcf6a', '#ff8c3a'], split: [.5, .85], emit: [1.0, 2.2], albedo: .6, dayFloor: 0 },
  wet: null,
  leaves: { colors: ['#c9521f', '#e39a2c', '#a8341f'], amount: .9, ground: .22, groundColor: '#a99a4e' },
  snow: null,
 },
 practicals: null,
 post: {
  tilt: { focusY: .47, band: .2, soft: .35, max: .5 },
  bloom: { threshold: .62, gain: 1.0, night: 1.0, nightLift: .15 },
  haze: { start: .55, day: .08, night: .1, dayColor: '#f3cf9c', nightColor: '#3b2a3e' },
  reflections: null,
  vignette: .3, grain: .008, aberration: 0,
  lut: {
   schedule: [[0, 'night'], [5, 'night'], [6.8, 'dusk'], [9, 'day'], [15, 'day'], [17.6, 'dusk'], [19.8, 'night'], [24, 'night']],
   protect: [[.08, .06]],   // amber window glow stays saturated
   grades: {
    day:   { sat: 1.08, contrast: 1.05, shadow: '#3b2a2a', shadowAmt: .20, high: '#ffe7bd', highAmt: .14, boost: 1.0 },
    dusk:  { sat: 1.12, contrast: 1.08, shadow: '#3a2236', shadowAmt: .30, high: '#ffb97a', highAmt: .22, boost: 1.1 },
    night: { sat: .92,  contrast: 1.06, shadow: '#1c1a30', shadowAmt: .45, high: '#ffcf8a', highAmt: .10, boost: 1.3 },
   },
  },
 },
};
