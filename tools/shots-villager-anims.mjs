import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { stage } from './villager-shot-staging.mjs';

const phase = process.argv[2] || 'after';
const origin = process.env.VILLAGER_ORIGIN || 'http://localhost:5241';
const folder = new URL('../shots/villager-anims/', import.meta.url);
await mkdir(folder, { recursive: true });
const views = {
  pier: { x: 164.1, z: 68.9, zoom: 18, rotation: 3, hour: 7.2 },
  bench: { x: -53.35, z: -8.7, zoom: 18, rotation: 3, hour: 12.4 },
  counter: { x: -68.9, z: -7.05, zoom: 17, rotation: 0, hour: 11.2 },
  path: { x: -26, z: -37.6, zoom: 15, rotation: 0, hour: 14 },
};
const film = phase === 'after' && process.argv.includes('--film');
const frames = new URL('../../out/villager-film/', folder);
if (film) await mkdir(frames, { recursive: true });
const selectedViews = process.argv.find(arg => arg.startsWith('--views='))?.slice(8).split(',');
const probe = new URL(`${phase}-probe.json`, folder);
const evidence = selectedViews
  ? JSON.parse(await readFile(probe, 'utf8'))
  : { phase, seed: 831, views: {}, errors: [] };
evidence.errors = [];
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.routeWebSocket('**', ws => ws.close());
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  page.on('console', message => { if (message.type() === 'error' && message.text().includes('THREE.WebGLProgram')) evidence.errors.push(message.text()); });
  page.on('pageerror', error => evidence.errors.push(error.message));
  await page.goto(`${origin}/?capture=1&seed=831`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready || window.__astraError, null, { timeout: 240000, polling: 250 });
  const error = await page.evaluate(() => window.__astraError);
  if (error) throw new Error(error);
  await page.evaluate(stageSource => {
    window.stageVillagers = (0, eval)(`(${stageSource})`);
    window.__astra.renderer.shadowMap.autoUpdate = false;
    window.__astra.renderer.shadowMap.needsUpdate = true;
  }, stage.toString());
  for (const [name, view] of Object.entries(views)) {
    if (selectedViews && !selectedViews.includes(name)) continue;
    const result = await page.evaluate(({ name, view, phase, timedFrames }) => {
      const a = window.__astra;
      a.setHour(view.hour);
      a.view(view);
      const sample = window.stageVillagers(name, a, phase);
      a.setPaused(false);
      for (let i = 0; i < 4; i++) a.step(.1, false);
      a.setPaused(true);
      a.camera.zoom = view.zoom;
      a.camera.updateProjectionMatrix();
      a.renderer.shadowMap.needsUpdate = true;
      a.step(0);
      const gl = a.renderer.getContext();
      const pixel = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      const frameMs = [];
      for (let i = 0; i < timedFrames; i++) {
        const start = performance.now();
        a.step(0);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        frameMs.push(performance.now() - start);
      }
      const cast = [...a.residents.people, ...(a.world.expansions.harbor?.life.people || [])].flatMap(p => {
        if (!p.object.visible) return [];
        const point = p.object.getWorldPosition(p.object.position.clone());
        point.y += .9;
        point.project(a.camera);
        if (Math.abs(point.x) >= 1 || Math.abs(point.y) >= 1 || Math.abs(point.z) >= 1) return [];
        return [{ name: p.name, model: p.object.name, clip: p.object.userData.animationClip || null, ...(p.mixer ? p.mixer.sample() : {}) }];
      });
      const transfers = performance.getEntriesByType('resource').filter(r => r.name.includes('/characters/') && r.name.endsWith('.glb'));
      const image = a.renderer.domElement.toDataURL('image/png').split(',')[1];
      return { image, cast, sample, frameMs, drawCalls: a.renderer.info.render.calls,
        characterBytes: transfers.reduce((sum, r) => sum + r.encodedBodySize, 0), characterDownloads: transfers.length,
        rigBytes: transfers.filter(r => r.name.includes('/rigged/')).reduce((sum, r) => sum + r.encodedBodySize, 0) };
    }, { name, view, phase, timedFrames: process.argv.includes('--benchmark') ? 5 : 2 });
    const { image, ...metrics } = result;
    await writeFile(new URL(`${phase}-${name}.png`, folder), Buffer.from(image, 'base64'));
    evidence.views[name] = metrics;
    console.log(name, metrics.frameMs, metrics.drawCalls, metrics.cast.map(p => [p.name, p.clip]));
    if (film && ['bench', 'pier'].includes(name)) {
      const first = name === 'bench' ? 0 : 12;
      for (let i = 0; i < 12; i++) {
        const jpg = await page.evaluate(({ view, index }) => {
          const a = window.__astra;
          a.renderer.setSize(640, 426, false);
          a.setPaused(false);
          a.view({ ...view, x: view.x + index * .04 });
          for (let tick = 0; tick < 3; tick++) a.step(.1, false);
          a.setPaused(true);
          a.camera.zoom = view.zoom - index * .055;
          a.camera.updateProjectionMatrix();
          a.step(0);
          const image = a.renderer.domElement.toDataURL('image/jpeg', .88).split(',')[1];
          a.renderer.setSize(1200, 800, false);
          return image;
        }, { view, index: i });
        await writeFile(new URL(String(first + i).padStart(3, '0') + '.jpg', frames), Buffer.from(jpg, 'base64'));
      }
    }
  }
  if (film && !selectedViews) {
    await page.evaluate(async () => {
      const a = window.__astra;
      const { scriptedPlanner } = await import('/src/astra/life/planner.js');
      a.residents.life.setBrain(scriptedPlanner);
      a.setPaused(false);
    });
    evidence.hourSweep = await page.evaluate(() => {
      const a = window.__astra;
      let tPoses = 0, rigSamples = 0, maxSeatError = 0;
      const clips = new Set(), previous = new Map();
      let maxPlantedSlip = 0, maxSoleError = 0;
      for (let i = 0; i < 600; i++) {
        a.setHour(12 + i / 599);
        a.step(.1, false);
        for (const p of [...a.residents.people, ...a.world.expansions.people]) {
          if (!p.mixer || !p.object.visible) continue;
          const pose = p.mixer.sample();
          rigSamples++;
          if (pose.tPose) tPoses++;
          clips.add(pose.clip);
          if (['Walk', 'Hike'].includes(pose.clip)) {
            const yaw = p.object.rotation.y;
            const last = previous.get(p);
            pose.feet.forEach((foot, index) => {
              if (!foot.planted) return;
              maxSoleError = Math.max(maxSoleError, Math.abs(foot.position[1] - foot.targetY));
              const prior = last?.feet[index];
              if (last?.yaw === yaw && prior?.planted) {
                maxPlantedSlip = Math.max(maxPlantedSlip, Math.hypot(foot.position[0] - prior.position[0], foot.position[2] - prior.position[2]));
              }
            });
            previous.set(p, { yaw, feet: pose.feet });
          } else previous.delete(p);
          if (p.animation?.plan.seatHeight !== undefined && pose.seatBlend === 1) {
            maxSeatError = Math.max(maxSeatError, Math.abs(pose.hipsY - pose.hipsAboveSeat - p.animation.plan.seatHeight));
          }
        }
      }
      return { seconds: 60, fromHour: 12, toHour: 13, rigSamples, tPoses, maxSeatError, maxPlantedSlip, maxSoleError, clips: [...clips] };
    });
    console.log('hour sweep', evidence.hourSweep);
  }
  if (film) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '3', '-i',
      new URL('%03d.jpg', frames).pathname, '-vf', 'fps=24', '-pix_fmt', 'yuv420p',
      new URL('bench-to-pier.mp4', folder).pathname]);
  }
  assert.deepEqual(evidence.errors, []);
  if (phase === 'after') {
    const all = Object.values(evidence.views).flatMap(view => view.cast);
    assert(new Set(all.map(p => p.clip).filter(Boolean)).size >= 8, 'Eight readable clips in the four cameras');
    assert(evidence.views.bench.cast.filter(p => p.clip === 'Sit' && p.seatBlend === 1).length >= 2);
    assert(evidence.views.counter.cast.some(p => p.clip === 'Counter'));
    assert(evidence.views.pier.cast.some(p => p.clip === 'Fish'));
    assert(evidence.views.path.cast.some(p => p.clip === 'Wave'));
    assert.equal(all.filter(p => p.tPose).length, 0);
    if (film) {
      assert.equal(evidence.hourSweep.tPoses, 0);
      assert(evidence.hourSweep.maxSeatError <= .04);
      assert(evidence.hourSweep.maxSoleError <= .025);
      assert(evidence.hourSweep.maxPlantedSlip <= .025);
    }
  }
} finally {
  await writeFile(probe, JSON.stringify(evidence, null, 2) + '\n');
  await browser.close();
}
