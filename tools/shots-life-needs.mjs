import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';

const directory = new URL('../shots/life-needs/', import.meta.url);
mkdirSync(directory, {recursive: true});
const url = process.argv[2] ?? 'http://127.0.0.1:5265';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.route('**/favicon.ico', route => route.fulfill({status: 204}));
  await page.addInitScript(() => {
    const schedule = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => callback.name === 'frame' ? 0 : schedule(callback);
  });
  await page.goto(`${url}/?capture=1&seed=831&hour=0`, {waitUntil: 'domcontentloaded', timeout: 120_000});
  console.log('Loaded the town page');
  // Poll from Node because the capture page disables the live animation loop.
  for (let attempt = 0; ; attempt++) {
    if (await page.evaluate(() => window.__ready || window.__astraError)) break;
    assert(attempt < 180, 'The town did not finish loading');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(await page.evaluate(() => window.__astraError), undefined);
  await page.evaluate(() => {
    document.querySelector('.loading')?.remove();
    const speed = document.querySelector('#speed');
    speed.click();
    speed.click();
    const {camera} = window.__astra;
    for (const side of ['left', 'right', 'top', 'bottom']) camera[side] *= .7;
    camera.updateProjectionMatrix();
  });

  console.log('Town ready at 8×');
  const evidence = {};
  async function capture(moment, limit) {
    console.log('Advancing to', moment);
    const data = await page.evaluate(async ({moment, limit}) => {
      const {pedestrianGraph} = await import('/src/roads/pedestrian.js');
      const world = window.__astra, resident = world.residents.people.find(p => p.name === 'Daisy');
      const {actor, context} = resident, home = context.assets.home;
      const safe = pedestrianGraph(world.town).index;
      const matched = {
        morning: () => actor.action?.tool === 'walkTo' && actor.action.target === context.job.workplace &&
          actor.travelled > 7 && safe.depth(context.location.position) <= 0 && !actor.crossing &&
          resident.object.userData.animationClip === 'Walk',
        lunch: () => world.hour >= 11 && actor.action?.tool === 'eat' && actor.action.elapsed >= 3,
        errand: () => actor.action?.tool === 'buy' && actor.action.elapsed >= 2 &&
          resident.destination?.sellsMeals && resident.destination.id !== context.job.workplace && actor.history.some(e => e.tool === 'walkTo' && e.status === 'completed' && e.args.target === actor.action.target),
        evening: () => world.hour >= 20 && actor.action?.sleeping && context.location.place === home &&
          actor.history.some(e => e.tool === 'walkTo' && e.status === 'completed' && e.args.target === home && e.hour > 18),
      };
      for (let step = 0; step < 3000 && world.hour < limit; step++) {
        world.step(.1, false);
        if (!matched[moment]()) continue;
        const [x, z] = context.location.position;
        world.view({x, z, zoom: 5});
        world.selectPerson(resident);
        world.setPaused(true);
        world.step(0);
        world.setPaused(false);
        return {name: resident.name, hour: world.hour, action: actor.action.tool,
          destination: resident.destination?.name, activity: resident.activity,
          fed: context.needs.hunger, energy: context.needs.energy, cash: context.money,
          stock: context.assets.inventory.meal, position: [x, z], visible: resident.object.visible,
          clip: resident.object.userData.animationClip,
          history: actor.history.filter(e => e.status === 'completed').slice(-3).map(e => ({hour: e.hour, tool: e.tool, detail: e.detail}))};
      }
      return null;
    }, {moment, limit});
    assert(data, `The simulated day did not reach ${moment}`);
    assert.equal(await page.locator('.life-card h2').textContent(), data.name);
    assert.equal(await page.locator('.resident-activity span:last-child').textContent(), data.activity);
    assert.equal(await page.getByRole('meter', {name: 'Fed', exact: true}).count(), 1);
    await page.screenshot({path: new URL(`after-${moment}.png`, directory).pathname, timeout: 120_000});
    evidence[moment] = data;
    console.log(moment, data.hour.toFixed(2), data.activity, data.destination);
  }

  await capture('morning', 7);
  assert(evidence.morning.visible);
  assert.equal(evidence.morning.clip, 'Walk');
  assert(evidence.morning.history.some(event => event.detail === 'Asleep at home'));
  await capture('lunch', 15);
  assert(['Eat', 'Seated Eat'].includes(evidence.lunch.clip));
  const mealFedAfter = await page.evaluate(() => {
    const {context, actor} = window.__astra.residents.people.find(p => p.name === 'Daisy');
    for (let i = 0; i < 120 && actor.action?.tool === 'eat'; i++) window.__astra.step(.1, false);
    return context.needs.hunger;
  });
  assert(mealFedAfter - evidence.lunch.fed >= 30 || mealFedAfter === 100);
  await capture('errand', 20);
  const purchase = await page.evaluate(() => {
    const {context, actor} = window.__astra.residents.people.find(p => p.name === 'Daisy');
    const cash = context.money, stock = context.assets.inventory.meal;
    for (let i = 0; i < 120 && actor.action?.tool === 'buy'; i++) window.__astra.step(.1, false);
    return {cash: context.money - cash, stock: context.assets.inventory.meal - stock};
  });
  assert.equal(purchase.cash, -300);
  assert.equal(purchase.stock, 2);
  await capture('evening', 23.75);
  assert.equal(evidence.evening.visible, false);
  assert.deepEqual(errors, []);
  writeFileSync(new URL('evidence.json', directory), JSON.stringify({seed: 831, ...evidence, mealFedAfter, purchase, errors}, null, 2) + '\n');
} finally {
  await browser.close();
}
