// One GLTFLoader setup for every model in the town. Deploy builds compress
// pack GLBs (tools/compress-dist-glbs.mjs) with Draco or EXT_meshopt_compression,
// picked per asset, so every loader must be able to decode both. A single
// DRACOLoader also keeps the decoder worker pool shared instead of one pool
// per district.
import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

let draco = null;
function sharedDraco() {
  draco ??= new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  return draco;
}

// Deploy builds inline window.__assetAliases (tools/prepare-deploy-dist.mjs):
// byte-identical models published under two URLs resolve to one, so the
// browser fetches and decodes each once. Dev servers have no map.
let manager = null;
function sharedManager() {
  if (manager) return manager;
  manager = new LoadingManager();
  const aliases = (typeof window !== 'undefined' && window.__assetAliases) || null;
  if (aliases && Object.keys(aliases).length) {
    manager.setURLModifier((url) => {
      try {
        const u = new URL(url, location.href);
        const target = aliases[u.pathname];
        return target ? new URL(target, u).href : url;
      } catch { return url; }
    });
  }
  return manager;
}

/** A GLTFLoader that understands KHR_draco_mesh_compression and EXT_meshopt_compression. */
export function createGLTFLoader() {
  return new GLTFLoader(sharedManager()).setDRACOLoader(sharedDraco()).setMeshoptDecoder(MeshoptDecoder);
}
