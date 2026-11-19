import {concertHours, FESTIVAL_ENTRY} from '../astra/festival-plan.js';

// Fairground parcels and circulation are independent of render geometry.
// Monday=0. The town starts on Friday; weekends are deliberately busier.
export const FAIR_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const FAIR_VIEW = { x: -61, z: -68, zoom: 2.15 };
export function fairSchedule(day, hour) {
  const weekend = ((day % 7) + 7) % 7 >= 5;
  const open = hour >= (weekend ? 11 : 15) && hour < 22;
  const peak = weekend && hour >= 13 && hour < 21;
  const [start, end] = concertHours(weekend);
  return { weekend, open, peak, visitors: hour < 7 || hour >= 23 ? 0 : peak ? 30 : open ? (weekend ? 20 : 12) : 5,
    concert: open && hour >= start && hour < end };
}
export function addFairground(town) {
  // Fill the former northwest notch, preserving the existing town bounds.
  town.outline = [[-80,-104], ...town.outline.slice(1,4)];
  town.districts.push({ id:'fair', name:'Merrymead Park', type:'recreation', center:[-61,-68] });
  // Reserve the whole designed park against the compiler's random foliage.
  town.civicAprons.push({min:[-79,-103],max:[-41,-35]});
  const venue = (id,name,type,pos,min,max,entry,access,height,story) => ({id:'fair-'+id,name,type,district:'fair',pos,box:{min,max},entry,access,height,story});
  town.venues.push(
    venue('wheel','The Little Skywheel','fair-wheel',[-64,-91],[-74,-100],[-55,-81],[-59,-84],[-59,-79],19,'A slow turn above the treetops. The queue follows the railings; the little gondolas stay upright all the way around. Rides open at eleven on weekends and three on weekdays.'),
    venue('carousel','Meadow Carousel','fair-carousel',[-50,-68],[-57,-76],[-44,-60],[-50,-61.5],[-50,-57],7,'Painted ponies, a striped canopy and one more turn before tea. Families gather by the entrance while the carousel circles the green.'),
    venue('pond','Willow Duck Pond','fair-pond',[-67,-68],[-76,-76],[-59,-60],[-63,-61.5],[-63,-57],2,'A quiet bank for watching the ducks. Paths go around the water, with room to stop and watch a small flotilla pass the reeds.'),
    venue('picnic','Clover Picnic Lawn','fair-picnic',[-49,-91],[-54,-100],[-44,-81],[-50,-84],[-50,-79],2,'Bring something from the food stands and settle under the orchard trees. The picnic lawn fills up on Saturday and Sunday afternoons.'),
    venue('band','Merrymead Bandshell','fair-band',[-67,-44],[-76,-53],[-59,-38],FESTIVAL_ENTRY,[-74,-57],7,'An open-air stage and a little listening lawn. Weekend sets begin at four; weekday music starts at six. Neighbours drift in from the midway to listen.'),
    venue('food','The Picnic Pantry','fair-food',[-49,-46],[-56,-54],[-44,-38],[-50,-53],[-50,-57],4,'Lemonade, warm buns and strawberry scoops. Stop at the counter, then take the long way back past the pond. Open with the rides until ten.')
  );
  const road=(a,b,width=2.2)=>town.roads.push({a,b,width,kind:'park',owner:null});
  for(const z of [-102,-79,-57,-36])road([-77.5,z],[-42,z]);
  for(const x of [-77.5,-42])road([x,-102],[x,-36]);
  road([-42,-36],[-42,-33]);road([-42,-33],[-34,-33]);
  road([-42,-57],[-38,-57],1.8);road([-38,-57],[-38,-69],1.8);road([-38,-69],[-36,-69],1.8);
}
