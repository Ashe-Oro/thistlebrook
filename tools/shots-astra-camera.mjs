import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { STREET_ZOOM_MAX, ZOOM_LIMITS } from '../src/astra/camera.js';

const dir = new URL('../shots/astra-camera/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const checks = [], errors = [];
const check = message => { checks.push(message); console.log('✓ ' + message); };
const url = 'http://localhost:5186/?seed=831&capture=1';
const near = (actual, expected, tolerance = .001) => assert(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.stack));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  await page.route('**/favicon.ico', r => r.fulfill({ status: 204 }));
  // Advance real application frames explicitly for reproducible input assertions.
  await page.addInitScript(() => window.requestAnimationFrame = () => 0);
  async function ready() {
    await page.waitForFunction(() => window.__ready || window.__astraError, null, { timeout: 120000, polling: 100 });
    assert.equal(await page.evaluate(() => window.__astraError), undefined);
    await page.evaluate(() => { document.querySelector('.loading')?.remove(); __astra.setPaused(true); __astra.step(0); });
  }
  const settle = () => page.evaluate(() => { for (let i = 0; i < 120; i++) __astra.step(1 / 60, false); __astra.step(0); });
  const state = () => page.evaluate(() => __astra.controls.state());
  const shot = name => page.screenshot({ path: dir + name, timeout: 60000 });
  await page.goto(url); await ready();
  const initial = await state();
  assert.equal(await page.evaluate(() => __astra.camera.isOrthographicCamera), true);
  await shot('02-map-controls.png');

  const cursor = { x: 830, y: 480 };
  const anchor = await page.evaluate(p => __astra.controls.groundAt(p.x, p.y).toArray(), cursor);
  await page.mouse.move(cursor.x, cursor.y); await page.mouse.wheel(0, -160); await page.waitForTimeout(80);
  near((await state()).zoom, initial.zoom, 1e-8);
  const samples = await page.evaluate(() => {
    const values = [];
    for (let i = 0; i < 80; i++) { __astra.step(1 / 60, false); values.push(__astra.camera.zoom); }
    __astra.step(0); return values;
  });
  assert(samples[0] > initial.zoom && samples[0] < samples.at(-1));
  assert(samples.every((z, i) => !i || z >= samples[i - 1]));
  const anchorAfter = await page.evaluate(p => __astra.controls.groundAt(p.x, p.y).toArray(), cursor);
  anchor.forEach((v, i) => near(v, anchorAfter[i], 1e-7));
  check('wheel zoom eases monotonically across real frames and preserves cursor ground anchor');

  await page.evaluate(() => __astra.view('downtown'));
  const panAnchor = await page.evaluate(() => __astra.controls.groundAt(780, 540).toArray());
  await page.mouse.move(780, 540); await page.mouse.down(); await page.mouse.move(860, 580, { steps: 8 }); await page.mouse.up();
  const panEnd = await page.evaluate(() => __astra.controls.groundAt(860, 580).toArray());
  panAnchor.forEach((v, i) => near(v, panEnd[i], 1e-7));
  assert.equal(await page.locator('.card').isVisible(), false);
  const dragState = await state();
  await page.mouse.down({ button: 'right' }); await page.mouse.move(810, 550, { steps: 6 }); await page.mouse.up({ button: 'right' });
  assert.notDeepEqual(await state(), dragState);
  check('left and right drag track the ground with no accidental inspection');

  await page.evaluate(() => __astra.view('downtown'));
  const building = await page.evaluate(() => {
    const b = __astra.world.selectables.find(b => b.data.name === 'Corner Cup Café');
    const point = b.bounds.getCenter(__astra.controls.target.clone()).project(__astra.camera);
    const x = (point.x + 1) * innerWidth / 2, y = (1 - point.y) * innerHeight / 2;
    return { x, y, name: b.data.name, picked: __astra.pick(x, y)?.name };
  });
  assert.equal(building.picked, building.name);
  await page.mouse.move(building.x, building.y); assert.equal(await page.locator('.tooltip').textContent(), building.name);
  // An out-and-back drag is still a drag, even when its endpoints coincide.
  await page.mouse.down(); await page.mouse.move(building.x + 35, building.y + 20, { steps: 5 }); await page.mouse.move(building.x, building.y, { steps: 5 }); await page.mouse.up();
  assert.equal(await page.locator('.card').isVisible(), false);
  await page.mouse.click(building.x, building.y, { button: 'right' });
  assert.equal(await page.locator('.card').isVisible(), false);
  await page.mouse.click(building.x, building.y);
  assert.equal(await page.locator('.card h2').textContent(), building.name);
  assert((await page.locator('.card p').textContent()).includes('fountain'));
  await page.evaluate(() => __astra.step(0)); await shot('05-building-story.png');
  await page.getByRole('button', { name: 'Close details' }).click();
  check('building hover, primary click, story, selection marker; right click and out-and-back drag do not select');

  await page.locator('#app canvas').focus();
  const beforeRotation = await state();
  await page.keyboard.press('e'); assert.equal((await state()).rotation, 1);
  near((await state()).x, beforeRotation.x); near((await state()).z, beforeRotation.z);
  await page.evaluate(() => __astra.step(0)); await shot('06-quarter-turn.png');
  await page.keyboard.press('e'); await page.keyboard.press('e'); await page.keyboard.press('e');
  assert.deepEqual(await state(), beforeRotation);
  const elevation = await page.evaluate(() => { const offset = __astra.camera.position.clone().sub(__astra.controls.target); return Math.atan2(offset.y, Math.hypot(offset.x, offset.z)); });
  near(elevation, Math.atan(1 / Math.sqrt(2)), 1e-9);
  await page.keyboard.press('ArrowRight'); assert.notDeepEqual(await state(), beforeRotation);
  check('four 90° turns return exactly; fixed isometric elevation; keyboard map pan');

  await page.evaluate(() => __astra.view('village'));
  const touchBefore = await state();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 600, y: 500 }, { x: 800, y: 500 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 560, y: 500 }, { x: 840, y: 500 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(); assert((await state()).zoom > touchBefore.zoom);
  assert.equal(await page.locator('.card').isVisible(), false);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 700, y: 500 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 760, y: 550 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal(await page.locator('.card').isVisible(), false);
  check('native touch pinch, touch pan and cancellation never trigger a tap');

  const npc = await page.evaluate(() => {
    for (const person of __astra.residents.people) {
      __astra.view({ x: person.object.position.x, z: person.object.position.z, zoom: 4 }); __astra.step(0);
      const p = person.object.position.clone(); p.y += .9; p.project(__astra.camera);
      const x = (p.x + 1) * innerWidth / 2, y = (1 - p.y) * innerHeight / 2;
      if (__astra.pick(x, y)?.person === person) return { x, y, name: person.name };
    }
  });
  assert(npc); await page.mouse.click(npc.x, npc.y);
  assert.equal(await page.locator('.card h2').textContent(), npc.name);
  await page.getByRole('button', { name: 'Follow their day' }).click();
  await page.evaluate(() => { __astra.setPaused(false); for (let i = 0; i < 180; i++) __astra.step(.1, false); __astra.setPaused(true); __astra.step(0); });
  assert.equal(await page.evaluate(() => __astra.following), npc.name);
  const activity = await page.evaluate(name => __astra.residents.people.find(p => p.name === name).activity, npc.name);
  assert.equal(await page.locator('.resident-activity span:last-child').textContent(), activity);
  await shot('03-resident.png');
  await page.getByRole('button', { name: 'Stop following · explore freely' }).click();
  assert.equal(await page.evaluate(() => __astra.following), undefined);
  await settle();
  await page.getByRole('button', { name: 'Follow their day' }).click(); await settle();
  await page.mouse.move(800, 500); await page.mouse.wheel(0, 50); await page.waitForTimeout(80); await settle();
  assert.equal(await page.evaluate(() => __astra.following), undefined);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.card').isVisible(), false);
  check('resident pointer picking, live activity, follow, stop follow, manual override and Escape');

  await page.getByRole('button', { name: 'Thistlebrook High', exact: true }).click(); await settle();
  near((await state()).x, 8); near((await state()).z, -70); near((await state()).zoom, 1.8);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click(); await settle();
  near((await state()).zoom, 1.8 * 1.3);
  const historyBefore = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'Rotate village', exact: true }).click();
  await page.getByRole('button', { name: 'Copy link to this view', exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(copied, page.url());
  assert(copied.includes('#x=8&y=-70&zoom=2.34&r=1'));
  assert.equal(await page.evaluate(() => history.length), historyBefore);
  const saved = await state(); saved.zoom = Number(saved.zoom.toFixed(4)); await page.reload(); await ready();
  assert.deepEqual(await state(), saved);
  await page.evaluate(() => location.hash = '#x=12&y=-23&zoom=2.5&r=2&selection=kept');
  await page.waitForFunction(() => __astra.controls.state().rotation === 2, null, { polling: 100 });
  assert.deepEqual(await state(), { x: 12, z: -23, zoom: 2.5, rotation: 2 });
  await page.evaluate(() => __astra.controls.flushHash()); assert(page.url().includes('selection=kept'));
  await page.goBack();
  await page.waitForFunction(() => __astra.controls.state().rotation === 1, null, { polling: 100 });
  assert.deepEqual(await state(), saved);
  check('district and zoom buttons, copy URL, reload within hash precision, hash navigation and Back without history spam');

  await page.evaluate(zoom => __astra.controls.view({ x: 0, z: 0, zoom }, true), ZOOM_LIMITS.max);
  assert(await page.getByRole('button', { name: 'Zoom in', exact: true }).isEnabled());
  await page.evaluate(() => __astra.controls.zoom(100)); await settle();
  near((await state()).zoom, STREET_ZOOM_MAX); assert(await page.getByRole('button', { name: 'Zoom in', exact: true }).isDisabled());
  await page.evaluate(() => __astra.controls.zoom(.0001)); await settle();
  near((await state()).zoom, ZOOM_LIMITS.min); assert(await page.getByRole('button', { name: 'Zoom out', exact: true }).isDisabled());
  await page.evaluate(() => location.hash = '#x=NaN&y=0&zoom=2'); await page.waitForTimeout(80);
  assert(Number.isFinite((await state()).x));
  await page.reload(); await ready(); assert.equal((await state()).x, -57);
  check('bounded zoom, disabled limit controls, invalid URL falls back safely');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedBefore = (await state()).zoom;
  await page.mouse.move(800, 500); await page.mouse.wheel(0, 80); await page.waitForTimeout(80);
  assert((await state()).zoom < reducedBefore); const reducedAfter = await state(); await settle(); assert.deepEqual(await state(), reducedAfter);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  check('reduced-motion preference applies zoom without animation');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { __astra.view('neighbourhood'); __astra.step(0); });
  await page.getByRole('button', { name: 'Meet a neighbour', exact: true }).click();
  await page.getByRole('button', { name: 'Follow their day' }).click(); await settle();
  await shot('04-mobile.png');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false);
  for (const selector of ['.card', '.tools', '.camera-status', '.control-bar']) {
    const box = await page.locator(selector).boundingBox(); assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= 391 && box.y + box.height <= 845, selector);
  }
  await page.getByRole('button', { name: 'Close details' }).click();
  await page.getByRole('button', { name: 'Show controls' }).click();
  assert.equal(await page.getByRole('button', { name: 'Show controls' }).getAttribute('aria-expanded'), 'true');
  await shot('07-mobile-help.png');
  check('mobile layout fits viewport; controls and inspection remain reachable');

  assert.deepEqual(errors, []);
  writeFileSync(dir + 'evidence.json', JSON.stringify({ url, initial, zoomSamples: samples, cursorAnchorError: Math.hypot(...anchor.map((v, i) => v - anchorAfter[i])), checks, errors }, null, 2));
  console.log(`Passed ${checks.length} camera and interaction checks. Evidence: shots/astra-camera/`);
} finally { await browser.close(); }
