// Copies the owned City and Nature pack GLBs used by the vehicle & street
// variety lane into the private, gitignored public/licensed folder. Never commit
// the GLBs; deploy them through `npm run deploy:dist` + `npm run models:upload`.
// Archived release: /workspace/threejs-packs/city/city-bundle-2026-08-27.zip.
import {copyFileSync, existsSync, mkdirSync} from 'node:fs';
const packs = {
  city: {from: '/workspace/threejs-packs/city/bundle/', files: ['LICENSE.txt', 'README.md', 'palettes.json', ...['car_sedan_01', 'taxi_01', 'city_bus_01', 'delivery_van_01', 'garbage_truck_01', 'bicycle_01', 'bus_shelter_01', 'street_lamp_01', 'bench_01', 'bike_rack_01', 'street_tree_01', 'street_sign_01', 'traffic_light_01', 'trash_bin_01'].map((f) => `glb/individual/${f}.glb`)]},
  nature: {from: '/workspace/threejs-assets/nature/bundle/glb/individual/', files: ['kayak.glb', 'canoe.glb']},
};
for (const [pack, {from, files}] of Object.entries(packs)) {
  const dir = new URL(`../public/licensed/${pack}/`, import.meta.url).pathname; mkdirSync(dir, {recursive: true});
  for (const f of files) { const src = from + f, dst = dir + f.split('/').pop(); if (!existsSync(src)) throw Error(`Owned ${pack} pack file missing: ${src}`); if (!existsSync(dst)) copyFileSync(src, dst); }
}
console.log('City and Nature vehicle-variety models available in public/licensed (gitignored).');
