import { DISTRICT_OFFSETS } from '../compiler/astra-placement.js';

export const SUNBEAM_MALL = Object.freeze({
  axisX: -61,
  north: -87,
  south: -36,
  clearWidth: 6,
  pavedWidth: 13.5,
});
export const SUNBEAM_NAME = 'Sunbeam Mall';

const { axisX, north, south, clearWidth } = SUNBEAM_MALL;
const centerZ = (north + south) / 2;
const rowCenters = [-82, -75.2, -68.4, -61.6, -54.8, -48, -41.2];

export const SUNBEAM_VIEW = { x: axisX + DISTRICT_OFFSETS.sunbeam[0], z: centerZ, zoom: 2.6 };
export const SUNBEAM_PHONE_VIEW = { ...SUNBEAM_VIEW, zoom: 3.7, elevation: 58 };

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

// The first nine entries keep the original resident home IDs.
const frontages = [
  { side: -1, row: 0, name: 'Nell’s Corner & upstairs flats', shopName: 'Nell’s Corner', shop: 'grocer', color: '#dbb56f', shopColor: '#547c66', storeys: 3 },
  { side: -1, row: 1, name: 'No. 2 · The Blue Shutters', shopName: 'Blue Shutter Books', shop: 'books', color: '#9cafcf', shopColor: '#496e89', storeys: 4 },
  { side: -1, row: 2, name: 'No. 3 · Sunflower House', shopName: 'Sunflower Sweets', shop: 'sweets', color: '#e2c182', shopColor: '#a76062', storeys: 3 },
  { side: -1, row: 3, name: 'No. 4 · The Mending Room', shopName: 'Linden Café', shop: 'cafe', color: '#da9e9c', shopColor: '#ab5350', storeys: 3 },
  { side: -1, row: 4, name: 'No. 5 · Skylark House', shopName: 'Skylark Stationery', shop: 'stationery', color: '#9eb4a7', shopColor: '#536e61', storeys: 4 },
  { side: 1, row: 0, name: 'The Washhouse & upstairs flats', shopName: 'The Washhouse', shop: 'laundry', color: '#95b4bb', shopColor: '#547e91', storeys: 3 },
  { side: 1, row: 1, name: 'No. 7 · Spoke House', shopName: 'Sol’s Cycle Repair', shop: 'cycles', color: '#e6bc82', shopColor: '#987050', storeys: 3 },
  { side: 1, row: 2, name: 'No. 8 · The Drawing Room', shopName: 'Golden Crumb Bakery', shop: 'bakery', color: '#cf9496', shopColor: '#985a65', storeys: 4 },
  { side: 1, row: 3, name: 'No. 9 · Piano House', shopName: 'Piano House Music', shop: 'music', color: '#a7b69b', shopColor: '#537060', storeys: 3 },
  { side: 1, row: 4, name: 'Salt & Stem Studios', shopName: 'Salt & Stem', shop: 'florist', color: '#b0abd0', shopColor: '#735d84', storeys: 3, upperUse: 'studios' },
  { side: 1, row: 5, name: 'Hearth House', shopName: 'Hearth Pottery', shop: 'pottery', color: '#e0a985', shopColor: '#9c6046', storeys: 4 },
  { side: -1, row: 5, name: 'Thimble House', shopName: 'Silver Thimble', shop: 'tailor', color: '#a1b6c9', shopColor: '#55778b', storeys: 5, upperUse: 'offices' },
  { side: -1, row: 6, name: 'Primrose House', shopName: 'Primrose Records', shop: 'records', color: '#d7a58e', shopColor: '#846849', storeys: 3 },
  { side: 1, row: 6, name: 'Heron House', shopName: 'Heron Fine Goods', shop: 'goods', color: '#a4b4c8', shopColor: '#586982', storeys: 3, upperUse: 'offices' },
];

const shopStories = {
  grocer: 'Nell lives above the corner grocer. Fruit crates sit under the striped awning, and she keeps a spare key for half the terrace.',
  laundry: 'Cleo lives above the shared washhouse. Bring a basket and leave with the latest news.',
  cafe: 'Mae lives upstairs. Linden Café serves coffee and cake under the red umbrellas on the promenade.',
};

export function addSunbeamLayout(town, { northStreet, southStreet }) {
  town.districts.push({ id: 'sunbeam', name: SUNBEAM_NAME, type: 'neighbourhood', center: [axisX, centerZ] });
  const road = (a, b, width, kind, owner = null) => town.roads.push({ a, b, width, kind, owner });
  road([axisX, north], [axisX, south], clearWidth, 'pedestrian');
  road([axisX, north], [axisX, northStreet], 1.8, 'pedestrian');
  road([axisX, south], [axisX, southStreet], 1.8, 'pedestrian');

  for (const [i, { side, row, ...frontage }] of frontages.entries()) {
    const x = axisX + 10 * side;
    const z = rowCenters[row];
    const key = 'sunbeam-' + i;
    const door = [x - 3.1 * side, z + .95 * side];
    const approach = [x - 4.5 * side, door[1]];
    const join = [axisX, door[1]];
    const upperUse = frontage.upperUse ?? 'flats';
    town.buildings.push({
      ...frontage, key, id: 'sunbeam-rowhouse', custom: true, pos: [x, z],
      rot: -side * Math.PI / 2,
      box: { min: [x - 3.25, z - 2.85], max: [x + 3.25, z + 2.85] },
      door, approach, join, kind: 'home', district: 'sunbeam',
      height: frontage.storeys * 2.65 + .5, upperUse,
      story: shopStories[frontage.shop] ?? `${frontage.shopName} opens onto Sunbeam Mall, with ${upperUse} on the floors above.`,
    });
    road(door, approach, 1.25, 'door', key);
    road(approach, join, 1.25, 'door', key);
  }

  return { min: [axisX - 14, north], max: [axisX + 14, south] };
}
