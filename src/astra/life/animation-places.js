import { cozyBenchSeats } from '../registry/asset-points.js';

export const CAFE_COUNTER = { x: 1.75, z: 4.1, width: 1.6, depth: .66 };

export function cafeFrontage(building) {
  const { x, z, width, depth } = CAFE_COUNTER;
  const yaw = building.rot, sin = Math.sin(yaw), cos = Math.cos(yaw);
  const point = (u, v) => [building.pos[0] + u * cos + v * sin, building.pos[1] - u * sin + v * cos];
  const side = x - width / 2 - .55;
  return {
    version: 1, activity: 'work', label: 'Counter service at Corner Cup Café',
    tools: ['work', 'buy', 'sell', 'payBill', 'eat', 'rest', 'visit'], duration: 24,
    minParticipants: 1, entryNode: building.node, hours: [0, 24], approach: [],
    slots: [
      { id: 'service', role: 'service', kind: 'standing', animation: 'work', counter: true,
        position: point(x, z - depth / 2 - .43), facing: yaw, approach: [point(side, z - depth / 2 - .43)] },
      { id: 'customer', role: 'customer', kind: 'standing', animation: 'idle', counter: true,
        position: point(x, z + depth / 2 + .47), facing: yaw + Math.PI,
        approach: [point(side, z - depth / 2 - .43), point(side, z + depth / 2 + .47)] },
    ],
  };
}

export function fountainBenches(town) {
  const plaza = town.venues.find(v => v.id === 'fountain');
  if (!plaza) return [];
  const [x, z] = plaza.pos;
  return (town.supplemental || []).filter(p => p.key.startsWith('fountain-bench-')).map(p => {
    const side = Math.sign(p.pos[0] - x), lane = x + side * 3.55;
    const slots = cozyBenchSeats(p).map(({ candidate, enabled, ...slot }) => ({
      ...slot, groundHeight: .19, approach: [[lane, slot.position[1]], ...slot.approach],
    }));
    const tools = ['rest', 'eat', 'visit'];
    return {
      id: 'life:' + p.key, name: 'Founders Fountain bench', kind: 'prop', district: 'downtown',
      node: plaza.node, pos: p.pos, capabilities: ['walkTo', ...tools], hours: [0, 24],
      interaction: { version: 1, activity: 'sit', label: 'Resting by the fountain', tools, duration: 24,
        minParticipants: 1, entryNode: plaza.node, approach: [[lane, z + 5]], slots, hours: [0, 24] },
    };
  });
}

export function playReservation(town) {
  const venue = town.venues.find(v => v.type === 'playground');
  if (!venue) return null;
  const [x, z] = venue.pos;
  const tools = ['visit'];
  return { id: 'life:playground', name: 'Little Oak play area', kind: 'prop',
    node: venue.node, pos: [x,z], capabilities: ['walkTo', ...tools], hours: [7, 20],
    interaction: { version: 1, activity: 'play', label: 'Playing at Little Oak', tools, duration: 28,
      minParticipants: 1, entryNode: venue.node, hours: [7,20], approach: [[x,z+6]],
      slots: [{ id: 'play', kind: 'standing', position: [x,z+4.6], groundHeight: .14,
        facing: 0, animation: 'idle', approach: [] }] },
  };
}
