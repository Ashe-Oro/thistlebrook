// Build first: npm run build && npm run shots:village-light.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const dir = new URL('../shots/village-light/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const videoOnly = process.argv.includes('--video-only'), stillsOnly = process.argv.includes('--stills-only');
assert(!(videoOnly && stillsOnly), 'Choose one capture mode');
const evidence = (videoOnly || stillsOnly) && existsSync(dir + 'evidence.json')
  ? JSON.parse(readFileSync(dir + 'evidence.json', 'utf8')) : { shots: [], video: {}, errors: [] };
evidence.errors = [];
const checkpoint = () => writeFileSync(dir + 'evidence.json', JSON.stringify(evidence, null, 2));
const server = await preview({ preview: { port: 0, strictPort: true, host: '127.0.0.1' } });
let browser;
try {
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  // The app has no favicon asset; satisfy Chrome's automatic request locally.
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
  // Keep the application's first render, then capture subsequent frames on demand.
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  page.on('pageerror', e => { evidence.errors.push(String(e.stack || e)); checkpoint(); });
  page.on('console', m => { if (m.type() === 'error') { evidence.errors.push(m.text()); checkpoint(); } });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) evidence.errors.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', r => evidence.errors.push(`${r.failure()?.errorText} ${r.url()}`));
  await page.goto(`${server.resolvedUrls.local[0]}?size=large&seed=1234&life=1&hour=16&timescale=0&view=overview&post=1&prmax=1&shadowMap=1024&kuwahara=3&cam=32,17,42&target=0,3,-5`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000, polling: 100 });
  console.log('renderer ready');
  // Render on demand: avoid competing live frames during software capture.
  await page.evaluate(() => {
    window.__captureNow = performance.now();
    performance.now = () => window.__captureNow;
    window.requestAnimationFrame = () => 0;
    document.querySelector('#look')?.classList.add('collapsed');
  });
  async function seek(hour) {
    await page.evaluate(h => { __life.setHour(h); window.__captureNow += 100; __post.render(__stage.camera); }, hour);
  }
  async function audit() {
    return page.evaluate(() => {
      const lamps = [], grasses = [], skies = [];
      __scene.traverse(o => {
        if (o.isPointLight) lamps.push({ intensity: o.intensity, shadows: o.castShadow });
        if (o.material?.uniforms?.top) skies.push({ top: o.material.uniforms.top.value.getHexString(), horizon: o.material.uniforms.bottom.value.getHexString() });
        if (o.material?.isMeshToonMaterial && o.material.color.getHexString() === '485957') grasses.push(o.name);
      });
      return { hour: __life.hour, lightingHour: __scene.userData.lightingPolish.hour, post: { ...__post.options }, sun: { position: __stage.sun.position.toArray(), color: __stage.sun.color.getHexString(), intensity: __stage.sun.intensity }, fog: __scene.fog && { near: __scene.fog.near, far: __scene.fog.far, color: __scene.fog.color.getHexString() }, lamps, nightGrassMaterials: grasses.length, skies, camera: { position: __stage.camera.position.toArray(), target: __stage.controls.target.toArray() } };
    });
  }
  const initial = await audit();
  assert.equal(initial.hour, 16, '?hour= preserved');
  assert.equal(initial.post.post, true);
  evidence.runtime = { queryHour: initial.hour, viewport: [1280, 720], renderer: 'Chrome / SwiftShader', lightingSeek: true };
  // Check the existing grade toggle gates the time-aware grade too.
  evidence.gradeToggle = await page.evaluate(() => {
    const u = Object.fromEntries(['uWarm', 'uSat', 'uContrast', 'uVignette'].map(k => [k, { value: 0 }]));
    const grade = __scene.userData.lightingPolish.grade;
    grade(u, { grade: false }); const off = u.uWarm.value;
    grade(u, { grade: true });
    return { off, on: u.uWarm.value };
  });
  assert.equal(evidence.gradeToggle.off, 0);
  assert.notEqual(evidence.gradeToggle.on, 0);
  if (!videoOnly) {
    evidence.shots = [];
    for (const [name, hour] of [['dawn', 6.25], ['day', 12], ['golden-hour', 17.25], ['night', 21.5]]) {
      await seek(hour);
      const state = await audit();
      assert(Math.abs(state.hour - hour) < .00001);
      assert.equal(state.lightingHour, state.hour);
      assert(state.lamps.length <= 10 && state.lamps.every(l => !l.shadows));
      if (name === 'night') assert(state.nightGrassMaterials > 0, 'Nocturnal grass preserved');
      const png = await page.evaluate(() => __renderer.domElement.toDataURL('image/png').split(',')[1]);
      writeFileSync(dir + name + '.png', Buffer.from(png, 'base64'));
      evidence.shots.push({ name, ...state }); checkpoint();
      console.log('shot', name);
    }
  }
  if (!stillsOnly) {
    const frames = dir + 'frames/';
    const resume = videoOnly && evidence.video.frames === 120 && evidence.video.fps === 10 && existsSync(frames + '0000.png');
    if (!resume) {
      rmSync(frames, { recursive: true, force: true });
      evidence.video = { file: 'village-light.mp4', fps: 10, frames: 120, seconds: 12, post: true, samples: [] };
    }
    mkdirSync(frames, { recursive: true });
    let start = 0;
    if (resume) while (start < 120) {
      const path = frames + String(start).padStart(4, '0') + '.png';
      if (!existsSync(path) || !readFileSync(path).subarray(-12).equals(Buffer.from('0000000049454e44ae426082', 'hex'))) break;
      start++;
    }
    evidence.video.samples = evidence.video.samples.filter(s => s.frame < start);
    console.log('video starting at frame', start);
    for (let frame = start; frame < 120; frame++) {
      await seek(16 + frame / 119 * 6.5);
      const png = await page.evaluate(() => __renderer.domElement.toDataURL('image/png').split(',')[1]);
      writeFileSync(frames + String(frame).padStart(4, '0') + '.png', Buffer.from(png, 'base64'));
      if (frame % 10 === 0 || frame === 119) {
        const state = await audit(); assert(state.post.post && state.post.hull && state.post.grade);
        evidence.video.samples.push({ frame, ...state }); checkpoint(); console.log('video frame', frame, '/120');
      }
    }
    execFileSync('ffmpeg', ['-y', '-framerate', '10', '-i', frames + '%04d.png', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dir + 'village-light.mp4'], { stdio: 'pipe' });
    evidence.video.probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,pix_fmt,duration,nb_frames', '-of', 'json', dir + 'village-light.mp4'], { encoding: 'utf8' }));
    const stream = evidence.video.probe.streams[0];
    assert.equal(stream.pix_fmt, 'yuv420p');
    assert.equal(stream.width, 1280); assert.equal(stream.height, 720);
    assert.equal(Number(stream.nb_frames), 120); assert.equal(Number(stream.duration), 12);
    rmSync(frames, { recursive: true, force: true });
  }
  assert.equal(evidence.errors.length, 0, JSON.stringify(evidence.errors));
  console.log('village lighting captures complete');
} finally {
  checkpoint(); await browser?.close(); await new Promise(r => server.httpServer.close(r));
}
