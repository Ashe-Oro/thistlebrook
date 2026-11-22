import * as THREE from 'three';

export const ZOOM_LIMITS = { min: .12, max: 15 };
const quarter = Math.PI / 2;
const clampZoom = zoom => THREE.MathUtils.clamp(zoom, ZOOM_LIMITS.min, ZOOM_LIMITS.max);
const snap = value => ((Math.round(value) % 4) + 4) % 4;
const validElevation = value => Number.isFinite(value) && value >= 30 && value <= 70 ? value : undefined;

// URL y is the map's second horizontal coordinate (Three.js z), never altitude.
export function readCameraHash(hash, defaultZoom) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!['x', 'y'].every(key => params.get(key)?.trim())) return null;
  const [x, z] = ['x', 'y'].map(key => Number(params.get(key)));
  const zoom = params.has('zoom') ? Number(params.get('zoom')) : defaultZoom;
  if (![x, z, zoom].every(Number.isFinite) || zoom <= 0) return null;
  const rotation = Number(params.get('r') || 0);
  const elevation = validElevation(Number(params.get('elevation')));
  return { x, z, zoom: clampZoom(zoom), rotation: Number.isFinite(rotation) ? snap(rotation) : 0,
    ...(elevation === undefined ? {} : { elevation }) };
}

export function writeCameraHash(hash, { x, z, zoom, rotation, elevation }) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  params.set('x', String(Number(x.toFixed(3))));
  params.set('y', String(Number(z.toFixed(3))));
  params.set('zoom', String(Number(zoom.toFixed(4))));
  params.set('r', String(snap(rotation)));
  if (validElevation(elevation) === undefined) params.delete('elevation');
  else params.set('elevation', String(elevation));
  return '#' + params.toString();
}

// Derive navigation bounds from the compiled town, including future districts.
export function cameraBounds(town) {
  const points = [...town.nodes,...(town.worldOutline||[])];
  for (const b of [...town.buildings, ...town.venues]) {
    if (b.box) points.push(b.box.min, b.box.max);
  }
  return {
    minX: Math.min(...points.map(p => p[0])) - 24,
    maxX: Math.max(...points.map(p => p[0])) + 24,
    minZ: Math.min(...points.map(p => p[1])) - 24,
    maxZ: Math.max(...points.map(p => p[1])) + 24,
  };
}

/** Orthographic map controller with quarter-turn rotation and per-view elevation. */
export function createMapCamera(camera, element, { bounds, hashZoom = () => undefined, onInteract = () => {}, onTap = () => {}, onHover = () => {}, onChange = () => {}, onRotate = () => {} }) {
  const target = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const screen = new THREE.Vector2(), groundBefore = new THREE.Vector3(), groundAfter = new THREE.Vector3();
  const orientedTarget = new THREE.Vector3();
  const inertia = new THREE.Vector3(), touchVelocity = new THREE.Vector3();
  const pointers = new Map();
  const disposers = [];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let rotation = 0, elevation, desiredZoom = camera.zoom, destination = null, anchor = null;
  let orientedRotation, orientedElevation;
  let gesture = null, hashTimer = null, lastState = '';
  const listen = (node, type, fn, options) => {
    node.addEventListener(type, fn, options);
    disposers.push(() => node.removeEventListener(type, fn, options));
  };
  function orient() {
    target.y = 0;
    target.x = THREE.MathUtils.clamp(target.x, bounds.minX, bounds.maxX);
    target.z = THREE.MathUtils.clamp(target.z, bounds.minZ, bounds.maxZ);
    if (orientedRotation === rotation && orientedElevation === elevation && orientedTarget.equals(target)) return;
    orientedRotation = rotation;
    orientedElevation = elevation;
    orientedTarget.copy(target);
    const heading = Math.PI / 4 + rotation * quarter;
    // Keep the usual isometric position unless a view requests a steeper look.
    const distance = 800 * Math.sqrt(1.5);
    const angle = elevation === undefined ? undefined : THREE.MathUtils.degToRad(elevation);
    const radius = angle === undefined ? 800 : distance * Math.cos(angle);
    const height = angle === undefined ? 800 / Math.sqrt(2) : distance * Math.sin(angle);
    camera.position.set(target.x + Math.sin(heading) * radius, height, target.z + Math.cos(heading) * radius);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  function state() {
    return { x: target.x, z: target.z, zoom: camera.zoom, rotation, ...(elevation === undefined ? {} : { elevation }) };
  }
  function flushHash() {
    clearTimeout(hashTimer); hashTimer = null;
    const hash = writeCameraHash(location.hash, state());
    if (hash !== location.hash) history.replaceState(history.state, '', location.pathname + location.search + hash);
    return location.href;
  }
  function changed() {
    const key = `${target.x.toFixed(3)},${target.z.toFixed(3)},${camera.zoom.toFixed(4)},${rotation},${elevation ?? ''}`;
    if (key === lastState) return;
    lastState = key;
    onChange(state());
    if (!hashTimer) hashTimer = setTimeout(flushHash, 160);
  }
  function groundAt(x, y, hit = new THREE.Vector3(), rect = element.getBoundingClientRect()) {
    if (!rect.width || !rect.height) return null;
    screen.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2);
    raycaster.setFromCamera(screen, camera);
    return raycaster.ray.intersectPlane(ground, hit);
  }
  function cancel() { destination = null; anchor = null; desiredZoom = camera.zoom; inertia.set(0, 0, 0); }
  function interact(kind) { destination = null; inertia.set(0, 0, 0); onInteract(kind); }
  function pan(from, to) {
    const rect = element.getBoundingClientRect();
    const a = groundAt(from.x, from.y, groundBefore, rect), b = groundAt(to.x, to.y, groundAfter, rect);
    if (a && b) target.add(a.sub(b));
    // Move the rendered camera on the pointer event. Publish UI, LOD and hash
    // changes once per frame, so coalesced events do only camera work.
    orient();
  }
  function applyZoom(amount, point) {
    const rect = point && element.getBoundingClientRect();
    const before = point && groundAt(point.x, point.y, groundBefore, rect);
    camera.zoom = amount;
    camera.updateProjectionMatrix();
    const after = point && groundAt(point.x, point.y, groundAfter, rect);
    if (before && after) target.add(before.sub(after));
  }
  function zoom(factor, point = null) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    interact();
    desiredZoom = clampZoom(desiredZoom * factor);
    anchor = point;
    onHover(null);
    if (reducedMotion.matches) update(0);
  }
  function rotate(direction = 1) {
    interact('rotate'); cancel();
    rotation = snap(rotation + direction);
    orient(); changed(); onRotate();
  }
  function view(dest, immediate = false) {
    if (!dest || ![dest.x, dest.z, dest.zoom].every(Number.isFinite)) return;
    cancel();
    destination = { x: THREE.MathUtils.clamp(dest.x, bounds.minX, bounds.maxX), z: THREE.MathUtils.clamp(dest.z, bounds.minZ, bounds.maxZ), zoom: clampZoom(dest.zoom) };
    if (Number.isFinite(dest.rotation)) rotation = snap(dest.rotation);
    elevation = validElevation(dest.elevation);
    if (immediate || reducedMotion.matches) {
      target.set(destination.x, 0, destination.z);
      camera.zoom = desiredZoom = destination.zoom;
      destination = null;
      camera.updateProjectionMatrix(); orient(); changed();
    }
  }
  function update(dt = 0) {
    const a = reducedMotion.matches ? 1 : 1 - Math.exp(-Math.max(0, dt) * 12);
    if (destination) {
      target.lerp(new THREE.Vector3(destination.x, 0, destination.z), a);
      camera.zoom = THREE.MathUtils.lerp(camera.zoom, destination.zoom, a);
      desiredZoom = camera.zoom;
      if (Math.hypot(target.x - destination.x, target.z - destination.z) < .002 && Math.abs(camera.zoom - destination.zoom) < .0001) {
        target.set(destination.x, 0, destination.z);
        camera.zoom = desiredZoom = destination.zoom;
        destination = null;
      }
      camera.updateProjectionMatrix();
    } else if (camera.zoom !== desiredZoom) {
      const amount = THREE.MathUtils.lerp(camera.zoom, desiredZoom, a);
      applyZoom(Math.abs(amount - desiredZoom) < .0001 ? desiredZoom : amount, anchor);
      if (camera.zoom === desiredZoom) anchor = null;
    }
    if (inertia.lengthSq()) {
      if (reducedMotion.matches) inertia.set(0, 0, 0);
      else {
        const decay = Math.exp(-Math.max(0, dt) * 10);
        target.addScaledVector(inertia, (1 - decay) / 10);
        inertia.multiplyScalar(decay);
        if (inertia.lengthSq() < .04) inertia.set(0, 0, 0);
      }
    }
    orient(); changed();
  }
  const midpoint = list => ({ x: (list[0].x + list[1].x) / 2, y: (list[0].y + list[1].y) / 2 });
  const distance = list => Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
  listen(element, 'pointerdown', e => {
    if (e.pointerType === 'mouse' && ![0, 1, 2].includes(e.button)) return;
    interact(); cancel();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    element.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      touchVelocity.set(0, 0, 0);
      gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, multiple: false,
        button: e.button, touch: e.pointerType === 'touch', time: e.timeStamp };
    }
    else if (gesture) gesture.multiple = true;
    onHover(null); element.style.cursor = 'grabbing';
  });
  listen(element, 'pointermove', e => {
    if (!pointers.has(e.pointerId)) { if (e.pointerType !== 'touch') onHover({ x: e.clientX, y: e.clientY }); return; }
    const previous = pointers.size === 2 ? [...pointers.values()] : null, old = pointers.get(e.pointerId);
    const point = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, point);
    const wasMoved = gesture?.moved;
    if (gesture && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 5) gesture.moved = true;
    if (pointers.size === 1) {
      if (!gesture || (!gesture.moved && !gesture.multiple)) return;
      const { x, z } = target;
      pan(wasMoved || gesture.multiple ? old : gesture, point);
      if (gesture.touch && !gesture.multiple && !reducedMotion.matches) {
        const seconds = THREE.MathUtils.clamp((e.timeStamp - gesture.time) / 1000, 1 / 120, .075);
        const maxSpeed = 2.5 * (camera.top - camera.bottom) / camera.zoom;
        touchVelocity.set((target.x - x) / seconds, 0, (target.z - z) / seconds).clampLength(0, maxSpeed);
        gesture.time = e.timeStamp;
      }
    } else if (previous) {
      const next = [...pointers.values()];
      const center = midpoint(next);
      pan(midpoint(previous), center);
      const d = distance(previous);
      if (d > 0) {
        desiredZoom = clampZoom(camera.zoom * distance(next) / d);
        applyZoom(desiredZoom, center);
        orient();
      }
    }
  });
  function release(e, cancelled = false) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
    if (!pointers.size) {
      const tap = !cancelled && gesture && gesture.id === e.pointerId && !gesture.moved && !gesture.multiple && gesture.button === 0;
      if (!cancelled && gesture?.touch && gesture.moved && !gesture.multiple && !reducedMotion.matches && e.timeStamp - gesture.time <= 80) {
        inertia.copy(touchVelocity);
      }
      gesture = null; element.style.cursor = 'grab';
      if (tap) onTap(e.clientX, e.clientY);
    }
  }
  listen(element, 'pointerup', e => release(e));
  listen(element, 'pointercancel', e => release(e, true));
  listen(element, 'lostpointercapture', e => release(e, true));
  listen(element, 'pointerleave', () => onHover(null));
  listen(element, 'contextmenu', e => e.preventDefault());
  listen(element, 'wheel', e => {
    e.preventDefault();
    const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? element.clientHeight : 1);
    zoom(Math.exp(-THREE.MathUtils.clamp(pixels, -400, 400) * .0018), { x: e.clientX, y: e.clientY });
  }, { passive: false });
  listen(window, 'keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
    if (['q', 'e', '+', '=', '-', '_', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'q' || e.key === 'e') { if (!e.repeat) rotate(e.key === 'q' ? -1 : 1); }
      else if (['+', '=', '-', '_'].includes(e.key)) zoom(['+', '='].includes(e.key) ? 1.3 : 1 / 1.3);
      else {
        interact(); cancel();
        const rect = element.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
        pan({ x, y }, { x: x + (e.key === 'ArrowLeft' ? 56 : e.key === 'ArrowRight' ? -56 : 0), y: y + (e.key === 'ArrowUp' ? 56 : e.key === 'ArrowDown' ? -56 : 0) });
        changed();
      }
    }
  });
  listen(window, 'hashchange', () => {
    const saved = readCameraHash(location.hash, hashZoom());
    if (saved) { interact(); view(saved, true); flushHash(); }
  });
  listen(window, 'blur', () => {
    gesture = null; inertia.set(0, 0, 0);
    for (const id of pointers.keys()) if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    pointers.clear(); onHover(null); element.style.cursor = 'grab';
  });
  listen(window, 'pagehide', flushHash);
  element.style.cursor = 'grab';
  element.tabIndex = 0;
  element.setAttribute('aria-label', 'Thistlebrook town map. Drag or use arrow keys to pan, plus and minus to zoom, Q and E to rotate. Use Meet a neighbour to explore residents.');
  orient();
  return { target, update, view, zoom, rotate, cancel, state, groundAt, flushHash, destination:()=>destination,
    panning: () => Boolean(gesture?.touch && (gesture.moved || gesture.multiple)),
    restore() { const saved = readCameraHash(location.hash, hashZoom()); if (saved) view(saved, true); return Boolean(saved); },
    dispose() { disposers.forEach(fn => fn()); clearTimeout(hashTimer); pointers.clear(); },
  };
}
