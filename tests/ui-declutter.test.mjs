// Ashe, Nov 18 9:51 AM: declutter the HUD. No "Your view"/share panel, no
// control hint, no happenings box, no bottom control bar and no sound. The
// top-right clock dropdown is the one place to set time, and it also holds
// pace, weather and skin so those stay reachable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOWN_RULE } from '../src/compiler/town-rules.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const chrome = process.env.CHROME || '/usr/bin/google-chrome';

test(`${TOWN_RULE.hud} removed HUD pieces have no markup, code or CSS left`, () => {
  const ui = read('src/astra/ui.js'), cam = read('src/astra/camera-ui.js'), main = read('src/astra/main.js');
  const css = ['style.css', 'camera.css', 'light-controls.css', 'weather.css'].map(f => read('src/astra/' + f)).join('\n');
  for (const [src, name] of [[ui, 'ui.js'], [cam, 'camera-ui.js'], [main, 'main.js']]) {
    for (const gone of [/YOUR VIEW/i, /share-view/, /camera-status/, /HAPPENINGS/i, /moment-title/, /control-bar/, /id="sound"|#sound/, /AudioContext/, /Scroll to get closer/i, /class="hint"|'\.hint'/, /id="day"|id="night"|school-time/]) {
      assert.doesNotMatch(src, gone, `${name} still has ${gone}`);
    }
  }
  for (const sel of ['.moment', '.control-bar', '.camera-status', '.share-view', '.camera-message', '.hint', '.transport', '.help'])
    assert.doesNotMatch(css, new RegExp(sel.replace('.', '\\.') + '(?![\\w-])'), `dead CSS for ${sel}`);
  for (const f of ['fair-ui.js', 'harbor-ui.js', 'coast-ui.js']) assert(!existsSync(join(root, 'src/astra', f)), `${f} is dead code`);
  assert.doesNotMatch(read('src/astra/place-info.js'), /worldMoment/);
});

test('?weather= and ?skin= URL params are still read', () => {
  const main = read('src/astra/main.js');
  assert.match(main, /skinFromQuery\(q\)/);
  assert.match(read('src/life/calendar.js'), /q\.get\('weather'\)/);
  assert.match(main, /calendar\.weather/);
});

const types = { '.js': 'text/javascript', '.mjs': 'text/javascript' };
test('clock settings work and mobile overlays fit in one touch-friendly row', { skip: !existsSync(chrome) && 'no Chrome' }, async () => {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('http://ui.test/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script><body></body>` });
      // Vite turns CSS imports into style tags; in a raw browser they are empty modules.
      if (path.endsWith('.css')) return route.fulfill({ contentType: 'text/javascript', body: '' });
      const file = join(root, path);
      if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ contentType: types[extname(file)] || 'text/plain', body: readFileSync(file) });
    });
    await page.goto('http://ui.test/');
    const result = await page.evaluate(async () => {
      const { createUI } = await import('/src/astra/ui.js');
      const { createLightControls } = await import('/src/astra/light-controls.js');
      const { mountWorldNavigation } = await import('/src/astra/navigation.js');
      const { mountWeatherControl } = await import('/src/astra/weather.js');
      const { mountSkinPicker } = await import('/src/astra/skin/picker.js');
      const log = { hour: [], pause: 0, speed: 0, weather: [], skin: [] };
      const ui = createUI({ districts: [], seed: 1 }, { zoom() {}, rotate() {}, view() {}, hour: h => log.hour.push(h), unfollow() {} });
      mountWorldNavigation(ui, id => ui.view(id));
      const lc = createLightControls(ui.root, h => log.hour.push(h), { pause: () => log.pause++, speed: () => log.speed++ });
      const show = mountWeatherControl(lc.section('weather'), 'clear', t => { log.weather.push(t); show(t); });
      const listeners = [];
      mountSkinPicker(lc.section('skin'), { list: () => [{ id: 'cel', label: 'Cel', swatch: ['#000', '#111', '#222'] }, { id: 'winter', label: 'Winter', swatch: ['#fff', '#eee', '#ddd'] }], skin: { id: 'cel', label: 'Cel' }, setSkin: id => log.skin.push(id), onChange: f => listeners.push(f), next() {} });
      lc.update(10.4);
      const q = s => document.querySelector(s);
      const absent = ['.camera-status', '.share-view', '.hint', '.moment', '#moment-title', '.control-bar', '.transport', '#sound', '#day', '#night', '#school-time', '#help', '.help']
        .filter(s => q(s));
      const text = document.body.innerText;
      const toggle = q('.top-right .clock .light-toggle');
      toggle.click();
      const opened = !q('#astra-light-picker').hidden;
      q('#astra-light-picker [data-hour]').click();
      const slider = q('#astra-hour'); slider.value = '900'; slider.dispatchEvent(new Event('input'));
      q('#astra-light-picker #pause').click(); q('#astra-light-picker #speed').click();
      const sel = q('#astra-light-picker #astra-weather'); sel.value = 'snow'; sel.dispatchEvent(new Event('change'));
      q('#astra-light-picker [data-skin="winter"]').click();
      lc.update(15);
      return { absent, opened, log, hasHintText: /drag to pan|share view|your view|happenings/i.test(text),
        clock: q('#astra-clock').textContent, weatherOptions: [...sel.options].map(o => o.value),
        weatherInTopRightDropdown: !!q('#astra-light-picker #astra-weather'), outsideWeather: document.querySelectorAll('#astra-weather').length };
    });
    assert.deepEqual(result.absent, [], 'removed HUD pieces must not render');
    assert.equal(result.hasHintText, false);
    assert.equal(result.opened, true, 'clock dropdown opens');
    assert.equal(result.log.hour.length, 2, 'preset and slider both set the time');
    assert.equal(result.log.hour[1], 15);
    assert.equal(result.clock, '3:00 pm');
    assert.equal(result.log.pause, 1); assert.equal(result.log.speed, 1);
    assert(result.weatherInTopRightDropdown && result.outsideWeather === 1, 'weather lives only in the clock dropdown');
    assert(result.weatherOptions.includes('snow') && result.weatherOptions.includes('rain'));
    assert.deepEqual(result.log.weather, ['snow']);
    assert.deepEqual(result.log.skin, ['winter']);

    await page.setViewportSize({ width: 390, height: 844 });
    for (const file of ['navigation.css', 'style.css', 'light-controls.css']) {
      await page.addStyleTag({ content: read('src/astra/' + file).replace(/^@import.*\n/, '') });
    }
    const bar = await page.locator('.top-bar').boundingBox();
    assert(bar && bar.y + bar.height <= 56, 'the top bar fits within the first 56 px');
    for (const selector of ['.masthead', '.clock', '.world-nav summary']) {
      const box = await page.locator(selector).boundingBox();
      assert(box && box.y >= bar.y && box.y + box.height <= bar.y + bar.height, `${selector} stays in the top row`);
      assert(box.x >= bar.x && box.x + box.width <= bar.x + bar.width, `${selector} fits inside the bar`);
    }
    for (const selector of ['.light-toggle', '.world-nav summary', '.tools button']) {
      for (const control of await page.locator(selector).all()) {
        const box = await control.boundingBox();
        assert(box && box.width >= 40 && box.height >= 40, `${selector} has a 40 px touch target`);
      }
    }
    const pill = await page.locator('.tools').boundingBox();
    assert(pill && pill.height > pill.width, 'the map tools form a vertical pill');
    await page.locator('.world-nav summary').click();
    const explore = page.getByRole('button', { name: 'Willowbank', exact: true });
    await explore.click();
    assert.equal(await page.locator('.nav-current').textContent(), 'Willowbank');
    assert.equal(await explore.isVisible(), false);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const camera = await page.evaluate(async () => {
      const { OrthographicCamera } = await import('three');
      const { createMapCamera } = await import('/src/astra/camera.js');
      const { townOpening } = await import('/src/astra/overview.js');
      const { createUI } = await import('/src/astra/ui.js');
      const town = { districts: [{ id: 'market', center: [1, 3] }] };
      const home = townOpening(town, innerWidth, innerHeight);
      const canvas = document.body.appendChild(document.createElement('canvas'));
      const controls = createMapCamera(new OrthographicCamera(), canvas, {
        bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
        hashZoom: () => home.zoom,
      });
      const actions = [];
      const { root } = createUI(town, { view(id) { actions.push(id); if (id === 'home') controls.view(home); } });
      try {
        history.replaceState(null, '', '#x=25&y=30&zoom=2&r=0');
        const restored = controls.restore();
        const linked = controls.state();
        root.querySelector('#home').click();
        const reset = controls.state();
        const changed = new Promise(resolve => window.addEventListener('hashchange', resolve, { once: true }));
        location.hash = '#x=88.74&y=18';
        await changed;
        return { home, restored, linked, reset, actions, coordinatesOnly: controls.state() };
      } finally {
        controls.dispose();
        root.remove();
        canvas.remove();
      }
    });
    assert.deepEqual(camera.actions, ['home']);
    assert.equal(camera.restored, true);
    assert.deepEqual(camera.linked, { x: 25, z: 30, zoom: 2, rotation: 0 });
    assert.deepEqual(camera.reset, { ...camera.home, rotation: 0 });
    assert.deepEqual(camera.coordinatesOnly, { x: 88.74, z: 18, zoom: camera.home.zoom, rotation: 0 });

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const drag = await page.evaluate(async () => {
      const { OrthographicCamera } = await import('three');
      const { createMapCamera } = await import('/src/astra/camera.js');
      const canvas = document.body.appendChild(document.createElement('canvas'));
      // Synthetic pointer events do not have an active browser capture.
      canvas.setPointerCapture = () => {};
      const { left, top } = canvas.getBoundingClientRect();
      const x = left + 30, y = top + 30;
      const pointer = (type, dx = 0) => canvas.dispatchEvent(new PointerEvent(type, {
        pointerId: 1, pointerType: 'touch', clientX: x + dx, clientY: y,
      }));
      let publications = 0;
      const controls = createMapCamera(new OrthographicCamera(), canvas, {
        bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
        onChange() { publications++; },
      });
      try {
        controls.update(0);
        const ground = controls.groundAt(x, y);
        pointer('pointerdown');
        pointer('pointermove', 3);
        pointer('pointermove', 20);
        const groundError = ground.distanceTo(controls.groundAt(x + 20, y));
        const changesBeforeFrame = publications;
        const held = controls.state();
        const panning = controls.panning();
        controls.update(.05);
        const afterFrame = controls.state();
        pointer('pointerup', 20);
        const afterRelease = controls.state();
        controls.update(.05);
        return { groundError, changesBeforeFrame, publications, panning, held, afterFrame, afterRelease, coast: controls.state() };
      } finally {
        controls.dispose();
        canvas.remove();
      }
    });
    assert(drag.groundError < 1e-8, 'the map point stays under the moving finger immediately');
    assert.equal(drag.changesBeforeFrame, 1, 'pointer moves do not trigger view callbacks');
    assert.equal(drag.publications, 3, 'each changed frame publishes once');
    assert.equal(drag.panning, true);
    assert.deepEqual(drag.held, drag.afterFrame, 'the camera does not coast while the finger stays down');
    assert.deepEqual(drag.afterFrame, drag.afterRelease);
    assert.notDeepEqual(drag.afterRelease, drag.coast, 'inertia starts on the first frame after release');
  } finally { await browser.close(); }
});
