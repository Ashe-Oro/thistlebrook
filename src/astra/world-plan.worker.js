import {compileWorld} from '../compiler/world-plan.js';
import {resolveAll} from '../catalog/resolve-all.js';
import bounds from '../catalog/bounds.json';

self.addEventListener('message', ({data:seed}) => {
 const town=compileWorld(resolveAll(bounds),seed,{onPlan:plan=>self.postMessage({plan})});
 self.postMessage({town});
});
