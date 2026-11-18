import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const origin = process.argv[2] ?? 'http://127.0.0.1:5271';
const output = new URL('../shots/maple-integration/', import.meta.url);
await mkdir(output, {recursive: true});

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 960}});
  const errors = [];
  await page.route('**/favicon.ico', (route) => route.fulfill({status: 204}));
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${message.location().url}: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (!response.ok() && response.url().includes('/licensed/')) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`${origin}/?capture=1&seed=831&skin=cel&weather=clear&view=maple-hollow`, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 600000, polling: 500});
  assert.equal(await page.evaluate(() => window.__astraError), undefined);

  for (const [name, camera] of [
    ['level-crossing', {x: 61, z: -176.5, zoom: 4, rotation: 0}],
    ['driveways', {x: 17, z: -145, zoom: 4.2, rotation: 0}],
    ['civic-cycle-strip-rain', {x: -80, z: -36.1, zoom: 5, rotation: 0}],
  ]) {
    const {image, ...state} = await page.evaluate(({name, camera}) => {
      const town = window.__astra;
      town.setPaused(true);
      town.setWeather(name.endsWith('rain') ? 'rain' : 'clear');
      town.setHour(name.endsWith('rain') ? 8.75 : 11.4);
      if (name === 'level-crossing') {
        const service = town.world.railway.service;
        const gate = service.rail.crossings[0];
        const seconds = service.timetable.first + service.timetable.lap;
        for (let step = 0; step < service.timetable.lap; step += .2) {
          const hour = (seconds + step) / 90;
          service.update(hour);
          const engine = service.cars[0];
          const gap = Math.hypot(engine.pos[0] - gate.pos[0], engine.pos[1] - gate.pos[1]);
          if (service.crossings[0].lower === 1 && gap < 8) {
            town.setHour(hour);
            break;
          }
        }
      }
      if (name.endsWith('rain')) {
        const cyclist = town.traffic.simulation.vehicles.find((v) => v.route === 'station-reverse-cycle');
        town.setPaused(false);
        for (let step = 0; step < 4; step++) town.step(.1, false);
        for (let step = 0; step < 2400; step++) {
          const [x, z] = cyclist.position;
          if (x > -79.2 && x < -77.8 && z > -42 && z < -37.2) break;
          town.step(.1, false);
        }
        town.setPaused(true);
      }
      town.view(camera);
      town.step(0);
      return {
        image: town.renderer.domElement.toDataURL('image/png').split(',')[1],
        hour: town.hour,
        weather: town.weather,
        gated: town.world.railway.service.crossings[0].closed,
        drivewayCount: town.town.mapleHollow.bays.length,
        cyclist: town.traffic.simulation.vehicles.find((v) => v.route === 'station-reverse-cycle').position,
        rainDrawCalls: town.audit().weather.effectDrawCalls,
        drawCalls: town.renderer.info.render.calls,
      };
    }, {name, camera});
    assert(state.drawCalls > 0 && state.drivewayCount === 22);
    if (name === 'level-crossing') assert(state.gated);
    if (name.endsWith('rain')) {
      assert.equal(state.weather, 'rain');
      assert.equal(state.rainDrawCalls, 2);
      assert(Math.hypot(state.cyclist[0] + 80, state.cyclist[1] + 36.1) < 7);
    }
    await writeFile(new URL(name + '.png', output), Buffer.from(image, 'base64'));
    console.log(name, state);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
