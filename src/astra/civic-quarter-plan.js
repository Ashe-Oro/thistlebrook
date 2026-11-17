// Civic Green occupies the former northwest cutout. Keep its parcels, paths,
// and view together so this district can be merged independently of others.
export const CIVIC_VIEW = { x: -73, z: -69, zoom: 1.95 };
export function planCivicQuarter(town) {
  town.districts.push({id:'civic-green',name:'Civic Green',type:'public-services',center:[-73,-68]});
  const venues = [
    {id:'fire-station',name:'Station 01 · Astra Fire & Rescue',type:'fire-station',pos:[-91,-89],box:{min:[-100,-98],max:[-82,-80]},entry:[-88,-82],access:[-88,-77],height:11,story:'Ready around the clock. The red engine leaves for a small bin fire beside the police post, the crew makes the scene safe, then returns to its bay. The second crew keeps the station ready.'},
    {id:'clinic',name:'Willow Community Clinic',type:'clinic',pos:[-71,-90],box:{min:[-79,-98],max:[-63,-82]},entry:[-71,-83],access:[-71,-77],height:7,story:'Appointments, a familiar nurse, and a place to sit in the herb garden. A cream ambulance stands ready while the morning delivery brings fresh medical supplies.'},
    {id:'library',name:'Civic Library & Story Garden',type:'library',pos:[-52,-90],box:{min:[-61,-98],max:[-43,-81]},entry:[-52,-82],access:[-52,-77],height:9,story:'Borrow a book, return a book, stay for another chapter. Children walk over to the outdoor reading circle after school; the librarian has saved the big picture book for story time.'},
    {id:'police-post',name:'Civic Neighbourhood Police',type:'police-post',pos:[-91,-64],box:{min:[-100,-72],max:[-84,-55]},entry:[-85,-60],access:[-80,-60],height:7,story:'A small neighbourhood post with a bicycle patrol, a lost-and-found counter, and a blue patrol car. Officers make a regular round of the park and help the fire crew keep the avenue clear.'},
    {id:'civic-park',name:'Willow Park',type:'civic-park',pos:[-59,-54],box:{min:[-75,-71],max:[-43,-37]},entry:[-73,-54],access:[-80,-54],height:3,story:'A whole afternoon of green: a duck pond, a picnic lawn, a play garden, a walking circuit and an outdoor story circle. Joggers take the long way around while children follow the librarian from the library.'},
  ].map(v=>({...v,district:'civic-green'}));
  town.venues.push(...venues);
  const road=(a,b,width=2.4,kind='lane',owner=null)=>town.roads.push({a,b,width,kind,owner});
  road([-100,-77],[-43,-77],4.2,'avenue');
  road([-80,-77],[-80,-33],4.2,'avenue');
  road([-80,-52],[-94,-52],3.2,'lane');
  road([-80,-33],[-78,-33],3,'avenue');road([-78,-33],[-78,-16],3,'avenue');road([-78,-16],[-76,-16],3,'avenue');
  // A second, pedestrian connection joins the existing campus approach.
  road([-80,-33],[-34,-33],2.4);
  // Park paths are part of the shared navigation graph, not decorative shortcuts.
  const owner='venue:civic-park';
  for(const [a,b] of [ [[-73,-54],[-70,-54]], [[-70,-66],[-48,-66]], [[-48,-66],[-48,-42]], [[-48,-42],[-70,-42]], [[-70,-42],[-70,-66]], [[-70,-54],[-48,-54]] ])road(a,b,1.6,'lane',owner);
}
