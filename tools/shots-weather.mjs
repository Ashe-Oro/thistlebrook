import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const before = process.argv.includes('--before');
const film = process.argv.includes('--film');
const skinsOnly = process.argv.includes('--skins');
const folder = new URL('../shots/weather/', import.meta.url);
const origin = process.env.WEATHER_ORIGIN || 'http://127.0.0.1:5268';
const views = {
  downtown: { x: -57, z: -6, zoom: 3.1, rotation: 0 },
  residential: { x: -3, z: -9, zoom: 5.5, rotation: 0 },
};
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: film ? { width: 640, height: 426 } : skinsOnly ? { width: 520, height: 346 } : { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' && m.text().includes('THREE.WebGLProgram')) errors.push(m.text());
  });
  await page.routeWebSocket('**', ws => ws.close());
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`${origin}/?capture=1&seed=831&weather=${film ? 'rain' : 'clear'}&skin=cel&hour=10&view=downtown`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready || window.__astraError, null, { timeout: 240000, polling: 250 });
  assert.equal(await page.evaluate(() => window.__astraError), undefined);
  const shot = async (name, view, hour, weather = 'clear') => {
    const { image, ...metrics } = await page.evaluate(({ view, hour, weather }) => {
      const a = window.__astra;
      a.setWeather?.(weather);
      a.view(view);
      a.setHour(hour);
      a.step(0);
      return { image: a.renderer.domElement.toDataURL().split(',')[1], drawCalls: a.renderer.info.render.calls, effect: a.setWeather ? a.audit().weather : null };
    }, { view, hour, weather });
    await writeFile(new URL(name + '.png', folder), Buffer.from(image, 'base64'));
    console.log(name, metrics);
    return metrics;
  };
  async function verifyLiveSkins() {
    if (!skinsOnly) await page.setViewportSize({ width: 520, height: 346 });
    const scene = await page.evaluate(() => {
      const a = window.__astra;
      a.renderer.shadowMap.autoUpdate = false;
      return a.scene.uuid;
    });
    const skins = ['autumn', 'neon', 'winter', 'cel'];
    const chooser = page.getByRole('combobox', { name: 'Weather' });
    for (const skin of skins) {
      await page.evaluate(id => window.__astra.setSkin(id), skin);
      for (const type of skin === 'cel' ? ['overcast', 'fog', 'rain', 'snow', 'clear'] : ['rain', 'snow', 'clear']) {
        await chooser.selectOption(type);
        const state = await page.evaluate(() => {
          const a = window.__astra;
          a.step(0);
          const gl = a.renderer.getContext(), pixel = new Uint8Array(4);
          gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          return { type: a.weather, query: new URL(location.href).searchParams.get('weather'),
            effects: a.audit().weather.effectDrawCalls, skin: a.skin.state.skin, scene: a.scene.uuid, alpha: pixel[3] };
        });
        assert.deepEqual(state, { type, query: type, effects: type === 'rain' ? 2 : type === 'snow' ? 1 : 0,
          skin, scene, alpha: 255 });
      }
    }
    return skins;
  }

  if (film) {
    const frames = new URL('../out/weather-film/', import.meta.url);
    await mkdir(frames, { recursive: true });
    const start = await page.evaluate(() => {
      const a = window.__astra;
      document.querySelector('#speed').click();
      document.querySelector('#speed').click();
      a.renderer.shadowMap.autoUpdate = false;
      return { hour: a.hour, weather: a.weather, speed: a.speed };
    });
    assert.deepEqual(start, { hour: 10, weather: 'rain', speed: 8 });
    const count = 48;
    for (let frame = 0; frame < count; frame++) {
      const jpg = await page.evaluate(frame => {
        const a = window.__astra;
        if (frame) for (let i = 0; i < 3; i++) a.step(90 / (47 * 8 * 3), false);
        a.step(0);
        return a.renderer.domElement.toDataURL('image/jpeg', .88).split(',')[1];
      }, frame);
      await writeFile(new URL(String(frame).padStart(3, '0') + '.jpg', frames), Buffer.from(jpg, 'base64'));
      if (frame % 12 === 0) console.log('Film frame', frame);
    }
    const finish = await page.evaluate(() => window.__astra.hour);
    assert(Math.abs(finish - 11) < .00001);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-framerate', '8',
      '-i', new URL('%03d.jpg', frames).pathname, '-vf', 'fps=24', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', new URL('rainy-downtown-minute.mp4', folder).pathname]);
  } else if (skinsOnly) {
    console.log('Weather passed live render checks in', await verifyLiveSkins());
  } else if (before) {
    await shot('before-clear-downtown', views.downtown, 10);
    await shot('before-clear-residential', views.residential, 12);
  } else {
    const metrics = {};
    metrics.rainDay = await shot('after-rain-day', views.downtown, 10, 'rain');
    metrics.rainDusk = await shot('after-rain-dusk', views.downtown, 18.8, 'rain');
    metrics.snowDay = await shot('after-snow-day', views.residential, 12, 'snow');
    await shot('after-snow-downtown', views.downtown, 12, 'snow');
    metrics.clear = await shot('after-clear', views.downtown, 10);
    assert.equal(metrics.rainDay.effect.effectDrawCalls, 2);
    assert.equal(metrics.snowDay.effect.effectDrawCalls, 1);
    assert.equal(metrics.clear.effect.effectDrawCalls, 0);
    const beforeImage = (await readFile(new URL('before-clear-downtown.png', folder))).toString('base64');
    const rainImage = (await readFile(new URL('after-rain-day.png', folder))).toString('base64');
    const clearImage = (await readFile(new URL('after-clear.png', folder))).toString('base64');
    const snowImage = (await readFile(new URL('after-snow-day.png', folder))).toString('base64');
    metrics.pixels = await page.evaluate(async images => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const arrays = [];
      for (const source of images) {
        const image = new Image();
        image.src = 'data:image/png;base64,' + source;
        await image.decode();
        ctx.drawImage(image, 0, 0);
        arrays.push(ctx.getImageData(...(arrays.length === 3 ? [0, 0, 1200, 800] : [878, 411, 12, 9])).data);
      }
      const mean = bytes => {
        let sum = 0;
        for (let i = 0; i < bytes.length; i += 4) sum += bytes[i] * .2126 + bytes[i+1] * .7152 + bytes[i+2] * .0722;
        return sum / (bytes.length / 4);
      };
      const [before, rain, restored, snow] = arrays;
      return { clearRoad: mean(before), rainRoad: mean(rain),
        rainDrop: 1 - mean(rain) / mean(before), snowFrame: mean(snow),
        restoredMaxChannelDelta: Math.max(...restored.map((v, i) => Math.abs(v - before[i]))) };
    }, [beforeImage, rainImage, clearImage, snowImage]);
    assert(metrics.pixels.rainDrop >= .15);
    assert(metrics.pixels.restoredMaxChannelDelta < 8);
    assert(metrics.pixels.snowFrame < 175);
    metrics.liveSkins = await verifyLiveSkins();
    assert.deepEqual(errors, []);
    await writeFile(new URL('render-metrics.json', folder), JSON.stringify(metrics, null, 2) + '\n');
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
