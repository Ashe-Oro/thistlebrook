// Decoders and URL mapping are shared by all town model loaders.
import {BufferAttribute, LoadingManager} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

let draco, manager, basis;
const textureLoaders = new Set();
const BASE = import.meta.env?.BASE_URL ?? '/';

export function configureGLTFTextures(renderer) {
  if (typeof window === 'undefined' || !window.__basisTextures) return;
  basis ??= new KTX2Loader(sharedManager()).setTranscoderPath(BASE+'basis/').detectSupport(renderer);
  for (const loader of textureLoaders) loader.setKTX2Loader(basis);
  textureLoaders.clear();
}

function sharedManager() {
  if (manager) return manager;
  manager = new LoadingManager();
  const aliases = typeof window !== 'undefined' && window.__assetAliases;
  if (aliases) manager.setURLModifier(url => {
    const source = new URL(url,location.href);
    const target = source.origin === location.origin && aliases[source.pathname];
    return target ? new URL(target,source).href : url;
  });
  return manager;
}

/** CPU geometry consumers can read or transform these attributes as floats.
 * Keep the glTF node transform, including the quantized position scale. */
function unpackAttributes(scene) {
  scene.traverse(object => {
    if (!object.isMesh) return;
    for (const name of ['position','normal','uv','uv1','uv2','uv3']) {
      const attribute = object.geometry.getAttribute(name);
      if (!attribute || (attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array) instanceof Float32Array) continue;
      const values = new Float32Array(attribute.count*attribute.itemSize);
      for (let i=0;i<attribute.count;i++) {
        for (let k=0;k<attribute.itemSize;k++) values[i*attribute.itemSize+k] = attribute.getComponent(i,k);
      }
      object.geometry.setAttribute(name,new BufferAttribute(values,attribute.itemSize));
    }
  });
}

export function createGLTFLoader() {
  draco ??= new DRACOLoader().setDecoderPath(BASE+'draco/').setWorkerLimit(2);
  const loader = new GLTFLoader(sharedManager()).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  loader.register(() => ({name:'town_float_attributes',afterRoot(result){result.scenes.forEach(unpackAttributes);}}));
  if (typeof window !== 'undefined' && window.__basisTextures) {
    loader.setResourcePath(location.origin+'/');
    if (basis) loader.setKTX2Loader(basis);
    else textureLoaders.add(loader);
  }
  return loader;
}
