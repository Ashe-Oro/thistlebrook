import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));
const cache = new Map<string, Promise<THREE.Object3D>>();
const sharedMat = new Map<THREE.Material, THREE.Material>(); const byLook = new Map<string, THREE.Material>();
// Packs ship one vertex-coloured material; swap to Lambert (cheap, matches flat look, good on phones).
function prep(root: THREE.Object3D) {
  root.traverse((m: any) => {
    if (!m.isMesh) return;
    const src = m.material as THREE.MeshStandardMaterial;
    let mat = sharedMat.get(src);
    // dedupe by look, not by source object: identical materials across packs collapse to one, so static scenery can be merged
    const look = `${!!m.geometry.attributes.color}|${src.color?.getHexString?.() ?? 'fff'}|${src.map?.uuid ?? ''}|${!!src.transparent}|${src.opacity ?? 1}`;
    if (!mat) mat = byLook.get(look);
    if (!mat) { mat = new THREE.MeshLambertMaterial({ vertexColors: !!m.geometry.attributes.color, color: src.color ?? 0xffffff, map: src.map ?? null, flatShading: true, transparent: src.transparent, opacity: src.opacity }); sharedMat.set(src, mat); byLook.set(look, mat); }
    sharedMat.set(src, mat);
    m.material = mat; m.castShadow = true; m.receiveShadow = true;
  });
  return root;
}
export function loadAsset(key: string): Promise<THREE.Object3D> {
  let p = cache.get(key);
  if (!p) { const [pack, name] = key.split('/'); p = loader.loadAsync(`/glb/${pack}/${name}.glb`).then(g => prep(g.scene)); cache.set(key, p); }
  return p.then(o => o.clone());
}
export async function preload(keys: string[], onProgress?: (n: number, total: number) => void) {
  let n = 0; await Promise.all([...new Set(keys)].map(k => loadAsset(k).then(() => onProgress?.(++n, keys.length))));
}
