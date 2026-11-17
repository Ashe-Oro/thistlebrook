import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {compileWorld} from '../src/compiler/world-plan.js';
import {registryCoverage} from '../src/astra/registry/coverage.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const seed=Number(process.argv.find(arg=>arg.startsWith('--seed='))?.slice(7)??831);
if(!Number.isFinite(seed))throw Error('Seed must be finite');
const town=compileWorld(catalog,seed);
const coverage=registryCoverage(town,catalog);
mkdirSync('out/astra',{recursive:true});
writeFileSync(`out/astra/registry-${seed}.json`,JSON.stringify(town.registry,null,2)+'\n');
writeFileSync(`out/astra/registry-coverage-${seed}.json`,JSON.stringify(coverage,null,2)+'\n');
if(process.argv.includes('--write-doc')){
 const path='docs/REGISTRY-INVENTORY.md',marker='\n## Exact logical placements for seed 831\n';
 const intro=readFileSync(path,'utf8').split(marker)[0];
 if(seed!==831)throw Error('Documentation reference seed must be 831');
 const escape=s=>String(s??'—').replaceAll('|','\\|').replaceAll('\n',' ');
 const rows=town.registry.places.map(p=>`| ${[p.id,p.name,p.asset||'procedural / area',p.district,p.interaction?'enabled: '+p.interaction.activity:p.activity?'disabled: '+p.activity.activity:'entry node '+p.node].map(escape).join(' | ')} |`);
 const summary=`\n## Eighteen-district coverage\n\nSeed ${seed}: **${coverage.registeredModels}/${coverage.placedModels} placed models** and **${coverage.registeredLogicalPlacements}/${coverage.logicalPlacements} logical placements** registered. ${coverage.places} total place records. ${coverage.usedOwnedModels}/${coverage.ownedModels} owned GLBs used as scenery; ${coverage.unusedIndividualModels}/${coverage.ownedIndividualModels} individual assets remain unused. Actors are excluded from scenery utilization; 94 authoring/prebuilt/whole-pack references are not prop candidates.\n\n| District | Placed models | Registered | Activity places | Slots |\n| --- | ---: | ---: | ---: | ---: |\n`+coverage.perDistrict.map(d=>`| ${d.district} | ${d.placedModels} | ${d.registeredModels} | ${d.executableActivities} | ${d.slots} |`).join('\n')+`\n\nThe complete unused list (including reference records) is reproducible in \`out/astra/registry-coverage-${seed}.json\`. See [merge notes](MERGE-sol-registry2.md) for interaction controllers, access policies, capture regeneration, and renderer coverage.\n`;
 const packTable='| Pack | Individual models | Used | Unused |\n| --- | ---: | ---: | ---: |\n'+coverage.perPack.map(p=>`| ${p.pack} | ${p.individualModels} | ${p.usedIndividuals} | ${p.unusedIndividuals} |`).join('\n');
 const unusedRows=coverage.unused.map(a=>`| ${a.id} | ${a.kind} | ${a.category} |`).join('\n');
 writeFileSync('docs/REGISTRY-UNUSED-ASSETS.md',`# Owned assets unused as placed scenery\n\nSeed ${seed}: ${coverage.unusedOwnedModels}/${coverage.ownedModels} measured GLBs are unused as scenery, including ${coverage.unusedIndividualModels} individual models and 94 reference/authoring scenes. Generated resident wardrobe variants are actors and are excluded from this scenery metric. All assets retain size, type, family and interaction templates in the owned catalog; unused does not mean untagged.\n\nRegenerate with \`npm run inventory:astra:registry -- --write-doc\`. Alternate OBJ/FBX exports are aliases of their GLB and are not extra placement candidates.\n\n${packTable}\n\nSee [asset lane merge notes](MERGE-sol-assets.md) for the before/after comparison and new vignettes.\n\n| Owned model | Kind | Type |\n| --- | --- | --- |\n`+unusedRows+'\n');
 writeFileSync(path,intro.split('\n## Eighteen-district coverage')[0]+summary+marker+`\nGenerated with \`npm run inventory:astra:registry -- --write-doc\`. ${rows.length} logical records; individual mesh pieces inherit their assembly ID. Rejected placement candidates are absent. Seed-dependent scatter is enumerated here at the reference seed; the base registry tests sweep 100 seeds and expansion tests cover seven varied seeds.\n\n| Registry ID | Human name | Model / construction | District | Access / activity |\n| --- | --- | --- | --- | --- |\n`+rows.join('\n')+'\n');
}
console.log(JSON.stringify({...coverage,unused:undefined},null,2));
console.log(`${town.registry.places.length} placements → out/astra/registry-${seed}.json`);
