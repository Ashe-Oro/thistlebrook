import { checkAstra, distanceToSegment } from '../compiler/astra.js';

export const HARBOR_VIEWS = {
  harbor: { x: 62, z: 51, zoom: 2.25 },
  beach: { x: 36, z: 57, zoom: 4.3 },
  pier: { x: 76, z: 64, zoom: 3.8 },
};

// An additive extension: the original compiler, island and node IDs stay intact.
// All public paths meet at explicit endpoints; water routes are private to swimmers.
export function addHarbor(town) {
  if (town.harbor) return town;
  const node = p => {
    let i = town.nodes.findIndex(v => Math.hypot(v[0] - p[0], v[1] - p[1]) < .015);
    if (i < 0) { i = town.nodes.length; town.nodes.push(p); town.edges.push([]); }
    return i;
  };
  const anchor = town.nodes.findIndex(p => Math.hypot(p[0] - 46, p[1] - 30) < .015);
  if (anchor < 0) throw Error('Saltwind Harbor needs the Lantern Quay landing at [46, 30]');
  const roads = [];
  const path = (points, width = 2.2, owner = 'harbor') => {
    for (let i = 1; i < points.length; i++) {
      const a = node(points[i - 1]), b = node(points[i]);
      if (!town.edges[a].includes(b)) town.edges[a].push(b);
      if (!town.edges[b].includes(a)) town.edges[b].push(a);
      const road = { a: points[i - 1], b: points[i], width, kind: 'boardwalk', owner };
      town.roads.push(road); roads.push(road);
    }
  };
  path([[46,30],[46,43]]);
  path([[27,43],[35,43],[46,43],[57,43],[70,43],[83,43],[91,43]], 3.6);
  path([[70,43],[70,51],[70,59],[70,69]], 3.2, 'venue:harbor-pier');
  path([[70,59],[76,59]], 2, 'venue:harbor-pier');
  path([[70,69],[64,69]], 2, 'venue:harbor-pier');
  path([[35,43],[35,50],[35,56]], 1.8, 'venue:harbor-beach');
  path([[57,43],[57,40.5]], 1.6, 'venue:harbor-market');
  path([[83,43],[83,39.5]], 1.6, 'venue:harbor-boathouses');
  path([[91,43],[91,49]], 1.8, 'venue:harbor-lighthouse');
  const specs = [
    ['market','Saltwind Fish Market',[57,38],[50,34],[64,41],[57,40.5],6,'The day’s catch comes up from the pier in wooden crates. The striped counters open at seven; by lunchtime the fishers are mending their nets.'],
    ['boathouses','The Net Loft & Boatworks',[81,36],[73,30],[88,40],[83,39.5],7,'Two weatherboard sheds, a boat under repair, drying nets and a kettle by the door. The boatwright walks down to check the moorings.'],
    ['pier','Gullwatch Fishing Pier',[70,64],[62,52],[78,72],[70,69],.35,'Lines go out at dawn. Later, fishers carry the catch to the market along the same boardwalk used by the rest of town.'],
    ['beach','Shell Cove',[35,56],[25,51],[47,61],[35,56],.3,'A sheltered swimming cove. Swimmers walk down from the changing huts, enter through the shallows and return to shore as the evening cools.'],
    ['lighthouse','Saltwind Light',[91,51],[87.5,48],[95,55],[91,49],13,'A warm light above the breakwater. At dusk its lantern turns across the harbor, while the keeper makes an evening round.'],
  ];
  const venues = specs.map(([id,name,pos,min,max,entry,height,story]) => ({
    id: 'harbor-' + id, type: 'harbor-' + id, district: 'harbor', name, pos,
    box: { min, max }, entry, height, story, node: node(entry),
  }));
  town.venues.push(...venues);
  town.districts.push({ id: 'harbor', name: 'Saltwind Harbor', type: 'waterfront', center: [62,51] });
  // Clear only the approach canopy where the new lane leaves the old island.
  town.trees = town.trees.filter(t => distanceToSegment(t.pos,[46,30],[46,43]) > 2.5*t.scale+1.2);
  town.harbor = {
    anchor, roads, venues, bounds: { minX: 16, maxX: 111, minZ: 27, maxZ: 91 },
    nodes: Object.fromEntries(Object.entries({
      gateway:[46,43],market:[57,40.5],loft:[83,39.5],pier:[70,69],
      fishingWest:[64,69],fishingEast:[76,59],landing:[70,51],
      beach:[35,56],changing:[35,50],promenade:[27,43],light:[91,49],
    }).map(([key,p]) => [key,node(p)])),
  };
  town.report = checkAstra(town);
  if (!town.report.ok) throw Error(town.report.errors.join('; '));
  return town;
}

export function harborPeriod(hour) {
  return hour >= 5 && hour < 9 ? 'dawn' : hour >= 9 && hour < 12 ? 'landing' : hour >= 12 && hour < 18 ? 'afternoon' : 'night';
}
