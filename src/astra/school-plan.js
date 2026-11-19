// School day at Thistlebrook High (school-day lane).
// Pure and clock-driven, like ballgame.js: every pose comes from
// (plan, hour, weekday), so pause, speed, tests, the collision sim and the
// renderers all see the same school day. The plan is built once from the
// compiled town and its pedestrian graph; nothing here touches three.js.
//
// weekday: 0 = Monday .. 6 = Sunday (main.js passes (4 + life.day) % 7, so the
// first simulated day is a Friday).
// Time: one game hour is 90 simulation seconds (main.js: hour += dt / 90).

export const GAME_HOUR_SECONDS = 90;
// Children hurry between places, like the after-school walk to the ballgame
// (ballgame.js covers ~80 m in about 30 s). Speeds are metres per sim second.
export const PACE = Object.freeze({ home: 2.2, recess: 3.0, room: 1.4, teacher: 2.2 });

export const SCHOOL = Object.freeze({
  door: [-2, -54.5],          // Thistlebrook High front steps (FIELD.school in ballgame.js)
  campusNode: [16, -54.5],    // the campus lane at the forecourt's east end
  // The parked school bus (civic.js) stands at x 21, z −61; riders use its kerb side.
  busDoor: [19.4, -58.6],
  busApproach: [[19.4, -58.6], [16.6, -55.4]],
  playground: 'playground',
  playgroundGate: [[-25.6, -36.2]],  // just inside Little Oak's south gate
});

// Weekday timetable. Windows are [start, end) in hours. Lessons are seated.
export const TIMETABLE = Object.freeze([
  { id: 'arrival', label: 'Morning arrival', start: 7.75, end: 8.5 },
  { id: 'period-1', label: 'Period 1 · Reading & phonics', start: 8.5, end: 10, lesson: true, board: 'Reading: The Owl and the Oak', subject: 'reading' },
  { id: 'recess', label: 'Morning recess at Little Oak', start: 10, end: 11.1 },
  { id: 'period-2', label: 'Period 2 · Number work', start: 11.1, end: 12.4, lesson: true, board: 'Number work: 7 + 5 = 12', subject: 'maths' },
  { id: 'lunch', label: 'Packed lunch at our desks', start: 12.4, end: 13.1, seated: true, board: 'Lunch! Wash your hands', subject: 'lunch' },
  { id: 'period-3', label: 'Period 3 · Seeds & sunlight', start: 13.1, end: 14.6, lesson: true, board: 'Seeds need sun + water', subject: 'science' },
  { id: 'dismissal', label: 'Home time', start: 14.6, end: 15 },
  { id: 'tidy', label: 'After school: tidying the classroom', start: 15, end: 16 },
]);
export const SCHOOL_HOURS = Object.freeze({ open: 7.5, close: 16.25 });
// Life-planner shifts for residents with school jobs (profiles.js): pupils from
// morning arrival to home time, staff from opening to the end of tidying.
export const SCHOOL_SHIFT = Object.freeze({ pupil: [7.75, 14.6], staff: [7.5, 16] });
export const isSchoolDay = (weekday) => weekday >= 0 && weekday <= 4;
export const weekdayOf = (day) => (4 + day) % 7;

export function sessionAt(hour, weekday = 4) {
  if (!isSchoolDay(weekday)) return { id: 'weekend', label: 'Weekend: the school is closed', start: 0, end: 24 };
  return TIMETABLE.find((s) => hour >= s.start && hour < s.end) ||
    { id: hour < TIMETABLE[0].start ? 'before' : 'closed', label: hour < TIMETABLE[0].start ? 'Before school' : 'School is closed for the day', start: 0, end: 24 };
}
const session = (id) => TIMETABLE.find((s) => s.id === id);

// Classroom camera ease, seconds: the campus camera eases towards the door,
// then the room settles. Both are skipped with prefers-reduced-motion.
export const ENTER_EASE = Object.freeze({ town: .3, room: .35 });
export const CAMPUS_VIEW = Object.freeze({ x: 8, z: -70, zoom: 1.8 }); // main.js 'campus'

/** Clicking the school enters the classroom while lessons are on or just after. */
export function canEnterClassroom(hour, weekday = 4) {
  return isSchoolDay(weekday) && hour >= TIMETABLE[0].start && hour < session('tidy').end;
}

// ---------------------------------------------------------------------------
// Room plan: Room 4, the Owls class. Local metres, floor at y = 0. The room is
// shown as a cutaway: the north (z −4) and west (x −5) walls stand, the south
// and east walls are left open towards the iso camera.
// ---------------------------------------------------------------------------
export const CHILD = Object.freeze({ seatHeight: .3, deskHeight: .55, adultHip: .92, adultSeat: .46 });
const COLS = [-2.1, -0.9, 0.9, 2.1], ROWS = [-1.2, 0.4, 2.0];
const desks = ROWS.flatMap((z, row) => COLS.map((x, col) => ({ id: `desk-${row * 4 + col}`, row, col, pos: [x, z] })));
export const ROOM = Object.freeze({
  name: 'Room 4 · the Owls',
  width: 10, depth: 8, height: 3.2,
  bounds: { min: [-5, -4], max: [5, 4] },
  door: [4.2, -3.55],         // classroom door in the north wall, right-hand end
  aisle: 3.3,                 // clear walkway east of the desks
  board: { center: [-0.6, -3.95], width: 3.4, bottom: .85, top: 2.05 },
  smartboard: { center: [2.75, -3.95], width: 1.5, bottom: 1, top: 1.85 },
  teacherBoard: [-0.6, -3.15],
  teacherDesk: { pos: [-3.6, -2.55], size: [1.3, .74, .65] },
  teacherSeat: { id: 'teacher-chair', kind: 'seat', position: [-3.6, -3.3], facing: 0, seatHeight: CHILD.adultSeat },
  desks: desks.map((d) => ({ ...d, size: [.72, CHILD.deskHeight, .5] })),
  // One reserved, documented seat per pupil: their chair behind their desk.
  seats: desks.map((d) => ({ id: `chair-${d.id.slice(5)}`, kind: 'seat', desk: d.id, position: [d.pos[0], d.pos[1] + .48], facing: Math.PI, seatHeight: CHILD.seatHeight })),
  // Reading corner beanbags (Period 3 readers), also documented seats.
  beanbags: [
    { id: 'beanbag-0', kind: 'seat', position: [-3.05, 2.35], facing: -2.2, seatHeight: .24 },
    { id: 'beanbag-1', kind: 'seat', position: [-3.9, 3.25], facing: -2.6, seatHeight: .24 },
    { id: 'beanbag-2', kind: 'seat', position: [-2.35, 3.3], facing: -1.9, seatHeight: .24 },
  ],
  windows: [-2.9, -1.3, 0.3].map((z) => ({ z, width: 1.2, bottom: 1.2, top: 2.45 })),
  cubbies: { x: -4.78, from: -2.5, to: .9, height: .95, depth: .42, columns: 6, rows: 3 },
  bookshelf: { x: -4.8, from: 1.6, to: 3.7, height: .8, depth: .36 },
  rug: { center: [-3.3, 2.85], radius: 1.15 },
  // Furniture on the floor (TOWN-04): base height and footprint per piece.
  furniture: [],
});
// Freestanding furniture list for the TOWN-04 check and the renderer.
ROOM.furniture.push(
  ...ROOM.desks.map((d) => ({ id: d.id, kind: 'desk', pos: d.pos, size: d.size, base: 0 })),
  ...ROOM.seats.map((s) => ({ id: s.id, kind: 'chair', pos: s.position, size: [.36, CHILD.seatHeight, .36], base: 0 })),
  { id: 'teacher-desk', kind: 'teacher-desk', pos: ROOM.teacherDesk.pos, size: ROOM.teacherDesk.size, base: 0 },
  { id: ROOM.teacherSeat.id, kind: 'chair', pos: ROOM.teacherSeat.position, size: [.46, CHILD.adultSeat, .46], base: 0 },
  { id: 'cubbies', kind: 'cubbies', pos: [ROOM.cubbies.x, (ROOM.cubbies.from + ROOM.cubbies.to) / 2], size: [ROOM.cubbies.depth, ROOM.cubbies.height, ROOM.cubbies.to - ROOM.cubbies.from], base: 0 },
  { id: 'bookshelf', kind: 'bookshelf', pos: [ROOM.bookshelf.x, (ROOM.bookshelf.from + ROOM.bookshelf.to) / 2], size: [ROOM.bookshelf.depth, ROOM.bookshelf.height, ROOM.bookshelf.to - ROOM.bookshelf.from], base: 0 },
  ...ROOM.beanbags.map((b) => ({ id: b.id, kind: 'beanbag', pos: b.position, size: [.7, b.seatHeight, .7], base: 0 })),
  { id: 'rug', kind: 'rug', pos: ROOM.rug.center, size: [ROOM.rug.radius * 2, .02, ROOM.rug.radius * 2], base: 0 },
);
Object.freeze(ROOM.furniture);

// Recess at Little Oak: the playground venue on the sidewalk graph. Spots stay
// clear of the swing set, the slide and the residents' reserved play slot.
export const RECESS_SPOTS = Object.freeze([
  ...Array.from({ length: 5 }, (_, k) => ({ game: 'ring', k, center: [-30.5, -40.5], radius: 1.5, activity: 'Playing ring-a-roses' })),
  { game: 'sand', pos: [-23.8, -41.6], facing: .6, activity: 'Digging in the sandpit' },
  { game: 'sand', pos: [-22.3, -40.3], facing: -2.4, activity: 'Building a sandcastle' },
  { game: 'slide', pos: [-24.4, -48.2], facing: Math.PI / 2, activity: 'Waiting a turn on the slide' },
  { game: 'slide', pos: [-21.6, -42.5], facing: 0, activity: 'Coming down the slide' },
  { game: 'hopscotch', pos: [-19.6, -38.4], facing: Math.PI, activity: 'Playing hopscotch' },
  { game: 'hopscotch', pos: [-19.6, -36.6], facing: Math.PI, activity: 'Waiting for hopscotch' },
  { game: 'swing', pos: [-30.4, -44.6], facing: Math.PI, activity: 'Pushing a friend on the swing' },
]);
export const TEACHER_YARD_SPOT = Object.freeze({ pos: [-26.6, -36.7], facing: Math.PI });
export const HOPSCOTCH = Object.freeze({ origin: [-19.6, -38.4], squares: 6, size: .55 });

const NAMES = ['Ada', 'Bram', 'Cleo', 'Dev', 'Ezra', 'Fern', 'Gus', 'Hattie', 'Ivo', 'Juno', 'Kenji', 'Lola'];
// No wide-brimmed or work hats on pupils: those read as grown-ups at child scale.
const LOOKS = ['child', 'shopkeeper', 'merchant', 'child', 'carpenter', 'innkeeper', 'child', 'blacksmith', 'watch', 'child', 'baker', 'shopkeeper'];
export const STUDENT_SCALE = .6; // adult rigs at about 1.03 m, a little under the child rig, so blocky bodies read young beside the desks
export const CHILD_RIG_SCALE = .94;
export const TEACHER = Object.freeze({ name: 'Ms Elsie Hart', look: 'elder', scale: 1, role: 'Teacher, Room 4' });

// ---------------------------------------------------------------------------
// Geometry helpers.
// ---------------------------------------------------------------------------
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const lerp2 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const pathLength = (pts) => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0);
const dedupe = (pts) => pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 1e-6);

/** Position and heading a distance `d` along a polyline. */
export function along(pts, d, crossings) {
  for (let i = 1; i < pts.length; i++) {
    const L = dist(pts[i - 1], pts[i]);
    if (d <= L || i === pts.length - 1) {
      const u = L ? clamp01(d / L) : 1;
      return { pos: lerp2(pts[i - 1], pts[i], u), heading: Math.atan2(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
        ...(crossings ? {crossing: crossings[i] && u > 0 && u < 1} : {}) };
    }
    d -= L;
  }
  return { pos: pts.at(-1), heading: 0 };
}
// cross[i] flags the segment ending at pts[i]; reversed, segment j is the original n − j.
const reverse = (route) => { const n = route.pts.length - 1; return { pts: [...route.pts].reverse(), cross: route.pts.map((_, j) => j > 0 && route.cross[n - j + 1] === true), length: route.length }; };
const extend = (route, more) => { const pts = [...route.pts], cross = [...route.cross]; for (const p of more) if (dist(pts.at(-1), p) > 1e-6) { pts.push(p); cross.push(false); } return { pts, cross, length: pathLength(pts) }; };

function graphRoute(walkBetween, graph, from, to, prefix = [], suffix = []) {
  const steps = walkBetween(graph, from, to);
  const pts = [], cross = [];
  const push = (p, c = false) => { if (pts.length && dist(pts.at(-1), p) < 1e-6) return; pts.push([p[0], p[1]]); cross.push(c); };
  for (const p of prefix) push(p);
  for (const s of steps) push(s.pos, !!s.cross);
  for (const p of suffix) push(p);
  // cross[i] marks the segment that ends at pts[i] as a graph crossing edge.
  return { pts, cross, length: pathLength(pts) };
}
const lineRoute = (pts) => { const p = dedupe(pts); return { pts: p, cross: p.map(() => false), length: pathLength(p) }; };
const hours = (metres, pace) => metres / pace / GAME_HOUR_SECONDS;

// In-room walks: door → east aisle → the lane behind the chair row → seat.
function roomRoute(seat) {
  const back = seat.position[1] + .52;
  return lineRoute([ROOM.door, [ROOM.aisle, ROOM.door[1] + .4], [ROOM.aisle, back], [seat.position[0], back], seat.position]);
}

/** Recess spot pose (the ring game turns slowly; everyone else plays in place). */
export function recessPose(spot, hour) {
  if (spot.game !== 'ring') return { pos: spot.pos, facing: spot.facing, moving: false };
  const a = spot.k / 5 * Math.PI * 2 + hour * 60;
  const pos = [spot.center[0] + Math.sin(a) * spot.radius, spot.center[1] + Math.cos(a) * spot.radius];
  return { pos, facing: a + Math.PI / 2, moving: true };
}
const recessEntry = (spot) => spot.game === 'ring' ? [spot.center[0] + Math.sin(spot.k / 5 * Math.PI * 2 + 10.5 * 60) * spot.radius, spot.center[1] + Math.cos(spot.k / 5 * Math.PI * 2 + 10.5 * 60) * spot.radius] : spot.pos;

/**
 * Build the day plan for a compiled town: who lives where, every walking route
 * (sidewalk graph only, crossing edges flagged), seats and recess spots.
 * `graph` comes from pedestrianGraph(town); `walkBetween` from roads/pedestrian.js.
 */
export function planSchool(town, graph, walkBetween) {
  const homes = town.buildings.filter((b) => b.kind === 'home');
  const near = homes.filter((b) => b.district === 'willowbank');
  const far = homes.filter((b) => b.district === 'sunbeam');
  const route = (a, b, prefix, suffix) => graphRoute(walkBetween, graph, a, b, prefix, suffix);
  const doorToCampus = route(SCHOOL.door, SCHOOL.campusNode);
  const busToDoor = route(SCHOOL.campusNode, SCHOOL.door, SCHOOL.busApproach);
  const playground = town.venues.find((v) => v.type === SCHOOL.playground);
  const toYard = route(SCHOOL.door, SCHOOL.playgroundGate[0], [], SCHOOL.playgroundGate);
  const students = NAMES.map((name, i) => {
    const bus = i % 4 === 3 && far.length > 0;               // three Sunbeam Terrace pupils ride the bus
    const home = bus ? far[Math.floor(i / 4) % far.length] : near[i % near.length];
    const morning = bus ? busToDoor : route(home.approach || home.door, SCHOOL.door, [home.door]);
    const seat = ROOM.seats[i];
    const spot = RECESS_SPOTS[i];
    const yardOut = extend(toYard, [recessEntry(spot)]);
    return {
      id: `pupil-${i}`, index: i, name, look: LOOKS[i], scale: LOOKS[i] === 'child' ? CHILD_RIG_SCALE : STUDENT_SCALE,
      bus, home: { key: home.key, name: home.name, district: home.district },
      seat, spot, reader: i % 4 === 1 ? ROOM.beanbags[Math.floor(i / 4)] : null,
      routes: { morning, evening: reverse(morning), yardOut, yardBack: reverse(yardOut), room: roomRoute(seat) },
    };
  });
  // Ms Hart lives at the first Willowbank home that is no pupil's.
  const teacherHome = near.find((b) => !students.some((s) => s.home.key === b.key)) || near[0];
  const teacherMorning = route(teacherHome.approach || teacherHome.door, SCHOOL.door, [teacherHome.door]);
  const teacherYard = extend(toYard, [TEACHER_YARD_SPOT.pos]);
  const teacher = { ...TEACHER, id: 'teacher', home: { key: teacherHome.key, name: teacherHome.name },
    routes: { morning: teacherMorning, evening: reverse(teacherMorning), yardOut: teacherYard, yardBack: reverse(teacherYard),
      room: lineRoute([ROOM.door, [ROOM.aisle, ROOM.door[1] + .4], [ROOM.aisle, -2.2], [0, -2.2], ROOM.teacherBoard]) } };
  return { students, teacher, doorToCampus, toYard, playground: { id: playground.id, box: playground.box, entry: playground.entry } };
}

/** Every town-side walking route, for TOWN-01 audits and the tests. */
export function schoolRoutes(plan) {
  const out = [];
  for (const p of [...plan.students, plan.teacher]) for (const key of ['morning', 'evening', 'yardOut', 'yardBack']) out.push({ who: p.id, key, ...p.routes[key] });
  return out;
}

// ---------------------------------------------------------------------------
// Clock-driven state.
// ---------------------------------------------------------------------------
const stagger = (i, span) => ((i * 7) % 12) / 11 * span;

function walkPose(route, start, pace, hour) {
  const d = (hour - start) * GAME_HOUR_SECONDS * pace;
  const s = along(route.pts, Math.max(0, d), route.cross);
  return { ...s, moving: d > 0 && d < route.length, done: d >= route.length, walk: { route, start, pace, distance: Math.max(0, d) } };
}

/** Phase windows for one pupil on a school day, in hours. */
export function studentDay(student) {
  const r = student.routes, i = student.index;
  const morningH = hours(r.morning.length, PACE.home), roomH = hours(r.room.length, PACE.room), corridor = .02;
  // The bus drops its three riders together around 08:03; walkers reach the door 08:05–08:37.
  const atDoor = student.bus ? 8.14 + Math.floor(i / 4) * .012 : 8.05 + stagger(i, .32);
  const leaveHome = atDoor - morningH;
  const inRoom = atDoor + corridor;
  const recess = session('recess'), yardH = hours(r.yardOut.length, PACE.recess);
  const recessOut = recess.start + stagger(i, .03);                      // leave the seat
  const yardDepart = recessOut + roomH + corridor;                       // out of the door
  const recessBack = recess.end - corridor * 2 - roomH - yardH - .012 - stagger(11 - i, .03);
  const dismiss = session('dismissal').start + stagger(i, .06);
  const outDoor = dismiss + roomH + corridor;
  return { leaveHome, atDoor, inRoom, seated: inRoom + roomH, recessOut, yardDepart, yardArrive: yardDepart + yardH, recessBack,
    backDoor: recessBack + yardH, backRoom: recessBack + yardH + corridor, backSeat: recessBack + yardH + corridor + roomH,
    dismiss, outDoor, home: outDoor + hours(r.evening.length, PACE.home) };
}

function studentAt(student, hour, weekday) {
  const base = { id: student.id, name: student.name, look: student.look, scale: student.scale, where: 'home', pos: null, room: null, heading: 0, moving: false, seated: false, seat: null, clip: 'Idle', activity: 'At home' };
  if (!isSchoolDay(weekday)) return { ...base, activity: 'Weekend at home' };
  const d = studentDay(student), r = student.routes, lesson = sessionAt(hour, weekday);
  const town = (s, activity) => ({ ...base, where: 'town', pos: s.pos, heading: s.heading, moving: s.moving, clip: s.moving ? 'Walk' : 'Idle', activity, walk: s.walk, crossing: s.crossing });
  const room = (s, activity, extra = {}) => ({ ...base, where: 'room', room: s.pos, heading: s.heading, moving: s.moving, clip: s.moving ? 'Walk' : 'Idle', activity, ...extra });
  const sitAt = (seat, activity, clip = 'Sit') => room({ pos: seat.position, heading: seat.facing, moving: false }, activity, { seated: true, seat, clip });
  if (hour < d.leaveHome) return student.bus && hour >= d.leaveHome - .3 ? { ...base, where: 'bus', activity: 'On the school bus' } : base;
  if (hour < d.atDoor) return town(walkPose(r.morning, d.leaveHome, PACE.home, hour), student.bus ? 'Off the bus and into school' : 'Walking to school');
  if (hour < d.inRoom) return { ...base, where: 'corridor', activity: 'Hanging up a coat' };
  // Morning lessons.
  if (hour < d.recessOut) {
    if (hour < d.seated) return room(walkPose(r.room, d.inRoom, PACE.room, hour), 'Finding my desk');
    return sitAt(student.seat, lesson.lesson ? lesson.label : 'Settling in for register');
  }
  // Out to recess and back.
  if (hour < d.yardDepart - .02) return room(walkPose(reverseRoom(r.room), d.recessOut, PACE.room, hour), 'Lining up for recess');
  if (hour < d.yardDepart) return { ...base, where: 'corridor', activity: 'Lining up for recess' };
  if (hour < d.yardArrive) return town(walkPose(r.yardOut, d.yardDepart, PACE.recess, hour), 'Hurrying out to Little Oak');
  if (hour < d.recessBack) { const p = recessPose(student.spot, hour); return { ...town({ pos: p.pos, heading: p.facing, moving: p.moving }, student.spot.activity), where: 'yard', clip: p.moving ? 'Walk' : 'Play' }; }
  if (hour < d.backDoor) return town(walkPose(r.yardBack, d.recessBack, PACE.recess, hour), 'Back to class after recess');
  if (hour < d.backRoom) return { ...base, where: 'corridor', activity: 'Back to class after recess' };
  if (hour < d.backSeat) return room(walkPose(r.room, d.backRoom, PACE.room, hour), 'Back to my desk');
  // Midday and afternoon: desks, lunch, the reading corner in Period 3.
  if (hour < d.dismiss) {
    if (lesson.id === 'lunch') return sitAt(student.seat, lesson.label, 'Seated Eat');
    if (lesson.id === 'period-3' && student.reader) return sitAt(student.reader, 'Reading in the book corner');
    return sitAt(student.seat, lesson.label);
  }
  // Home time.
  if (hour < d.outDoor - .02) return room(walkPose(reverseRoom(r.room), d.dismiss, PACE.room, hour), 'Packing my bag');
  if (hour < d.outDoor) return { ...base, where: 'corridor', activity: 'Home time' };
  const evening = walkPose(r.evening, d.outDoor, PACE.home, hour);
  if (!evening.done) return town(evening, student.bus ? 'Walking to the school bus' : 'Walking home');
  return student.bus ? { ...base, where: 'bus', activity: 'Riding the bus home' } : { ...base, activity: 'Home after school' };
}
const reverseRoom = (r) => ({ pts: [...r.pts].reverse(), cross: r.cross, length: r.length });

const TEACHER_LOOP = [ROOM.teacherBoard, [0, -2.2], [0, 2.95], [ROOM.aisle, 2.95], [ROOM.aisle, -2.2], [0, -2.2], ROOM.teacherBoard];
const LOOP_LENGTH = pathLength(TEACHER_LOOP);

function teacherAt(plan, hour, weekday) {
  const t = plan.teacher, r = t.routes;
  const base = { id: t.id, name: t.name, look: t.look, scale: t.scale, where: 'home', pos: null, room: null, heading: 0, moving: false, seated: false, seat: null, clip: 'Idle', activity: 'At home' };
  if (!isSchoolDay(weekday)) return { ...base, activity: 'Weekend at home' };
  const lesson = sessionAt(hour, weekday), morningH = hours(r.morning.length, PACE.teacher), roomH = hours(r.room.length, PACE.room);
  const arrive = 7.6, leaveHome = arrive - morningH, recess = session('recess'), yardH = hours(r.yardOut.length, PACE.teacher);
  const town = (s, activity) => ({ ...base, where: 'town', pos: s.pos, heading: s.heading, moving: s.moving, clip: s.moving ? 'Walk' : 'Idle', activity, walk: s.walk, crossing: s.crossing });
  const room = (s, activity, clip) => ({ ...base, where: 'room', room: s.pos, heading: s.heading, moving: s.moving, clip: s.moving ? 'Walk' : clip || 'Idle', activity });
  if (hour < leaveHome) return base;
  if (hour < arrive) return town(walkPose(r.morning, leaveHome, PACE.teacher, hour), 'Walking to school');
  const atBoard = (activity) => room({ pos: ROOM.teacherBoard, heading: 0, moving: false }, activity, 'Work');
  if (hour < arrive + .02) return { ...base, where: 'corridor', activity: 'Collecting the register' };
  if (hour < arrive + .02 + roomH) return room(walkPose(r.room, arrive + .02, PACE.room, hour), 'Opening up Room 4');
  if (hour < recess.start + .02) {
    if (lesson.lesson) return lessonPose(lesson, hour, atBoard, room);
    return atBoard('Writing the day on the board');
  }
  // Yard duty with the class.
  const out = recess.start + .05;
  if (hour < out) return { ...base, where: 'corridor', activity: 'Yard duty' };
  if (hour < out + yardH) return town(walkPose(r.yardOut, out, PACE.teacher, hour), 'Walking the class to recess');
  const back = recess.end - .1 - yardH;
  if (hour < back) return { ...town({ pos: TEACHER_YARD_SPOT.pos, heading: TEACHER_YARD_SPOT.facing, moving: false }, 'On yard duty at Little Oak'), where: 'yard', clip: 'Look Around' };
  if (hour < back + yardH) return town(walkPose(r.yardBack, back, PACE.teacher, hour), 'Bringing the class back in');
  if (hour < back + yardH + .02) return { ...base, where: 'corridor', activity: 'Back to Room 4' };
  if (hour < back + yardH + .02 + roomH) return room(walkPose(r.room, back + yardH + .02, PACE.room, hour), 'Back to Room 4');
  if (lesson.id === 'lunch') return { ...room({ pos: ROOM.teacherSeat.position, heading: ROOM.teacherSeat.facing, moving: false }, 'Lunch at the teacher’s desk', 'Seated Eat'), seated: true, seat: ROOM.teacherSeat };
  if (lesson.lesson) return lessonPose(lesson, hour, atBoard, room);
  if (lesson.id === 'dismissal' || lesson.id === 'recess' || lesson.id === 'period-2') return atBoard('Waving the class goodbye');
  if (lesson.id === 'tidy') {
    if (hour < 15.45) return atBoard('Wiping the board clean');
    const d = (hour - 15.45) * GAME_HOUR_SECONDS * .8;
    const s = along(TEACHER_LOOP, d % LOOP_LENGTH);
    return room({ ...s, moving: true }, 'Tucking in the chairs');
  }
  const leave = session('tidy').end;
  if (hour < leave + .02) return { ...base, where: 'corridor', activity: 'Locking up Room 4' };
  const home = walkPose(r.evening, leave + .02, PACE.teacher, hour);
  if (!home.done) return town(home, 'Walking home');
  return { ...base, activity: 'Home after school' };
}

function lessonPose(lesson, hour, atBoard, room) {
  const u = (hour - lesson.start) / (lesson.end - lesson.start);
  if (u < .45 || u > .85) return atBoard(`Teaching ${lesson.label.split(' · ')[1] || lesson.label}`);
  const d = (hour - (lesson.start + (lesson.end - lesson.start) * .45)) * GAME_HOUR_SECONDS * .5;
  const s = along(TEACHER_LOOP, d % LOOP_LENGTH);
  return room({ ...s, moving: true }, 'Walking between the desks to help');
}

/** The whole school at one moment. */
export function schoolState(plan, hour, weekday = 4) {
  const h = ((hour % 24) + 24) % 24;
  return schoolSnapshot(h, weekday, plan.students.map((s) => studentAt(s, h, weekday)), teacherAt(plan, h, weekday));
}

function schoolSnapshot(h, weekday, students, teacher) {
  const lesson = sessionAt(h, weekday);
  const inRoom = students.filter((s) => s.where === 'room');
  const yard = students.filter((s) => s.where === 'yard');
  const lights = !isSchoolDay(weekday) || h < SCHOOL_HOURS.open || h >= session('tidy').end ? 'off' : lesson.id === 'tidy' ? 'cleaning' : 'on';
  return {
    weekday, hour: h, session: lesson, board: lesson.board || (lesson.id === 'recess' ? 'Recess! Back at 11:06' : lesson.id === 'tidy' || lesson.id === 'dismissal' ? 'Well done today, Owls!' : 'Good morning, Owls!'),
    students, teacher, lights,
    occupancy: { room: inRoom.length, seated: inRoom.filter((s) => s.seated).length, yard: yard.length, town: students.filter((s) => s.where === 'town').length, teacherInRoom: teacher.where === 'room' },
  };
}

// Walk only as far as the next blocked kerb or rail barrier. Keep the route
// cursor so a hold cannot skip part of the walk when the timetable advances.
function walkUntilBlocked({ route, distance, pace }, dt, clearRoad, clearRail) {
  const target = distance + dt * pace;
  let start = 0;
  for (let i = 1; i < route.pts.length; i++) {
    const a = route.pts[i - 1], b = route.pts[i], length = dist(a, b), end = start + length;
    if (distance < end - 1e-7) {
      if (route.cross[i] && distance <= start + 1e-7 && !clearRoad(a, b)) return start;
      const next = Math.min(target, end);
      if (!clearRail(lerp2(a, b, clamp01((distance - start) / length)), lerp2(a, b, (next - start) / length))) return distance;
      if (target <= end + 1e-7) break;
      distance = end;
    }
    start = end;
  }
  return null;
}

/** Live school walks. Clock seeks use the nominal timetable. */
export function createSchoolDay(plan) {
  let state, poses = new Map();
  return {
    get state() { return state; },
    update(hour, weekday, dt = 0, clearRoad = () => true, clearRail = () => true) {
      if (state?.hour === hour && state.weekday === weekday) return state;
      const continuous = state?.weekday === weekday && Math.abs((hour - state.hour) * GAME_HOUR_SECONDS - dt) < 1e-5;
      if (!continuous) poses = new Map();
      const advance = (id, at) => {
        const previous = poses.get(id);
        let time = previous ? previous.time + dt / GAME_HOUR_SECONDS : hour;
        const walk = previous?.pose.walk;
        const stop = walk && walkUntilBlocked(walk, dt, clearRoad, clearRail);
        if (stop != null) time = walk.start + hours(stop, walk.pace);
        let pose = at(time);
        if (stop != null) {
          pose.moving = false;
          pose.clip = 'Idle';
        }
        // Catch up only when both clocks have reached the same destination.
        if (!pose.walk && !previous?.pose.walk && time < hour - 1e-7) {
          const nominal = at(hour);
          if (!nominal.walk && nominal.where === pose.where) {
            time = hour;
            pose = nominal;
          }
        }
        poses.set(id, { time, pose });
        return pose;
      };
      const students = plan.students.map((s) => advance(s.id, (h) => studentAt(s, h, weekday)));
      const teacher = advance(plan.teacher.id, (h) => teacherAt(plan, h, weekday));
      state = schoolSnapshot(hour, weekday, students, teacher);
      return state;
    },
  };
}

/** People walking in the town right now (for the collision sim and audits). */
export function schoolWalkers(state) {
  if (!state) return [];
  return [...state.students, state.teacher].filter((p) => (p.where === 'town' || p.where === 'yard') && p.pos)
    .map((p) => {
      const pace = p.moving ? p.walk?.pace ?? PACE.home : 0;
      return { id: 'school-' + p.id, x: p.pos[0], z: p.pos[1], vx: Math.sin(p.heading) * pace, vz: Math.cos(p.heading) * pace, walking: true, crossing: !!p.crossing };
    });
}

// ---------------------------------------------------------------------------
// Rule checks (TOWN-01 walking, TOWN-04 furniture, TOWN-09 seats), reported by
// the road audit. `index` is surfaceIndex(roadSurfaces(town)).
// ---------------------------------------------------------------------------
export function schoolFindings(plan, index, { routes = schoolRoutes(plan), room = ROOM } = {}) {
  const out = [];
  for (const r of routes) {
    for (let i = 1; i < r.pts.length; i++) {
      if (r.cross[i]) continue; // a graph crossing edge: the zebra is the allowed place to step onto the road
      const a = r.pts[i - 1], b = r.pts[i], n = Math.max(1, Math.ceil(dist(a, b) / .25));
      for (let k = 0; k <= n; k++) {
        const p = lerp2(a, b, k / n);
        if (index.depth(p) > .05) { out.push({ category: 'school-walk', at: p, detail: `${r.who} ${r.key} route walks on the carriageway outside a crossing` }); k = n; i = r.pts.length; }
      }
    }
  }
  const { min, max } = room.bounds;
  for (const f of room.furniture) {
    const inside = f.pos[0] - f.size[0] / 2 >= min[0] - 1e-6 && f.pos[0] + f.size[0] / 2 <= max[0] + 1e-6 && f.pos[1] - f.size[2] / 2 >= min[1] - 1e-6 && f.pos[1] + f.size[2] / 2 <= max[1] + 1e-6;
    if (Math.abs(f.base) > .005 || !inside) out.push({ category: 'school-furniture', at: f.pos, detail: `${f.id} is ${inside ? `${f.base.toFixed(2)} m off the classroom floor` : 'outside the classroom walls'}` });
  }
  for (const s of [...room.seats, ...room.beanbags, room.teacherSeat]) {
    const furniture = room.furniture.find((f) => f.id === s.id || (s.id.startsWith('beanbag') && f.id === s.id));
    if (s.kind !== 'seat' || !Number.isFinite(s.seatHeight) || !furniture || Math.abs(furniture.size[1] - s.seatHeight) > .02) out.push({ category: 'school-seat', at: s.position, detail: `${s.id} is not a reserved seat whose height matches its furniture` });
  }
  for (const s of room.seats) if (s.seatHeight > CHILD.adultHip / 2) out.push({ category: 'school-seat', at: s.position, detail: `${s.id} seat at ${s.seatHeight} m is adult-scaled` });
  return out;
}
