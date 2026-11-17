// Reuses the established exporter without modifying the art-owned generator.
// All output is confined to the gitignored licensed library.
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { TOWNSFOLK_VARIANTS } from '../src/catalog/townsfolk-variants.js';
const root=new URL('../',import.meta.url).pathname;
const dest=root+'public/licensed/characters/variety/';
mkdirSync(dest,{recursive:true});
// Keep the same baked relaxed pose, role tools, facial marks and export recipe.
let source=readFileSync(new URL('./generate-townsfolk.mjs',import.meta.url),'utf8');
const replaceRequired=(before,after)=>{if(!source.includes(before))throw Error('Art exporter changed; expected '+before);source=source.replaceAll(before,after);};
replaceRequired("import { TOWNSFOLK as VILLAGERS } from '${root}src/catalog/townsfolk.js';", "import { TOWNSFOLK_VARIANTS as VILLAGERS } from '${root}src/catalog/townsfolk-variants.js';");
replaceRequired("const dest=root+'public/licensed/characters/';", "const dest=root+'public/licensed/characters/variety/';");
replaceRequired("v.role==='elder'?'#aaa69d':'#252321'",'v.hairColor');
replaceRequired("v.id+'.glb'", "v.role+'.glb'");
// Bundle the adapted script in tools so package resolution stays in this worktree.
const file=new URL('./.building-variety-generator.mjs',import.meta.url).pathname;
writeFileSync(file,source);
try { await import(file+'?v='+Date.now()); } finally { rmSync(file,{force:true}); }
const io=new NodeIO(),bounds={};
for(const v of TOWNSFOLK_VARIANTS){
 const doc=await io.read(root+'public/'+v.path), {min,max}=getBounds(doc.getRoot().listScenes()[0]);
 let tris=0;for(const m of doc.getRoot().listMeshes())for(const p of m.listPrimitives())tris+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;
 bounds[v.variantId]={min,max,tris,base:{min:[min[0],min[2]],max:[max[0],max[2]]},roof:null};
}
writeFileSync(new URL('../src/catalog/building-variety-bounds.json',import.meta.url),JSON.stringify(bounds,null,2)+'\n');
