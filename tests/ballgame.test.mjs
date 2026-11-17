// grok-merge: kids' pickup ballgame on the Astra Owls field.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {pedestrianGraph, walkBetween, roadSurfaces, surfaceIndex} from '../src/roads/pedestrian.js';
import {ballgameState, gameWindow, onField, FIELD, ROSTER, PLAY, kidPath} from '../src/astra/ballgame.js';

const onFieldCount = (s) => s.kids.filter((k) => k.visible && onField(k.pos) && k.role !== 'waiting').length;

test('at least nine kids play during game hours, none at night, weekends too', () => {
 for (const weekday of [0, 2, 4]) for (const hour of [15.6, 16.5, 17.75, 18.5]) for (let t = 0; t < PLAY * 3; t += .5) {
  const s = ballgameState(hour, t, weekday);
  assert.equal(s.phase, 'playing'); assert.ok(onFieldCount(s) >= 9, `${onFieldCount(s)} on the field at ${hour} weekday ${weekday} t ${t}`);
  assert.ok(s.ball.visible);
 }
 for (const weekday of [5, 6]) assert.ok(onFieldCount(ballgameState(12, 3, weekday)) >= 9, 'weekend midday game');
 assert.equal(ballgameState(12, 3, 2).kids.filter((k) => k.visible).length, 0, 'kids are at school on a weekday at noon');
 for (const weekday of [0, 3, 5, 6]) for (const hour of [0, 3, 6, 20, 21.5, 23.9]) {
  const s = ballgameState(hour, 7, weekday);
  assert.equal(s.kids.filter((k) => k.visible).length, 0, `kids out at ${hour}`); assert.equal(s.ball.visible, false);
 }
});

test('roster: pitcher, catcher, batter, fielders and two waiting; diamond has home in the fence corner', () => {
 const roles = ROSTER.map((r) => r.role);
 for (const r of ['pitcher', 'catcher', 'batter']) assert.ok(roles.includes(r));
 assert.ok(roles.filter((r) => /base|stop|field/.test(r)).length >= 4); assert.equal(roles.filter((r) => r === 'waiting').length, 2);
 const {home, first, second, third, mound} = FIELD, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
 for (const [a, b] of [[home, first], [first, second], [second, third], [third, home]]) assert.ok(Math.abs(d(a, b) - d(home, first)) < 1e-9, 'square base paths');
 assert.ok(Math.abs(d(home, second) - d(first, third)) < 1e-9); assert.ok(d(home, mound) < d(home, second) && d(home, mound) > 0);
});

test('the batter runs to first, sometimes rounds the bases, and the ball is pitched then hit', () => {
 const at = (u, n) => ballgameState(16, n * PLAY + u, 2);
 const batter = (s) => s.kids[ROSTER.findIndex((r) => r.role === 'batter')];
 assert.ok(Math.hypot(at(1.3, 0).ball.pos[0] - FIELD.mound[0], at(1.3, 0).ball.pos[2] - FIELD.mound[1]) < 8, 'pitch in flight');
 assert.ok(at(2.5, 0).ball.pos[1] > 2, 'hit in the air');
 const b = batter(at(4.5, 0)); assert.ok(Math.hypot(b.pos[0] - FIELD.first[0], b.pos[1] - FIELD.first[1]) < 1, 'safe on first');
 let rounded = false; for (let n = 0; n < 3; n++) { const p = batter(at(7, n)).pos; if (Math.hypot(p[0] - FIELD.second[0], p[1] - FIELD.second[1]) < 4 || Math.hypot(p[0] - FIELD.third[0], p[1] - FIELD.third[1]) < 4) rounded = true; }
 assert.ok(rounded, 'a big hit rounds the bases');
 for (let t = 0; t < PLAY * 3; t += .1) { const a = ballgameState(16, t, 2), c = ballgameState(16, t + .1, 2); a.kids.forEach((k, i) => assert.ok(Math.hypot(k.pos[0] - c.kids[i].pos[0], k.pos[1] - c.kids[i].pos[1]) < 1.2, `${k.role} teleports at ${t}`)); }
});

test('kids walk over from school on sidewalks, never along a carriageway, and leave at dusk', () => {
 const catalog = resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url))));
 const town = compileWorld(catalog, 831), graph = pedestrianGraph(town), steps = walkBetween(graph, FIELD.school, FIELD.entry);
 const walk = steps.map((s) => s.pos), index = surfaceIndex(roadSurfaces(town));
 for (let i = 1; i < steps.length; i++) if (!steps[i].cross) for (let k = 0; k <= 20; k++) {
  const a = steps[i - 1].pos, b = steps[i].pos, p = [a[0] + (b[0] - a[0]) * k / 20, a[1] + (b[1] - a[1]) * k / 20];
  assert.ok(index.depth(p) < 0, `walk route on a carriageway at ${p.map((v) => v.toFixed(1))}`);
 }
 for (const r of ROSTER) { const path = kidPath(walk, r.spot); assert.deepEqual(path.at(-1), r.spot); }
 const w = gameWindow(2);
 const arriving = ballgameState((w.arrive + w.start) / 2, 0, 2, walk), leaving = ballgameState((w.end + w.leave) / 2, 0, 2, walk);
 assert.ok(arriving.kids.some((k) => k.visible && k.activity.startsWith('Walking to')));
 assert.ok(leaving.kids.some((k) => k.visible && k.activity.startsWith('Walking home')));
 assert.equal(ballgameState(w.leave, 0, 2, walk).kids.filter((k) => k.visible).length, 0);
});
