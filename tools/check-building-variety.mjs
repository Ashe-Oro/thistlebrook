// Namespaced additive checks; frozen fixtures are read-only.
import assert from 'node:assert/strict';
import { readFileSync,existsSync,mkdirSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { validateSpec } from '../src/compiler/spec.js';
import { compileTown } from '../src/compiler/compile.js';
import { TOWNSFOLK } from '../src/catalog/townsfolk.js';
import { TOWNSFOLK_VARIANTS } from '../src/catalog/townsfolk-variants.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const catalog=resolveAll(read('src/catalog/bounds.json'));
const frozen=read('tools/fixtures/pre-villagers-defaults.sha256.json'),hashes={};
for(const size of ['hamlet','large'])for(const seed of [1,7,1234]){
 const spec=validateSpec(read(`specs/${size}.json`),catalog);
 const json=JSON.stringify(compileTown(spec,catalog,{seed}));
 const key=size+seed,hash=createHash('sha256').update(json).digest('hex');
 assert.equal(hash,frozen[key],key+' frozen life-off JSON');hashes[key]=hash;
}
assert.deepEqual(TOWNSFOLK_VARIANTS.map(v=>v.id).sort(),TOWNSFOLK.map(v=>v.id).sort());
assert.equal(new Set(TOWNSFOLK_VARIANTS.map(v=>v.variantId)).size,12);
const bounds=read('src/catalog/building-variety-bounds.json');
for(const v of TOWNSFOLK_VARIANTS){
 assert(existsSync(new URL('../public/'+v.path,import.meta.url)),v.path);
 const b=bounds[v.variantId];assert(b.tris>0);assert(b.max[1]-b.min[1]>.9);assert(b.max[0]-b.min[0]<1.5);
 assert(!/edo|samurai|miko/.test(v.path));
}
mkdirSync(new URL('../out/',import.meta.url),{recursive:true});
writeFileSync(new URL('../out/building-variety-hashes.json',import.meta.url),JSON.stringify(hashes,null,2)+'\n');
console.log('building-variety: all six life-off hashes match frozen fixtures; twelve unique owned wardrobe models exist with measured bounds');
