// Viewer "god powers". Each one is just a perturbation; the villagers' own brains do the rest.
import * as THREE from 'three';
import type { Sim } from './sim';
import type { Villager } from './types';
import { makeCarry } from '../agents/props';

export function dropGift(sim: Sim, x?: number, z?: number) {
  if (x === undefined || z === undefined) { x = -9 + sim.rng.range(-5, 5); z = 4 + sim.rng.range(-2, 4); }
  [x, z] = sim.world.nav.nearestFree(x, z);
  const obj = makeCarry('gift'); obj.scale.setScalar(2.2); obj.position.set(x, 9, z); sim.world.scene.add(obj);
  const g = { x, z, obj, claimedBy: null as string | null, t: 0 }; sim.gifts.push(g);
  sim.world.fx.sparkle(x, 1, z, [1, .85, .4], 30);
  sim.log('A glittering gift box fell from the sky into the village!', 6, [], 'god', '🎁', x, z);
  // greedy and nearby villagers race for it
  const racers = sim.villagers.filter(v => !v.inside && v.doing !== 'sleeping' && v.act?.type !== 'fight' && Math.hypot(v.x - x!, v.z - z!) < 45 && (v.traits.envy > .45 || sim.rng.chance(.4)));
  for (const v of racers) { v.act = null; v.queue = [{ type: 'claim', gift: g, run: true, t: 0, label: 'racing for the gift!' }]; v.thought = 'Is that... a present?!'; sim.leaveSeat(v); sim.icon(v, '❗'); }
  if (racers.length >= 2) sim.log(`${racers.map(r => r.first).join(', ')} dropped everything and raced for it!`, 5, racers.map(r => r.id), 'god', '🏃', x, z);
  return g;
}
export function animateGifts(sim: Sim, dt: number) {
  for (const g of sim.gifts) { if (g.obj.position.y > .35) { g.obj.position.y = Math.max(.35, g.obj.position.y - dt * 9); if (g.obj.position.y === .35) sim.world.fx.dust(g.x, g.z, 10, .7); } g.obj.rotation.y += dt * 1.5; if (!g.claimedBy && Math.random() < dt * 3) sim.world.fx.sparkle(g.x, .6, g.z, [1, .85, .4], 1); }
  sim.gifts = sim.gifts.filter(g => { if (g.claimedBy && g.obj.parent) { g.obj.parent.remove(g.obj); } return !g.claimedBy; });
}
export function summonRain(sim: Sim) { sim.startRain(150, true); }
// A travelling storyteller rolls in. Folk gather to hear her tales... and she has heard a few things about *them*.
export async function spawnTraveller(sim: Sim) {
  if (sim.visitorUntil > sim.clock) return; sim.visitorUntil = sim.clock + 300; await sim.world.setMerchant(true);
  sim.world.places.set('cart', { id: 'cart', kind: 'market', name: 'the storyteller\u2019s wagon', x: -18.9, z: 2.2, cx: -21.4, cz: 1.2, enterable: false, district: 'old-town', inside: new Set(), smokeUntil: 0 });
  sim.log('A travelling storyteller\u2019s wagon rattled into the plaza. Tales from far away, and gossip from close by!', 6, [], 'traveller', '🧳', -19, 2);
  // the juiciest true secret in the village (an unconfessed crush), else a tall tale about someone
  const pining = sim.villagers.filter(v => v.crush && !v.partner); const pv = pining.length ? sim.rng.pick(pining) : null;
  const subject = pv ?? sim.rng.pick(sim.villagers); const crushOf = pv ? sim.byId.get(pv.crush!)! : null;
  const f = sim.fact('deed', crushOf ? `${subject.first} is sweet on ${crushOf.first}` : `${subject.first} was once ${sim.rng.pick(['chased out of the capital by a goose', 'engaged to a duke', 'a famous juggler'])}`, subject.id, subject.id, crushOf ? .1 : 0, crushOf ? 8 : 5, crushOf?.id);
  if (crushOf) (f as any).romance = true; (f as any).label = 'the storyteller\u2019s tale';
  let told = false; const [cx, cz] = [-18.9, 2.2]; let slot = 0;
  for (const v of sim.villagers) {
    if (v.inside || v.doing === 'sleeping' || v.act?.locked || !(v.traits.sociability > .45 || sim.rng.chance(.4))) continue;
    const a = (slot % 5 - 2) * .42 + sim.rng.range(-.08, .08), r = 2.3 + Math.floor(slot / 5) * 1.1; slot++; const [x, z] = sim.world.nav.nearestFree(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
    v.act = null; sim.leaveSeat(v); v.thought = 'A storyteller! I love a good tale.'; sim.icon(v, '📜');
    v.queue = [{ type: 'go', x, z, t: 0, label: 'hurrying to hear the storyteller' }, { type: 'idle', anim: 'idle', dur: 40, face: Math.atan2(cx - x, cz - z), t: 0, label: 'listening to tall tales', after: () => {
      const isSubject = v === subject; v.emotions.joy += .3; v.needs.social = Math.min(100, v.needs.social + 25);
      if (isSubject && crushOf) { v.emotions.surprise = 1; v.emotions.sadness += .3; sim.say(v, 'How does she know that?!', '😳', 3); v.mem.add(sim.clock, `The storyteller told everyone I\u2019m sweet on ${crushOf.first}!`, 9, [crushOf.id], -.5, 'feeling'); }
      else if (sim.learnFact(v, f)) { v.mem.add(sim.clock, `The storyteller says ${f.text}`, f.imp, [subject.id], f.valence, 'heard', f.id); sim.say(v, crushOf && v === crushOf ? 'Wait... me?!' : sim.rng.pick(['Ooooh!', 'No way!', 'Ha!']), crushOf ? '😮' : '😄', 2.5); if (v === crushOf) { v.emotions.surprise = 1; v.emotions.love += .4; v.opinion[subject.id] = Math.min(100, (v.opinion[subject.id] ?? 0) + 6); } }
      if (!told) { told = true; sim.log(crushOf ? `The storyteller wove a ballad about a shy villager pining for ${crushOf.first}, and everybody knew exactly who she meant: ${subject.first}.` : `The storyteller swore that ${f.text}. Nobody knows whether to believe it.`, crushOf ? 8 : 5, crushOf ? [subject.id, crushOf.id] : [subject.id], 'traveller', '📜', cx, cz); }
    } } as any];
  }
}
export function tickTraveller(sim: Sim) { if (sim.visitorUntil && sim.clock > sim.visitorUntil) { sim.visitorUntil = 0; sim.world.setMerchant(false); sim.world.places.delete('cart'); sim.log('The storyteller packed up her wagon and rolled on, leaving a trail of whispers behind her.', 3, [], 'traveller', '👋', -19, 2); } }
export type { Villager };
export async function startFestival(sim: Sim) {
  if (sim.festivalUntil > sim.clock) return; await sim.world.setFestival(true); sim.festivalUntil = sim.clock + 200;
  const host = [...sim.villagers].sort((a, b) => sim.popularity(b) - sim.popularity(a))[0];
  const p = sim.scheduleParty(host, 'the Thistlebrook Festival', 'plaza', sim.clock + 10, 180);
  for (const v of sim.villagers) { sim.learnFact(v, p.fact); p.invited.add(v.id); if (v.doing === 'sleeping') continue; sim.icon(v, '🎪'); }
  sim.log(`Festival! Bunting went up over the plaza and ${host.first} was chosen to lead the dancing.`, 7, [host.id], 'festival', '🎪', -9, 5);
}
export function tickFestival(sim: Sim) { if (sim.festivalUntil && sim.clock > sim.festivalUntil) { sim.festivalUntil = 0; sim.world.setFestival(false); } }
export { THREE };
