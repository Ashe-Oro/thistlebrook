import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { compileWorld } from '../src/compiler/world-plan.js';
import { createCalendar, WEATHER } from '../src/life/calendar.js';
import { createLife } from '../src/astra/life/runtime.js';
import { allowsWeatherVisit, outdoorLinger, weatherPlan, weatherShelter, weatherSlotOpen } from '../src/astra/weather-plan.js';
import { pedestrianGraph, segDistance } from '../src/roads/pedestrian.js';
import { ZEBRA_HALF_WIDTH } from '../src/roads/crosswalks.js';

const catalog = resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url))));
const town = compileWorld(catalog, 831);
const request = (tool, target) => ({ tool, args: { target }, reason: 'Weather test' });

test('the seeded calendar and live weather resolve all five states', () => {
  const life = createLife(town);
  for (const type of WEATHER) {
    assert.equal(createCalendar(831, new URLSearchParams({ weather: type })).weather, type);
    assert.equal(life.setWeather(type), type);
    assert.equal(life.snapshot(life.actors[0]).weather, type);
  }
  const seeded = new Set(Array.from({ length: 100 }, (_, seed) => createCalendar(seed).weather));
  assert.deepEqual(seeded, new Set(WEATHER));
  assert.equal(life.setWeather('hail'), 'snow');
  assert.equal(life.setWeather('clear'), 'clear');
  assert.equal(createCalendar(831, new URLSearchParams('weather=invalid')).weather, createCalendar(831).weather);
  assert.equal(life.walkPace(life.actors[0]), life.actors[0].context.personality.pace);
  assert.equal(life.travelWeather(life.actors[0]), null);
});

function atTen(weather) {
  const life = createLife(town, { hour: 10, weather });
  const places = new Map(life.registry.places.map(p => [p.id, p]));
  let occupancy = 0, walking = 0, protectedWalkers = 0;
  const tools = new Set(), classes = new Set();
  let indoors = 0;
  for (let i = 0; i < 450; i++) {
    life.update(.2, 10);
    for (const a of life.actors) {
      if (a.action?.tool === 'walkTo') {
        walking++;
        if (life.travelWeather(a)) protectedWalkers++;
      } else if (a.context.location.slot && outdoorLinger(places.get(a.context.location.place))) {
        occupancy++;
      }
      if (a.action) {
        tools.add(a.action.tool);
        if (a.context.job.title === 'Student' && a.action.tool === 'work') classes.add(a.context.id);
        if (['visit', 'rest', 'eat'].includes(a.action.tool) && weatherShelter(places.get(a.action.target))) indoors++;
      }
    }
  }
  return { occupancy, walking, protectedWalkers, tools, classes, indoors };
}

test('seed 831 at 10:00 trades outdoor seats for shelter and keeps work and school', () => {
  const clear = atTen('clear'), rain = atTen('rain'), snow = atTen('snow');
  assert(clear.occupancy > 0);
  assert(rain.occupancy <= clear.occupancy * .5, JSON.stringify({ clear, rain }));
  assert(rain.walking > 0 && rain.protectedWalkers / rain.walking >= .8);
  assert(rain.indoors > clear.indoors);
  for (const wet of [rain, snow]) {
    assert(wet.classes.size > 0);
    assert(wet.tools.has('work'));
  }
});

test('a resident at a shop can replenish a packed lunch during rain or snow', () => {
  for (const type of ['rain', 'snow']) {
    const life = createLife(town, { hour: 10, weather: type });
    const shop = life.registry.places.find(p => p.capabilities.includes('buy') && p.capabilities.includes('walkTo') && !p.interaction);
    // Villager needs: pick a customer who is off shift at 10:00, not the shop's own staff.
    const offShift = (job) => job.shift[0] === job.shift[1] || !(10 >= job.shift[0] && 10 < job.shift[1]);
    const a = life.actors.find(actor => actor.context.job.workplace !== shop.id && offShift(actor.context.job));
    Object.assign(a.context.location, { node: shop.node, position: [...shop.pos], place: shop.id });
    a.context.assets.inventory.meal = 0;
    // needs.hunger is satiety since villager-needs: low means hungry.
    a.context.needs.hunger = 20;
    a.context.memory.lastMeal = -1000;
    a.context.money = 1000;
    for (let i = 0; i < 40; i++) life.update(.2, 10);
    assert(a.history.some(e => e.tool === 'buy' && e.status === 'completed'));
    assert(a.context.assets.inventory.meal > 0);
  }
});

test('snow slows outdoor walks, reduces picnic and visitor slots, and leaves baseball and play open', () => {
  const life = createLife(town, { hour: 10, brain: () => null });
  const a = life.actors[0], pace = life.walkPace(a);
  life.setWeather('snow');
  assert(life.walkPace(a) < pace);
  const picnic = life.registry.places.find(p => p.id === 'life:picnic');
  const canPicnic = life.actors.filter(actor => allowsWeatherVisit('snow', picnic, actor.index)).length;
  assert(canPicnic > 0 && canPicnic < life.actors.length / 2);
  assert.equal(picnic.interaction.slots.filter(slot => weatherSlotOpen('snow', picnic, slot)).length, 1);
  for (const activity of ['baseball', 'play']) {
    const place = life.registry.places.find(p => p.interaction?.activity === activity);
    assert(place, activity);
    for (const type of ['rain', 'snow']) assert(allowsWeatherVisit(type, place, 1));
  }
  for (const type of ['rain', 'snow']) {
    assert(weatherPlan(type).fairAttendance < 1);
    assert(weatherPlan(type).beachAttendance < 1);
  }
  life.setWeather('clear');
  assert.equal(life.walkPace(a), pace);
  assert(life.actors.every(actor => allowsWeatherVisit('clear', picnic, actor.index)));
});

function assertNoRainyBench(life, a, bench) {
  for (let i = 0; i < 450; i++) {
    life.update(.2, 10 + i / 450);
    assert(!(a.action?.tool === 'rest' && a.context.location.place === bench && a.context.location.slot),
      'A resident is lingering on an outdoor bench in the rain');
  }
}

test('switching to rain interrupts a reserved bench rest and the hour check catches injected lingering', () => {
  const life = createLife(town, { hour: 10, brain: () => null });
  const a = life.actors[0], bench = life.registry.places.find(p => p.interaction?.activity === 'sit').id;
  assert(life.execute(a, request('walkTo', bench)).ok);
  for (let i = 0; i < 1500 && a.action; i++) life.update(.2, 10);
  assert.equal(a.context.location.place, bench);
  assert(life.execute(a, request('rest', bench)).ok);
  const resting = { ...a.action, duration: 90 };
  life.setBrain(ctx => ctx.self.id === a.context.id ? request('walkTo', ctx.self.assets.home) : null);
  life.setWeather('rain');
  assert.equal(life.execute(a, request('rest', bench)).ok, false);
  assertNoRainyBench(life, a, bench);
  assert.notEqual(a.context.location.place, bench);
  assert(![...life.reservations].some(([key, id]) => key.startsWith(bench) && id === a.context.id));

  a.context.location.place = bench;
  a.context.location.slot = 'injected';
  a.action = resting;
  assert.throws(() => assertNoRainyBench(life, a, bench), /lingering/);
});

test('TOWN-01 weather routines keep walkers on paths and marked crossings', () => {
  const graph = pedestrianGraph(town);
  const crossings = graph.crossings.map(([a, b]) => [graph.nodes[a].pos, graph.nodes[b].pos]);
  for (const type of ['rain', 'snow']) {
    const life = createLife(town, { hour: 9, weather: type });
    let walkers = 0;
    for (let i = 0; i < 2250; i++) {
      life.update(.2, 9 + i / 450);
      for (const a of life.actors) {
        if (a.action?.tool !== 'walkTo') continue;
        walkers++;
        const p = a.context.location.position;
        if (graph.index.depth(p) > .05) {
          assert(crossings.some(([x, z]) => segDistance(p, x, z) <= ZEBRA_HALF_WIDTH),
            `${type}: ${a.context.name} on the carriageway at ${p.join(', ')}`);
        }
      }
    }
    assert(walkers > 0);
  }
});
