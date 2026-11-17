import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {compileAstra} from '../src/compiler/astra.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
const args=process.argv.slice(2),value=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:Number(args[i+1]);};
const seed=value('--seed',831),sweep=value('--sweep',0);if(!Number.isFinite(seed)||!Number.isInteger(sweep)||sweep<0)throw Error('Use --seed NUMBER and --sweep NONNEGATIVE_INTEGER');
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
mkdirSync('out/astra',{recursive:true});
if(sweep){for(let i=0;i<sweep;i++)compileAstra(catalog,i);console.log(`${sweep}/${sweep} layouts passed: connected doors, street clearance and non-overlapping parcels.`);}else{const town=compileAstra(catalog,seed),path=`out/astra/town-${seed}.json`;writeFileSync(path,JSON.stringify(town,null,2));console.log(path,town.report);}
