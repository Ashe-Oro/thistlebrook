// Westward expansion. Called before reservations and graph compilation so
// these workplaces obey the same collision and connectivity rules as town.
export function addWorkingDistrict(town, road) {
 town.districts.push({id:'works',name:'West Works',type:'industry',center:[-80,-69]});
 const venues=[
  {id:'work-station',name:'Thistlebrook Union Station',type:'station',pos:[-91,-83],box:{min:[-112,-101],max:[-77,-73]},entry:[-88,-77],height:9,story:'The local pulls in beside the old clock tower. Neighbours walk here from Main Street; the platform fills before the morning shift. The train pauses, then heads back along the branch line.'},
  {id:'work-farm',name:'Sunward Market Gardens',type:'market-garden',pos:[-96,-51],box:{min:[-112,-66],max:[-80,-38]},entry:[-95,-59],height:6,story:'Clover and Tilly grow vegetables for the town. Raised beds, a glasshouse and a packing shed keep the local market supplied. Produce accumulates while the gardeners are here, ready for the next freight collection.'},
  {id:'work-timber',name:'Rowan & Co. Timber Works',type:'timber',pos:[-61,-51],box:{min:[-76,-66],max:[-46,-38]},entry:[-63,-59],height:8,story:'Logs arrive at the yard; sawn boards leave for repairs around Thistlebrook. Rowan and Bram walk in for the day shift. The saw runs while the workshop is staffed, with a lunch break at noon.'},
  {id:'work-depot',name:'West Freight Exchange',type:'freight',pos:[-60,-83],box:{min:[-74,-101],max:[-46,-73]},entry:[-60,-77],height:8,story:'Hazel sorts the garden crates and timber orders. Every train departure collects up to eight ready loads when the exchange is staffed. The counters show work actually done and goods actually dispatched during this visit.'},
 ];
 town.venues.push(...venues.map(v=>({...v,district:'works',access:[v.entry[0],-69]})));
 road([-111,-69],[-42,-69],3,'avenue');
 road([-42,-69],[-42,-33],2.2);
 // Platform track stays separate from the pedestrian graph.
 town.workRail={minX:-112,maxX:-47,z:-96};
 // Separate standing places keep colleagues visible, connected by short
 // paths inside their employer's reserved parcel.
 town.workstations=[
  {name:'Clover',venue:'work-farm',entry:[-96,-59]},
  {name:'Tilly',venue:'work-farm',entry:[-94,-59]},
  {name:'Rowan',venue:'work-timber',entry:[-65,-58]},
  {name:'Bram',venue:'work-timber',entry:[-62,-59]},
  {name:'Hazel',venue:'work-depot',entry:[-60,-77]},
  {name:'Hugh',venue:'work-station',entry:[-88,-77]},
 ];
 for(const spot of town.workstations){const venue=venues.find(v=>v.id===spot.venue);road(venue.entry,spot.entry,.8,'venue','venue:'+venue.id);}
}

export const WORK_ASSIGNMENTS={
 Bram:'work-timber',Rowan:'work-timber',Clover:'work-farm',Tilly:'work-farm',Hazel:'work-depot',Hugh:'work-station',
};
export function workPeriod(hour){return hour>=7&&hour<12?'morning':hour>=12&&hour<13?'lunch':hour>=13&&hour<17?'afternoon':'home';}
export function workDestination(person,town,hour){
 if(!person.workplace)return null;
 const period=workPeriod(hour);
 if(period==='home')return town.buildings.find(b=>b.node===person.home);
 if(period==='lunch')return town.venues.find(v=>v.id==='fountain');
 return person.workplace;
}
// A branch-line shuttle: ease into the platform, dwell, depart, and return.
// At both turnarounds the entire train remains on the owned rail corridor.
export function trainState(time,hour){
 const phase=((time%100)+100)%100,open=hour>=6&&hour<21;
 const smooth=t=>t*t*(3-2*t);
 const x=phase<24?-94:phase<50?-94+36*smooth((phase-24)/26):phase<64?-58:-58-36*smooth((phase-64)/36);
 return {x:open?x:-58,phase,open,atPlatform:open&&phase<24,departed:open&&phase>=24,direction:phase<64?1:-1};
}
