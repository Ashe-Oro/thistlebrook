import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const [stage, dist = 'dist', lane = 'all'] = process.argv.slice(2);
assert(['baseline', 'after'].includes(stage), 'Usage: node tools/shots-street-camera.mjs <baseline|after> [dist] [stills|perf|all]');
const scratch = '/workspace/scratch/street-camera';
const shots = resolve('shots/street-camera');
await mkdir(scratch, { recursive: true });
if (stage === 'after') await mkdir(shots, { recursive: true });

// Both builds use the same private, production-shaped assets and LOD routes.
const assetPack = resolve(process.env.STREET_CAMERA_ASSET_PACK ?? 'public/licensed/fast-load/publish');
const manifest = process.env.STREET_CAMERA_ASSET_MANIFEST;
const routes = JSON.parse(await readFile(resolve(assetPack, 'routes.json'), 'utf8'));
const three = resolve('node_modules/three/examples/jsm/libs');
const server = await preview({
  build: { outDir: resolve(dist) }, preview: { host: '127.0.0.1' },
  plugins: [{
    name: 'street-camera-private-probe-assets',
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url.split('?')[0];
        const model = path.match(/^\/models\/([a-f\d]{24}\.(?:glb|ktx2))$/);
        const decoder = path.match(/^\/(basis\/basis_transcoder|draco\/draco_(?:decoder|wasm_wrapper))\.(js|wasm)$/);
        const sizes = path === '/asset-sizes.json' && manifest;
        if (!model && !decoder && !sizes) return next();
        const file = sizes || (model ? resolve(assetPack, 'models', model[1]) : resolve(three, decoder[1] + '.' + decoder[2]));
        const type = { json: 'application/json', glb: 'model/gltf-binary', ktx2: 'image/ktx2', js: 'text/javascript', wasm: 'application/wasm' };
        res.setHeader('Content-Type', type[file.split('.').at(-1)]);
        try { await pipeline(createReadStream(file), res); }
        catch { if (!res.headersSent) res.writeHead(404).end(); }
      });
    },
  }],
});
const url = `http://127.0.0.1:${server.httpServer.address().port}/?seed=831&hour=10.4`;
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu-watchdog', '--enable-unsafe-swiftshader'];
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const desktop = { viewport: { width: 1440, height: 900 } };
const sunbeam = { x: -125.7, z: -50, lookYaw: -.02, lookPitch: -.08 };
const elsewhere = { x: -48, z: 7, lookYaw: -.025, lookPitch: -.06 };
const timeout = 180_000;

async function ready(page, query = '') {
  await page.goto(url + query, { waitUntil: 'domcontentloaded', timeout });
  await page.waitForFunction(() => window.__ready || window.__astraError, null, { polling: 100, timeout });
  assert.equal(await page.evaluate(() => window.__astraError), undefined);
}

async function settle(page) {
  await page.evaluate(async () => {
    __astra.setPaused(true);
    await __astra.streamed;
    await __astra.viewReady();
  });
}

async function screenshot(page, name) {
  await page.evaluate(() => {
    document.querySelector('.loading')?.remove();
    __astra.setHour(10.4);
    __astra.step(0);
  });
  const info = await page.evaluate(() => {
    const { camera, controls, skin } = __astra;
    const { width, height } = __astra.renderer.domElement.getBoundingClientRect();
    return {
      state: controls.state(), position: camera.position.toArray(), forward: camera.getWorldDirection(camera.position.clone()).toArray(),
      horizonInFrame: !controls.groundAt(width / 2, height * .1) && !!controls.groundAt(width / 2, height * .9),
      post: skin.state.post,
    };
  });
  assert(info.post);
  if (name.startsWith('street-')) assert(info.horizonInFrame, 'Expected the view to include the horizon');
  const dir = stage === 'baseline' || name.startsWith('sunbeam-map') ? scratch : shots;
  await page.screenshot({ path: resolve(dir, `${dir === scratch ? stage + '-' : ''}${name}.png`), timeout });
  console.log(stage, name, info.state);
  return info;
}

async function freezeFrames(context) {
  await context.addInitScript(routes => {
    window.__assetAliases = routes.aliases;
    window.__modelLods = routes.variants;
    window.__basisTextures = routes.basis;
    window.__districtStreaming = true;
    const raf = window.requestAnimationFrame.bind(window);
    const held = [];
    window.cameraProbe = {
      frozen: false, recording: false, frames: [],
      resume() {
        this.frozen = false;
        held.splice(0).forEach(callback => window.requestAnimationFrame(callback));
      },
    };
    let ready;
    Object.defineProperty(window, '__ready', {
      get: () => ready,
      set(value) { ready = value; if (value) window.cameraProbe.frozen = true; },
    });
    window.requestAnimationFrame = callback => raf(timestamp => {
      const p = window.cameraProbe, a = window.__astra;
      if (p.frozen) { held.push(callback); return; }
      const frame = a?.renderer.info.render.frame;
      callback(timestamp);
      if (p.recording && a && a.renderer.info.render.frame !== frame) {
        p.frames.push({ timestamp, calls: a.renderer.info.render.calls, triangles: a.renderer.info.render.triangles });
      }
    });
  }, routes);
}

const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
async function measure(page, cdp, pan) {
  await page.evaluate(() => {
    cameraProbe.frames = [];
    cameraProbe.recording = true;
    cameraProbe.resume();
  });
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
  });
  if (pan) {
    await touch('touchStart', 195, 430);
    const start = performance.now();
    const moves = [];
    for (let ms = 0; ms < 3000; ms += 1000 / 30) {
      await new Promise(done => setTimeout(done, Math.max(0, start + ms - performance.now())));
      const t = ms / 3000;
      moves.push(touch('touchMove', 195 + 95 * Math.sin(t * Math.PI * 2), 430 + 60 * Math.sin(t * Math.PI)));
    }
    await Promise.all(moves);
    await touch('touchEnd');
  }
  const frames = await page.evaluate(async pan => {
    if (!pan) {
      const start = performance.now();
      while (performance.now() - start < 5000 ||
          (cameraProbe.frames.length < 6 && performance.now() - start < 35000)) {
        await new Promise(done => setTimeout(done, 250));
      }
    }
    cameraProbe.frozen = true;
    cameraProbe.recording = false;
    return cameraProbe.frames;
  }, pan);
  assert(frames.length >= 2, 'Expected at least two rendered frames');
  const intervals = frames.slice(1).map((frame, i) => frame.timestamp - frames[i].timestamp);
  return {
    fps: 1000 * intervals.length / (frames.at(-1).timestamp - frames[0].timestamp),
    p95Ms: percentile(intervals, .95), drawCalls: percentile(frames.map(f => f.calls), .5), frames,
  };
}

async function checkGestures(page, context, profile) {
  const state = () => page.evaluate(() => __astra.controls.state());
  const advance = () => page.evaluate(() => { for (let i = 0; i < 90; i++) __astra.controls.update(1 / 60); });
  await page.evaluate(view => __astra.view({ ...view, zoom: 15 }), sunbeam);
  assert(await page.locator('#zoom-in').isEnabled());
  const cdp = await context.newCDPSession(page);
  const touch = (type, points = []) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: points.map(([x, y], id) => ({ x, y, id })),
  });
  const twoFingers = async (from, to) => {
    await touch('touchStart', from);
    await touch('touchMove', to);
    await touch('touchEnd');
  };
  if (profile === 'phone') {
    await twoFingers([[145, 385], [245, 385]], [[120, 385], [270, 385]]);
  } else {
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, -155);
  }
  await advance();
  assert((await state()).tilt > 0);

  await page.evaluate(view => __astra.view({ ...view, zoom: 45 }), sunbeam);
  assert(await page.locator('#zoom-in').isDisabled());
  const start = await state();
  if (profile === 'phone') {
    await twoFingers([[135, 380], [255, 380]], [[157, 398], [277, 398]]);
  } else {
    await page.mouse.move(700, 425);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(739, 449);
    await page.mouse.up({ button: 'right' });
  }
  await advance();
  const looked = await state();
  assert.equal(looked.zoom, start.zoom);
  assert.equal(looked.x, start.x);
  assert.equal(looked.z, start.z);
  assert.notEqual(looked.lookYaw, start.lookYaw);
  assert.notEqual(looked.lookPitch, start.lookPitch);

  if (profile === 'phone') {
    await touch('touchStart', [[195, 415]]);
    await touch('touchMove', [[195, 445]]);
    await touch('touchEnd');
    await twoFingers([[135, 380], [255, 380]], [[149, 380], [241, 380]]);
  } else {
    await page.mouse.move(700, 425);
    await page.mouse.down();
    await page.mouse.move(701, 458);
    await page.mouse.up();
    await page.mouse.wheel(0, 160);
  }
  await advance();
  const moved = await state();
  assert.notEqual(moved.z, looked.z);
  assert.equal(moved.lookYaw, looked.lookYaw);
  assert(moved.tilt > 0 && moved.tilt < 1);
  await page.evaluate(() => __astra.controls.zoom(.2));
  await advance();
  assert.equal((await state()).tilt, undefined);
  console.log(profile, 'native walk, look, zoom and zoom-button limits passed');
}

let browser;
try {
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args });
  if (lane !== 'perf') {
    const evidence = {};
    for (const [profile, options] of Object.entries({phone, desktop})) {
      const context = await browser.newContext(options);
      await freezeFrames(context);
      try {
        const page = await context.newPage();
        await ready(page, '&capture=1&skin=autumn');
        await settle(page);
        evidence[`overhead-${profile}`] = await screenshot(page, `overhead-${profile}`);
        if (stage === 'after') {
          for (const [name, view] of Object.entries({
            'mid-tilt': { ...sunbeam, zoom: Math.sqrt(15 * 45), elevation: 58 },
            'street-sunbeam': { ...sunbeam, zoom: 45, elevation: 58 },
            'street-elsewhere': { ...elsewhere, zoom: 45 },
          })) {
            await page.evaluate(async view => { __astra.view(view); await __astra.viewReady(); }, view);
            evidence[`${name}-${profile}`] = await screenshot(page, `${name}-${profile}`);
          }
        }
        await ready(page, '&capture=1&skin=autumn&view=sunbeam');
        await settle(page);
        evidence[`sunbeam-map-${profile}`] = await screenshot(page, `sunbeam-map-${profile}`);
        if (stage === 'after') await checkGestures(page, context, profile);
      } finally { await context.close(); }
    }
    await writeFile(resolve(stage === 'after' ? shots : scratch, `${stage === 'after' ? 'evidence' : stage + '-stills'}.json`),
      JSON.stringify({
        seed: 831, hour: 10.4, skin: 'autumn',
        profiles: { phone: { ...phone.viewport, dpr: phone.deviceScaleFactor }, desktop: { ...desktop.viewport, dpr: 1 } },
        views: evidence,
      }, null, 2) + '\n');
  }
  if (lane !== 'stills') {
    const context = await browser.newContext(phone);
    await freezeFrames(context);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const errors = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failed.push(new URL(response.url()).pathname); });
    await ready(page);
    const result = await page.evaluate(() => ({
      readyMs: window.__readyAt, readyDrawCalls: __astra.renderer.info.render.calls, opening: __astra.controls.state(),
      progress: window.__loadProgress.samples,
    }));
    assert.equal(result.progress.at(-1).progress, 1, 'Loading bar must reach 100%');
    assert(result.progress.every((point, index, samples) => !index || point.progress >= samples[index - 1].progress));
    console.log(stage, 'phone6 ready', result.readyMs, result.readyDrawCalls);
    await settle(page);
    await page.evaluate(() => { __astra.step(0); __astra.setPaused(false); });
    result.overhead = await measure(page, cdp, false);
    result.pan = await measure(page, cdp, true);
    if (stage === 'after') {
      await page.evaluate(async view => { __astra.view(view); await __astra.viewReady(); __astra.step(0); },
        { ...sunbeam, z: -53, zoom: 45 });
      result.street = await measure(page, cdp, false);
    }
    await writeFile(resolve(scratch, `${stage}-phone6.json`),
      JSON.stringify({ browser: browser.version(), viewport: phone.viewport, dpr: phone.deviceScaleFactor, cpuThrottle: 6,
        ...result, errors, failed }, null, 2) + '\n');
    for (const key of ['overhead', 'pan', 'street']) {
      const row = result[key];
      if (row) console.log(stage, key, row.p95Ms, row.fps, row.drawCalls, row.frames.length);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise(done => server.httpServer.close(done));
}
