import type { Sim } from '../sim/sim';
import type { Villager, SimEvent, PlanBlock } from '../sim/types';
import type { Director, Paper } from '../sim/director';
import { JOB_INFO, GOAL_LABEL } from '../data/villagers';
import { fmtTime, dayOf } from '../core/util';
import { drawWeb } from './web';
import { arcs } from '../sim/arcs';
import type { Arc } from '../sim/arcs';
import { calendarFor } from '../sim/calendar';

export const VCOLOR: Record<string, string> = { mara: '#e8875b', tom: '#6c8fd1', jen: '#c96bd6', ollie: '#d8b23b', pip: '#6dbb5a', rosa: '#d4574a', wren: '#5fc0c4', edgar: '#a98a62', bram: '#b5763a', sol: '#4f7fa0', posy: '#e58fb1', agnes: '#8c7bc0', hugh: '#7a8a96', hazel: '#9fbf4a', mabel: '#c98a9a', kit: '#e0a040' };
const setHTML = (el: Element, html: string) => { if ((el as any)._html !== html) { (el as any)._html = html; el.innerHTML = html; } };
const h = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
export interface AppApi { sim: Sim; director: Director; setSpeed(s: number): void; togglePause(): void; speed: number; select(id: string | null): void; selected: string | null; portrait(id: string): HTMLCanvasElement; setMode(m: 'director' | 'free'): void; mode: string;
  god(kind: string): boolean; newVillage(): void; sound: { setMuted(m: boolean): void; muted: boolean; play(k: string, v?: number): void }; project(x: number, y: number, z: number): { x: number; y: number; on: boolean }; camDist(): number; }

function sim0(v: Villager, s: any) { const f = s.villagers.filter((u: Villager) => u.crush === v.id && u.partner !== v.id && u !== v); return f.length ? `<span class="it love" title="Only you can see this">💌 ${f.map((u: Villager) => u.first).join(' & ')} ${f.length > 1 ? 'are' : 'is'} sweet on them</span>` : ''; }
const cleanLie = (t: string) => t.replace(/\s*\(It isn't true\.\)/gi, '').replace(/\.\s*,/g, ',').replace(/\s+/g, ' ').trim();
export class UI {
  root: HTMLElement; feed!: HTMLElement; card!: HTMLElement; clock!: HTMLElement; overlay!: HTMLElement; toasts!: HTMLElement; caption!: HTMLElement; lb!: HTMLElement; modal!: HTMLElement;
  marks: { el: HTMLElement; x: number; z: number }[] = []; markT = 0; cardRect: { l: number; r: number; t: number; b: number } | null = null;
  tags = new Map<string, HTMLElement>(); bubbles = new Map<string, { el: HTMLElement; until: number; t0: number }>(); icons: { glyph: HTMLCanvasElement; id: string; t: number }[] = []; convo: { who: string; text: string; emoji: string; at: number }[] = [];
  tab = 'rel'; cardT = 0; lbKind: 'popularity' | 'power' | 'mischief' = 'popularity'; feedFilter = 'all'; autoPaper = true;
  feedDay = 0; safeTop = 70; hint: HTMLElement | null = null;
  calPop!: HTMLElement; calOpen = false;
  constructor(public app: AppApi, parent: HTMLElement) {
    this.root = h('div', 'ui'); parent.appendChild(this.root); this.build();
    const s = app.sim;
    arcs(s); // create the arc tracker first so it ingests each event before the feed renders its chip
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
    // The date/clock is a button: click it for a small popover of this week's fixtures and the season.
    this.clock.style.cursor = 'pointer'; this.clock.title = 'This week in Thistlebrook';
    this.calPop = h('div', 'calpop hidden'); this.calPop.style.display = 'none'; r.appendChild(this.calPop);
    this.clock.addEventListener('click', () => this.toggleCal());
    document.addEventListener('click', (e) => { const t = e.target as Node; if (this.calOpen && !this.calPop.contains(t) && !this.clock.contains(t)) this.toggleCal(); });
    (top.querySelector('.toggles') as HTMLElement).insertAdjacentHTML('beforeend', '<button id="newv" title="Start a brand-new village (the current one is forgotten)">🌱</button>');
    (top.querySelector('#newv') as HTMLButtonElement).onclick = () => { if (confirm('Start a new village? The current story (it is saved automatically) will be forgotten.')) this.app.newVillage(); };
    top.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => b.onclick = () => this.app.setSpeed(+b.dataset.speed!));
    (top.querySelector('#mode') as HTMLButtonElement).onclick = () => this.app.setMode(this.app.mode === 'director' ? 'free' : 'director');
    (top.querySelector('#snd') as HTMLButtonElement).onclick = (e) => { this.app.sound.setMuted(!this.app.sound.muted); (e.target as HTMLElement).textContent = this.app.sound.muted ? '🔇' : '🔊'; };
    const fw = h('div', 'feedwrap'); fw.innerHTML = `<div class="ph"><b>📜 Village chronicle</b><div class="ff"><button data-f="all" class="on">All</button><button data-f="drama">Drama</button><button data-f="social">Social</button><button data-f="work">Work</button><button data-f="life">Life</button></div><button class="feedtog" title="Collapse chronicle">▾</button></div>`;
    this.feed = h('div', 'feed'); fw.appendChild(this.feed); r.appendChild(fw);
    // one delegated listener for every name link and story chip in the chronicle (rows come and go; listeners don't pile up)
    this.feed.addEventListener('click', (ev) => { const t = ev.target as HTMLElement; const nm = t.closest<HTMLElement>('.nm'); if (nm) { ev.stopPropagation(); this.app.select(nm.dataset.id!); return; } const ch = t.closest<HTMLElement>('.arcchip'); if (ch) { ev.stopPropagation(); this.showArc(ch.dataset.arc!); } });
    fw.querySelectorAll<HTMLButtonElement>('[data-f]').forEach(b => b.onclick = () => { this.feedFilter = b.dataset.f!; fw.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); this.refilter(); });
    const ftog = fw.querySelector<HTMLButtonElement>('.feedtog')!; ftog.onclick = () => { const col = fw.classList.toggle('collapsed'); ftog.textContent = col ? '▸' : '▾'; ftog.title = col ? 'Expand chronicle' : 'Collapse chronicle'; };
    if (matchMedia('(max-width: 700px), (pointer: coarse)').matches) ftog.click(); // phones start with the chronicle folded to a one-line strip
    this.card = h('div', 'card hidden'); r.appendChild(this.card);
    this.lb = h('div', 'lb'); r.appendChild(this.lb);
    const dock = h('div', 'dock'); dock.innerHTML = `<div class="grp"><span class="lbl">God powers</span><button data-g="gift">🎁<i>Drop gift</i><b class="s">Gift</b></button><button data-g="rain">🌧️<i>Rain</i><b class="s">Rain</b></button><button data-g="traveller">🧳<i>Traveller</i><b class="s">Visitor</b></button><button data-g="festival">🎪<i>Festival</i><b class="s">Fest</b></button></div>
      <div class="grp"><span class="lbl">Views</span><button data-v="web">🕸️<i>Relationships</i><b class="s">Web</b></button><button data-v="paper">📰<i>Gazette</i><b class="s">Paper</b></button><button data-v="recap">📈<i>Recap</i><b class="s">Recap</b></button><button data-v="villagers">👥<i>Villagers</i><b class="s">People</b></button></div>`;
    r.appendChild(dock);
    // god powers cool down (a sweep fills the button) so spamming can't flood the chronicle
    const COOL: Record<string, number> = { gift: 8, rain: 25, traveller: 30, festival: 30 };
    dock.querySelectorAll<HTMLButtonElement>('[data-g]').forEach(b => b.onclick = () => { if (b.classList.contains('cool')) return; const k = b.dataset.g!; if (!this.app.god(k)) return; b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 600);
      const sec = COOL[k] ?? 10; b.classList.add('cool'); b.setAttribute('aria-disabled', 'true'); b.style.setProperty('--cool', `${sec}s`); b.title = 'Recharging…'; setTimeout(() => { b.classList.remove('cool'); b.removeAttribute('aria-disabled'); b.title = ''; }, sec * 1000); });
    dock.querySelectorAll<HTMLButtonElement>('[data-v]').forEach(b => b.onclick = () => this.view(b.dataset.v!));
    this.overlay = h('div', 'overlay'); r.appendChild(this.overlay); this.toasts = h('div', 'toasts'); r.appendChild(this.toasts); this.caption = h('div', 'caption'); r.appendChild(this.caption);
    this.modal = h('div', 'modal hidden'); r.appendChild(this.modal); this.modal.onclick = (e) => { if (e.target === this.modal) this.closeModal(); };
    // landmark labels: shown when the camera pulls back far enough to see the whole village
    const PIC: Record<string, string> = { bakery: '🥖', store: '✉️', tavern: '🍺', smithy: '⚒️', market: '🧺', well: '🪣', field: '🌾', coop: '🐔', orchard: '🍎', forest: '🌲', quarry: '⛏️', campfire: '🔥', plaza: '⛲', pond: '🦆', barn: '🐄', chapel: '⛪', windmill: '🌬️', pasture: '🐑', school: '📚', garden: '🌿', dock: '🎣' };
    for (const pl of this.app.sim.world.places.values() as Iterable<any>) { if (!PIC[pl.kind]) continue; const el = h('div', 'landmark', `<i>${PIC[pl.kind]}</i>${esc(pl.name.replace(/^the /, ''))}`); el.style.display = 'none'; this.overlay.appendChild(el); this.marks.push({ el, x: pl.x, z: pl.z }); }
    for (const v of this.app.sim.villagers) { const t = h('div', 'tag', `<span style="background:${VCOLOR[v.id]}"></span>${v.first}`); t.onclick = () => this.app.select(v.id); this.overlay.appendChild(t); this.tags.set(v.id, t); }
    // keep the CSS layout vars in step with the real (wrapping) top bar and dock heights
    const measure = () => { this.root.style.setProperty('--top-h', `${top.offsetHeight}px`); this.root.style.setProperty('--dock-h', `${dock.offsetHeight}px`); };
    addEventListener('resize', measure); requestAnimationFrame(measure); setTimeout(measure, 500);
    // first-visit tip: goes away on the first villager click (or when tapped)
    if (!localStorage.getItem('thistlebrook.hinted')) { const hint = h('div', 'hint', '👆 Click a villager to read their mind'); hint.onclick = () => hint.classList.add('gone'); r.appendChild(hint); this.hint = hint; setTimeout(() => hint.classList.add('gone'), 45000); }
    window.addEventListener('keydown', e => { if (e.key === 'Escape') { this.closeModal(); this.app.select(null); } if (e.key === ' ') { this.app.togglePause(); e.preventDefault(); } });
  }
  name(id: string) { const v = this.app.sim.byId.get(id); return v ? `<a class="nm" data-id="${id}" style="--c:${VCOLOR[id]}">${v.first}</a>` : id; }
  linkify(text: string) { let t = esc(text); for (const v of this.app.sim.villagers) t = t.replace(new RegExp(`\\b${v.first}(?!\\w)`, 'g'), this.name(v.id)); return t; }
  // text with a fabricated rumour inside gets the same badge everywhere (chronicle, Gazette, recap, story tab, arcs)
  rich(text: string) { return text.includes("(It isn't true.)") ? `${this.linkify(cleanLie(text))} <span class="badge false" title="A fabricated rumour — not actually true">false rumour</span>` : this.linkify(text); }
  isLie(e: SimEvent) { return e.kind === 'gossip' && e.text.includes("(It isn't true.)"); }
  cat(e: SimEvent) {
    if (e.kind === 'life') return 'life';
    if (e.kind === 'weather') return 'weather'; // routine weather stays out of Drama; only in All
    if (this.isLie(e)) return 'drama'; // fabricated rumours are the heart of the drama
    return ['theft', 'burglary', 'fight', 'argue', 'accuse', 'god', 'traveller', 'festival', 'reconcile', 'ally', 'romance', 'rumour', 'snoop', 'sneaky', 'heartbreak', 'wedding', 'showdown', 'search', 'contest'].includes(e.kind) ? 'drama'
      : ['talk', 'gift', 'gossip', 'invite', 'party', 'bond', 'reflect', 'generous', 'lunch', 'breakfast', 'evening', 'social', 'meeting', 'market', 'calendar', 'prank', 'mediate'].includes(e.kind) ? 'social' : 'work';
  }
  addFeed(e: SimEvent) {
    if (e.kind === 'life') { this.addLife(e); return; }
    const cat = this.cat(e), lie = this.isLie(e);
    // small talk lives in each villager's story log; routine work (imp 1) is kept only for the Work filter
    const minor = e.imp <= 1; if (minor && cat !== 'work') return;
    const day = dayOf(e.t);
    // an identical line already near the top (the same chore again, a repeated accusation) is bumped with a ×N count, not re-printed
    if (day === this.feedDay) { for (let i = 0, c = this.feed.firstElementChild as HTMLElement | null; c && i < 40; i++, c = c.nextElementSibling as HTMLElement | null) {
      if (c.classList.contains('daysep')) break;
      if (c.dataset.txt === e.text) { const ids: number[] = JSON.parse(c.dataset.ids ?? `[${c.dataset.id}]`); ids.push(e.id); c.dataset.ids = JSON.stringify(ids); c.dataset.n = String(ids.length); this.refreshFeedRow(c, e); this.feed.prepend(c); this.promoteCaption(e, c); return; }
    } } if (this.feedDay && day !== this.feedDay) { const sep = h('div', 'daysep', `— Day ${day} —`); this.feed.prepend(sep); } this.feedDay = day;
    const el = h('div', `ev imp${Math.min(9, e.imp)} k-${e.kind} c-${cat}`); el.dataset.id = String(e.id); el.dataset.ids = JSON.stringify([e.id]); el.dataset.cat = cat; el.dataset.txt = e.text; if (minor) el.dataset.minor = '1';
    const txt = lie ? cleanLie(e.text) : e.text;
    el.innerHTML = `<span class="t">${fmtTime(e.t)}</span><span class="ic">${e.icon}</span><span class="tx">${this.linkify(txt)}${lie ? ' <span class="badge false" title="A fabricated rumour — not actually true">false rumour</span>' : ''}</span>`;
    this.arcChip(el, e.id);
    this.applyFilter(el);
    this.feed.prepend(el); while (this.feed.children.length > 100) this.feed.lastChild!.remove();
    if (minor) { const m = this.feed.querySelectorAll('[data-minor]'); for (let i = 30; i < m.length; i++) m[i].remove(); }
    this.promoteCaption(e, el);
  }
  // Same-hour life shares one compact row; keep only two samples, regardless of count.
  addLife(e: SimEvent) {
    const hour = String(Math.floor(e.t / 60));
    let el = [...this.feed.querySelectorAll<HTMLElement>('.c-life')].find(row => row.dataset.hour === hour);
    if (!el) {
      const day = dayOf(e.t);
      if (this.feedDay && day !== this.feedDay) this.feed.prepend(h('div', 'daysep', `— Day ${day} —`));
      this.feedDay = day;
      el = h('div', 'ev imp2 k-life c-life muted');
      el.style.fontSize = '.85em';
      el.style.opacity = '.7';
      el.dataset.cat = 'life'; el.dataset.hour = hour; el.dataset.n = '0';
      el.dataset.samples = '[]'; el.dataset.ids = '[]';
      el.innerHTML = '<span class="t"></span><span class="ic">🌿</span><span class="tx"></span>';
    }
    const n = +(el.dataset.n ?? 0) + 1;
    const samples: string[] = JSON.parse(el.dataset.samples!);
    if (samples.length < 2) samples.push(e.text.replace(/[.!]+$/, ''));
    el.dataset.n = String(n); el.dataset.samples = JSON.stringify(samples);
    el.querySelector('.t')!.textContent = fmtTime(e.t);
    el.querySelector('.tx')!.innerHTML = `Life in the village: ${samples.map(t => this.linkify(t)).join(' · ')}${n > 2 ? ` (+${n - 2})` : ''}${n > 1 ? `<span class="rep"> ×${n}</span>` : ''}`;
    this.applyFilter(el); this.feed.prepend(el);
    while (this.feed.children.length > 100) this.feed.lastChild!.remove();
  }
  promoteCaption(e: SimEvent, el: HTMLElement) {
    if (e.kind === 'life') return;
    let visibleInFeed = el.style.display !== 'none' && !this.feed.parentElement!.classList.contains('collapsed') && this.feed.getClientRects().length > 0;
    for (let panel: HTMLElement | null = this.feed; visibleInFeed && panel; panel = panel.parentElement) {
      const style = getComputedStyle(panel);
      if (style.display === 'none' || style.visibility !== 'visible' || style.opacity === '0') visibleInFeed = false;
    }
    if (e.imp >= 7 && !visibleInFeed) this.captionText(`${e.icon} ${this.linkify(this.isLie(e) ? cleanLie(e.text) : e.text)}`);
  }
  refreshFeedRow(el: HTMLElement, e: SimEvent) {
    const cat = this.cat(e), n = +(el.dataset.n ?? 1);
    el.className = `ev imp${Math.min(9, e.imp)} k-${e.kind} c-${cat}`;
    el.dataset.cat = cat; el.dataset.txt = e.text;
    if (e.imp <= 1) el.dataset.minor = '1'; else delete el.dataset.minor;
    el.querySelector('.t')!.textContent = fmtTime(e.t);
    el.querySelector('.ic')!.textContent = e.icon;
    el.querySelector('.tx')!.innerHTML = this.rich(e.text) + (n > 1 ? `<span class="rep"> ×${n}</span>` : '');
    this.arcChip(el, e.id); this.applyFilter(el);
  }
  updateFeed(e: SimEvent) {
    if (e.kind === 'life') return; // Life narration is immutable and folded without event-ID storage.
    const el = [...this.feed.querySelectorAll<HTMLElement>('.ev')].find(row => (JSON.parse(row.dataset.ids ?? `[${row.dataset.id}]`) as number[]).includes(e.id));
    if (el) { this.refreshFeedRow(el, e); this.promoteCaption(e, el); }
  }
  applyFilter(el: HTMLElement) { const f = this.feedFilter; el.style.display = (f === 'all' ? !el.dataset.minor : el.dataset.cat === f) ? '' : 'none'; }
  refilter() { this.feed.querySelectorAll<HTMLElement>('.ev').forEach(el => this.applyFilter(el)); }
  // small arc chip under a feed row once its story has shape (>= 2 beats): "📖 The Missing Geode · beat 3"
  arcChip(el: HTMLElement, eventId: number) {
    el.querySelector('.arcchip')?.remove();
    const hit = arcs(this.app.sim).arcForEvent(eventId); if (!hit || hit.arc.beats.length < 2) return;
    const chip = h('a', 'arcchip', `📖 ${esc(hit.arc.title)} · beat ${hit.beatNo}`); chip.title = 'Open this story'; chip.dataset.arc = hit.arc.id;
    el.appendChild(chip);
  }
  showArc(arcId: string) {
    const s = this.app.sim, at = arcs(s), arc = at.arcs.find(a => a.id === arcId); if (!arc) return;
    this.modal.classList.remove('hidden');
    this.modal.innerHTML = `<div class="sheet arcview"><button class="x">✕</button><div class="archd"><span class="status ${arc.status}">${arc.status}</span><h2>📖 ${esc(arc.title)}</h2></div>
      <div class="cast">${[...arc.actors].filter(a => s.byId.get(a)).map(a => `<span class="nm" data-id="${a}" style="--c:${VCOLOR[a]}">${s.byId.get(a)!.first}</span>`).join('')}</div>
      <div class="arctl">${arc.beats.map((b, i) => `<div class="beat"><span class="dot">${b.icon}</span><div class="bbody"><div class="bhd"><span class="bno">Beat ${i + 1}</span><span class="blabel">${esc(b.beat)}</span><span class="t">${fmtTime(b.t)}</span></div><div class="btx">${this.rich(b.text)}</div></div></div>`).join('')}</div></div>`;
    this.modal.querySelectorAll<HTMLElement>('.nm').forEach(a => a.onclick = () => { this.closeModal(); this.app.select(a.dataset.id!); });
    this.modal.querySelector('.x')?.addEventListener('click', () => this.closeModal());
  }
  captionTO: any; captionText(html: string) { this.caption.innerHTML = html; this.caption.classList.add('show'); clearTimeout(this.captionTO); this.captionTO = setTimeout(() => this.caption.classList.remove('show'), 6000); }
  toastQ: [string, string][] = []; quiet = false;
  private toastTimers = new WeakMap<Element, ReturnType<typeof setTimeout>[]>();
  refreshToast(t: Element) {
    for (const timer of this.toastTimers.get(t) ?? []) clearTimeout(timer);
    t.classList.remove('out');
    this.toastTimers.set(t, [setTimeout(() => t.classList.add('out'), 4200), setTimeout(() => { t.remove(); this.toastTimers.delete(t); const n = this.toastQ.shift(); if (n) this.toast(n[0], n[1]); }, 5000)]);
  }
  toast(title: string, desc: string) { if (this.quiet) return;
    // the same achievement again (a story reaching more people) refreshes the toast already showing or queued, never stacks a twin
    const same = [...this.toasts.children].find(t => t.querySelector('b')?.textContent === title); if (same) { same.querySelector('span')!.innerHTML = this.linkify(desc); this.refreshToast(same); return; }
    const q = this.toastQ.find(t => t[0] === title); if (q) { q[1] = desc; return; }
    if (this.toasts.children.length >= 2) { if (this.toastQ.length < 6) this.toastQ.push([title, desc]); return; } const t = h('div', 'toast', `<b>${title}</b><span>${this.linkify(desc)}</span>`); this.toasts.appendChild(t); this.app.sound.play('toast'); this.refreshToast(t); }
  bubble(id: string, text: string, emoji: string, dur: number) {
    let b = this.bubbles.get(id); if (!b) { const el = h('div', 'bubble'); this.overlay.appendChild(el); b = { el, until: 0, t0: 0 }; this.bubbles.set(id, b); }
    b.el.innerHTML = `${emoji ? `<span class="em">${emoji}</span>` : ''}${esc(text)}`; b.el.classList.add('pop'); for (const animation of b.el.getAnimations()) { animation.cancel(); animation.play(); } b.t0 = performance.now(); b.until = performance.now() + dur * 1000 / Math.max(1, Math.sqrt(this.app.speed || 1));
  }
  private iconsDirty = false;
  private iconCanvas?: HTMLCanvasElement; private iconGlyphs = new Map<string, HTMLCanvasElement>();
  icon(id: string, emoji: string) {
    if (!this.iconCanvas) { const c = this.iconCanvas = document.createElement('canvas'); c.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none'; c.setAttribute('aria-hidden', 'true'); this.overlay.appendChild(c); }
    let glyph = this.iconGlyphs.get(emoji);
    if (!glyph) {
      glyph = document.createElement('canvas'); glyph.width = glyph.height = 96;
      const ctx = glyph.getContext('2d')!; ctx.scale(2, 2); ctx.font = '26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowOffsetY = 2; ctx.shadowBlur = 3; ctx.fillText(emoji, 24, 24);
      /* Glyphs rasterize once; each active icon is just a cached image instance. */
      if (this.iconGlyphs.size >= 128) this.iconGlyphs.delete(this.iconGlyphs.keys().next().value!);
      this.iconGlyphs.set(emoji, glyph);
    }
    this.icons.push({ glyph, id, t: 0 }); if (this.icons.length > 40) this.icons.shift();
  }

  // Measured element sizes are cached per (text, class) so the per-frame layout pass never reads offsetWidth after a write (layout thrash).
  private szCache = new WeakMap<HTMLElement, { k: string; w: number; h: number }>();
  private sz(el: HTMLElement) { const k = innerWidth + '|' + el.textContent; let c = this.szCache.get(el); if (!c || c.k !== k || !c.w) { c = { k, w: el.offsetWidth, h: el.offsetHeight }; this.szCache.set(el, c); } return c; }
  private setDisp(el: HTMLElement, show: boolean) { const d = show ? '' : 'none'; if (el.style.display !== d) el.style.display = d; }

  frame(dt: number) {
    const s = this.app.sim, now = performance.now();
    while (this.convo.length && this.convo[0].at <= s.clock) { const c = this.convo.shift()!; const v = s.byId.get(c.who); if (v && !v.inside) this.bubble(c.who, c.text, c.emoji, 3); }
    if (this.convo.length > 60) this.convo.splice(0, this.convo.length - 60);
    const close = this.app.camDist() < 30, W = window.innerWidth, HT = this.safeTop;
    { const far = this.app.camDist() > 42; this.markT += dt; for (const m of this.marks) { if (!far) { this.setDisp(m.el, false); continue; } const p = this.app.project(m.x, 5, m.z); const on = p.on && p.y > HT + 10; this.setDisp(m.el, on); if (on) m.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`; } }
    /* Batch visibility writes, then measure new text before positioning any labels. */
    for (const v of s.villagers) {
      const pos = v.avatar.root.position, p = this.app.project(pos.x, v.avatar.height + .55, pos.z), vis = p.on && !v.inside && v.avatar.alpha > .3;
      const tag = this.tags.get(v.id)!; this.setDisp(tag, vis && (close || this.app.selected === v.id));
      const b = this.bubbles.get(v.id); if (b) this.setDisp(b.el, vis && now < b.until);
    }
    for (const tag of this.tags.values()) if (tag.style.display !== 'none') this.sz(tag);
    for (const b of this.bubbles.values()) if (b.el.style.display !== 'none') this.sz(b.el);
    for (const v of s.villagers) {
      const pos = v.avatar.root.position, hh = v.avatar.height, tag = this.tags.get(v.id)!, p = this.app.project(pos.x, hh + .55, pos.z);
      const vis = p.on && !v.inside && v.avatar.alpha > .3;
      this.setDisp(tag, vis && (close || this.app.selected === v.id)); const isSel = this.app.selected === v.id; if (tag.classList.contains('sel') !== isSel) tag.classList.toggle('sel', isSel);
      const tagHidden = tag.style.display === 'none';
      if (vis && !tagHidden) { const { w: tw, h: th } = this.sz(tag); const tx = Math.max(tw / 2 + 4, Math.min(W - tw / 2 - 4, p.x)), ty = Math.max(HT + th, p.y); tag.style.transform = `translate(${tx}px, ${ty}px) translate(-50%, -100%)`; }
      const b = this.bubbles.get(v.id);
      if (b) { const show = vis && now < b.until; this.setDisp(b.el, show);
        if (show) { const q = this.app.project(pos.x, hh + 1.0, pos.z), { w: bw, h: bh } = this.sz(b.el);
          let bx = q.x, by = q.y - (tagHidden ? 0 : 18), below = false;
          if (by - bh < HT) { below = true; by = q.y + 16; } // flip bubble below the head if it would clip the topbar
          bx = Math.max(bw / 2 + 4, Math.min(W - bw / 2 - 4, bx));
          if (b.el.classList.contains('below') !== below) b.el.classList.toggle('below', below); b.el.style.transform = `translate(${bx}px, ${by}px) translate(-50%, ${below ? '0%' : '-100%'})`; } }
    }
    // Declutter: the selected villager and the newest speakers win; each bubble may stack at most twice above a
    // neighbour; at most 3 bubbles per crowd; anything that still collides (or sits under the open villager card) fades out.
    const shown: { id: string; el: HTMLElement; x: number; y: number; ax: number; ay: number; w: number; h: number; off: string; below: boolean; pri: number }[] = [];
    for (const [id, b] of this.bubbles) { if (b.el.style.display === 'none') continue; const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) translate\(-50%, ([^)]+)\)/.exec(b.el.style.transform); if (!m) continue; const z = this.sz(b.el); shown.push({ id, el: b.el, x: +m[1], y: +m[2], ax: +m[1], ay: +m[2], w: z.w, h: z.h, off: m[3], below: m[3].trim() === '0%', pri: id === this.app.selected ? 1e15 : b.t0 }); }
    shown.sort((a, b) => b.pri - a.pri);
    const rect = (a: { x: number; y: number; w: number; h: number; below: boolean }) => ({ l: a.x - a.w / 2 - 3, r: a.x + a.w / 2 + 3, t: a.below ? a.y - 3 : a.y - a.h - 3, b: a.below ? a.y + a.h + 3 : a.y + 3 });
    const hit = (p: { l: number; r: number; t: number; b: number }, q: { l: number; r: number; t: number; b: number }) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b;
    const obst: { l: number; r: number; t: number; b: number }[] = [];
    if (this.app.selected && this.cardRect) obst.push(this.cardRect);
    const placed: typeof shown = [];
    for (const a of shown) {
      if (a.below) { if (a.y < HT) a.y = HT; } else if (a.y - a.h < HT) a.y = HT + a.h;
      let ok = false;
      for (let tries = 0; tries < 3; tries++) {
        const ra = rect(a), blocker = placed.find(b => hit(ra, rect(b)));
        if (!blocker) { ok = true; break; }
        if (a.below) break; a.y = blocker.y - blocker.h - 8; if (a.y - a.h < HT) break;
      }
      const crowd = placed.filter(b => Math.abs(b.ax - a.ax) < 170 && Math.abs(b.ay - a.ay) < 130).length;
      if (ok && a.pri < 1e15 && (crowd >= 3 || obst.some(o => hit(rect(a), o)))) ok = false;
      if (ok) { placed.push(a); a.el.style.transform = `translate(${a.x}px, ${a.y}px) translate(-50%, ${a.off})`; }
      const op = ok ? '' : '0'; if (a.el.style.opacity !== op) a.el.style.opacity = op;
    }
    if (this.iconCanvas) {
      const c = this.iconCanvas, H = innerHeight, ratio = Math.min(devicePixelRatio, 2), w = Math.round(W * ratio), h = Math.round(H * ratio);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; c.style.width = `${W}px`; c.style.height = `${H}px`; }
      const ctx = c.getContext('2d')!; ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (this.icons.length || this.iconsDirty) ctx.clearRect(0, 0, W, H);
      this.iconsDirty = this.icons.length > 0; let alive = 0;
      for (const ic of this.icons) {
        ic.t += dt; if (ic.t > 2.2) continue; this.icons[alive++] = ic;
        const v = s.byId.get(ic.id); if (!v || v.inside) continue;
        const pos = v.avatar.root.position, bub = this.bubbles.get(ic.id), talking = !!bub && bub.until > now;
        const p = this.app.project(pos.x, v.avatar.height + (talking ? 1.9 : .9) + ic.t * .9, pos.z); if (!p.on) continue;
        const x = Math.max(16, Math.min(W - 16, p.x)), y = Math.max(HT, p.y), size = 48 * Math.min(1, ic.t * 5);
        ctx.globalAlpha = Math.max(0, 1 - ic.t / 2.2); ctx.drawImage(ic.glyph, x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = 1; this.icons.length = alive;
    }
    this.cardT -= dt; if (this.cardT <= 0) { this.cardT = .35; const cal = calendarFor(s.day); setHTML(this.clock, `<b><span class="wkd">${cal.weekday} · </span>${cal.dayOfSeason} ${cal.season}<span class="dno"> · Day ${s.day}</span></b> · ${fmtTime(s.clock)} ${s.rain > .4 ? '🌧️' : s.hour >= 20 || s.hour < 6 ? '🌙' : s.hour < 8 ? '🌅' : '☀️'}${s.festivalUntil > s.clock ? ' 🎪' : ''}${s.visitorUntil > s.clock ? ' 🧳' : ''}`); if (this.calOpen) this.renderCal();
      this.measureChrome();
      this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed! === this.app.speed)); { const m = this.root.querySelector('#mode') as HTMLElement, html = this.app.mode === 'director' ? '🎬<span> Director</span>' : '🕹️<span> Free cam</span>'; if (m.innerHTML !== html) m.innerHTML = html; }
      this.renderCard(); this.renderLB();
      { const r = this.card.classList.contains('hidden') ? null : this.card.getBoundingClientRect(); this.cardRect = r && r.width ? { l: r.left, r: r.right, t: r.top, b: r.bottom } : null; } }
  }
  // measure real topbar/dock heights so overlays and panels never assume a fixed chrome size
  measureChrome() {
    const tb = this.root.querySelector<HTMLElement>('.topbar'), dk = this.root.querySelector<HTMLElement>('.dock');
    if (tb) { const r = tb.getBoundingClientRect(); this.safeTop = r.bottom + 8; const th = `${Math.round(r.height)}px`; if (this.root.style.getPropertyValue('--top-h') !== th) this.root.style.setProperty('--top-h', th); }
    if (dk) { const dh = `${Math.round(dk.offsetHeight)}px`; if (this.root.style.getPropertyValue('--dock-h') !== dh) this.root.style.setProperty('--dock-h', dh); }
  }
  // the little calendar popover under the date/clock: this week's fixtures (from calendar tags) and the season
  toggleCal() {
    this.calOpen = !this.calOpen;
    if (!this.calOpen) { this.calPop.classList.add('hidden'); this.calPop.style.display = 'none'; return; }
    const r = this.clock.getBoundingClientRect();
    this.calPop.classList.remove('hidden');
    this.calPop.style.cssText = `position:fixed;z-index:50;top:${Math.round(this.safeTop)}px;left:${Math.round(Math.max(8, Math.min(r.left, innerWidth - 272)))}px;min-width:214px;max-width:min(92vw,272px);background:rgba(28,26,20,.94);color:#f3ead6;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.45);font-size:13px;line-height:1.4;backdrop-filter:blur(6px);`;
    this.renderCal();
  }
  renderCal() {
    const s = this.app.sim, cal = calendarFor(s.day), start = s.day - cal.weekdayIndex;
    const TAG: Record<string, [string, string]> = { market: ['🧺', 'Market day'], 'town-meeting': ['🏛️', 'Town meeting'], 'festival-eve': ['🎪', 'Festival eve'], rest: ['😌', 'Rest day'] };
    let rows = '';
    for (let i = 0; i < 7; i++) {
      const d = start + i; if (d < 1) continue; const c = calendarFor(d), today = d === s.day, tg = c.tags[0] ? TAG[c.tags[0]] : null;
      rows += `<div style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:7px;${today ? 'background:rgba(255,255,255,.14);font-weight:600;' : ''}"><span style="width:76px;opacity:${today ? '1' : '.82'}">${c.weekday}</span><span style="width:20px;text-align:right;opacity:.55">${c.dayOfSeason}</span><em style="flex:1;font-style:normal">${tg ? `${tg[0]} ${tg[1]}` : '<span style="opacity:.35">—</span>'}</em></div>`;
    }
    setHTML(this.calPop, `<div style="font-weight:700;margin-bottom:6px;letter-spacing:.3px">🗓️ ${cal.season} · Week ${cal.week}</div>${rows}`);
  }
  renderLB() {
    const s = this.app.sim, rows = this.app.director.ranked(this.lbKind), max = Math.max(1, ...rows.map(r => Math.abs(r.score)));
    const legend: Record<string, string> = { popularity: 'Liked — the village’s average opinion of you.', power: 'Influence — allies + admirers + those who fear you.', mischief: 'Mischief — thefts, rumours and fights stirred up.' };
    // trend vs ~24 game hours ago (popularity & influence are tracked in sim.history)
    const hk = this.lbKind === 'popularity' ? 'pop' : this.lbKind === 'power' ? 'power' : null;
    let past: Record<string, number> | null = null;
    if (hk && s.history.length) { const tgt = s.clock - 1440; let pick = s.history[0]; for (const snap of s.history) { if (snap.t <= tgt) pick = snap; } past = (pick as any)[hk]; }
    const trend = (id: string, cur: number) => { if (!past || past[id] === undefined) return ''; const d = cur - past[id]; return d > 2 ? '<span class="tr up" title="rising since yesterday">↑</span>' : d < -2 ? '<span class="tr dn" title="falling since yesterday">↓</span>' : '<span class="tr fl" title="steady">·</span>'; };
    setHTML(this.lb, `<div class="ph"><b>🏆 Leaderboard</b><div class="ff">${(['popularity', 'power', 'mischief'] as const).map(k => `<button data-k="${k}" class="${k === this.lbKind ? 'on' : ''}">${k === 'mischief' ? '😈 Mischief' : k === 'popularity' ? '❤️ Liked' : '👑 Influence'}</button>`).join('')}</div></div>` +
      `<div class="lbleg">${esc(legend[this.lbKind])}</div>` +
      rows.map((r, i) => { const neg = r.score < 0, w = Math.max(2, Math.abs(r.score) / max * 50); return `<div class="row" data-id="${r.v.id}"><span class="rk">${['🥇', '🥈', '🥉'][i] ?? i + 1}</span><span class="dot" style="background:${VCOLOR[r.v.id]}"></span><span class="n">${r.v.first}</span><span class="bar signed"><i class="${neg ? 'neg' : 'pos'}" style="${neg ? 'right:50%' : 'left:50%'};width:${w}%;background:${neg ? '#d1574b' : VCOLOR[r.v.id]}"></i></span><span class="sc">${r.score}${trend(r.v.id, r.score)}</span></div>`; }).join(''));
    this.lb.querySelectorAll<HTMLElement>('[data-k]').forEach(b => b.onclick = () => { this.lbKind = b.dataset.k as any; this.renderLB(); });
    this.lb.querySelectorAll<HTMLElement>('.row').forEach(b => b.onclick = () => this.app.select(b.dataset.id!));
  }
  mood(v: Villager) { const e = v.avatar.expr; return ({ happy: '😊', grin: '😁', sad: '😢', angry: '😠', scared: '😨', surprised: '😮', sleepy: '😴', love: '🥰', smirk: '😏', determined: '😤', dizzy: '😵‍💫', neutral: '🙂', knockedOut: '😵' } as any)[e] ?? '🙂'; }
  relLabel(o: number) { return o >= 70 ? 'Best friend' : o >= 35 ? 'Friend' : o >= 10 ? 'Friendly' : o > -10 ? 'Neutral' : o > -40 ? 'Wary' : o > -70 ? 'Dislikes' : 'Nemesis'; }
  // cheaply refresh the volatile header fields without tearing down the whole card (avoids flicker / focus loss)
  updateCardLive(v: Villager, s: Sim) {
    const md = this.card.querySelector('.md'); if (md) md.textContent = this.mood(v);
    const th = this.card.querySelector('.thought'); if (th) setHTML(th, `💭 ${esc(v.thought)}`);
    const dg = this.card.querySelector('.doing'); if (dg) setHTML(dg, `▶ ${esc(v.doing)}${v.inside ? ` <span class="muted">(inside ${s.place(v.inside).name})</span>` : ''}`);
    const bars = this.card.querySelectorAll<HTMLElement>('.need i'); if (bars.length >= 3) { bars[0].style.width = `${v.needs.food}%`; bars[1].style.width = `${v.needs.energy}%`; bars[2].style.width = `${v.needs.social}%`; }
  }
  private cardBodyAt = 0;
  renderCard() {
    const id = this.app.selected; if (!id) { this.card.classList.add('hidden'); this.card.dataset.rid = ''; return; } const s = this.app.sim, v = s.byId.get(id)!; this.card.classList.remove('hidden');
    const refresh = this.card.dataset.rid === id && this.card.dataset.rtab === this.tab;
    if (refresh) { this.updateCardLive(v, s); if (performance.now() - this.cardBodyAt < 2000) return; }
    this.cardBodyAt = performance.now();
    this.card.dataset.rid = id; this.card.dataset.rtab = this.tab;
    const al = v.alliance ? s.alliances.find(a => a.id === v.alliance) : null; const bar = (l: string, x: number, c: string) => `<div class="need"><span>${l}</span><b><i style="width:${x}%;background:${c}"></i></b></div>`;
    const traits = Object.entries(v.traits).map(([k, x]) => `<span class="tr" title="${k} ${x}">${k}<i style="width:${x * 100}%"></i></span>`).join('');
    const held = s.holding(v).map(k => `<span class="it ${k.owner !== v.id ? 'hot' : ''}" title="${k.owner !== v.id ? 'Belongs to ' + s.byId.get(k.owner)?.first : 'Treasured keepsake'}">${k.icon} ${esc(k.name.replace(/^(his|her) /, ''))}${k.owner !== v.id ? ` <em>(${s.byId.get(k.owner)?.first}'s!)</em>` : ''}</span>`).join('');
    const lost = s.missing(v); const heart = v.partner ? `<span class="it love">💞 Sweetheart: <b>${s.byId.get(v.partner)!.first}</b></span>` : v.crush ? `<span class="it love" title="Only you can see this">💘 Secretly sweet on <b>${s.byId.get(v.crush)!.first}</b></span>` : sim0(v, s) ;
    const inv = held + (lost ? `<span class="it miss">❓ ${esc(lost.name.replace(/^(his|her) /, ''))} is missing</span>` : '') + heart || '<span class="muted">nothing in their pockets</span>';
    let body = '';
    if (this.tab === 'rel') body = [...s.villagers].filter(u => u !== v).sort((a, b) => (v.opinion[b.id] ?? 0) - (v.opinion[a.id] ?? 0)).map(u => { const o = Math.round(v.opinion[u.id] ?? 0), back = Math.round(u.opinion[v.id] ?? 0), bel = v.mem.belief(u.id); return `<div class="rel" data-id="${u.id}"><span class="dot" style="background:${VCOLOR[u.id]}"></span><span class="n">${u.first}${v.family.includes(u.id) ? ' 👪' : ''}${u.alliance && u.alliance === v.alliance ? ' 🚩' : ''}</span><span class="ob"><i class="${o < 0 ? 'neg' : 'pos'}" style="${o < 0 ? 'right:50%' : 'left:50%'};width:${Math.abs(o) / 2}%"></i></span><span class="lab">${this.relLabel(o)}</span><span class="back" title="How ${u.first} feels about ${v.first}">${back >= 35 ? '💚' : back <= -35 ? '💢' : '·'}</span>${bel ? `<div class="bel">“${esc(bel.text)}”</div>` : ''}</div>`; }).join('');
    if (this.tab === 'plan') body = v.plan.filter(b => b.to > s.clock - 60).reduce((acc: PlanBlock[], b) => { const p = acc[acc.length - 1]; if (p && p.act === b.act && p.note === b.note && Math.abs(p.to - b.from) < 1) acc[acc.length - 1] = { ...p, to: b.to }; else acc.push(b); return acc; }, []).map(b => `<div class="pl ${s.clock >= b.from && s.clock < b.to ? 'now' : ''} ${b.act === 'event' ? 'evt' : ''}"><span class="t">${fmtTime(b.from)}–${fmtTime(b.to)}</span>${esc(b.note)}${dayOf(b.from) > s.day ? ' <i class="muted">(tomorrow)</i>' : ''}</div>`).join('') + (v.intent ? `<div class="intent">🎯 ${esc(v.intent)}</div>` : '');
    if (this.tab === 'mem') body = `${v.mem.beliefs.length ? `<div class="sub">Beliefs (from reflection)</div>${v.mem.beliefs.map(b => `<div class="mem refl">💭 ${esc(b.text)}</div>`).join('')}` : ''}<div class="sub">Most salient memories</div>` + v.mem.retrieve(s.clock, [], 10).map(m => `<div class="mem k-${m.kind}"><span class="t">${fmtTime(m.t)}</span><span class="imp" title="importance">${'●'.repeat(Math.ceil(m.imp / 2))}</span> ${esc(m.text)}</div>`).join('') + `<div class="sub">Knows ${v.mem.known.size} pieces of news · ${v.mem.items.length} memories</div>`;
    if (this.tab === 'story') body = v.story.slice().reverse().slice(0, 30).map(x => `<div class="st"><span class="t">${fmtTime(x.t)}</span>${this.rich(x.text)}</div>`).join('') || '<div class="muted">Nothing yet.</div>';
    if (refresh) {
      const tb = this.card.querySelector<HTMLElement>('.tb')!, top = tb.scrollTop, left = tb.scrollLeft, cardTop = this.card.scrollTop;
      setHTML(tb, body); setHTML(this.card.querySelector('.inv')!, inv);
      tb.scrollTop = top; tb.scrollLeft = left; this.card.scrollTop = cardTop;
    } else {
    this.card.innerHTML = `<button class="x">✕</button><div class="hd"><div class="pt"></div><div><div class="nmb" style="color:${VCOLOR[v.id]}">${v.name} <span class="md">${this.mood(v)}</span></div><div class="jb">${JOB_INFO[v.job].label} · ${v.def.age}</div><div class="gl">🎯 ${GOAL_LABEL[v.goal]}</div>${al ? `<div class="al" style="--c:${al.color}">🚩 ${al.name}</div>` : ''}</div></div>
      <div class="thought">💭 ${esc(v.thought)}</div><div class="doing">▶ ${esc(v.doing)}${v.inside ? ` <span class="muted">(inside ${s.place(v.inside).name})</span>` : ''}</div>
      ${bar('🍞 Fed', v.needs.food, '#e0a64a')}${bar('⚡ Energy', v.needs.energy, '#6cc36c')}${bar('💬 Social', v.needs.social, '#6aa6e8')}
      <div class="inv">${inv}</div><div class="traits">${traits}</div>
      <div class="tabs">${[['rel', 'Relationships'], ['plan', 'Plan'], ['mem', 'Mind'], ['story', 'Story']].map(([k, l]) => `<button data-t="${k}" class="${this.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="tb">${body}</div>`;
    const pt = this.card.querySelector('.pt')!; pt.appendChild(this.app.portrait(v.id));
    (this.card.querySelector('.x') as HTMLElement).onclick = () => this.app.select(null);
    this.card.querySelectorAll<HTMLElement>('[data-t]').forEach(b => b.onclick = () => { this.tab = b.dataset.t!; this.renderCard(); });
    }
    this.card.querySelectorAll<HTMLElement>('.rel').forEach(b => b.onclick = () => this.app.select(b.dataset.id!));
    this.card.querySelectorAll<HTMLElement>('.nm').forEach(a => a.onclick = () => this.app.select(a.dataset.id!));
  }
  closeModal() { this.modal.classList.add('hidden'); this.modal.innerHTML = ''; }
  view(kind: string) {
    const s = this.app.sim; this.modal.classList.remove('hidden');
    if (kind === 'paper') { const p = this.app.director.papers[this.app.director.papers.length - 1] ?? { ...this.app.director.paper(s.day), early: true }; this.showPaper(p); return; }
    if (kind === 'web') { this.modal.innerHTML = `<div class="sheet web"><button class="x">✕</button><h2>🕸️ Who likes whom</h2><p class="muted">Green = fondness, red = resentment, thickness = strength. Hover or tap a face to see who <b>they</b> like (→ outgoing) and who likes <b>them</b> (← incoming). 💞 sweethearts · 💗 crushes · 🚩 alliances.</p><canvas width="760" height="560"></canvas></div>`; drawWeb(this.modal.querySelector('canvas')!, s, VCOLOR, (id) => this.app.portrait(id)); }
    if (kind === 'recap') this.showRecap();
    if (kind === 'villagers') { this.modal.innerHTML = `<div class="sheet"><button class="x">✕</button><h2>👥 The villagers</h2><div class="vgrid">${s.villagers.map(v => `<div class="vc" data-id="${v.id}"><div class="pt"></div><b style="color:${VCOLOR[v.id]}">${v.name}</b><small>${JOB_INFO[v.job].label} · ${GOAL_LABEL[v.goal]}</small><p>${esc(v.def.bio)}</p></div>`).join('')}</div></div>`;
      this.modal.querySelectorAll<HTMLElement>('.vc').forEach(el => { el.querySelector('.pt')!.appendChild(this.app.portrait(el.dataset.id!)); el.onclick = () => { this.closeModal(); this.app.select(el.dataset.id!); }; }); }
    this.modal.querySelector('.x')?.addEventListener('click', () => this.closeModal());
  }
  showPaper(p: Paper) {
    this.modal.classList.remove('hidden'); this.app.sound.play('paper');
    this.modal.innerHTML = `<div class="sheet paper"><button class="x">✕</button><div class="mast">The Thistlebrook Gazette</div><div class="dateline">${p.early ? `Day ${p.day} · Early edition, today so far (the first full paper comes out at dawn)` : `Day ${p.day + 1} · Village morning edition`} · Weather: ${p.weather}</div><h1>${this.linkify(p.headline)}</h1>
      ${p.lead ? `<p class="lead">${this.linkify(p.lead)}</p>` : ''}
      <div class="cols"><div>${p.stories.map(x => `<p>${x.icon} ${this.rich(x.text)}</p>`).join('') || '<p>All quiet on the village front.</p>'}</div><div class="side"><h3>Standings</h3><p>❤️ Best-loved: <b>${p.leaders.popular}</b></p><p>👑 Most influential: <b>${p.leaders.power}</b></p><p>😈 Most mischievous: <b>${p.leaders.mischief}</b></p>${p.couples ? `<p>💞 Sweethearts: <b>${p.couples}</b></p>` : ''}${p.quote ? `<h3>Overheard</h3><p class="q">“${esc(p.quote.text)}”<br>— ${p.quote.who}</p>` : ''}</div></div></div>`;
    this.modal.querySelector('.x')?.addEventListener('click', () => this.closeModal());
  }
  showRecap() {
    const s = this.app.sim; const days = Object.keys(s.dayStats).map(Number).sort((a, b) => a - b);
    const at = arcs(s), top = at.top(4, 2);
    const statusLabel: Record<Arc['status'], string> = { brewing: 'brewing', open: 'ongoing', resolved: 'resolved' };
    const stories = top.length ? `<div class="stories">${top.map(a => `<div class="storyc" data-arc="${a.id}"><div class="shd"><span class="status ${a.status}">${statusLabel[a.status]}</span><b>📖 ${esc(a.title)}</b></div><div class="mini">${a.beats.map(b => `<span class="mb" title="${esc(b.beat)} · ${fmtTime(b.t)}">${b.icon}</span>`).join('<span class="arr">→</span>')}</div><div class="latest">${this.rich(a.beats[a.beats.length - 1].text)}</div></div>`).join('')}</div>` : '<p class="muted">No stories have taken shape yet — give the village time.</p>';
    this.modal.innerHTML = `<div class="sheet recap"><button class="x">✕</button><h2>📖 This week’s stories</h2>${stories}
      <h2>📈 The story so far</h2><canvas width="760" height="220"></canvas><div class="legend">${s.villagers.map(v => `<span><i style="background:${VCOLOR[v.id]}"></i>${v.first}</span>`).join('')}</div>
      <div class="timeline">${days.map(d => `<div class="day"><h3>Day ${d}</h3>${(s.dayStats[d] ?? []).filter(e => e.imp >= 5).slice(0, 8).map(e => `<p><span class="t">${fmtTime(e.t)}</span> ${e.icon} ${this.rich(e.text)}</p>`).join('') || '<p class="muted">A quiet day.</p>'}</div>`).join('')}</div></div>`;
    this.modal.querySelectorAll<HTMLElement>('.storyc').forEach(el => el.onclick = () => this.showArc(el.dataset.arc!));
    const c = this.modal.querySelector('canvas')!, g = c.getContext('2d')!, H = s.history; if (H.length > 1) { const max = Math.max(1, ...H.flatMap(x => Object.values(x.pop).map(Math.abs))); g.fillStyle = '#fbf4e4'; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = '#d9cdb3'; g.font = '12px sans-serif'; g.fillStyle = '#8a7a5a';
      const xOf = (t: number) => { let i = H.findIndex(x => x.t >= t); if (i < 0) i = H.length - 1; return 30 + i / (H.length - 1) * (c.width - 40); };
      for (const d of days) { const i = H.findIndex(x => x.t >= (d - 1) * 1440 + 360); if (i < 0) continue; const x = 30 + i / (H.length - 1) * (c.width - 40); g.beginPath(); g.moveTo(x, 10); g.lineTo(x, c.height - 20); g.stroke(); g.fillText(`Day ${d}`, x + 4, c.height - 6); }
      for (const v of s.villagers) { g.strokeStyle = VCOLOR[v.id]; g.lineWidth = 2.5; g.beginPath(); H.forEach((x, i) => { const px = 30 + i / (H.length - 1) * (c.width - 40), py = (c.height - 20) / 2 + 2 - (x.pop[v.id] / max) * ((c.height - 40) / 2); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); }
      // markers: a small flag at each beat of the top stories, so graph swings line up with events
      for (const a of top) for (const b of a.beats) { const x = xOf(b.t); g.fillStyle = '#b07d3a'; g.beginPath(); g.moveTo(x, 8); g.lineTo(x - 3, 2); g.lineTo(x + 3, 2); g.closePath(); g.fill(); g.strokeStyle = '#d9cdb3'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(x, 8); g.lineTo(x, c.height - 20); g.stroke(); g.setLineDash([]); }
      g.fillStyle = '#8a7a5a'; g.fillText('How liked (village average opinion)', 4, 14); g.strokeStyle = '#cbbd9c'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(30, (c.height - 20) / 2 + 2); g.lineTo(c.width - 10, (c.height - 20) / 2 + 2); g.stroke(); g.setLineDash([]); }
    this.modal.querySelector('.x')?.addEventListener('click', () => this.closeModal());
  }
}
