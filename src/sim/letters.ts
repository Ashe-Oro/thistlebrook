import type { Sim } from './sim';
import type { Villager } from './types';
import { letterText } from './lines';
import { bump } from './social';

export type LetterKind = 'love' | 'apology' | 'thanks' | 'invite' | 'prank' | 'farewell' | 'board';
export interface Letter {
  id: string; from: string; to: string; kind: LetterKind; unsigned: boolean; text: string;
  written: number; delivered?: number; read?: number; event?: number; readers: string[];
  place: string; context: string; factId?: string;
}
/* Six opportunities per day; missed opportunities never accumulate into a burst. All state is plain save data. */
export function tickLetters(sim: Sim) {
  if (sim.clock >= sim.nextLetterAt && sim.hour >= 7 && sim.hour < 21) {
    sim.nextLetterAt = sim.clock + sim.rng.range(220, 340);
    const writers = sim.villagers.filter(v => !v.inside && !v.act?.locked && sim.clock >= v.busyUntil && v.needs.food > 30 && v.needs.energy > 30 && !sim.letterArchive.some(l => l.from === v.id && l.delivered === undefined));
    if (writers.length) write(sim, sim.rng.pick(writers));
  }
  for (const l of sim.letterArchive) {
    const writer = sim.byId.get(l.from); if (!writer) continue;
    if (l.delivered === undefined) {
      const p = sim.place(l.place);
      if (!writer.inside && Math.hypot(writer.x - p.x, writer.z - p.z) < 1.7) {
        l.delivered = sim.clock;
        const ev = sim.log(l.kind === 'board' ? `${writer.first} pinned a handwritten note on the notice board.` : `${writer.first} slipped a handwritten envelope through ${sim.byId.get(l.to)!.first}'s door.`, 3, [writer.id, ...(l.to ? [l.to] : [])], 'letter', '✉️'); l.event = ev.id; sim.letterEvents[ev.id] = l.id;
      } else if (!writer.act && !writer.queue.length && !writer.inside && sim.hour >= 7 && sim.hour < 21) route(sim, writer, l);
      continue;
    }
    if (sim.clock - l.delivered < 25) continue;
    const readers = l.to ? [sim.byId.get(l.to)!] : sim.villagers.filter(v => v.id !== l.from && !v.inside && Math.hypot(v.x - sim.place(l.place).x, v.z - sim.place(l.place).z) < 6);
    for (const v of readers) {
      if (!v || l.readers.includes(v.id) || (l.to && l.read !== undefined) || v.inside || sim.clock < v.busyUntil || v.act?.locked || !['idle', 'sit', undefined].includes(v.act?.type)) continue;
      l.readers.push(v.id); l.read ??= sim.clock;
      v.queue.unshift({ type: 'idle', t: 0, dur: 10, label: 'reading a letter', locked: true });
      const curious = l.unsigned, emoji = curious ? '🤔' : l.kind === 'farewell' ? '🥲' : l.kind === 'love' ? '💗' : '💌';
      v.emotions[curious ? 'surprise' : l.kind === 'farewell' ? 'sadness' : 'joy'] = .7;
      if (!curious) { bump(sim, v, writer, l.kind === 'apology' ? 7 : l.kind === 'love' ? 6 : 3); if (l.kind === 'apology') v.emotions.anger *= .5; }
      v.mem.add(sim.clock, curious ? 'An unsigned note! Who could have written it?' : `Read ${writer.first}'s ${l.kind} note: ${l.context}`, 5, curious ? [] : [writer.id], .3, 'heard');
      if (l.factId) { const f = writer.mem.known.get(l.factId); if (f) v.mem.learn(f); const p = sim.parties.find(p => p.id === l.factId); if (p) { v.mem.learn(p.fact); p.invited.add(v.id); } }
      if (curious) { const f = sim.fact('news', `${v.first} received a mysterious unsigned ${l.kind === 'prank' ? 'prank' : 'admiration'} note`, v.id, v.id, .1, 5); v.mem.learn(f); }
      sim.icon(v, emoji); sim.emit('convo', [{ who: v.id, text: curious ? 'Who could this be from…?' : 'A little letter, just for me.', emoji, at: sim.clock }]);
      const ev = sim.log(`${v.first} read ${curious ? 'an unsigned' : writer.first + "’s"} handwritten note.`, 4, curious ? [v.id] : [v.id, writer.id], 'letter', '✉️');
      sim.emit('letterRead', l, v); l.event = ev.id; sim.letterEvents[ev.id] = l.id;
    }
    if (l.event !== undefined) sim.letterEvents[l.event] = l.id;
  }
}
function route(sim: Sim, v: Villager, l: Letter) {
  const p = sim.place(l.place), [x, z] = sim.world.nav.nearestFree(p.x, p.z + .4);
  v.queue.unshift({ type: 'go', t: 0, label: l.kind === 'board' ? 'pinning a village note' : 'delivering a handwritten letter', x, z, locked: true });
}
function write(sim: Sim, v: Villager) {
  const choices: { to: Villager; kind: LetterKind; context: string; factId?: string; score: number }[] = [];
  for (const t of sim.villagers) { if (v === t) continue;
    const add = (kind: LetterKind, context: string, score: number, factId?: string) => { if (!sim.letterArchive.some(l => l.from === v.id && l.to === (kind === 'board' ? '' : t.id) && l.kind === kind && sim.clock - l.written < 2880)) choices.push({ to: t, kind, context, score: score + sim.rng.range(0, 1), factId }); };
    if (v.crush === t.id && !v.partner && !v.family.includes(t.id)) add('love', 'I have a quiet crush on you.', 2 + (1 - v.traits.bravery));
    const facts = [...v.mem.known.values()].filter(f => sim.clock - f.t < 2880 && (f.target === t.id || f.actor === t.id));
    const gift = facts.find(f => f.actor === t.id && f.target === v.id && /gave/.test(f.text)); if (gift) add('thanks', gift.text, 3, gift.id);
    const spat = sim.arguedAt[sim.pairKey(v.id, t.id)]; if (spat !== undefined && sim.clock - spat < 2880 && sim.clock - spat > 60 && v.traits.kindness > .45) { const f = facts.find(f => /argu|row|shout/.test(f.text)); add('apology', f?.text ?? [...sim.events].reverse().find(e => e.kind === 'argue' && e.actors.includes(v.id) && e.actors.includes(t.id))?.text ?? 'We had a spat.', 2.5 + (1 - v.traits.bravery), f?.id); }
    const rejection = facts.find(f => f.actor === v.id && f.target === t.id && /turned down|broke up/.test(f.text)); if (rejection && v.heartbreak > sim.clock) add('farewell', rejection.text, 3, rejection.id);
    const party = sim.parties.find(p => !p.done && p.at > sim.clock + 60 && v.mem.known.has(p.id) && !t.mem.known.has(p.id)); if (party) add('invite', party.title, 3, party.id);
    if (v.traits.honesty < .55) add('prank', `For ${t.first}: the village ducks have appointed you their honorary mayor.`, .2);
    if ((v.opinion[t.id] ?? 0) > 20) add('board', `A little appreciation for ${t.first}, our ${t.job}.`, .1);
  }
  choices.sort((a, b) => b.score - a.score); const c = choices[0]; if (!c) return;
  const unsigned = c.kind === 'prank' || c.kind === 'love' && v.traits.bravery < .6;
  const l: Letter = { id: `note-${sim.letterSerial++}`, from: v.id, to: c.kind === 'board' ? '' : c.to.id, kind: c.kind, unsigned, context: c.context, factId: c.factId, written: sim.clock, readers: [], place: c.kind === 'board' ? 'notices' : c.to.def.home, text: letterText(sim, v, c.to, c.kind, c.context, unsigned) };
  sim.letterArchive.push(l); route(sim, v, l);
}
