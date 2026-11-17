import { workStatus } from './work-status.js';
const stories={
 'Flour & Fern':'Mabel opens the shutters early. Warm loaves leave the bakery throughout the morning.',
 'The Copper Kettle':'Rose keeps a warm table at the village inn. A place to eat, rest and begin the walk home.',
 'The Little Mill':'Grain from the surrounding farms becomes tomorrow’s bread. The sails turn above the lane.',
 'Bram’s Workshop':'Tools, repairs and careful metalwork beside Willowbank’s main lane.',
 'Astra Provisions':'Everyday supplies, packed lunches and a stop between errands.',
 'Sunrise Bakehouse':'Warm rolls in the morning, something sweet after school. The counter faces Main Street.',
 'Sole & Stitch':'Shoes for every walk around town, with repairs done at the back.',
 'The Reading Room':'An independent bookshop with a shelf for local stories.',
 'Corner Cup Café':'A favourite table overlooking the fountain.',
 'Petal & Stem':'Flowers for ordinary Tuesdays and very important Saturdays.',
 'Astra Town Hall':'Where this growing town makes its plans.',
 'The Post Office':'Letters, parcels and postcards from somewhere else.',
 'The Nightjar':'A little bar with a long playlist. The outside tables fill up as the lamps come on.',
 'The Lantern Room':'Dinner with friends, then a walk down to the riverside music.',
 'Moonrise Gelateria':'Scoops of strawberry, pistachio and a place to linger by the quay.',
};
const venues={school:'Classrooms, a clock tower and paths to every playing field. Students gather before lessons and practice.',baseball:'Bases, a pitching mound, outfield fence and a backstop. Neighbours arrive along the paths for batting practice.',football:'Home of the Astra Owls. Marked end zones, a scoreboard, bleachers and evening floodlights.',fountain:'People stop at the fountain between the bakery, shops and town hall.',tennis:'A rally on the common, with courtside seats for a slower afternoon.',basketball:'A pickup game on the neighbourhood court.',playground:'Swings, a slide and a busy little sandpit.',music:'The riverside stage comes alive after five.'};
export function placeInfo(record,town){
 const district=town.districts.find(d=>d.id===record.district)?.name||'Astra';
 return {name:record.name||'Around Astra',badge:district,story:record.description||record.story||stories[record.name]||venues[record.type]||(record.kind==='home'?'A home beside the lane, with neighbours heading out for work and returning after their errands.':`A place to visit in ${district}. Follow the paths to explore this part of town.`)};
}
export function worldMoment(town,world,tesla,target,zoom,view,hour){
 if(view==='village'||zoom<.5)return ['One connected little world',`${town.districts.length} districts, from the neighbourhood lanes to the coast and mountain pass.`];
 const p=[target.x,target.z],region=town.regions.find(r=>p[0]>=r.bounds.minX&&p[0]<=r.bounds.maxX&&p[1]>=r.bounds.minZ&&p[1]<=r.bounds.maxZ);
 const closest=town.districts.reduce((a,b)=>Math.hypot(p[0]-a.center[0],p[1]-a.center[1])<Math.hypot(p[0]-b.center[0],p[1]-b.center[1])?a:b);
 const id=region?.id||(Math.hypot(p[0]-closest.center[0],p[1]-closest.center[1])<70?closest.id:null);
 if(id==='starbase'){const s=world.expansions.starbase.audit();return[s.title,s.detail];}
 if(id==='works')return ['West Works',workStatus(world.works.audit(),hour)];
 if(id==='roadster')return ['Roadster Proving Ground',tesla.roadster.phase];
 if(id==='civic-green')return world.civicQuarter.moment();
 const moments={harbor:['Saltwind Harbor',hour<10?'Fishing boats on the water; shutters opening at the fish market.':'A walk along the quay, a paddle at Shell Cove, a light on the headland.'],fair:['Merrymead Park',world.expansions.fair.audit().schedule.open?'The rides are turning. Follow the midway past the pond and picnic lawn.':'A quiet walk by the pond. Rides open at three on weekdays and eleven on weekends.'],outskirts:['Stillwater & the Hinterlands','Cabins by the lake, a woodland walk and fields beyond the water.'],airport:['Astra Municipal Airport','Airliners, club planes and a helicopter follow their arrivals and departures.'],skatepark:['Switchyard Skate & Bike',hour>=6&&hour<22?'Taking turns in the bowl; another lap of the pump track.':'The park is resting. Riders return in the morning.'],themepark:['Pinecrest Adventure Park',hour>=19||hour<6?'The midway is lit: festoons over the stalls, neon on the arch and Copperhead running under the stars.':'Copperhead above the pines, queues at every ride and the smell of popcorn on the midway.'],'coral-coast':['Coral Coast',hour>=19?'Ocean Drive lights up. Rooftop tables fill above the palm promenade.':'Rolling surf, beach volleyball and a long walk beside the palms.'],works:['West Works','Grown here. Made here. Sent by rail.'],sunbeam:['Sunbeam Terrace','Front gardens, shared paths and neighbours coming home.'],downtown:['Around the town square','A fountain, small shops and room to stop between errands.'],common:['Astra High & the Common',hour>=15&&hour<22?'School is out. Practice and pickup games continue on the fields.':'Classrooms, playing fields and the paths between them.'],quay:['Lantern Quay',hour>=17?'Tables under the lights and music beside the river.':'A quiet riverside stroll before the evening crowd.'],market:['Market Square','Produce on the stalls and people passing between their daily errands.'],orchard:['Clover Fields','Farm lanes, orchard trees and ducks along the river.'],willowbank:['Willowbank','A neighbourhood of gardens, workshops and familiar paths.']};
 return moments[id]||['The road between places','Keep wandering. There is another part of town around the bend.'];
}
