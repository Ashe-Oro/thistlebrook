import type { Sim } from '../sim/sim';
import type { Villager, SimEvent, Item } from '../sim/types';
import { ITEM_ICON } from '../sim/types';
import type { Director, Paper } from '../sim/director';
import { JOB_INFO, GOAL_LABEL } from '../data/villagers';
import { fmtTime } from '../core/util';
import { drawWeb } from './web';

export const VCOLOR: Record<string, string> = { mara: '#e8875b', tom: '#6c8fd1', jen: '#c96bd6', ollie: '#d8b23b', pip: '#6dbb5a', rosa: '#d4574a', wren: '#5fc0c4', edgar: '#a98a62' };
const h = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
export interface AppApi { sim: Sim; director: Director; setSpeed(s: number): void; speed: number; select(id: string | null): void; selected: string | null; portrait(id: string): HTMLCanvasElement; setMode(m: 'director' | 'free'): void; mode: string;
  god(kind: string): void; sound: { setMuted(m: boolean): void; muted: boolean; play(k: string, v?: number): void }; project(x: number, y: number, z: number): { x: number; y: number; on: boolean }; camDist(): number; }

export class UI {
  root: HTMLElement; feed!: HTMLElement; card!: HTMLElement; clock!: HTMLElement; overlay!: HTMLElement; toasts!: HTMLElement; caption!: HTMLElement; lb!: HTMLElement; modal!: HTMLElement;
  tags = new Map<string, HTMLElement>(); bubbles = new Map<string, { el: HTMLElement; until: number }>(); icons: { el: HTMLElement; id: string; t: number }[] = []; convo: { who: string; text: string; emoji: string; at: number }[] = [];
  tab = 'rel'; cardT = 0; lbKind: 'wealth' | 'popularity' | 'power' = 'wealth'; feedFilter = 'all'; autoPaper = true;
  constructor(public app: AppApi, parent: HTMLElement) {
    this.root = h('div', 'ui'); parent.appendChild(this.root); this.build();
    const s = app.sim;
    s.on('event', (e: SimEvent) => this.addFeed(e)); s.on('eventUpdate', (e: SimEvent) => this.updateFeed(e));
    s.on('bubble', (v: Villager, text: string, emoji: string, dur: number) => this.bubble(v.id, text, emoji, dur));
    s.on('icon', (v: Villager, emoji: string) => this.icon(v.id, emoji));
    s.on('convo', (lines: any[]) => this.convo.push(...lines));
    s.on('achievement', (a: any) => this.toast(`🏆 ${a.title}`, a.desc));
  }
  build() {
    const r = this.root;
    const top = h('div', 'topbar'); top.innerHTML = `<div class="brand"><span class="logo">🌿</span><div><b>Thistlebrook</b><small>a digital terrarium</small></div></div><div class="clock" id="clock"></div>
      <div class="speeds">${[[0, '⏸'], [1, '1×'], [4, '4×'], [16, '16×']].map(([s, l]) => `<button data-speed="${s}">${l}</button>`).join('')}</div>
      <div class="toggles"><button id="mode" title="Camera: cinematic director / free">🎬 Director</button><button id="snd" title="Sound">🔇</button></div>`;
    r.appendChild(top); this.clock = top.querySelector('#clock')!;
    top.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => b.onclick = () => this.app.setSpeed(+b.dataset.speed!));
    (top.querySelector('#mode') as HTMLButtonElement).onclick = () => this.app.setMode(this.app.mode === 'director' ? 'free' : 'director');
    (top.querySelector('#snd') as HTMLButtonElement).onclick = (e) => { this.app.sound.setMuted(!this.app.sound.muted); (e.target as HTMLElement).textContent = this.app.sound.muted ? '🔇' : '🔊'; };
    const fw = h('div', 'feedwrap'); fw.innerHTML = `<div class="ph"><b>📜 Village chronicle</b><div class="ff"><button data-f="all" class="on">All</button><button data-f="drama">Drama</button><button data-f="social">Social</button><button data-f="work">Work</button></div></div>`;
    this.feed = h('div', 'feed'); fw.appendChild(this.feed); r.appendChild(fw);
    fw.querySelectorAll<HTMLButtonElement>('[data-f]').forEach(b => b.onclick = () => { this.feedFilter = b.dataset.f!; fw.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); this.refilter(); });
    this.card = h('div', 'card hidden'); r.appendChild(this.card);
    this.lb = h('div', 'lb'); r.appendChild(this.lb);
    const dock = h('div', 'dock'); dock.innerHTML = `<div class="grp"><span class="lbl">God powers</span><button data-g="gift">🎁<i>Drop gift</i></button><button data-g="rain">🌧️<i>Rain</i></button><button data-g="merchant">🛒<i>Merchant</i></button><button data-g="festival">🎪<i>Festival</i></button></div>
      <div class="grp"><span class="lbl">Views</span><button data-v="web">🕸️<i>Relationships</i></button><button data-v="paper">📰<i>Gazette</i></button><button data-v="recap">📈<i>Recap</i></button><button data-v="villagers">👥<i>Villagers</i></button></div>`;
    r.appendChild(dock);
    dock.querySelectorAll<HTMLButtonElement>('[data-g]').forEach(b => b.onclick = () => { this.app.god(b.dataset.g!); b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 600); });
    dock.querySelectorAll<HTMLButtonElement>('[data-v]').forEach(b => b.onclick = () => this.view(b.dataset.v!));
    this.overlay = h('div', 'overlay'); r.appendChild(this.overlay); this.toasts = h('div', 'toasts'); r.appendChild(this.toasts); this.caption = h('div', 'caption'); r.appendChild(this.caption);
    this.modal = h('div', 'modal hidden'); r.appendChild(this.modal); this.modal.onclick = (e) => { if (e.target === this.modal) this.closeModal(); };
    for (const v of this.app.sim.villagers) { const t = h('div', 'tag', `<span style="background:${VCOLOR[v.id]}"></span>${v.first}`); t.onclick = () => this.app.select(v.id); this.overlay.appendChild(t); this.tags.set(v.id, t); }
    window.addEventListener('keydown', e => { if (e.key === 'Escape') { this.closeModal(); this.app.select(null); } if (e.key === ' ') { this.app.setSpeed(this.app.speed ? 0 : 1); e.preventDefault(); } });
  }
  name(id: string) { const v = this.app.sim.byId.get(id); return v ? `<a class="nm" data-id="${id}" style="--c:${VCOLOR[id]}">${v.first}</a>` : id; }
  linkify(text: string) { let t = esc(text); for (const v of this.app.sim.villagers) t = t.replace(new RegExp(`\\b${v.first}(?!\\w)`, 'g'), this.name(v.id)); return t; }
  cat(e: SimEvent) { return ['theft', 'fight', 'argue', 'god', 'weather', 'merchant', 'festival', 'reconcile', 'ally'].includes(e.kind) ? 'drama' : ['talk', 'gift', 'gossip', 'invite', 'party', 'bond', 'reflect'].includes(e.kind) ? 'social' : 'work'; }
  addFeed(e: SimEvent) {
    if (e.imp <= 1) return; // small talk lives in each villager's story log, not the main chronicle
    const el = h('div', `ev imp${Math.min(9, e.imp)} k-${e.kind} c-${this.cat(e)}`); el.dataset.id = String(e.id); el.dataset.cat = this.cat(e);
    el.innerHTML = `<span class="t">${fmtTime(e.t)}</span><span class="ic">${e.icon}</span><span class="tx">${this.linkify(e.text)}</span>`;
    el.querySelectorAll<HTMLElement>('.nm').forEach(a => a.onclick = (ev) => { ev.stopPropagation(); this.app.select(a.dataset.id!); });
    if (this.feedFilter !== 'all' && this.feedFilter !== el.dataset.cat) el.style.display = 'none';
    this.feed.prepend(el); while (this.feed.children.length > 150) this.feed.lastChild!.remove();
    if (e.imp >= 7) { this.captionText(`${e.icon} ${this.linkify(e.text)}`); }
  }
  updateFeed(e: SimEvent) { const el = this.feed.querySelector<HTMLElement>(`[data-id="${e.id}"] .tx`); if (el) { el.innerHTML = this.linkify(e.text); el.querySelectorAll<HTMLElement>('.nm').forEach(a => a.onclick = (ev) => { ev.stopPropagation(); this.app.select(a.dataset.id!); }); } }
  refilter() { this.feed.querySelectorAll<HTMLElement>('.ev').forEach(el => el.style.display = this.feedFilter === 'all' || el.dataset.cat === this.feedFilter ? '' : 'none'); }
  captionTO: any; captionText(html: string) { this.caption.innerHTML = html; this.caption.classList.add('show'); clearTimeout(this.captionTO); this.captionTO = setTimeout(() => this.caption.classList.remove('show'), 6000); }
  toastQ: [string, string][] = []; quiet = false;
  toast(title: string, desc: string) { if (this.quiet) return; if (this.toasts.children.length >= 2) { if (this.toastQ.length < 6) this.toastQ.push([title, desc]); return; } const t = h('div', 'toast', `<b>${title}</b><span>${this.linkify(desc)}</span>`); this.toasts.appendChild(t); this.app.sound.play('toast'); setTimeout(() => t.classList.add('out'), 4200); setTimeout(() => { t.remove(); const n = this.toastQ.shift(); if (n) this.toast(n[0], n[1]); }, 5000); }
  bubble(id: string, text: string, emoji: string, dur: number) {
    let b = this.bubbles.get(id); if (!b) { const el = h('div', 'bubble'); this.overlay.appendChild(el); b = { el, until: 0 }; this.bubbles.set(id, b); }
    b.el.innerHTML = `${emoji ? `<span class="em">${emoji}</span>` : ''}${esc(text)}`; b.el.classList.remove('pop'); void b.el.offsetWidth; b.el.classList.add('pop'); b.until = performance.now() + dur * 1000 / Math.max(1, Math.sqrt(this.app.speed || 1));
  }
  icon(id: string, emoji: string) { const el = h('div', 'icon', emoji); this.overlay.appendChild(el); this.icons.push({ el, id, t: 0 }); if (this.icons.length > 40) { this.icons.shift()!.el.remove(); } }

  frame(dt: number) {
    const s = this.app.sim, now = performance.now();
    while (this.convo.length && this.convo[0].at <= s.clock) { const c = this.convo.shift()!; const v = s.byId.get(c.who); if (v && !v.inside) this.bubble(c.who, c.text, c.emoji, 3); }
    if (this.convo.length > 60) this.convo.splice(0, this.convo.length - 60);
    const close = this.app.camDist() < 30;
    for (const v of s.villagers) {
      const pos = v.avatar.root.position, hh = v.avatar.height, tag = this.tags.get(v.id)!, p = this.app.project(pos.x, hh + .55, pos.z);
      const vis = p.on && !v.inside && v.avatar.alpha > .3;
      tag.style.display = vis && (close || this.app.selected === v.id) ? '' : 'none'; tag.classList.toggle('sel', this.app.selected === v.id);
      if (vis) tag.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      const b = this.bubbles.get(v.id); if (b) { const show = vis && now < b.until; b.el.style.display = show ? '' : 'none'; if (show) { const q = this.app.project(pos.x, hh + 1.0, pos.z); b.el.style.transform = `translate(${q.x}px, ${q.y - (tag.style.display === 'none' ? 0 : 18)}px) translate(-50%, -100%)`; } }
    }
    // keep simultaneous speech bubbles from stacking on top of each other
    const shown: { el: HTMLElement; x: number; y: number; w: number; h: number }[] = [];
    for (const [, b] of this.bubbles) { if (b.el.style.display === 'none') continue; const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(b.el.style.transform); if (!m) continue; shown.push({ el: b.el, x: +m[1], y: +m[2], w: b.el.offsetWidth, h: b.el.offsetHeight }); }
    shown.sort((a, b) => b.y - a.y);
    for (let i = 0; i < shown.length; i++) { const a = shown[i]; for (let j = 0; j < i; j++) { const b = shown[j]; if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 4 && a.y > b.y - b.h - 6 && a.y < b.y + a.h) { a.y = b.y - b.h - 8; } } a.el.style.transform = `translate(${a.x}px, ${a.y}px) translate(-50%, -100%)`; }
    for (const ic of this.icons) { ic.t += dt; const v = s.byId.get(ic.id)!; const pos = v.avatar.root.position; const p = this.app.project(pos.x, v.avatar.height + .9 + ic.t * .9, pos.z); ic.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${Math.min(1, ic.t * 5)})`; ic.el.style.opacity = String(Math.max(0, 1 - ic.t / 2.2)); ic.el.style.display = p.on && !v.inside ? '' : 'none'; }
    this.icons = this.icons.filter(ic => { if (ic.t > 2.2) { ic.el.remove(); return false; } return true; });
    this.cardT -= dt; if (this.cardT <= 0) { this.cardT = .35; this.clock.innerHTML = `<b>Day ${s.day}</b> · ${fmtTime(s.clock)} ${s.rain > .4 ? '🌧️' : s.hour >= 20 || s.hour < 6 ? '🌙' : s.hour < 8 ? '🌅' : '☀️'}${s.festivalUntil > s.clock ? ' 🎪' : ''}${s.merchantUntil > s.clock ? ' 🛒' : ''}`;
      this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed! === this.app.speed)); (this.root.querySelector('#mode') as HTMLElement).textContent = this.app.mode === 'director' ? '🎬 Director' : '🕹️ Free cam';
      this.renderCard(); this.renderLB(); }
  }
  renderLB() {
    const rows = this.app.director.ranked(this.lbKind), max = Math.max(1, ...rows.map(r => Math.abs(r.score)));
    this.lb.innerHTML = `<div class="ph"><b>🏆 Leaderboard</b><div class="ff">${(['wealth', 'popularity', 'power'] as const).map(k => `<button data-k="${k}" class="${k === this.lbKind ? 'on' : ''}">${k === 'wealth' ? '🪙 Wealth' : k === 'popularity' ? '❤️ Liked' : '👑 Power'}</button>`).join('')}</div></div>` +
      rows.map((r, i) => `<div class="row" data-id="${r.v.id}"><span class="rk">${['🥇', '🥈', '🥉'][i] ?? i + 1}</span><span class="dot" style="background:${VCOLOR[r.v.id]}"></span><span class="n">${r.v.first}</span><span class="bar"><i style="width:${Math.max(3, Math.abs(r.score) / max * 100)}%;background:${r.score < 0 ? '#c55' : VCOLOR[r.v.id]}"></i></span><span class="sc">${r.score}</span></div>`).join('');
    this.lb.querySelectorAll<HTMLElement>('[data-k]').forEach(b => b.onclick = () => { this.lbKind = b.dataset.k as any; this.renderLB(); });
    this.lb.querySelectorAll<HTMLElement>('.row').forEach(b => b.onclick = () => this.app.select(b.dataset.id!));
  }
  mood(v: Villager) { const e = v.avatar.expr; return ({ happy: '😊', grin: '😁', sad: '😢', angry: '😠', scared: '😨', surprised: '😮', sleepy: '😴', love: '🥰', smirk: '😏', determined: '😤', dizzy: '😵‍💫', neutral: '🙂', knockedOut: '😵' } as any)[e] ?? '🙂'; }
  relLabel(o: number) { return o >= 70 ? 'Best friend' : o >= 35 ? 'Friend' : o >= 10 ? 'Friendly' : o > -10 ? 'Neutral' : o > -40 ? 'Wary' : o > -70 ? 'Dislikes' : 'Nemesis'; }
  renderCard() {
    const id = this.app.selected; if (!id) { this.card.classList.add('hidden'); return; } const s = this.app.sim, v = s.byId.get(id)!; this.card.classList.remove('hidden');
    const al = v.alliance ? s.alliances.find(a => a.id === v.alliance) : null; const bar = (l: string, x: number, c: string) => `<div class="need"><span>${l}</span><b><i style="width:${x}%;background:${c}"></i></b></div>`;
    const traits = Object.entries(v.traits).map(([k, x]) => `<span class="tr" title="${k} ${x}">${k}<i style="width:${x * 100}%"></i></span>`).join('');
    const inv = (Object.entries(v.inv) as [Item, number][]).filter(([, n]) => n > 0).map(([k, n]) => `<span class="it" title="${k}">${ITEM_ICON[k]} ${n}</span>`).join('') || '<span class="muted">empty pockets</span>';
    let body = '';
    if (this.tab === 'rel') body = [...s.villagers].filter(u => u !== v).sort((a, b) => (v.opinion[b.id] ?? 0) - (v.opinion[a.id] ?? 0)).map(u => { const o = Math.round(v.opinion[u.id] ?? 0), back = Math.round(u.opinion[v.id] ?? 0), bel = v.mem.belief(u.id); return `<div class="rel" data-id="${u.id}"><span class="dot" style="background:${VCOLOR[u.id]}"></span><span class="n">${u.first}${v.family.includes(u.id) ? ' 👪' : ''}${u.alliance && u.alliance === v.alliance ? ' 🚩' : ''}</span><span class="ob"><i class="${o < 0 ? 'neg' : 'pos'}" style="${o < 0 ? 'right:50%' : 'left:50%'};width:${Math.abs(o) / 2}%"></i></span><span class="lab">${this.relLabel(o)}</span><span class="back" title="How ${u.first} feels about ${v.first}">${back >= 35 ? '💚' : back <= -35 ? '💢' : '·'}</span>${bel ? `<div class="bel">“${esc(bel.text)}”</div>` : ''}</div>`; }).join('');
    if (this.tab === 'plan') body = v.plan.filter(b => b.to > s.clock - 60).map(b => `<div class="pl ${s.clock >= b.from && s.clock < b.to ? 'now' : ''} ${b.act === 'event' ? 'evt' : ''}"><span class="t">${fmtTime(b.from)}–${fmtTime(b.to)}</span>${esc(b.note)}</div>`).join('') + (v.intent ? `<div class="intent">🎯 ${esc(v.intent)}</div>` : '');
    if (this.tab === 'mem') body = `${v.mem.beliefs.length ? `<div class="sub">Beliefs (from reflection)</div>${v.mem.beliefs.map(b => `<div class="mem refl">💭 ${esc(b.text)}</div>`).join('')}` : ''}<div class="sub">Most salient memories</div>` + v.mem.retrieve(s.clock, [], 10).map(m => `<div class="mem k-${m.kind}"><span class="t">${fmtTime(m.t)}</span><span class="imp" title="importance">${'●'.repeat(Math.ceil(m.imp / 2))}</span> ${esc(m.text)}</div>`).join('') + `<div class="sub">Knows ${v.mem.known.size} pieces of news · ${v.mem.items.length} memories</div>`;
    if (this.tab === 'story') body = v.story.slice().reverse().slice(0, 30).map(x => `<div class="st"><span class="t">${fmtTime(x.t)}</span>${this.linkify(x.text)}</div>`).join('') || '<div class="muted">Nothing yet.</div>';
    this.card.innerHTML = `<button class="x">✕</button><div class="hd"><div class="pt"></div><div><div class="nmb" style="color:${VCOLOR[v.id]}">${v.name} <span class="md">${this.mood(v)}</span></div><div class="jb">${JOB_INFO[v.job].label} · ${v.def.age}</div><div class="gl">🎯 ${GOAL_LABEL[v.goal]}</div>${al ? `<div class="al" style="--c:${al.color}">🚩 ${al.name}</div>` : ''}</div></div>
      <div class="thought">💭 ${esc(v.thought)}</div><div class="doing">▶ ${esc(v.doing)}${v.inside ? ` <span class="muted">(inside ${s.place(v.inside).name})</span>` : ''}</div>
      ${bar('🍞 Fed', v.needs.food, '#e0a64a')}${bar('⚡ Energy', v.needs.energy, '#6cc36c')}${bar('💬 Social', v.needs.social, '#6aa6e8')}
      <div class="inv">${inv}</div><div class="traits">${traits}</div>
      <div class="tabs">${[['rel', 'Relationships'], ['plan', 'Plan'], ['mem', 'Mind'], ['story', 'Story']].map(([k, l]) => `<button data-t="${k}" class="${this.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="tb">${body}</div>`;
    const pt = this.card.querySelector('.pt')!; pt.appendChild(this.app.portrait(v.id));
    (this.card.querySelector('.x') as HTMLElement).onclick = () => this.app.select(null);
    this.card.querySelectorAll<HTMLElement>('[data-t]').forEach(b => b.onclick = () => { this.tab = b.dataset.t!; this.renderCard(); });
    this.card.querySelectorAll<HTMLElement>('.rel').forEach(b => b.onclick = () => this.app.select(b.dataset.id!));
    this.card.querySelectorAll<HTMLElement>('.nm').forEach(a => a.onclick = () => this.app.select(a.dataset.id!));
  }
  closeModal() { this.modal.classList.add('hidden'); this.modal.innerHTML = ''; }
  view(kind: string) {
    const s = this.app.sim; this.modal.classList.remove('hidden');
    if (kind === 'paper') { const p = this.app.director.papers[this.app.director.papers.length - 1] ?? this.app.director.paper(s.day); this.showPaper(p); return; }
    if (kind === 'web') { this.modal.innerHTML = `<div class="sheet web"><button class="x">✕</button><h2>🕸️ Who likes whom</h2><p class="muted">Green = fondness, red = resentment, thickness = strength. Flags mark alliances.</p><canvas width="760" height="560"></canvas></div>`; drawWeb(this.modal.querySelector('canvas')!, s, VCOLOR, (id) => this.app.portrait(id)); }
    if (kind === 'recap') this.showRecap();
    if (kind === 'villagers') { this.modal.innerHTML = `<div class="sheet"><button class="x">✕</button><h2>👥 The villagers</h2><div class="vgrid">${s.villagers.map(v => `<div class="vc" data-id="${v.id}"><div class="pt"></div><b style="color:${VCOLOR[v.id]}">${v.name}</b><small>${JOB_INFO[v.job].label} · ${GOAL_LABEL[v.goal]}</small><p>${esc(v.def.bio)}</p></div>`).join('')}</div></div>`;
      this.modal.querySelectorAll<HTMLElement>('.vc').forEach(el => { el.querySelector('.pt')!.appendChild(this.app.portrait(el.dataset.id!)); el.onclick = () => { this.closeModal(); this.app.select(el.dataset.id!); }; }); }
    this.modal.querySelector('.x')?.addEventListener('click', () => this.closeModal());
  }
  showPaper(p: Paper) {
    this.modal.classList.remove('hidden'); this.app.sound.play('paper');
    this.modal.innerHTML = `<div class="sheet paper"><button class="x">✕</button><div class="mast">The Thistlebrook Gazette</div><div class="dateline">Day ${p.day + 1} · Morning edition · Weather: ${p.weather} · One copper</div><h1>${this.linkify(p.headline)}</h1>
      <div class="cols"><div>${p.stories.map(x => `<p>${x.icon} ${this.linkify(x.text)}</p>`).join('') || '<p>All quiet on the village front.</p>'}</div><div class="side"><h3>Standings</h3><p>🪙 Richest: <b>${p.leaders.wealth}</b></p><p>❤️ Best-loved: <b>${p.leaders.popular}</b></p><p>👑 Most powerful: <b>${p.leaders.power}</b></p>${p.quote ? `<h3>Overheard</h3><p class="q">“${esc(p.quote.text)}”<br>— ${p.quote.who}</p>` : ''}</div></div></div>`;
    this.modal.querySelector('.x')?.addEventListener('click', () => this.closeModal());
  }
  showRecap() {
    const s = this.app.sim; const days = Object.keys(s.dayStats).map(Number).sort((a, b) => a - b);
    this.modal.innerHTML = `<div class="sheet recap"><button class="x">✕</button><h2>📈 The story so far</h2><canvas width="760" height="220"></canvas><div class="legend">${s.villagers.map(v => `<span><i style="background:${VCOLOR[v.id]}"></i>${v.first}</span>`).join('')}</div>
      <div class="timeline">${days.map(d => `<div class="day"><h3>Day ${d}</h3>${(s.dayStats[d] ?? []).filter(e => e.imp >= 5).slice(0, 8).map(e => `<p><span class="t">${fmtTime(e.t)}</span> ${e.icon} ${this.linkify(e.text)}</p>`).join('') || '<p class="muted">A quiet day.</p>'}</div>`).join('')}</div></div>`;
    const c = this.modal.querySelector('canvas')!, g = c.getContext('2d')!, H = s.history; if (H.length > 1) { const max = Math.max(...H.flatMap(x => Object.values(x.wealth))); g.fillStyle = '#fbf4e4'; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = '#d9cdb3'; g.font = '12px sans-serif'; g.fillStyle = '#8a7a5a';
      for (const d of days) { const i = H.findIndex(x => x.t >= (d - 1) * 1440 + 360); if (i < 0) continue; const x = 30 + i / (H.length - 1) * (c.width - 40); g.beginPath(); g.moveTo(x, 10); g.lineTo(x, c.height - 20); g.stroke(); g.fillText(`Day ${d}`, x + 4, c.height - 6); }
      for (const v of s.villagers) { g.strokeStyle = VCOLOR[v.id]; g.lineWidth = 2.5; g.beginPath(); H.forEach((x, i) => { const px = 30 + i / (H.length - 1) * (c.width - 40), py = c.height - 24 - (x.wealth[v.id] / max) * (c.height - 40); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); }
      g.fillStyle = '#8a7a5a'; g.fillText('Wealth', 4, 14); }
    this.modal.querySelector('.x')?.addEventListener('click', () => this.closeModal());
  }
}
