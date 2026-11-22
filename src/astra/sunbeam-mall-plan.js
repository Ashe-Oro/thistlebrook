// Local coordinates, shared by the renderer, lamp registry and clearance tests.
import { SUNBEAM_MALL } from './sunbeam-layout.js';

const { axisX, clearWidth } = SUNBEAM_MALL;
const bay = (kind, dx, z, size, details = {}) => ({
  kind, pos: [axisX + dx, z], size, ...details,
});
const seat = (z, role) => ({ offset: [0, z], yaw: z < 0 ? 0 : Math.PI, role });
const chess = (dx, z, roles) => bay('chess', dx, z, [1.62, 2.9], {
  seats: [seat(-1.01, roles[0]), seat(1.01, roles[1])],
});
const cafe = (z, color, roles) => bay('cafe', -4.95, z, [2.3, 2.5], {
  color, seats: [seat(-.83, roles[0]), seat(.83, roles[1])],
});

export const SUNBEAM_PAVING_Y = .16;
export const SUNBEAM_GLOBE_HEIGHT = 2.86;

export const SUNBEAM_FURNISHINGS = [
  ...[-85.4, -72.45, -51.95, -39.3].map(z => bay('tree-planter', -4.95, z, [2.45, 2.2])),
  ...[-84.65, -71.9, -58.15, -44.5].map(z => bay('tree-planter', 4.95, z, [2.45, 2.2])),
  ...[-77.95, -46.35].map(z => bay('bench', -5.42, z, [.64, 1.52], { yaw: Math.PI / 2 })),
  ...[-82.45, -42.55].map(z => bay('bench', 5.42, z, [.64, 1.52], { yaw: -Math.PI / 2 })),
  ...[-79.75, -70.85, -53.9, -44.9].map(z => bay('lamp', -3.58, z, [.48, .48])),
  ...[-80.1, -69.1, -56.25, -37.3].map(z => bay('lamp', 3.58, z, [.48, .48])),
  chess(-4.8, -65.85, ['elder', 'shopkeeper']),
  chess(4.8, -64.05, ['herbalist', 'farmhand']),
  cafe(-60.3, '#cf765c', ['herbalist', 'shopkeeper']),
  cafe(-57.7, '#759e9c', ['elder']),
  bay('kiosk', 5.05, -77.65, [2.7, 2.9]),
  bay('performer', 5.05, -51.4, [2.75, 2.5]),
];

const seats = SUNBEAM_FURNISHINGS.flatMap((spot, index) => (spot.seats || []).flatMap((slot, i) => {
  if (!slot.role) return [];
  return [{
    role: slot.role, activity: spot.kind, seated: true, table: index, seat: i,
    pos: spot.pos.map((v, axis) => v + slot.offset[axis]), yaw: slot.yaw,
  }];
}));

export const SUNBEAM_AMBIENT = [
  ...seats,
  { role: 'farmhand', activity: 'performer', pos: [axisX + 5.34, -51.4], yaw: -Math.PI / 2 },
  { role: 'shopkeeper', activity: 'audience', pos: [axisX + 3.7, -52.22], yaw: 1.1 },
  { role: 'herbalist', activity: 'window-shopping', pos: [axisX + 5.83, -69.55], yaw: Math.PI / 2 },
  { role: 'elder', activity: 'window-shopping', pos: [axisX - 5.85, -74.08], yaw: -Math.PI / 2 },
  ...['herbalist', 'shopkeeper', 'farmhand', 'elder', 'herbalist', 'shopkeeper'].map((role, i) => ({
    role, activity: 'stroll', pos: [axisX + (i % 2 ? clearWidth * .19 : -clearWidth * .19), -61.5],
    phase: [0.25, -.38, -.82, 1.03, 2.3, 4.45][i], yaw: 0,
  })),
];

export function sunbeamDaytime(hour) {
  return hour >= 7 && hour < 21;
}
