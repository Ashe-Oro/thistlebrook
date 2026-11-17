import { DISTRICT_OFFSETS } from '../compiler/astra-placement.js';
// Authored local district data. The shared placement transform moves these
// parcels and their rendered courtyard west of Civic Green.
export const SUNBEAM_VIEW = { x: -60 + DISTRICT_OFFSETS.sunbeam[0], z: -52, zoom: 3.1 };
export const SUNBEAM_RESIDENTS = [
  { name: 'Nell', role: 'Corner grocer', model: 'merchant', home: 0, story: 'Lives above the shop. Keeps a spare key for half the terrace, and always rounds up the cherries.' },
  { name: 'Otis', role: 'Night-shift nurse', model: 'watch', home: 1, story: 'The blue shutters mean he is sleeping. In the afternoon he tends the shared herb beds.' },
  { name: 'Cleo', role: 'Laundry keeper', model: 'innkeeper', home: 5, story: 'Knows whose socks are whose. The laundry doubles as the neighbourhood meeting room.' },
  { name: 'Rafi', role: 'School student', model: 'child', home: 2, story: 'Holds the terrace hopscotch record. Takes the long way to school to count the sunflowers.' },
  { name: 'Mae', role: 'Retired seamstress', model: 'elder', home: 3, story: 'Mends a sleeve, lends a book, remembers every birthday on the row.' },
  { name: 'Sol', role: 'Bicycle repairer', model: 'carpenter', home: 6, story: 'Fixes the neighbours’ bikes on the doorstep. Payment in home-grown tomatoes is accepted.' },
  { name: 'Zara', role: 'Illustrator', model: 'herbalist', home: 7, story: 'Draws the town from her balcony. The washing line keeps appearing in every picture.' },
  { name: 'Emil', role: 'Music teacher', model: 'shopkeeper', home: 8, story: 'The upstairs piano is a little out of tune. Nobody on the terrace seems to mind.' },
];

export function addSunbeamLayout(town) {
  town.districts.push({ id: 'sunbeam', name: 'Sunbeam Terrace', type: 'neighbourhood', center: [-61,-52] });
  const road = (a,b,width=2.2,kind='lane',owner=null) => town.roads.push({a,b,width,kind,owner});
  road([-77,-52],[-40,-52],3);
  road([-40,-52],[-40,-33]); road([-61,-52],[-61,-33]); road([-61,-33],[-34,-33]);
  const palette = ['#d7a453','#c88472','#90ac9f','#d8b68b','#99a8bd','#91aaa0','#ddb269','#c48f82','#a7b69b'];
  const names = ['Nell’s Corner & upstairs flats','No. 2 · The Blue Shutters','No. 3 · Sunflower House','No. 4 · The Mending Room','No. 5 · Skylark House','The Washhouse & upstairs flats','No. 7 · Spoke House','No. 8 · The Drawing Room','No. 9 · Piano House'];
  const positions = [[-73,-62],[-67,-62],[-61,-62],[-55,-62],[-49,-62],[-73,-42],[-67,-42],[-55,-42],[-49,-42]];
  positions.forEach(([x,z],i) => {
    const front = i<5?1:-1, key=`sunbeam-${i}`, door=[x+.95*front,z+3.1*front], approach=[door[0],z+4.5*front], join=[door[0],-52];
    const shop=i===0?'grocer':i===5?'laundry':null;
    town.buildings.push({key,id:'sunbeam-rowhouse',custom:true,name:names[i],pos:[x,z],rot:front===1?0:Math.PI,box:{min:[x-2.85,z-3.25],max:[x+2.85,z+3.25]},door,approach,join,kind:'home',district:'sunbeam',color:palette[i],height:8.4+(i%3)*.35,shop,
      story:shop==='grocer'?'Two homes above Nell’s corner grocer. Fruit crates on the pavement, a striped awning, and a spare key behind the counter.':shop==='laundry'?'Two upstairs homes and a shared washhouse below. Bring a basket; leave with the latest news. On sunny days the whole court smells of clean sheets.':'One of Sunbeam’s narrow, three-storey terrace houses. Two households share a front door, a flower-filled balcony, and the little pedestrian court outside.'});
    road(door,approach,1.25,'door',key); road(approach,join,1.25,'door',key);
  });
  // Reserve the complete furnished court and margins against random foliage.
  // Building and street checks still use each real footprint above.
  return {min:[-79,-69],max:[-43,-34]};
}
