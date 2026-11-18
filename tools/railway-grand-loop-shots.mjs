// Usage: node tools/railway-grand-loop-shots.mjs http://127.0.0.1:5279 [--stills-only | --film-only] [--views=wide,station,crossing,night,consist]
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright-core';

const [base, ...options] = process.argv.slice(2);
if (!base) throw Error('Pass the local Vite URL.');
const dir = new URL('../shots/railway-grand-loop/', import.meta.url).pathname;
mkdirSync(dir, {recursive: true});
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
  const errors = [], assetFailures = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/licensed/railway/')) assetFailures.push(new URL(r.url()).pathname); });
  await page.route('**/favicon.ico', (route) => route.fulfill({status: 204}));
  await page.routeWebSocket(new RegExp(new URL(base).host), (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      if (!String(message).includes('"type":"full-reload"') && !String(message).includes('"type":"update"')) socket.send(message);
    });
  });
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(base + '/?capture=1&seed=831&weather=clear', {timeout: 300000});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 300000, polling: 300});
  const audit = await page.evaluate(async () => {
    if (window.__astraError) throw Error(window.__astraError);
    const app = window.__astra, rw = app.world.railway, svc = rw.service;
    document.querySelector('[data-view="railway"]').click();
    if (document.querySelector('.nav-current').textContent !== 'Thistlebrook Grand Loop') throw Error('The railway view did not open');
    if (app.skin.skin.id !== 'cel' || app.setSkin('neon') !== 'neon' || app.setSkin('cel') !== 'cel') throw Error('The skin controls did not switch back to cel');
    document.querySelectorAll('.loading,.ui,#hud').forEach((e) => { e.style.display = 'none'; });
    const {overview} = await import('/src/astra/overview.js');
    const {railProject} = await import('/src/compiler/railway.js');
    const wide = () => {
      const rotation = 1;
      const fit = overview(app.town, innerWidth, innerHeight + 240, Math.PI / 4 + rotation * Math.PI / 2);
      return {...fit, zoom: fit.zoom * 1.10, rotation};
    };
    const deps = svc.timetable.departures;
    const first = svc.timetable.first;
    const last = svc.timetable.end;
    function nearestTime(target, min, max, require = () => true) {
      const s = railProject(svc.rail, target).s, length = svc.rail.length;
      let best = {time: min, d: Infinity};
      for (let time = min; time <= max; time += .5) {
        svc.update(time / 90);
        if (!require(svc.train)) continue;
        const d = Math.abs((svc.train.s - s + length * 1.5) % length - length / 2);
        if (d < best.d) best = {time, d};
      }
      return best.time;
    }
    const crossing = svc.rail.crossings.find((c) => c.pos[1] > -120);
    const stationChoices = svc.travellers.filter((tr) => ['pinecrest', 'fair', 'coast', 'union', 'high'].includes(tr.from));
    const topics = stationChoices.map((tr) => {
      const time = tr.depart - 8;
      svc.update(time / 90);
      const waiting = svc.travellers.filter((p) => svc.travellerPose(p)?.phase === 'waiting' && p.from === tr.from).length;
      const preference = {pinecrest: 3, fair: 2, coast: 1, union: 0, high: 0}[tr.from];
      return {tr, time, waiting, preference};
    }).sort((a, b) => b.waiting - a.waiting || b.preference - a.preference);
    const choice = topics[0];
    const station = svc.rail.stations.find((s) => s.id === choice.tr.from);
    const nightStop = svc.rail.stations.find((st) => st.id === 'roadster');
    const nightTime = deps.filter((d) => d.station === nightStop.id).at(-1).at - 8;
    const wideTime = nearestTime([-234, 91], first, first + svc.timetable.lap, (tr) => tr.phase === 'run');
    const approach = crossing.pos.map((x, i) => x - crossing.railDir[i] * 24);
    const crossingTime = nearestTime(approach, first, last, (tr) => tr.phase === 'run');
    const viewAt = (p, zoom, rotation = 0) => ({x: p[0], z: p[1], zoom, rotation});
    window.railwayCapture = {
      views: {
        wide: [wideTime, wide()],
        station: [choice.time, viewAt(station.centre, 2.8, station.id === 'pinecrest' ? 1 : 0)],
        crossing: [crossingTime, viewAt(crossing.pos, 3.8, 2)],
        night: [nightTime, viewAt(nightStop.centre, 2.7, 1)],
        consist: [nearestTime([303, 145], first, first + svc.timetable.lap, (tr) => tr.phase === 'run'), viewAt([303, 145], 2.2)],
      },
      draw(time, view, shadow = true) {
        app.renderer.shadowMap.enabled = shadow;
        app.setHour(time / 90);
        app.controls.view(view, true);
        app.step(0);
        return app.renderer.info.render.calls;
      },
      capture(name) {
        const args = this.views[name], shadow = name !== 'wide';
        const withRail = this.draw(...args, shadow);
        const data = this.frame();
        rw.root.visible = false;
        const withoutRail = this.draw(...args, shadow);
        rw.root.visible = true;
        return {data, withRail, withoutRail, delta: withRail - withoutRail};
      },
      frame(type = 'image/png') {
        return app.renderer.domElement.toDataURL(type, .89).split(',')[1];
      },
      setupFilm() {
        // The map is stationary in the lap view. Render the town once and
        // composite the real animated train at the same camera and lighting.
        const makeCanvas = () => Object.assign(document.createElement('canvas'), {
          width: app.renderer.domElement.width, height: app.renderer.domElement.height,
        });
        rw.moving.visible = false;
        this.draw(first + 45, wide(), false);
        const background = makeCanvas();
        background.getContext('2d').drawImage(app.renderer.domElement, 0, 0);
        rw.moving.visible = true;
        for (const object of app.scene.children) {
          if (object !== rw.root && !object.isLight) object.visible = false;
        }
        for (const object of rw.root.children) if (object !== rw.moving) object.visible = false;
        app.scene.background = null;
        const renderer = new app.renderer.constructor({alpha: true, antialias: true, preserveDrawingBuffer: true});
        renderer.setSize(background.width, background.height);
        renderer.setClearColor(0, 0);
        renderer.outputColorSpace = app.renderer.outputColorSpace;
        this.filmLayer = {renderer, background, canvas: makeCanvas()};
      },
      film(fraction) {
        const hour = (first + fraction * svc.timetable.lap) / 90;
        svc.update(hour);
        rw.update(fraction * 36, hour, 0);
        const {renderer, background, canvas} = this.filmLayer;
        renderer.render(app.scene, app.camera);
        const context = canvas.getContext('2d');
        context.drawImage(background, 0, 0);
        context.drawImage(renderer.domElement, 0, 0);
        return canvas.toDataURL('image/jpeg', .89).split(',')[1];
      },
    };
    return {station: station.id, waiting: choice.waiting, stock: svc.cars.length, nightHour: nightTime / 90, registryErrors: app.audit().renderRegistryErrors};
  });
  console.log('Browser check', JSON.stringify(audit));
  const views = options.find((o) => o.startsWith('--views='))?.slice(8).split(',') ?? ['wide', 'station', 'crossing', 'night', 'consist'];
  if (!options.includes('--film-only')) for (const name of views) {
    const {data, ...calls} = await page.evaluate((key) => railwayCapture.capture(key), name);
    writeFileSync(join(dir, 'after-' + name + '.png'), Buffer.from(data, 'base64'));
    console.log(name, JSON.stringify(calls));
  }
  if (!options.includes('--stills-only')) {
    const frames = mkdtempSync(join(tmpdir(), 'thistlebrook-lap-'));
    try {
      await page.setViewportSize({width: 1120, height: 700});
      await page.evaluate(() => railwayCapture.setupFilm());
      const count = 144;
      for (let i = 0; i < count; i++) {
        const data = await page.evaluate((f) => railwayCapture.film(f), i / (count - 1));
        writeFileSync(join(frames, String(i).padStart(3, '0') + '.jpg'), Buffer.from(data, 'base64'));
        if (i % 24 === 0) console.log('Lap frames', i, '/', count);
      }
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-threads', '2', '-framerate', '12', '-i', join(frames, '%03d.jpg'), '-c:v', 'libx264', '-threads', '2', '-vf', 'format=yuv420p', '-crf', '20', '-movflags', '+faststart', join(dir, 'around-the-map.mp4')]);
    } finally {
      rmSync(frames, {recursive: true, force: true});
    }
  }
  if (errors.length || assetFailures.length) throw Error([...errors, ...assetFailures].join('\n'));
} finally {
  await browser.close();
}
