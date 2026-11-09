// Viewer "god powers". Each one is just a perturbation; the villagers' own brains do the rest.
import * as THREE from 'three';
import type { Sim } from './sim';
import type { Item } from './types';
import { makeCarry } from '../agents/props';

export function dropGift(sim: Sim, x?: number, z?: number) {
  if (x === undefined || z === undefined) { x = -9 + sim.rng.range(-5, 5); z = 4 + sim.rng.range(-2, 4); }
  [x, z] = sim.world.nav.nearestFree(x, z);
  const obj = makeCarry('gift'); obj.scale.setScalar(2.2); obj.position.set(x, 9, z); sim.world.scene.add(obj);
  const g = { x, z, obj, claimedBy: null as string | null, t: 0 }; sim.gifts.push(g);
  sim.world.fx.sparkle(x, 1, z, [1, .85, .4], 30);
  sim.log('A glittering gift box fell from the sky into the village!', 6, [], 'god', '🎁', x, z);
  // greedy and nearby villagers race for it
  const racers = sim.villagers.filter(v => !v.inside && v.doing !== 'sleeping' && v.act?.type !== 'fight' && Math.hypot(v.x - x!, v.z - z!) < 45 && (v.traits.greed > .35 || sim.rng.chance(.4)));
  for (const v of racers) { v.act = null; v.queue = [{ type: 'claim', gift: g, run: true, t: 0, label: 'racing for the gift!' }]; v.thought = 'Is that... a present?!'; sim.leaveSeat(v); sim.icon(v, '❗'); }
  if (racers.length >= 2) sim.log(`${racers.map(r => r.first).join(', ')} dropped everything and raced for it!`, 5, racers.map(r => r.id), 'god', '🏃', x, z);
  return g;
}
export function animateGifts(sim: Sim, dt: number) {
  for (const g of sim.gifts) { if (g.obj.position.y > .35) { g.obj.position.y = Math.max(.35, g.obj.position.y - dt * 9); if (g.obj.position.y === .35) sim.world.fx.dust(g.x, g.z, 10, .7); } g.obj.rotation.y += dt * 1.5; if (!g.claimedBy && Math.random() < dt * 3) sim.world.fx.sparkle(g.x, .6, g.z, [1, .85, .4], 1); }
  sim.gifts = sim.gifts.filter(g => { if (g.claimedBy && g.obj.parent) { g.obj.parent.remove(g.obj); } return !g.claimedBy; });
}
export function summonRain(sim: Sim) { sim.startRain(150, true); }
export async function spawnMerchant(sim: Sim) {
  if (sim.merchantUntil > sim.clock) return; sim.merchantUntil = sim.clock + 360; await sim.world.setMerchant(true);
  sim.world.places.set('cart', { id: 'cart', kind: 'market', name: 'the merchant\u2019s cart', x: -19.3, z: 6.8, cx: -21, cz: 5, enterable: false, district: 'old-town', inside: new Set(), smokeUntil: 0 });
  sim.log('A travelling merchant\u2019s cart rattled into the plaza. Exotic wares! Generous prices!', 6, [], 'merchant', '🛒', -21, 5);
  for (const v of sim.villagers) { const goods = (['wood', 'ore', 'wheat', 'eggs', 'apples', 'tools'] as Item[]).filter(i => v.inv[i] > 0); if (!goods.length || v.inside || v.traits.greed + (v.goal === 'wealth' ? .3 : 0) < .45) continue;
    v.act = null; v.queue = [{ type: 'trade_market', place: 'cart', sell: goods.map(i => [i, v.inv[i]]), buy: v.goal === 'wealth' || v.goal === 'power' ? [['trinket', 1]] : [], t: 0, label: 'hurrying to the merchant', run: true, off: sim.rng.range(-1, 1) }]; v.thought = 'The merchant pays double! Quick!'; sim.icon(v, '🤑'); }
  sim.stock.trinket += 3;
}
export function tickMerchant(sim: Sim) { if (sim.merchantUntil && sim.clock > sim.merchantUntil) { sim.merchantUntil = 0; sim.world.setMerchant(false); sim.world.places.delete('cart'); sim.log('The travelling merchant packed up and rolled on down the road.', 3, [], 'merchant', '👋', -21, 5); } }
export async function startFestival(sim: Sim) {
  if (sim.festivalUntil > sim.clock) return; await sim.world.setFestival(true); sim.festivalUntil = sim.clock + 200;
  const host = [...sim.villagers].sort((a, b) => sim.popularity(b) - sim.popularity(a))[0];
  const p = sim.scheduleParty(host, 'the Thistlebrook Festival', 'plaza', sim.clock + 10, 180);
  for (const v of sim.villagers) { sim.learnFact(v, p.fact); p.invited.add(v.id); if (v.doing === 'sleeping') continue; sim.icon(v, '🎪'); }
  sim.log(`Festival! Bunting went up over the plaza and ${host.first} was chosen to lead the dancing.`, 7, [host.id], 'festival', '🎪', -9, 5);
}
export function tickFestival(sim: Sim) { if (sim.festivalUntil && sim.clock > sim.festivalUntil) { sim.festivalUntil = 0; sim.world.setFestival(false); } }
export { THREE };
