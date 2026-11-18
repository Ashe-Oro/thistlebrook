// school-day: Thistlebrook High's weekday timetable, Room 4 and the walks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {pedestrianGraph, walkBetween, roadSurfaces, surfaceIndex, segDistance} from '../src/roads/pedestrian.js';
import {ZEBRA_HALF_WIDTH} from '../src/roads/crosswalks.js';
import {ballgameState} from '../src/astra/ballgame.js';
import {animationPlan, animationRuleErrors, CLIP} from '../src/life/animation-plan.js';
import {createLife} from '../src/astra/life/runtime.js';
import {runAudit} from '../tools/audit-roads.mjs';
import {
  planSchool, schoolState, createSchoolDay, studentDay, schoolRoutes, schoolFindings, schoolWalkers, sessionAt, canEnterClassroom,
  TIMETABLE, ROOM, CHILD, SCHOOL, ENTER_EASE, isSchoolDay, weekdayOf, GAME_HOUR_SECONDS,
} from '../src/astra/school-plan.js';

const catalog = resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url))));
const town = compileWorld(catalog, 831), graph = pedestrianGraph(town), index = surfaceIndex(roadSurfaces(town));
const plan = planSchool(town, graph, walkBetween);
const crossings = graph.crossings.map(([a, b]) => [graph.nodes[a].pos, graph.nodes[b].pos]);
const onCarriageway = (p) => index.depth(p) > .05 && !crossings.some(([a, b]) => segDistance(p, a, b) <= ZEBRA_HALF_WIDTH);
const inBox = (p, box) => p[0] >= box.min[0] && p[0] <= box.max[0] && p[1] >= box.min[1] && p[1] <= box.max[1];
const FRIDAY = 4, SATURDAY = 5, SUNDAY = 6;

test('weekday timetable: arrival, two or more lessons, a recess, home time; weekends closed', () => {
  const lessons = TIMETABLE.filter((s) => s.lesson);
  assert.ok(lessons.length >= 2, 'at least two class periods');
  assert.ok(TIMETABLE.some((s) => s.id === 'recess' || s.id === 'lunch'));
  for (let i = 1; i < TIMETABLE.length; i++) assert.equal(TIMETABLE[i].start, TIMETABLE[i - 1].end, 'periods are back to back');
  assert.deepEqual([TIMETABLE[0].start, TIMETABLE[0].end], [7.75, 8.5], 'arrival window 07:45–08:30');
  assert.equal(sessionAt(9.5, FRIDAY).id, 'period-1');
  for (const w of [SATURDAY, SUNDAY]) { assert.equal(sessionAt(9.5, w).id, 'weekend'); assert.equal(canEnterClassroom(9.5, w), false); }
  assert.ok(canEnterClassroom(9.5, FRIDAY) && canEnterClassroom(15.5, FRIDAY) && !canEnterClassroom(20, FRIDAY) && !canEnterClassroom(7, FRIDAY));
  assert.ok([0, 1, 2, 3, 4].every(isSchoolDay) && !isSchoolDay(5) && !isSchoolDay(6));
  assert.equal(weekdayOf(0), FRIDAY, 'the first simulated day is a Friday');
});

test('weekday 09:30: at least 8 pupils seated in Room 4, the teacher present, none on the road', () => {
  const s = schoolState(plan, 9.5, FRIDAY);
  assert.ok(s.occupancy.seated >= 8, `${s.occupancy.seated} seated`);
  assert.equal(s.teacher.where, 'room');
  assert.ok(s.students.filter((p) => p.seated).every((p) => p.seat && p.seat.kind === 'seat'));
  assert.equal(s.students.filter((p) => p.where === 'town' && onCarriageway(p.pos)).length, 0);
  assert.equal(s.students.filter((p) => p.where === 'town').length, 0, 'nobody waits outside during class');
  assert.equal(s.lights, 'on');
});

test('recess: the room empties by at least 75% and at least 6 pupils play at Little Oak', () => {
  const lesson = schoolState(plan, 9.5, FRIDAY), recess = schoolState(plan, 10.5, FRIDAY);
  assert.ok(recess.occupancy.room <= lesson.occupancy.room * .25, `${recess.occupancy.room} still in the room`);
  const box = town.venues.find((v) => v.type === 'playground').box;
  const playing = recess.students.filter((p) => p.where === 'yard' && inBox(p.pos, box));
  assert.ok(playing.length >= 6, `${playing.length} at the playground`);
  assert.equal(recess.teacher.where, 'yard', 'Ms Hart is on yard duty');
  // Back in class for Period 2.
  assert.ok(schoolState(plan, 11.5, FRIDAY).occupancy.seated >= 8);
});

test('weekend 09:30: Room 4 is empty and dark, and the ballgame keeps its weekend window', () => {
  for (const w of [SATURDAY, SUNDAY]) {
    const s = schoolState(plan, 9.5, w);
    assert.equal(s.occupancy.room, 0); assert.equal(s.occupancy.town, 0); assert.equal(s.teacher.where, 'home'); assert.equal(s.lights, 'off');
    assert.ok(ballgameState(12, 3, w).kids.filter((k) => k.visible).length >= 9, 'weekend ballgame');
  }
});

test('arrival and dismissal walk the sidewalk graph, never along a carriageway', () => {
  const routes = schoolRoutes(plan);
  assert.ok(routes.length >= plan.students.length * 4);
  for (const r of routes) {
    assert.equal(r.pts.length, r.cross.length);
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i];
      if (r.cross[i]) { assert.ok(crossings.some(([c, d]) => segDistance(a, c, d) < .3 && segDistance(b, c, d) < .3), `${r.who} ${r.key}: crossing off the graph`); continue; }
      for (let k = 0; k <= 20; k++) { const p = [a[0] + (b[0] - a[0]) * k / 20, a[1] + (b[1] - a[1]) * k / 20]; assert.ok(index.depth(p) <= .05, `${r.who} ${r.key} on a carriageway at ${p.map((v) => v.toFixed(1))}`); }
    }
  }
  for (const s of plan.students) {
    const m = s.routes.morning.pts;
    assert.ok(Math.hypot(m.at(-1)[0] - SCHOOL.door[0], m.at(-1)[1] - SCHOOL.door[1]) < .01, 'morning ends at the school door');
    if (s.bus) assert.deepEqual(m[0], SCHOOL.busDoor); else assert.deepEqual(m[0], town.buildings.find((b) => b.key === s.home.key).door);
  }
  // Every quarter-minute of a school day: anyone outdoors is on a sidewalk, path, crossing or the playground.
  const box = town.venues.find((v) => v.type === 'playground').box;
  let seenArriving = 0, seenLeaving = 0;
  for (let h = 7; h < 17; h += 1 / 240) {
    const s = schoolState(plan, h, FRIDAY);
    for (const p of [...s.students, s.teacher].filter((p) => p.where === 'town' || p.where === 'yard')) {
      assert.ok(!onCarriageway(p.pos), `${p.id} on the road at ${h.toFixed(2)} (${p.pos.map((v) => v.toFixed(1))})`);
      if (p.where === 'yard') assert.ok(inBox(p.pos, box));
    }
    if (h >= 7.75 && h < 8.5) seenArriving = Math.max(seenArriving, s.students.filter((p) => p.where === 'town').length);
    if (h >= 14.6 && h < 15.6) seenLeaving = Math.max(seenLeaving, s.students.filter((p) => p.where === 'town' && /home|bus/.test(p.activity)).length);
  }
  assert.ok(seenArriving >= 6 && seenLeaving >= 6, `${seenArriving} arriving, ${seenLeaving} leaving`);
  const bay = schoolState(plan, 8.2, FRIDAY).students.filter((p) => p.where === 'town' && Math.hypot(p.pos[0] - 8, p.pos[1] + 56) < 14);
  assert.ok(bay.length >= 2, 'pupils at the bus bay and door around 08:12');
  // Walkers handed to the collision sim match the outdoor pupils.
  assert.equal(schoolWalkers(schoolState(plan, 10.5, FRIDAY)).length, 13);
  // Pace sanity: nobody crosses town faster than a jog.
  for (const s of plan.students) assert.ok(s.routes.morning.length / ((schoolStateDoorTime(s) - schoolStateStart(s)) * GAME_HOUR_SECONDS) < 3.2);
});
const schoolStateStart = (s) => { for (let h = 6; h < 9; h += 1 / 600) if (schoolState(plan, h, FRIDAY).students[s.index].where === 'town') return h; return 9; };
const schoolStateDoorTime = (s) => { for (let h = 6; h < 9; h += 1 / 600) if (['corridor', 'room'].includes(schoolState(plan, h, FRIDAY).students[s.index].where)) return h; return 9; };

test('a pupil waits at the zebra until traffic clears while the school clock keeps running', () => {
  const pupil = plan.students.find((s) => s.routes.morning.cross.includes(true));
  const route = pupil.routes.morning, i = route.cross.indexOf(true);
  const from = route.pts[i - 1], to = route.pts[i];
  const distance = route.pts.slice(1, i).reduce((sum, p, j) => sum + Math.hypot(p[0] - route.pts[j][0], p[1] - route.pts[j][1]), 0);
  const start = studentDay(pupil).leaveHome;
  const pace = schoolState(plan, start + .001, FRIDAY).students[pupil.index].walk.pace;
  const curb = start + distance / pace / GAME_HOUR_SECONDS;
  const school = createSchoolDay(plan);
  const closed = (a, b) => a !== from || b !== to;
  const dt = .2;
  let hour = curb - .1 / GAME_HOUR_SECONDS;
  school.update(hour, FRIDAY);
  for (let step = 0; step < 6; step++) {
    hour += dt / GAME_HOUR_SECONDS;
    const state = school.update(hour, FRIDAY, dt, closed);
    const { x, z, vx, vz } = schoolWalkers(state).find((p) => p.id === 'school-' + pupil.id);
    assert(Math.hypot(x - from[0], z - from[1]) < 1e-6);
    assert.equal(Math.hypot(vx, vz), 0);
    assert.equal(state.hour, hour);
  }
  hour += dt / GAME_HOUR_SECONDS;
  const {pos, moving} = school.update(hour, FRIDAY, dt).students[pupil.index];
  assert(moving && segDistance(pos, from, to) < 1e-6 && Math.hypot(pos[0] - from[0], pos[1] - from[1]) > .1);
});

test('Room 4 is child scale, furnished on the floor, with a documented seat per pupil', () => {
  assert.ok(CHILD.seatHeight < CHILD.adultHip / 2 && CHILD.deskHeight < CHILD.adultHip, 'seats and desks well below adult hip height');
  assert.ok(ROOM.seats.length >= 8 && ROOM.desks.length === ROOM.seats.length);
  for (const k of ['desk', 'chair', 'cubbies', 'bookshelf', 'rug', 'teacher-desk']) assert.ok(ROOM.furniture.some((f) => f.kind === k), k);
  assert.deepEqual(schoolFindings(plan, index), []);
  for (const seat of [...ROOM.seats, ...ROOM.beanbags, ROOM.teacherSeat]) {
    const p = animationPlan({tool: 'rest', place: {interaction: {activity: 'sit'}}, slot: seat, position: seat.position});
    assert.equal(p.clip, CLIP.sit); assert.equal(p.seatHeight, seat.seatHeight);
    assert.deepEqual(animationRuleErrors({clip: p.clip, slot: seat, position: seat.position, hipsY: seat.seatHeight + .105, hipsAboveSeat: .105}), []);
  }
  // Injected faults are caught: a floating desk, an adult-height chair.
  const room = {...ROOM, furniture: ROOM.furniture.map((f) => f.id === 'desk-0' ? {...f, base: .2} : f), seats: ROOM.seats.map((s, i) => i ? s : {...s, seatHeight: .6})};
  const found = schoolFindings(plan, index, {room});
  assert.ok(found.some((f) => f.category === 'school-furniture' && /desk-0/.test(f.detail)));
  assert.ok(found.some((f) => f.category === 'school-seat' && /adult/.test(f.detail)));
});

test('enter and leave Room 4 in under a second of camera ease', () => {
  assert.ok(ENTER_EASE.town + ENTER_EASE.room < 1);
  const src = readFileSync(new URL('../src/astra/school-interior.js', import.meta.url), 'utf8');
  assert.match(src, /prefers-reduced-motion/); assert.match(src, /reduced\.matches/);
  // Classroom models are not part of the first town paint.
  const main = readFileSync(new URL('../src/astra/main.js', import.meta.url), 'utf8');
  assert.match(main, /createSchoolEntry/);
  assert.match(src, /async function build\(\)/);
});

test('road audit: a pupil route down the middle of the avenue fails TOWN-01', async () => {
  const clean = await runAudit();
  assert.equal(clean.findings.filter((f) => f.category.startsWith('school-') && f.status === 'open').length, 0);
  const bad = await runAudit({mutateSchool: (p) => { p.students[0].routes.morning = {pts: [[-30, -33], [40, -33]], cross: [false, false], length: 70}; }});
  const hit = bad.findings.filter((f) => f.category === 'school-walk' && f.status === 'open');
  assert.ok(hit.length >= 1, 'avenue route caught'); assert.equal(hit[0].rule, 'TOWN-01');
});

test('life planner honours the timetable: school staff and pupils are free at the weekend', () => {
  const life = createLife(town, {hour: 6});
  const school = life.actors.filter((a) => a.context.job.workplace === 'school');
  assert.ok(school.length >= 3);
  for (const a of school) assert.ok(a.context.job.shift[0] >= 7.5 && a.context.job.shift[1] <= 16, `${a.context.name} shift ${a.context.job.shift}`);
  // Friday 06:00 to Saturday 11:00.
  let worked = 0;
  for (let t = 0; t < 29 * GAME_HOUR_SECONDS; t += .5) {
    const hour = (6 + t / GAME_HOUR_SECONDS) % 24; life.update(.5, hour);
    if (life.day === 1 && hour > 8 && hour < 11) worked += school.filter((a) => a.action?.tool === 'work' && a.context.location.place === 'school').length;
  }
  assert.equal(life.day, 1); assert.equal(weekdayOf(life.day), SATURDAY);
  assert.equal(worked, 0, 'nobody works at the school on Saturday');
});
