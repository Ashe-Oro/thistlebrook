/** Choose geometry by zoom and map distance, with hysteresis for small pans. */
export function createModelDetail(initial, {deferFull = false} = {}) {
  let view = initial, interactive = false;
  const models = new Set();
  const pending = new Set();

  function wantsFull(model,point=view) {
    if (deferFull || point.zoom < (model.full ? 1.05 : 1.2)) return false;
    const range = (model.full ? 205 : 175) / Math.sqrt(point.zoom);
    const centres = typeof model.centres === 'function' ? model.centres() : model.centres;
    return centres.some(([x,z]) => Math.hypot(x-point.x,z-point.z) <= range);
  }

  function loadFull(model) {
    if (model.task) return;
    model.task = Promise.resolve().then(model.load).then(high => {
      model.high = high;
      if (model.full && !interactive) model.apply(high);
    }).catch(error => console.warn('Full-detail model unavailable', error)).finally(() => pending.delete(model.task));
    pending.add(model.task);
  }

  function refresh(model) {
    model.full = wantsFull(model);
    if (!model.full || interactive) model.apply(model.low);
    else if (model.high) model.apply(model.high);
    else loadFull(model);
  }

  function update(next) {
    view = next;
    for (const model of models) {
      if (model.full !== wantsFull(model)) refresh(model);
    }
  }

  return {
    track(centres, low, load, apply) {
      const model = {centres,low,load,apply,full:false};
      models.add(model);
      refresh(model);
    },
    update,
    setInteractive(value) {
      if (interactive === value) return;
      interactive = value;
      // The lightweight geometry is already loaded. Reuse it while the
      // camera is moving and restore the selected detail when the drag ends.
      for (const model of models) if (model.full) refresh(model);
    },
    start() {
      if (!deferFull) return;
      deferFull = false;
      update(view);
    },
    preload(point) {
      for (const model of models) {
        if (wantsFull(model,point)) loadFull(model);
      }
    },
    async settled() {
      while (pending.size) await Promise.all(pending);
    },
  };
}

let currentDetail;
export function setModelDetail(detail) { currentDetail = detail; }
export function modelDetail() { return currentDetail; }

export const lodUrl = path => typeof window === 'undefined' ? undefined :
  window.__modelLods?.[new URL(path,location.href).pathname];

const bindings = new WeakMap();
/** Geometry bindings survive static batching without changing the draw count. */
export function bindMeshDetail(detail, centres, mesh, load) {
  const meshes = new Set([mesh]);
  const low = mesh.geometry;
  let current = low;
  const binding = {
    add(target) { meshes.add(target); bindings.set(target,binding); target.geometry = current; },
  };
  bindings.set(mesh,binding);
  detail.track(centres,low,load,geometry => {
    if (!geometry || geometry === current) return;
    current = geometry;
    for (const object of meshes) {
      object.geometry = geometry;
      if (object.isInstancedMesh) object.boundingBox = object.boundingSphere = null;
    }
  });
}

export function inheritMeshDetail(source, target) {
  bindings.get(source)?.add(target);
}

export function hasMeshDetail(mesh) {
  return bindings.has(mesh);
}
