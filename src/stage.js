// Shared renderer, camera, controls and toon lighting for every page, so the
// hamlet and the kit viewer are lit identically.
//
// Two camera modes: the default pulled-back perspective, and an orthographic
// 2:1 isometric (?cam=iso, elevation 30 deg) whose azimuth follows the layout's
// suggested camera direction and whose frustum fits the core bounds. Iso ideas
// are inspired by jankeesvw/isometric-helenaveen (no code copied).
//
// Pages with a compiled town call setIsoFit(boxes) and setPerspectiveFit(boxes)
// with townCoreBoxes(scene) after building, so both modes frame the core
// tightly (the perspective fit solves target + distance with the real camera).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PALETTE } from './toon.js';

// ?cam=x,y,z&target=x,y,z overrides the start view (handy for QA shots).
// ?cam=iso selects the orthographic isometric camera instead.
const q = new URLSearchParams(location.search);
const isoRequested = q.get('cam') === 'iso';
const vec = (k) => {
  const v = q.get(k);
  if (!v || v === 'iso') return null;
  const a = v.split(',').map(Number);
  return a.every(Number.isFinite) ? a : null;
};

const ISO_ELEV = 30 * Math.PI / 180; // 2:1-ish isometric elevation

export function createStage({
  camPos = [30, 24, 34], target = [0, 2.5, 0], minDistance = 20, maxDistance = 72,
  shadowSize = 44, fog = [90, 230], fitRadius = 36, mode = isoRequested ? 'iso' : 'persp',
} = {}) {
  // Explicit ?cam=x,y,z and/or ?target=x,y,z: never auto-fit the perspective
  // camera (the requested eye / aim point is kept exactly).
  const camOverride = !!vec('cam') || !!vec('target');
  camPos = vec('cam') || camPos;
  target = vec('target') || target;
  const app = document.getElementById('app');
  // preserveDrawingBuffer lets headless screenshots read the canvas reliably.
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  const _rq = new URLSearchParams(location.search);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, Number(_rq.get('prmax')) || 2));
  window.__renderer = renderer;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(new THREE.Color(PALETTE.skyHorizon));
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const fogObj = fog ? new THREE.Fog(new THREE.Color(PALETTE.skyHorizon), fog[0], fog[1]) : null;

  const aspect = () => window.innerWidth / window.innerHeight;

  // Horizontal azimuth from the requested view; iso keeps it, forces elevation.
  const dir = new THREE.Vector2(camPos[0] - target[0], camPos[2] - target[2]);
  if (dir.lengthSq() < 1e-6) dir.set(1, 1);
  dir.normalize();

  const persp = new THREE.PerspectiveCamera(42, aspect(), 0.1, 1000);
  persp.position.set(...camPos);

  // Elevation foreshortens the ground plane vertically (× sin elev), so a frustum
  // sized to the raw radius leaves the town tiny. Fit vertical extent to the
  // foreshortened spread + building height, and keep enough width for the radius.
  const orthoHalfH = () => Math.max(fitRadius * 0.82, (fitRadius / aspect()) * 1.1);

  function makeOrtho() {
    const h = orthoHalfH();
    const w = h * aspect();
    const D = Math.max(fitRadius * 3, 140);
    const cam = new THREE.OrthographicCamera(-w, w, h, -h, 0.1, D + 700);
    cam.position.set(
      target[0] + dir.x * D * Math.cos(ISO_ELEV),
      target[1] + D * Math.sin(ISO_ELEV),
      target[2] + dir.y * D * Math.cos(ISO_ELEV),
    );
    if (isoFit) fitOrtho(cam);
    return cam;
  }

  // Tight iso framing: project the town core's world bounds into the ortho
  // camera's view space and size an (asymmetric) frustum around them, leaving
  // the left panel strip (panelFrac of the width) clear. Without this the
  // radius-based frustum left the town small in a big green field.
  let isoFit = null; // { boxes: Box3[], panelFrac, margin }
  const _v = new THREE.Vector3();
  function fitOrtho(cam) {
    cam.updateMatrixWorld(true);
    const inv = cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const b of isoFit.boxes) {
      for (let i = 0; i < 8; i++) {
        _v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(inv);
        x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y);
      }
    }
    if (!Number.isFinite(x0)) return;
    const m = isoFit.margin, pf = isoFit.panelFrac, a = aspect();
    let w = (x1 - x0) * (1 + 2 * m), h = (y1 - y0) * (1 + 2 * m);
    // Visible width for the town is (1 - pf) of the frame.
    let W = Math.max(w / (1 - pf), h * a);
    const H = W / a;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    // Centre the town in the area right of the panel.
    const left = cx - W * (pf + (1 - pf) / 2);
    Object.assign(cam, { left, right: left + W, top: cy + H / 2, bottom: cy - H / 2, zoom: 1 });
    cam.updateProjectionMatrix();
  }
  // Called by pages once the town is built. Boxes are world-space Box3s.
  function setIsoFit(boxes, { panelFrac = 0.2, margin = 0.04 } = {}) {
    isoFit = { boxes, panelFrac, margin };
    if (stage.camera && stage.camera.isOrthographicCamera) fitOrtho(stage.camera);
  }

  // Tight perspective framing: keep the current azimuth and fov (elevation may
  // rise up to maxElevation, see below), then solve target + distance by projecting the town
  // core's world boxes through the real perspective camera. The core is
  // centred in the frame right of the left panel strip (panelFrac of the
  // width) and spans `fill` of that area on its binding axis (width or
  // height), leaving a small margin; boxes include full heights, so roofs and
  // chimneys stay in frame.
  let perspFit = null; // { boxes, panelFrac, fill }
  let userMoved = false;
  const _p = new THREE.Vector3(), _off = new THREE.Vector3(), _t = new THREE.Vector3();
  const _right = new THREE.Vector3(), _gf = new THREE.Vector3();
  function fitPerspective() {
    if (!perspFit || !perspFit.boxes.length) return null;
    const { boxes, panelFrac: pf, fill } = perspFit;
    const pts = [];
    for (const b of boxes) for (let i = 0; i < 8; i++) {
      pts.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
    }
    const cam = persp.clone();
    cam.aspect = aspect(); cam.updateProjectionMatrix();
    const { az, baseEl, maxEl } = perspFit;
    _gf.set(-az.x, 0, -az.y); // ground-forward (unit)
    _right.set(-_gf.z, 0, _gf.x); // screen right on the ground
    let el = baseEl;
    const setEl = (e) => { el = e; _off.set(az.x * Math.cos(e), Math.sin(e), az.y * Math.cos(e)); };
    const tanV = Math.tan((cam.fov * Math.PI) / 360), tanH = tanV * cam.aspect;
    const wantX = pf; // centre of NDC x in [-1 + 2pf, 1]
    const measure = (D, tgt) => {
      cam.position.copy(tgt).addScaledVector(_off, D);
      cam.lookAt(tgt);
      cam.updateMatrixWorld(true);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) {
        _p.copy(p).applyMatrix4(cam.matrixWorldInverse);
        if (-_p.z < cam.near * 4) return null; // too close / behind
        _p.applyMatrix4(cam.projectionMatrix);
        x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x); y0 = Math.min(y0, _p.y); y1 = Math.max(y1, _p.y);
      }
      return { x0, x1, y0, y1 };
    };
    const at = (D) => {
      const tgt = new THREE.Vector3(...target);
      let ex = measure(D, tgt);
      for (let k = 0; k < 6 && ex; k++) {
        const sx = ((ex.x0 + ex.x1) / 2 - wantX) * tanH * D;
        const sy = ((ex.y0 + ex.y1) / 2) * tanV * D / Math.sin(el);
        tgt.addScaledVector(_right, sx).addScaledVector(_gf, sy);
        ex = measure(D, tgt);
      }
      if (!ex) return { ok: false };
      const fx = (ex.x1 - ex.x0) / (2 * (1 - pf)), fy = (ex.y1 - ex.y0) / 2;
      const inside = ex.x0 >= -1 + 2 * pf - 1e-3 && ex.x1 <= 1 + 1e-3 && ex.y0 >= -1 - 1e-3 && ex.y1 <= 1 + 1e-3;
      return { ok: inside && Math.max(fx, fy) <= fill, tgt, fx, fy };
    };
    const solve = () => {
      let lo = 2, hi = 600, best = at(hi);
      if (!best.ok) return null;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        const r = at(mid);
        if (r.ok) { hi = mid; best = r; } else lo = mid;
      }
      return { D: hi, el, ...best };
    };
    // A wide town is width-limited and leaves empty foreground. Try raising
    // the elevation (1 deg steps up to maxEl): the binding axis stays at
    // `fill`, the minor axis grows. Take the lowest elevation whose minor-axis
    // fill is within 0.01 of the best. The target recentring keeps the core
    // centred on both axes of the usable area.
    const cands = [];
    const step = Math.PI / 180;
    for (let e = perspFit.minEl; e <= maxEl + 1e-6; e += step) {
      setEl(e);
      const s = solve();
      if (s) cands.push(s);
    }
    if (!cands.length) return null;
    const bestMinor = Math.max(...cands.map((c) => Math.min(c.fx, c.fy)));
    const best = cands.find((c) => Math.min(c.fx, c.fy) >= bestMinor - 0.01);
    setEl(best.el);
    const D = best.D;
    _t.copy(best.tgt);
    target = [_t.x, _t.y, _t.z];
    persp.position.copy(_t).addScaledVector(_off, D);
    persp.lookAt(_t);
    if (stage.controls && stage.camera === persp) {
      stage.controls.target.copy(_t);
      stage.controls.minDistance = Math.min(stage.controls.minDistance, D * 0.4);
      stage.controls.maxDistance = Math.max(stage.controls.maxDistance, D * 2.2);
      stage.controls.update();
    }
    const result = { distance: D, target: [...target], elevation: +(best.el * 180 / Math.PI).toFixed(1), fillX: best.fx, fillY: best.fy };
    stage.perspFitResult = result; // for QA / headless shots
    return result;
  }
  // Called by pages once the town is built. Boxes are world-space Box3s.
  // maxElevation (deg) caps how far the fit may raise the camera above the
  // suggested elevation. No-op when ?cam=x,y,z overrides the view.
  function setPerspectiveFit(boxes, { panelFrac = 0.2, fill = 0.86, minElevation = 37, maxElevation = 45 } = {}) {
    if (camOverride) return null;
    const ox = persp.position.x - target[0], oy = persp.position.y - target[1], oz = persp.position.z - target[2];
    const h = Math.hypot(ox, oz) || 1;
    const baseEl = Math.max(0.05, Math.atan2(oy, h));
    const maxEl = Math.max(baseEl, (maxElevation * Math.PI) / 180);
    perspFit = {
      boxes, panelFrac, fill,
      az: new THREE.Vector2(ox / h, oz / h), baseEl, maxEl,
      // Elevations searched: [min(base, minElevation), max(base, maxElevation)].
      minEl: Math.min(baseEl, (minElevation * Math.PI) / 180),
    };
    userMoved = false;
    return fitPerspective();
  }

  const stage = { renderer, scene, sun: null, mode, camera: null, controls: null };

  let onChange = null;
  stage.onCameraChange = (fn) => { onChange = fn; };

  function makeControls(cam) {
    const c = new OrbitControls(cam, renderer.domElement);
    c.target.set(...target);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    if (cam.isOrthographicCamera) {
      c.minZoom = 0.5;
      c.maxZoom = 3.0;
    } else {
      c.minDistance = q.get('cam') && !isoRequested ? 1 : minDistance;
      c.maxDistance = maxDistance;
    }
    c.minPolarAngle = 0.15;
    c.maxPolarAngle = 1.35; // keep the camera above the ground plane
    c.addEventListener('start', () => { userMoved = true; }); // stop auto re-fit on resize
    c.update();
    return c;
  }

  function applyMode(m) {
    stage.mode = m;
    stage.camera = m === 'iso' ? makeOrtho() : persp;
    if (stage.controls) stage.controls.dispose();
    stage.controls = makeControls(stage.camera);
    // Fog washes out the ortho view (everything sits at a similar depth); drop
    // it in iso, keep it in perspective.
    scene.fog = m === 'iso' ? null : fogObj;
    if (onChange) onChange(stage.camera);
  }

  stage.setIsoFit = setIsoFit;
  stage.setPerspectiveFit = setPerspectiveFit;
  stage.setMode = (m) => { if (m !== stage.mode) applyMode(m); };
  applyMode(mode);

  const sun = new THREE.DirectionalLight(0xfff4d6, 1.7);
  sun.position.set(34 + target[0], 44, 22 + target[2]);
  sun.target.position.set(target[0], 0, target[2]);
  sun.castShadow = true;
  { const _sm = Number(new URLSearchParams(location.search).get('shadowMap')) || 2048; const _max = renderer.capabilities.maxTextureSize; const _v = Math.min(_sm, _max); sun.shadow.mapSize.set(_v, _v); window.__shadowMap = _v; }
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  const S = shadowSize;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S });
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x6f8a3f, 0.55));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  stage.sun = sun;

  window.addEventListener('resize', () => {
    const a = aspect();
    persp.aspect = a;
    persp.updateProjectionMatrix();
    if (perspFit && !userMoved) fitPerspective(); // keep the tight framing for the new aspect
    if (stage.camera.isOrthographicCamera && isoFit) fitOrtho(stage.camera);
    else if (stage.camera.isOrthographicCamera) {
      const h = orthoHalfH();
      stage.camera.left = -h * a; stage.camera.right = h * a;
      stage.camera.top = h; stage.camera.bottom = -h;
      stage.camera.updateProjectionMatrix();
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Back-compat: callers may destructure { renderer, scene, camera, controls, sun }.
  return stage;
}

// World bounds of the town core (everything but trees and bushes), used to
// frame the iso camera tightly on the town.
export function townCoreBoxes(scene) {
  const out = [];
  scene.traverse((o) => {
    const inst = o.userData.inst;
    if (!inst || o.userData.outline) return;
    if (inst.kind === 'tree' || inst.kind === 'bush' || (inst.kind === 'villager' && !new URLSearchParams(location.search).has('lineup'))) return;
    if (o.userData.batchPivot) {
      const bounds = o.userData.entry.bounds;
      o.updateWorldMatrix(true, false);
      out.push(new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max)).applyMatrix4(o.matrixWorld));
      return;
    }
    // precise: vertex-exact bounds, so rotated buildings aren't inflated.
    const b = new THREE.Box3().setFromObject(o, true);
    if (!b.isEmpty()) out.push(b);
  });
  return out;
}
