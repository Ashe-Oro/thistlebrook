// Assemble content-addressed model files for deployment and a private source
// tree for the model pack. No model payload is stored in tracked files.
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join,relative} from 'node:path';
import {buildModelLods} from './build-model-lods.mjs';
import {externalizeBasis} from './model-textures.mjs';

const identity = bytes => createHash('sha256').update(bytes).digest('hex').slice(0,24);
function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const file=join(dir,entry.name);
    return entry.isDirectory()?files(file):[file];
  });
}

export async function stageFastLoad(dist,licensedRoot) {
  const publish = join(licensedRoot,'fast-load/publish');
  const modelDir = join(dist,'models');
  mkdirSync(modelDir,{recursive:true});
  const original = {};
  const aliases = {}, variants = {}, artifacts = {};
  function addFile(name,bytes) {
    const file = join(modelDir,name);
    if (!existsSync(file)) writeFileSync(file,bytes);
    artifacts[name] = bytes.byteLength;
  }
  const {results,files:lods} = await buildModelLods(dist);
  for (const [name,file] of Object.entries(lods)) addFile(name,readFileSync(file));
  for (const [url,{name}] of Object.entries(results)) variants[url] = '/models/'+name;
  rmSync(publish,{recursive:true,force:true});
  for (const sub of ['licensed','owned-assets']) {
    cpSync(join(dist,sub),join(publish,sub),{recursive:true,dereference:true});
    for (const file of files(join(dist,sub)).filter(file=>file.endsWith('.glb')).sort()) {
      const path=relative(dist,file), url='/'+path.split('/').map(encodeURIComponent).join('/');
      const source=readFileSync(file);
      const bytes=externalizeBasis(source,addFile);
      const name=identity(bytes)+'.glb';
      addFile(name,bytes);
      original[url]={bytes:source.length,full:'/models/'+name,lod:variants[url]};
      aliases[url]='/models/'+name;
      rmSync(file);
    }
  }

  const basis = Object.keys(artifacts).some(name=>name.endsWith('.ktx2'));
  if (basis) {
    const basisRoot=new URL('../node_modules/three/examples/jsm/libs/basis/',import.meta.url);
    mkdirSync(join(dist,'basis'),{recursive:true});
    for(const name of ['basis_transcoder.js','basis_transcoder.wasm']) cpSync(new URL(name,basisRoot),join(dist,'basis',name));
  }
  const runtime = {aliases,variants,basis};
  const script = '<script id="asset-aliases">window.__assetAliases='+JSON.stringify(aliases)
    +';window.__modelLods='+JSON.stringify(variants)
    +';window.__districtStreaming=true;window.__basisTextures='+basis+';</script>';
  for(const file of files(dist).filter(file=>file.endsWith('.html'))){
    const html=readFileSync(file,'utf8').replace(/<script id="asset-aliases">[\s\S]*?<\/script>\n?/,'');
    writeFileSync(file,html.replace('<head>','<head>\n    '+script));
  }

  cpSync(modelDir,join(publish,'models'),{recursive:true});
  writeFileSync(join(publish,'routes.json'),JSON.stringify(runtime));
  return {original,artifacts};
}
