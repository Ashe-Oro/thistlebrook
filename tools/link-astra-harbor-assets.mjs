// This creates only a private, gitignored link. Never copy the GLB into a build.
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { dirname } from 'node:path';
const source='/workspace/threejs-assets/nature/bundle/glb/individual/rowboat.glb';
const target=new URL('../public/licensed/nature/rowboat.glb',import.meta.url);
if(!existsSync(source))throw Error('Owned Nature pack is missing: '+source);
if(!existsSync(target)){mkdirSync(dirname(target.pathname),{recursive:true});symlinkSync(source,target);}
console.log('Saltwind rowboat available through the private asset mapping.');
