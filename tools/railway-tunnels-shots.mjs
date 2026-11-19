// Usage: node tools/railway-tunnels-shots.mjs <vite-url> [stills|before|ride] [frame-from frame-to frame-dir]
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from 'playwright-core';
import survey from './railway-plan/route.json' with {type: 'json'};

const rideFrames = 96;
const [base, mode = 'stills', first = '0', last = String(rideFrames), frames = '/tmp/northern-loop-ride'] = process.argv.slice(2);
if (!base) throw Error('Pass the local Vite URL.');
const dir = 'shots/railway-tunnels', comparison = 'shots/railway-reroute';
mkdirSync(dir, {recursive: true});
if (mode === 'ride') mkdirSync(frames, {recursive: true});
const bugs = {
  'airport-crossing': [70, -178, 4.8, 1],
  'floating-station-over-water': [299, 82, 3.8, 1],
  'lantern-room-patio-on-road': [51, -.6, 8, 0],
  'rail-into-mountain-no-tunnel': [108, -40, 4, 0],
  'skatepark-crossing-mountain': [75, -89, 4, 0],
  'track-over-road-station': [184, 22, 4.6, 0],
  'track-through-parking-lot': [242, 23, 3.7, 0],
  'trees-through-rail': [-56, 86, 4.8, 0],
};
const bugSelection = process.env.RAILWAY_BUGS?.split(',');
const views = bugSelection ? [] : [
  {name: 'overview', view: [-103, -207, .72, 1], s: 130},
  ...survey.tunnels.flatMap((t, i) => t.portals.map((p, j) => ({
    name: `portal-${i + 1}-${p.end}`,
    view: [p.pos[0] + p.outward[0] * 1.3, p.pos[1] + p.outward[1] * 1.3, 7.2,
      ((Math.round((Math.atan2(...p.outward) - Math.PI / 4) / (Math.PI / 2)) % 4) + 4) % 4],
    cameraAngle: [Math.atan2(...p.outward) + Math.PI / 9, [[38, 38], [38, 47], [50, 48]][i][j] * Math.PI / 180],
    s: p.s + (j ? 10 : -31),
  }))),
  ...survey.stations.map((st) => ({
    name: 'station-' + st.id,
    view: [st.centre[0], st.centre[1] - 2, 4.6, 0],
    station: st.id,
  })),
];

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const viewport = mode === 'ride' ? {width: 864, height: 486} : {width: 1600, height: 900};
  const page = await browser.newPage({viewport});
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/favicon.ico', (route) => route.fulfill({status: 204}));
  await page.routeWebSocket(new RegExp(new URL(base).host), (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      if (!String(message).includes('"type":"full-reload"') && !String(message).includes('"type":"update"')) socket.send(message);
    });
  });
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(base + '/?view=railway&capture=1&seed=831&weather=clear', {timeout: 90000});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 120000, polling: 300});
  await page.evaluate(({baseline, ride}) => {
    if (window.__astraError) throw Error(window.__astraError);
    const app = __astra;
    app.setPaused(true);
    app.renderer.shadowMap.enabled = false;
    if (!baseline) {
      const portals = app.world.railway.root.getObjectByName('Railway · tunnel_portal');
      if (portals?.count !== 6 || !portals.material.isMeshToonMaterial || !portals.children.some((mesh) => mesh.userData.outline)) {
        throw Error('Six toon-shaded stone portals with ink are required');
      }
      if (!ride) {
        if (app.setSkin('winter') !== 'winter') throw Error('Winter skin did not load');
        app.step(0);
        app.setSkin('cel');
      }
    }
  }, {baseline: mode === 'before', ride: mode === 'ride'});
  if (mode === 'ride') {
    await page.evaluate(async (frameCount) => {
      const app = __astra, rail = app.town.railway;
      const {railPose} = await import('/src/compiler/railway.js');
      const {trainAt} = await import('/src/astra/railway-plan.js');
      const Three = await import('/node_modules/.vite/deps/three.js');
      const railway = app.world.railway, timetable = railway.service.timetable;
      const camera = new Three.PerspectiveCamera(70, innerWidth / innerHeight, .04, 240);
      const exhaust = railway.moving.children.filter((o) => o.isMesh);
      app.setHour(11.1);
      app.step(0, false);
      // Keep the northern scenery in the ride camera's draw range. Compact
      // town-wide static batches once so distant district instances do not
      // get submitted on every software-rendered frame.
      const registry = new Map(app.town.registry.places.map((p) => [p.id, p.pos]));
      const matrix = new Three.Matrix4(), color = new Three.Color();
      const nearby = ([x, z]) => x > -278 && x < 90 && z < -144;
      const special = /^(landscape:mainland|landscape:ocean|built:island)$/;
      const keep = (id) => special.test(id ?? '') || nearby(registry.get(id) ?? [Infinity, Infinity]);
      app.scene.traverse((mesh) => {
        if (!mesh.isMesh || mesh.name.includes('evening sky')) return;
        for (let parent = mesh; parent; parent = parent.parent) if (parent === railway.root) return;
        if (mesh.isInstancedMesh && mesh.userData.registryIds) {
          let count = 0;
          mesh.userData.registryIds.forEach((id, i) => {
            if (!keep(id)) return;
            mesh.getMatrixAt(i, matrix);
            mesh.setMatrixAt(count, matrix);
            if (mesh.instanceColor) {
              mesh.getColorAt(i, color);
              mesh.setColorAt(count, color);
            }
            count++;
          });
          mesh.count = count;
          mesh.visible &&= count > 0;
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          mesh.computeBoundingSphere();
        } else {
          mesh.visible &&= keep(mesh.userData.registryId);
        }
      });
      const ridingTime = 8 * timetable.lap + timetable.departures[1].at;
      function find(s) {
        let lo = ridingTime, hi = lo + timetable.legs[1].time;
        for (let i = 0; i < 25; i++) {
          const time = (lo + hi) / 2;
          const pose = trainAt(rail, timetable, time / 90);
          if (pose.s < s && pose.s >= rail.stations[1].s) lo = time;
          else hi = time;
        }
        return (lo + hi) / 2;
      }
      const start = find(238), end = find(480);
      window.rideFrame = (i) => {
        const t = start + (end - start) * i / (frameCount - 1);
        railway.update(t, t / 90);
        for (const puff of exhaust) puff.visible = false;
        const train = railway.service.train, engine = railway.service.cars[0];
        const p = railPose(rail, engine.s + 3), ahead = railPose(rail, engine.s + 9);
        // A camera mounted above the smokebox sees the uninterrupted rails,
        // every portal on the return leg, and both daylight and tunnel cover.
        camera.position.set(p.p[0], p.y + 2.78, p.p[1]);
        camera.lookAt(ahead.p[0], ahead.y + 1.6, ahead.p[1]);
        app.renderer.render(app.scene, camera);
        return {phase: train.phase, data: app.renderer.domElement.toDataURL('image/jpeg', .88).split(',')[1]};
      };
    }, rideFrames);
    for (let i = Number(first); i < Number(last); i++) {
      const frame = await page.evaluate((i) => rideFrame(i), i);
      if (frame.phase !== 'run') throw Error('Ride camera left the return leg');
      writeFileSync(join(frames, String(i).padStart(4, '0') + '.jpg'), Buffer.from(frame.data, 'base64'));
      if (i % 15 === 0) console.log('Ride frame', i);
    }
  } else {
    const baseline = mode === 'before';
    const evidence = {};
    for (const {name, view, s, station, cameraAngle} of views) {
      const result = await page.evaluate(({view, s, station, baseline, cameraAngle}) => {
        const app = __astra, svc = app.world.railway.service;
        let time = 10.7 * 90;
        if (!baseline) {
          if (station) {
            time = svc.timetable.departures.find((d) => d.station === station && d.at > 950).at - 8;
          } else {
            let best = Infinity;
            for (let i = 906; i < 1080; i += .33) {
              svc.update(i / 90);
              const d = Math.abs(svc.train.s - s);
              if (d < best) { best = d; time = i; }
            }
          }
        }
        app.setHour(time / 90);
        app.controls.view({x: view[0], z: view[1], zoom: view[2], rotation: view[3]}, true);
        app.step(0, !cameraAngle);
        if (cameraAngle) {
          const [x, z] = view, [azimuth, elevation] = cameraAngle;
          app.camera.position.set(x + Math.sin(azimuth) * 800, 2 + Math.tan(elevation) * 800, z + Math.cos(azimuth) * 800);
          app.camera.lookAt(x, 2, z);
          app.camera.updateMatrixWorld();
          app.renderer.render(app.scene, app.camera);
        }
        return {data: baseline ? null : app.renderer.domElement.toDataURL('image/png').split(',')[1],
          calls: app.renderer.info.render.calls, camera: app.controls.state(), train: svc.train};
      }, {view, s, station, baseline, cameraAngle});
      if (result.data) writeFileSync(join(dir, name + '.png'), Buffer.from(result.data, 'base64'));
      evidence[name] = {drawCalls: result.calls, camera: {...result.camera, ...(cameraAngle && {azimuth: cameraAngle[0], elevation: cameraAngle[1]})}, phase: result.train.phase};
      console.log(name, result.calls);
    }
    const suffix = baseline ? 'before' : 'after';
    if (!process.env.RAILWAY_SKIP_COMPARISONS) for (const [name, [x, z, zoom, rotation]] of Object.entries(bugs)) {
      if (bugSelection && !bugSelection.includes(name)) continue;
      const data = await page.evaluate(({x, z, zoom, rotation}) => {
        __astra.setHour(11.4);
        __astra.controls.view({x, z, zoom, rotation}, true);
        __astra.step(0, zoom <= 5);
        if (zoom > 5) {
          __astra.camera.zoom = zoom;
          __astra.camera.updateProjectionMatrix();
          __astra.renderer.render(__astra.scene, __astra.camera);
        }
        return __astra.renderer.domElement.toDataURL('image/png').split(',')[1];
      }, {x, z, zoom, rotation});
      writeFileSync(join(comparison, name + '-' + suffix + '.png'), Buffer.from(data, 'base64'));
    }
    if (!bugSelection) writeFileSync(join(dir, 'evidence-' + suffix + '.json'), JSON.stringify(evidence, null, 2) + '\n');
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser.close(); }
