// Optional LLM brain (OFF by default; no keys shipped). It keeps the utility AI for moment-to-moment
// motor decisions and asks a model for the Smallville "slow thinking": daily plans and reflections.
// Enable from the console:  terrarium.enableLLM({ endpoint: 'https://.../v1/chat/completions', model: '...', apiKey: '...' })
// (stored only in this browser's localStorage). Any OpenAI-compatible chat endpoint works.
import { UtilityBrain } from './brain';
import type { Sim } from './sim';
import type { Villager } from './types';
import { fmtTime } from '../core/util';
import { JOB_INFO, GOAL_LABEL } from '../data/villagers';

export interface LLMConfig { endpoint: string; model: string; apiKey?: string; maxCallsPerDay?: number; }

export function describeVillager(v: Villager, sim: Sim) {
  const t = v.traits, rel = sim.villagers.filter(u => u !== v).map(u => `${u.first} (${Math.round(v.opinion[u.id] ?? 0)})`).join(', ');
  return `You are ${v.name}, the ${JOB_INFO[v.job].label.toLowerCase()} of Thistlebrook (${v.def.age}). ${v.def.bio}
Life goal: ${GOAL_LABEL[v.goal]}. Traits (0-1): kindness ${t.kindness}, honesty ${t.honesty}, bravery ${t.bravery}, sociability ${t.sociability}, envy ${t.envy}, ambition ${t.ambition}, temper ${t.temper}.
Needs: hunger ${Math.round(100 - v.needs.food)}/100, energy ${Math.round(v.needs.energy)}/100, loneliness ${Math.round(100 - v.needs.social)}/100.
Keepsakes held: ${sim.holding(v).map(k => k.name).join(', ') || 'none'}${sim.missing(v) ? ` (yours is missing: ${sim.missing(v)!.name})` : ''}. ${v.partner ? `Sweetheart: ${sim.byId.get(v.partner)!.first}.` : v.crush ? `Secret crush: ${sim.byId.get(v.crush)!.first}.` : ''}
Opinions of others (-100..100): ${rel}.
Beliefs: ${v.mem.beliefs.map(b => b.text).join(' ') || 'none yet'}.`;
}
export function buildPlanPrompt(v: Villager, sim: Sim) {
  const mems = v.mem.retrieve(sim.clock, [], 12).map(m => `- [${fmtTime(m.t)}] ${m.text} (importance ${m.imp})`).join('\n');
  const parties = sim.parties.filter(p => !p.done && v.mem.known.has(p.id)).map(p => `- ${p.fact.text}`).join('\n') || '- none';
  return [{ role: 'system', content: 'You role-play a villager in a cozy life sim. Reply with JSON only.' },
    { role: 'user', content: `${describeVillager(v, sim)}\n\nMost relevant memories:\n${mems}\n\nKnown events tonight:\n${parties}\n\nIt is day ${sim.day}, ${fmtTime(sim.clock)}. Write today's plan as JSON: {"intent": "<one sentence about what you want today>", "blocks": [{"from": "HH:MM", "to": "HH:MM", "act": "work|lunch|errands|social|evening|event|sleep", "note": "<short>"}], "host_party": null | {"title": "...", "place": "campfire|plaza|tavern"}}` }];
}
export function buildReflectPrompt(v: Villager, sim: Sim) {
  const mems = v.mem.items.slice(-25).map(m => `- ${m.text} (importance ${m.imp})`).join('\n');
  return [{ role: 'system', content: 'You distil memories into high-level beliefs. Reply with JSON only.' },
    { role: 'user', content: `${describeVillager(v, sim)}\n\nRecent memories:\n${mems}\n\nWhat 1-3 high-level beliefs do you now hold about specific villagers? JSON: {"beliefs": [{"about": "<first name>", "text": "<belief>", "valence": -1..1}]}` }];
}

export class LLMBrain extends UtilityBrain {
  name = 'LLM (plans + reflections) over Utility AI'; calls = 0; pending = new Set<string>();
  constructor(public cfg: LLMConfig) { super(); }
  async ask(messages: any[]) {
    if (this.calls >= (this.cfg.maxCallsPerDay ?? 200)) throw new Error('LLM budget reached');
    this.calls++;
    const r = await fetch(this.cfg.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(this.cfg.apiKey ? { authorization: `Bearer ${this.cfg.apiKey}` } : {}) }, body: JSON.stringify({ model: this.cfg.model, messages, temperature: .8, response_format: { type: 'json_object' } }) });
    const j = await r.json(); return JSON.parse(j.choices[0].message.content);
  }
  planDay(v: Villager, sim: Sim) {
    super.planDay(v, sim); // instant deterministic plan; the model's plan replaces it when it arrives
    if (this.pending.has(v.id + 'p')) return; this.pending.add(v.id + 'p');
    this.ask(buildPlanPrompt(v, sim)).then(res => {
      const day0 = (sim.day - 1) * 1440, tm = (s: string) => { const [h, m] = s.split(':').map(Number); return day0 + h * 60 + (m || 0); };
      if (Array.isArray(res.blocks) && res.blocks.length) v.plan = [...res.blocks.map((b: any) => ({ from: tm(b.from), to: tm(b.to), act: b.act, note: b.note })), ...v.plan.filter(b => b.act === 'event')].sort((a, b) => a.from - b.from);
      if (res.intent) { v.intent = res.intent; v.thought = res.intent; }
      if (res.host_party && !sim.parties.some(p => p.at > sim.clock)) sim.scheduleParty(v, res.host_party.title, res.host_party.place, day0 + 19.5 * 60);
    }).catch(e => console.warn('[llm] plan failed, keeping utility plan', e.message)).finally(() => this.pending.delete(v.id + 'p'));
  }
  reflect(v: Villager, sim: Sim) {
    super.reflect(v, sim);
    if (this.pending.has(v.id + 'r')) return; this.pending.add(v.id + 'r');
    this.ask(buildReflectPrompt(v, sim)).then(res => { for (const b of res.beliefs ?? []) { const u = sim.villagers.find(x => x.first.toLowerCase() === String(b.about).toLowerCase()); if (u) { v.mem.setBelief({ about: u.id, text: b.text, t: sim.clock, valence: +b.valence || 0 }); v.thought = b.text; } } })
      .catch(e => console.warn('[llm] reflect failed', e.message)).finally(() => this.pending.delete(v.id + 'r'));
  }
}
