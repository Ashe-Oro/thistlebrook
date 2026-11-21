#!/usr/bin/env node
import {NodeIO, PropertyType} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup, dequantize, draco, getBounds, simplify, weld} from '@gltf-transform/functions';
import {MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier} from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';

const root = fileURLToPath(new URL('../',import.meta.url));
const cache = join(root,'public/licensed/fast-load/lod');
const VERSION = 'lod-v1';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const triangles = doc => doc.getRoot().listMeshes().reduce((total,mesh) => total + mesh.listPrimitives()
  .reduce((count,prim) => count + (prim.getMode() === 4 ? (prim.getIndices()||prim.getAttribute('POSITION')).getCount()/3 : 0),0),0);
const permissive = {
  ...MeshoptSimplifier,
  simplify(indices, positions, stride, count, error, flags) {
    return MeshoptSimplifier.simplify(indices,positions,stride,count,error,[...(flags||[]),'Permissive']);
  },
};

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry => {
    const path = join(dir,entry.name);
    return entry.isDirectory() ? walk(path) : path.endsWith('.glb') ? [path] : [];
  });
}

async function build(entries) {
  await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready,MeshoptSimplifier.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.encoder':await draco3d.createEncoderModule(),
    'draco3d.decoder':await draco3d.createDecoderModule(),
    'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder,
  });
  const results = {};
  for (const [url,file] of entries) {
    const raw = readFileSync(file);
    const key = hash(Buffer.concat([Buffer.from(VERSION),raw]));
    const meta = join(cache,key+'.json');
    if (existsSync(meta)) {
      const saved = JSON.parse(readFileSync(meta,'utf8'));
      if (saved) results[url] = saved;
      continue;
    }
    let result = null;
    try {
      const doc = await io.readBinary(raw);
      const asset = doc.getRoot();
      const before = triangles(doc);
      if (before >= 2200 && !asset.listSkins().length && !asset.listAnimations().length && !asset.listTextures().length
          && !asset.listMeshes().some(mesh => mesh.listPrimitives().some(prim => prim.listTargets().length))) {
        const scene = asset.getDefaultScene() || asset.listScenes()[0];
        const original = getBounds(scene);
        const meshCount = asset.listMeshes().length;
        const primitives = asset.listMeshes().map(mesh => mesh.listPrimitives().length).join(',');
        // Preserve the boundaries of individual primitives and all authored
        // node transforms. Permissive collapse handles flat-shaded seams.
        await doc.transform(dequantize(),weld(),simplify({simplifier:permissive,ratio:.25,error:.008,lockBorder:false}));
        const after = triangles(doc);
        const reduced = getBounds(scene);
        const span = Math.max(...original.max.map((v,i) => v-original.min[i]));
        const within = ['min','max'].every(end => original[end].every((v,i) => Math.abs(v-reduced[end][i]) <= span*.018));
        if (after <= before*.75 && within && asset.listMeshes().length === meshCount
            && asset.listMeshes().map(mesh => mesh.listPrimitives().length).join(',') === primitives) {
          asset.listExtensionsUsed().find(ext => ext.extensionName === 'EXT_meshopt_compression')?.dispose();
          await doc.transform(dedup({propertyTypes:[PropertyType.ACCESSOR,PropertyType.MESH,PropertyType.TEXTURE]}),
            draco({quantizePosition:13,quantizeNormal:9,quantizeTexcoord:12,quantizeColor:8,quantizationVolume:'scene'}));
          const bytes = await io.writeBinary(doc);
          if (bytes.length < raw.length*.8) {
            const name = hash(bytes).slice(0,24)+'.glb';
            writeFileSync(join(cache,name),bytes);
            result = {name,before,after,bytes:bytes.length};
          }
        }
      }
    } catch (error) {
      console.warn(url,error.message);
    }
    writeFileSync(meta,JSON.stringify(result));
    if (result) results[url] = result;
  }
  return results;
}

export async function buildModelLods(dist,{jobs=4}={}) {
  mkdirSync(cache,{recursive:true});
  const entries = ['licensed','owned-assets'].flatMap(sub => walk(join(dist,sub))).map(file => [
    '/'+file.slice(dist.length+1).split('/').map(encodeURIComponent).join('/'),file,
  ]).filter(([url,file]) => !url.includes('/characters/') && !url.includes('/fast-load/') && statSync(file).size >= 15000);
  const unique = new Map();
  for (const entry of entries) {
    const key = hash(readFileSync(entry[1]));
    if (!unique.has(key)) unique.set(key,[]);
    unique.get(key).push(entry);
  }
  const buckets = Array.from({length:jobs},()=>[]);
  [...unique.values()].forEach(([entry],i) => buckets[i%jobs].push(entry));
  const results = Object.assign({},...await Promise.all(buckets.filter(bucket=>bucket.length).map(bucket => new Promise((done,fail) => {
    const worker = new Worker(new URL(import.meta.url),{workerData:bucket});
    worker.once('message',done);
    worker.once('error',fail);
    worker.once('exit',code => {if (code) fail(new Error('LOD worker exited '+code));});
  }))));
  const files = {};
  for (const [[canonical],...aliases] of unique.values()) {
    if (!results[canonical]) continue;
    for (const [url] of aliases) results[url] = results[canonical];
    const {name} = results[canonical];
    files[name] = join(cache,name);
  }
  return {results,files};
}

if (!isMainThread) parentPort.postMessage(await build(workerData));
else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] || 'dist');
  const mapFile = resolve(process.argv[3] || 'out/model-lods.json');
  mkdirSync(dirname(mapFile),{recursive:true});
  const {results} = await buildModelLods(dist);
  writeFileSync(mapFile,JSON.stringify(results,null,2)+'\n');
  console.log(Object.keys(results).length+' LOD routes');
}
