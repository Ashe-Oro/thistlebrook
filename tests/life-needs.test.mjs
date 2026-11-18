import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {createLife} from '../src/astra/life/runtime.js';
import {scriptedPlanner} from '../src/astra/life/planner.js';
import {isOpen} from '../src/astra/life/registry.js';
import {isSchoolDay, weekdayOf} from '../src/astra/school-plan.js';

const catalog = resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url))));
const towns = new Map([831, 42].map(seed => [seed, compileWorld(catalog, seed)]));
const secondsPerHour = 90;
const mealShops = places => places.filter(p => p.sellsMeals);

function noon(life) {
  const actor = life.actors.find(a => a.context.name === 'Mae');
  actor.context.needs.hunger = 10;
  actor.context.assets.inventory.meal = 0;
  return actor;
}

test('low food at noon leads to a meal and closed food shops lead to the home pantry', () => {
  const life = createLife(towns.get(831), {hour: 12});
  const actor = noon(life), view = structuredClone(life.snapshot(actor));
  assert(mealShops(view.places).length > 1);
  const plan = scriptedPlanner(view);
  assert(['eat', 'walkTo'].includes(plan?.tool));
  const destination = view.places.find(p => p.id === plan.args.target);
  assert(destination.servesFood || destination.id === view.self.assets.home);
  for (const place of mealShops(view.places)) place.hours = [6, 7];
  const fallback = scriptedPlanner(view);
  assert.equal(fallback.tool, 'eat');
  assert.equal(fallback.args.target, view.self.assets.home);
  assert.match(fallback.reason, /pantry/i);
});

test('an unreachable food shop is recorded and the resident eats safely at home', () => {
  const town = structuredClone(towns.get(831));
  const baseline = createLife(town, {hour: 12});
  const {context} = noon(baseline);
  const shops = mealShops(baseline.registry.places);
  const unreachable = shops.find(p => p.name === 'Flour & Fern');
  town.nodes.push([...context.location.position]);
  town.edges.push([]);
  const places = shops.map(p => ({id: p.id, name: p.name, capabilities: ['walkTo', 'buy'],
    hours: p === unreachable ? [0, 24] : [6, 7], node: p === unreachable ? town.nodes.length - 1 : p.node}));
  const life = createLife(town, {hour: 12, places});
  const actor = noon(life);
  const position = [...actor.context.location.position];
  for (let t = 0; t < 25; t++) life.update(1);
  assert(actor.history.some(e => e.status === 'fallback' && e.args.target === unreachable.id));
  assert(actor.history.some(e => e.status === 'completed' && e.tool === 'eat' && e.args.target === actor.context.assets.home));
  assert.deepEqual(actor.context.location.position, position);
});

test('at 23:00 a tired resident walks back from an outing and sleeps at home', () => {
  const life = createLife(towns.get(831), {hour: 19, brain: () => null});
  const actor = noon(life), home = actor.context.assets.home;
  assert(life.execute(actor, {tool: 'walkTo', args: {target: 'life:picnic'}, reason: 'Evening outing'}).ok);
  for (let t = 0; actor.action && t < 600; t++) life.update(1);
  assert.equal(actor.context.location.place, 'life:picnic');
  life.setHour(23);
  actor.context.needs.energy = 10;
  life.setBrain(scriptedPlanner);
  life.update(1);
  assert.equal(actor.action?.tool, 'walkTo');
  assert.equal(actor.action?.target, home);
  for (let t = 0; !actor.action?.sleeping && t < 600; t++) life.update(1);
  assert.equal(actor.context.location.place, home);
  assert(actor.action?.sleeping);
  const energy = actor.context.needs.energy;
  life.update(1);
  assert(actor.context.needs.energy > energy);
});

for (const [seed, town] of towns) test(`full day at seed ${seed}`, t => {
  const life = createLife(town, {hour: 21});
  // Start the clocks before midnight so the nurse can walk to the clinic.
  for (let elapsed = .5; elapsed <= 3 * secondsPerHour; elapsed += .5) life.update(.5, (21 + elapsed / secondsPerHour) % 24);
  const stats = life.actors.map(() => ({sleep: 0, meals: 0, work: 0, due: 0}));
  // school-day: Thistlebrook High is closed at weekends, so its shifts are only due on school days.
  const shiftDue = (job, hour) => job.shift[0] !== job.shift[1] && isOpen(job.shift, hour) && !(job.workplace === 'school' && !isSchoolDay(weekdayOf(life.day)));
  let lastEvent = life.events.at(-1)?.id ?? 0, nightWalking = 0, dayWalking = 0, purchases = 0, talks = 0, sharedPlaceTalks = 0;
  const dt = .5;
  for (let elapsed = dt; elapsed <= 24 * secondsPerHour; elapsed += dt) {
    const hour = (elapsed - dt) / secondsPerHour;
    const before = life.actors.map(({context, action}) => ({food: context.needs.hunger, stock: context.assets.inventory.meal, cash: context.money, action}));
    life.update(dt, hour);
    life.actors.forEach((actor, i) => {
      const {context, action} = actor;
      for (const value of Object.values(context.needs)) assert(Number.isFinite(value) && value >= 0 && value <= 100, context.name);
      if (action?.sleeping) {
        assert.equal(context.location.place, context.assets.home);
        stats[i].sleep += dt;
      }
      const due = shiftDue(context.job, hour);
      if (due) stats[i].due += dt;
      if (action?.tool === 'work' && isOpen(context.job.shift, hour)) {
        assert.equal(context.location.place, context.job.workplace);
        if (due) stats[i].work += dt;
      }
      if (action?.tool === 'walkTo') {
        if (hour >= 22.5) nightWalking++;
        if (hour >= 16 && hour < 17.5) dayWalking++;
      }
      const old = before[i];
      if (old.action?.tool === 'eat' && old.action !== action && context.needs.hunger > old.food) {
        assert(context.needs.hunger - old.food >= 30 || context.needs.hunger === 100);
        const place = life.registry.places.find(p => p.id === context.location.place);
        assert(place.servesFood || (place.capabilities.includes('eat') && old.stock > 0) || place.id === context.assets.home);
        stats[i].meals++;
      }
      if (old.action?.tool === 'buy' && old.action !== action && context.money < old.cash) {
        const shop = life.registry.places.find(p => p.id === context.location.place);
        assert(shop.sellsMeals && isOpen(shop.hours, hour));
        assert.equal(context.money, old.cash - 300);
        assert.equal(context.assets.inventory.meal, old.stock + 2);
        purchases++;
      }
    });
    for (const event of life.events) if (event.id > lastEvent) {
      if (event.tool === 'talkTo' && event.status === 'completed') {
        talks++;
        const placeOf = id => life.actors.find(a => a.context.id === id)?.context.location.place;
        if (placeOf(event.resident) && placeOf(event.resident) === placeOf(event.args.target)) sharedPlaceTalks++;
      }
      lastEvent = event.id;
    }
  }
  const results = stats.map(({sleep, meals, work, due}, i) => {
    const {name} = life.actors[i].context;
    return {name, sleep: sleep / secondsPerHour, meals, attendance: due ? work / due : 1};
  });
  const missed = results.filter(r => r.sleep < 6 || r.meals < 2 || r.attendance < .9);
  t.diagnostic(`${results.length - missed.length}/${results.length} meet all three targets, ${purchases} purchases, ${talks} conversations, ${nightWalking}/${dayWalking} late/afternoon walker samples. Missed: ${JSON.stringify(missed)}`);
  assert(results.length - missed.length >= Math.ceil(results.length * .9));
  assert(nightWalking < dayWalking / 2);
  assert(purchases > 0 && talks > 0 && sharedPlaceTalks > 0);
});
