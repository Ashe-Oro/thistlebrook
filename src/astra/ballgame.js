// Kids' pickup ballgame on the Thistlebrook Owls field (grok-merge).
// Pure and clock-driven: positions come from (hour, t, weekday), so pause,
// speed and tests all see the same game. civic.js renders it.
// weekday: 0 = Monday .. 6 = Sunday (world.update passes (4 + life.day) % 7).
const lerp = (a, b, u) => a + (b - a) * u;
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const mix = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// Home plate sits in the outfield fence's corner; the foul lines run along
// the first- and third-base paths and the mound is inside the diamond.
export const FIELD = Object.freeze({
 home: [-22, -73], first: [-14, -81], second: [-22, -89], third: [-30, -81], mound: [-22, -81],
 fenceRadius: 24, entry: [-22, -69], school: [-2, -54.5],
});
const B = FIELD;
// Nine on the field and two waiting their turn by the backstop.
export const ROSTER = Object.freeze([
 {role: 'pitcher', spot: [-22, -80.6], look: 'child'},
 {role: 'catcher', spot: [-22, -72.1], look: 'farmhand'},
 {role: 'batter', spot: [-21.2, -73.4], look: 'carpenter'},
 {role: 'first base', spot: [-14.6, -82.2], look: 'shopkeeper'},
 {role: 'second base', spot: [-18.2, -87.4], look: 'miller'},
 {role: 'shortstop', spot: [-25.8, -87.4], look: 'innkeeper'},
 {role: 'third base', spot: [-29.4, -82.2], look: 'herbalist'},
 {role: 'left field', spot: [-33.5, -92.5], look: 'watch'},
 {role: 'right field', spot: [-10.5, -92.5], look: 'blacksmith'},
 {role: 'waiting', spot: [-27.2, -71.1], look: 'child'},
 {role: 'waiting', spot: [-28.4, -71.6], look: 'merchant'},
]);
export const KID_SCALE = .64; // 1.72 m adult rigs -> about 1.1 m, the child rig's height.

// After school on weekdays, most of the day at weekends; everyone heads home at dusk.
export function gameWindow(weekday = 4) {
 const weekend = weekday === 5 || weekday === 6;
 return weekend ? {arrive: 9.5, start: 10, end: 18.6, leave: 19.2} : {arrive: 15, start: 15.5, end: 18.6, leave: 19.2};
}
export const PLAYING_ON_FIELD = 9;

// Walk from the school door to the field gate on the sidewalk graph, then
// around the east end of the backstop to the player's spot.
export function kidPath(walk, spot) {
 const route = (walk && walk.length ? walk : [FIELD.school, FIELD.entry]).map((p) => [p[0], p[1]]);
 return [...route, [-16.8, -70.4], [-15.6, -73.4], spot];
}
function along(path, u) {
 const lens = path.slice(1).map((p, i) => dist(path[i], p)), total = lens.reduce((a, b) => a + b, 0);
 let d = clamp01(u) * total;
 for (let i = 0; i < lens.length; i++) {
  if (d <= lens[i] || i === lens.length - 1) { const k = lens[i] ? clamp01(d / lens[i]) : 1; return {pos: mix(path[i], path[i + 1], k), heading: Math.atan2(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1])}; }
  d -= lens[i];
 }
 return {pos: path.at(-1), heading: 0};
}
const face = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);

// One 12-second play. Every third play is a big hit and the batter rounds the bases.
export const PLAY = 12;
const FIELDERS = [4, 5, 7, 8, 6, 3];
function play(t) {
 const n = Math.floor(t / PLAY), u = ((t % PLAY) + PLAY) % PLAY, big = n % 3 === 2;
 const fielder = big ? (n % 2 ? 7 : 8) : FIELDERS[n % FIELDERS.length];
 const spot = ROSTER[fielder].spot, out = [spot[0] - B.home[0], spot[1] - B.home[1]], len = Math.hypot(...out);
 const land = big ? [B.home[0] + out[0] / len * 21, B.home[1] + out[1] / len * 21] : [spot[0] + (n % 2 ? .9 : -.9), spot[1] + 1.2];
 return {n, u, big, fielder, land};
}

export function ballgameState(hour, t, weekday = 4, walk = null) {
 const w = gameWindow(weekday), kids = [];
 const empty = {phase: 'empty', kids: ROSTER.map((r) => ({role: r.role, visible: false, pos: r.spot, y: .18, heading: 0, swing: 0, activity: ''})), ball: {visible: false, pos: [B.mound[0], 1.2, B.mound[1]]}};
 if (!(hour >= w.arrive && hour < w.leave)) return empty;
 const bob = (k, rate = 8, amp = .04) => Math.abs(Math.sin(t * rate + k)) * amp;
 if (hour < w.start || hour >= w.end) {
  const leaving = hour >= w.end, span = leaving ? w.leave - w.end : w.start - w.arrive, p = (hour - (leaving ? w.end : w.arrive)) / span;
  ROSTER.forEach((r, k) => {
   const u = clamp01(p * 1.5 - k * .04), path = kidPath(walk, r.spot), s = along(path, leaving ? 1 - u : u);
   const walking = u > 0 && u < 1, visible = leaving ? u < 1 : u > 0;
   kids.push({role: r.role, visible, pos: s.pos, y: .18 + (walking ? bob(k) : 0), heading: leaving ? s.heading + Math.PI : s.heading, swing: 0, activity: walking ? (leaving ? 'Walking home from the ballgame' : 'Walking to the ballgame') : 'Waiting for the game'});
  });
  return {phase: leaving ? 'leaving' : 'arriving', kids, ball: {visible: false, pos: [B.mound[0], 1.2, B.mound[1]]}};
 }
 const g = play(t), {u, big, fielder, land} = g;
 let ball = [B.mound[0], 1.25, B.mound[1]];
 const swing = u >= 1.45 && u < 2 ? Math.sin((u - 1.45) / .55 * Math.PI) : 0;
 const flight = big ? 3.2 : 2;
 if (u >= 1 && u < 1.6) { const k = (u - 1) / .6, p = mix(B.mound, B.home, k); ball = [p[0], 1.25 - .25 * k, p[1]]; }
 else if (u >= 1.6 && u < 1.6 + flight) { const k = (u - 1.6) / flight, p = mix(B.home, land, k); ball = [p[0], 1 + Math.sin(k * Math.PI) * (big ? 7 : 3.5) + (1 - k) * 0, p[1]]; }
 else if (u >= 1.6 + flight && u < 2.6 + flight) { const k = (u - 1.6 - flight), p = mix(land, B.first, k); ball = [p[0], .9 + Math.sin(k * Math.PI) * 1.2, p[1]]; }
 else if (u >= 2.6 + flight && u < 9) ball = [B.first[0] - .3, 1, B.first[1] - .3];
 else { const k = clamp01((u - 9) / 2), p = mix(B.first, B.mound, k); ball = [p[0], 1 + Math.sin(k * Math.PI) * 1.5, p[1]]; }
 const runner = () => {
  if (u < 1.6) return null;
  if (!big) { if (u < 4.4) return {pos: mix(B.home, B.first, (u - 1.6) / 2.8), run: true}; if (u < 8) return {pos: [B.first[0] + .5, B.first[1]], run: false}; return {pos: mix([B.first[0] + .5, B.first[1]], ROSTER[2].spot, clamp01((u - 8) / 3.5)), run: u < 11.5}; }
  const legs = [B.home, B.first, B.second, B.third, B.home], k = clamp01((u - 1.6) / 8) * 4, i = Math.min(3, Math.floor(k));
  if (u >= 9.6) return {pos: mix(B.home, ROSTER[2].spot, clamp01((u - 9.6) / 1.5)), run: false};
  return {pos: mix(legs[i], legs[i + 1], k - i), run: true};
 };
 ROSTER.forEach((r, k) => {
  let pos = r.spot, heading = face(r.spot, B.home), y = .18 + bob(k, 3, .03), sw = 0, activity = 'Ready in the field';
  if (r.role === 'pitcher') { heading = face(pos, B.home); activity = u < 1.6 ? 'Winding up the pitch' : 'Pitching'; if (u < 1) y += Math.sin(u * Math.PI) * .08; }
  if (r.role === 'catcher') { heading = face(pos, B.mound); y = .1; activity = 'Catching'; }
  if (r.role === 'batter') {
   const run = runner();
   if (run) { pos = run.pos; activity = run.run ? (big ? 'Rounding the bases' : 'Running to first') : 'Safe on first'; heading = run.run ? face(pos, big ? B.second : B.first) : face(pos, B.home); y = .18 + (run.run ? bob(k, 10, .07) : 0); }
   else { heading = face(pos, B.home); activity = 'At bat'; sw = swing; }
   if (u < 2) sw = swing;
  }
  if (k === fielder) {
   const chase = clamp01((u - 1.6) / flight), back = clamp01((u - 2.6 - flight) / 3);
   pos = back > 0 ? mix(land, r.spot, back) : mix(r.spot, land, chase);
   heading = back > 0 ? face(pos, r.spot) : face(r.spot, land); activity = back > 0 ? 'Jogging back' : chase < 1 ? 'Chasing the ball' : 'Throwing to first';
   y = .18 + ((chase > 0 && chase < 1) || (back > 0 && back < 1) ? bob(k, 10, .07) : 0);
  }
  if (r.role === 'first base') { const cover = [B.first[0] - .4, B.first[1] - .4]; pos = u < 1.6 ? mix(r.spot, cover, clamp01(u / 1.6)) : u < 9 ? cover : mix(cover, r.spot, clamp01((u - 9) / 2)); heading = face(pos, land); activity = 'Covering first'; }
  if (r.role === 'waiting') { heading = face(pos, B.mound); y = .18 + bob(k, 5, .06); activity = 'Waiting to bat'; }
  kids.push({role: r.role, visible: true, pos, y, heading, swing: sw, activity});
 });
 return {phase: 'playing', play: g, kids, ball: {visible: true, pos: ball}};
}

// Field footprint test helper: inside the fenced fan or by the backstop.
export function onField([x, z]) {
 const dx = x - B.home[0], dz = z - B.home[1], r = Math.hypot(dx, dz);
 if (r <= B.fenceRadius + .5 && dz <= .6) return true;
 return x > -30 && x < -14 && z > -73.5 && z < -70;
}
