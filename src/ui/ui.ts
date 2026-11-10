import { llm, type RewriteContext } from '../sim/llm';
import type { Sim } from '../sim/sim';
import type { Villager, SimEvent, PlanBlock } from '../sim/types';
import type { Director, Paper } from '../sim/director';
import { JOB_INFO, GOAL_LABEL } from '../data/villagers';
import { fmtTime, dayOf } from '../core/util';
import { drawWeb } from './web';
import { arcs } from '../sim/arcs';
import type { Arc } from '../sim/arcs';
import { storylines, findStory } from './storylines';
import { calendarFor } from '../sim/calendar';
import { shortLine, moodOf, eventBubble } from './bubbletext';

export const VCOLOR: Record<string, string> = { mara: '#e8875b', tom: '#6c8fd1', jen: '#c96bd6', ollie: '#d8b23b', pip: '#6dbb5a', rosa: '#d4574a', wren: '#5fc0c4', edgar: '#a98a62', bram: '#b5763a', sol: '#4f7fa0', posy: '#e58fb1', agnes: '#8c7bc0', hugh: '#7a8a96', hazel: '#9fbf4a', mabel: '#c98a9a', kit: '#e0a040' };
const setHTML = (el: Element, html: string) => { if ((el as any)._html !== html) { (el as any)._html = html; el.innerHTML = html; } };
const h = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
export interface AppApi { sim: Sim; director: Director; setSpeed(s: number): void; togglePause(): void; speed: number; select(id: string | null): void; selected: string | null; portrait(id: string): HTMLCanvasElement; setMode(m: 'director' | 'free'): void; mode: string;
  pinStory(id: string | null): boolean; pinnedStory: string | null;
  hovered: string | null; focus: string | null; camPos(): { x: number; y: number; z: number }; occluded(x: number, y: number, z: number): boolean;
  god(kind: string): boolean; newVillage(): void; sound: import('./sound').Sound; project(x: number, y: number, z: number): { x: number; y: number; on: boolean }; camDist(): number; }

function sim0(v: Villager, s: any) { const f = s.villagers.filter((u: Villager) => u.crush === v.id && u.partner !== v.id && u !== v); return f.length ? `<span class="it love" title="Only you can see this">💌 ${f.map((u: Villager) => u.first).join(' & ')} ${f.length > 1 ? 'are' : 'is'} sweet on them</span>` : ''; }
interface Bubble { el: HTMLElement; until: number; t0: number; full: string; occ: boolean; occT: number; rewriteToken?: object }
// Panels (chronicle, leaderboard, storylines) start closed; the open/closed choice is remembered.
const PANEL_KEY = 'thistlebrook.panels';
type PanelId = 'feed' | 'lb' | 'story';
function loadPanels(): Record<PanelId, boolean> { try { const j = JSON.parse(localStorage.getItem(PANEL_KEY) ?? '{}'); return { feed: !!j.feed, lb: !!j.lb, story: !!j.story }; } catch { return { feed: false, lb: false, story: false }; } }
const narrow = () => matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const cleanLie = (t: string) => t.replace(/\s*\(It isn't true\.\)/gi, '').replace(/\.\s*,/g, ',').replace(/\s+/g, ' ').trim();
export class UI {
  root: HTMLElement; feed!: HTMLElement; card!: HTMLElement; clock!: HTMLElement; overlay!: HTMLElement; toasts!: HTMLElement; caption!: HTMLElement; lb!: HTMLElement; modal!: HTMLElement;
  marks: { el: HTMLElement; x: number; z: number }[] = []; markT = 0; cardRect: { l: number; r: number; t: number; b: number } | null = null;
  tags = new Map<string, HTMLElement>(); bubbles = new Map<string, Bubble>(); icons: { glyph: HTMLCanvasElement; id: string; t: number }[] = []; convo: { who: string; text: string; emoji: string; at: number; listener?: string }[] = [];
  tab = 'rel'; cardT = 0; lbKind: 'popularity' | 'power' | 'mischief' = 'popularity'; feedFilter = 'all'; autoPaper = true;
  feedDay = 0; safeTop = 70; hint: HTMLElement | null = null;
  storyPanel!: HTMLElement; storyChip!: HTMLElement; storyT = 0; storyCards = new Map<string, HTMLElement>();
  calPop!: HTMLElement; calOpen = false;
  feedWrap!: HTMLElement; dock!: HTMLElement; panels = loadPanels(); unread = 0;
  constructor(public app: AppApi, parent: HTMLElement) {
    this.root = h('div', 'ui'); parent.appendChild(this.root); this.build();
    const s = app.sim;
    arcs(s); // create the arc tracker first so it ingests each event before the feed renders its chip
    s.on('event', (e: SimEvent) => this.addFeed(e)); s.on('eventUpdate', (e: SimEvent) => this.updateFeed(e));
    s.on('bubble', (v: Villager, text: string, emoji: string, dur: number) => this.bubble(v.id, text, emoji, dur));
    s.on('icon', (v: Villager, emoji: string) => this.icon(v.id, emoji));
    s.on('convo', (lines: { who: string; text: string; emoji: string; at: number }[]) => this.convo.push(...lines.map(l => ({ ...l, listener: lines.find(other => other.who !== l.who)?.who }))));
    s.on('achievement', (a: any) => this.toast(`🏆 ${a.title}`, a.desc));
  }
  build() {
    const r = this.root;
    const top = h('div', 'topbar'); top.innerHTML = `<div class="brand" title="Thistlebrook, a digital terrarium"><span class="logo">🌿</span><div><b>Thistlebrook</b></div></div><div class="clock" id="clock"></div>
      <div class="speeds">${[[0, '⏸'], [1, '1×'], [4, '4×'], [16, '16×']].map(([s, l]) => `<button data-speed="${s}">${l}</button>`).join('')}</div>
      <div class="toggles"><span id="llm-status" role="status" hidden></span><button id="mode" title="Camera: cinematic director / free">🎬 Director</button><button id="snd" title="Sound">🔇</button></div>`;
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
    { /* sound: the first click turns sound on (a browser gesture) and opens the mixer; after that it toggles the mixer */
      const snd = top.querySelector('#snd') as HTMLButtonElement, so = this.app.sound, pop = h('div', 'sndpop hidden'); pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Sound settings');
      pop.innerHTML = `<button data-a="mute"></button><label><input type="checkbox" data-a="music"> 🎵 Music</label><label class="vol">Music volume <input type="range" min="0" max="1" step="0.05" data-a="vol"></label><label><input type="checkbox" data-a="amb"> 🌿 Ambience</label>`;
      r.appendChild(pop);
      const sync = () => { snd.textContent = so.muted ? '🔇' : '🔊'; snd.title = so.muted ? 'Sound off: click for music and ambience' : 'Sound settings'; (pop.querySelector('[data-a=mute]') as HTMLElement).textContent = so.muted ? '🔊 Turn sound on' : '🔇 Mute all';
        (pop.querySelector('[data-a=music]') as HTMLInputElement).checked = so.settings.music; (pop.querySelector('[data-a=amb]') as HTMLInputElement).checked = so.settings.amb; (pop.querySelector('[data-a=vol]') as HTMLInputElement).value = String(so.settings.vol); };
      so.onChange = sync; sync();
      snd.onclick = (e) => { e.stopPropagation(); if (so.muted) { so.setMuted(false); pop.classList.remove('hidden'); } else pop.classList.toggle('hidden'); const b = snd.getBoundingClientRect(); pop.style.top = `${b.bottom + 6}px`; pop.style.right = `${Math.max(6, innerWidth - b.right)}px`; };
      pop.addEventListener('click', e => e.stopPropagation());
      (pop.querySelector('[data-a=mute]') as HTMLElement).onclick = () => { so.setMuted(!so.muted); if (so.muted) pop.classList.add('hidden'); };
      (pop.querySelector('[data-a=music]') as HTMLInputElement).onchange = e => so.setMusic((e.target as HTMLInputElement).checked);
      (pop.querySelector('[data-a=amb]') as HTMLInputElement).onchange = e => so.setAmbience((e.target as HTMLInputElement).checked);
      (pop.querySelector('[data-a=vol]') as HTMLInputElement).oninput = e => so.setVolume(+(e.target as HTMLInputElement).value);
      addEventListener('pointerdown', e => { if (!pop.contains(e.target as Node) && e.target !== snd) pop.classList.add('hidden'); });
    }
    const fw = h('div', 'feedwrap'); fw.innerHTML = `<div class="ph"><b>📜 Village chronicle</b><div class="ff"><button data-f="all" class="on">All</button><button data-f="drama">Drama</button><button data-f="social">Social</button><button data-f="work">Work</button><button data-f="life">Life</button></div><button class="feedtog" title="Close chronicle" aria-label="Close chronicle">✕</button></div>`;
    this.feed = h('div', 'feed'); fw.appendChild(this.feed); r.appendChild(fw);
    // one delegated listener for every name link and story chip in the chronicle (rows come and go; listeners don't pile up)
    this.feed.addEventListener('click', (ev) => { const t = ev.target as HTMLElement; const nm = t.closest<HTMLElement>('.nm'); if (nm) { ev.stopPropagation(); this.app.select(nm.dataset.id!); return; } const ch = t.closest<HTMLElement>('.arcchip'); if (ch) { ev.stopPropagation(); this.showArc(ch.dataset.arc!); } });
    fw.querySelectorAll<HTMLButtonElement>('[data-f]').forEach(b => b.onclick = () => { this.feedFilter = b.dataset.f!; fw.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); this.refilter(); });
    fw.querySelector<HTMLButtonElement>('.feedtog')!.onclick = () => this.setPanel('feed', false);
    this.feedWrap = fw;
    const letterStyle = document.createElement('style'); letterStyle.textContent = `.handwritten{background:#f8edcf;color:#513b31;padding:22px;border:1px solid #d2b984;border-radius:3px;box-shadow:0 6px 22px #30201040;font:16px/1.6 "Segoe Print","Bradley Hand","Comic Neue",cursive;transform:rotate(-1deg);text-align:left;overflow-wrap:anywhere}.handwritten p{margin:8px 0}.letter-float{display:block;width:min(320px,82vw);border:0;background:none;padding:4px;cursor:pointer;pointer-events:auto}.letter-view{width:min(420px,86vw);max-height:85vh;overflow:auto;margin:auto}.letter-close{margin-bottom:12px}.tb .handwritten{margin:10px 5px;font-size:14px}`; r.appendChild(letterStyle);
    this.card = h('div', 'card hidden'); r.appendChild(this.card);
    this.lb = h('div', 'lb'); r.appendChild(this.lb);
    // Compact icon dock: god powers | panels you can open | full-screen views. Labels live in tooltips.
    const B = (attr: string, icon: string, label: string) => `<button ${attr} title="${label}" aria-label="${label}"><span class="ico">${icon}</span><i>${label}</i></button>`;
    const dock = h('div', 'dock'); dock.innerHTML = `<div class="grp g-god">${B('data-g="gift"', '🎁', 'Drop a gift')}${B('data-g="rain"', '🌧️', 'Summon rain')}${B('data-g="traveller"', '🧳', 'Send a traveller')}${B('data-g="festival"', '🎪', 'Start a festival')}</div>
      <div class="grp g-panel">${B('data-p="feed"', '📜', 'Village chronicle')}${B('data-p="story"', '📺', 'Storylines')}${B('data-p="lb"', '🏆', 'Leaderboard')}</div>
      <div class="grp g-view">${B('data-v="web"', '🕸️', 'Who likes whom')}${B('data-v="paper"', '📰', 'The Gazette')}${B('data-v="recap"', '📈', 'Recap')}${B('data-v="villagers"', '👥', 'Villagers')}</div>`;
    this.dock = dock;
    r.appendChild(dock);
    this.storyPanel = h('section', 'storyguide panelish'); this.storyPanel.setAttribute('aria-label', 'Storylines');
    this.storyPanel.innerHTML = '<header><b>📺 Storylines</b><small>Previously… and what happens next?</small><button aria-label="Collapse storylines">▾</button></header><div class="storycards"></div>';
    r.appendChild(this.storyPanel);
    this.storyPanel.querySelector('header button')!.setAttribute('aria-label', 'Close storylines'); this.storyPanel.querySelector('header button')!.textContent = '✕';
    this.storyPanel.querySelector('header button')!.addEventListener('click', () => this.setPanel('story', false));
    this.storyPanel.addEventListener('click', e => { const el = e.target as HTMLElement, pin = el.closest<HTMLElement>('[data-pin]'), nm = el.closest<HTMLElement>('.nm'); if (pin) this.app.pinStory(this.app.pinnedStory === pin.dataset.pin ? null : pin.dataset.pin!); else if (nm) this.app.select(nm.dataset.id!); });
    this.storyChip = h('button', 'storyfollow hidden'); this.storyChip.title = 'Stop following storyline'; this.storyChip.onclick = () => this.app.pinStory(null); r.appendChild(this.storyChip);

    // god powers cool down (a sweep fills the button) so spamming can't flood the chronicle
    const COOL: Record<string, number> = { gift: 8, rain: 25, traveller: 30, festival: 30 };
    dock.querySelectorAll<HTMLButtonElement>('[data-g]').forEach(b => b.onclick = () => { if (b.classList.contains('cool')) return; const k = b.dataset.g!; if (!this.app.god(k)) return; b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 600);
      const sec = COOL[k] ?? 10; b.classList.add('cool'); b.setAttribute('aria-disabled', 'true'); b.style.setProperty('--cool', `${sec}s`); const t0 = b.title; b.title = 'Recharging…'; setTimeout(() => { b.classList.remove('cool'); b.removeAttribute('aria-disabled'); b.title = t0; }, sec * 1000); });
    dock.querySelectorAll<HTMLButtonElement>('[data-p]').forEach(b => b.onclick = () => this.setPanel(b.dataset.p as PanelId, !this.panels[b.dataset.p as PanelId]));
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
    // one-time tip: shown on the very first visit only, gone after a few seconds or the first tap
    if (!localStorage.getItem('thistlebrook.hinted')) { const hint = h('div', 'hint', '👆 Tap a villager to peek at their thoughts'); hint.onclick = () => hint.classList.add('gone'); r.appendChild(hint); this.hint = hint; try { localStorage.setItem('thistlebrook.hinted', '1'); } catch {} setTimeout(() => hint.classList.add('gone'), 12000); }
    this.applyPanels();
    window.addEventListener('keydown', e => { if (e.key === 'Escape') { this.closeModal(); this.app.select(null); } if (e.key === ' ') { this.app.togglePause(); e.preventDefault(); } });
  }
  // ---- panels: closed by default, opened from the dock, remembered in localStorage ----
  setPanel(id: PanelId, open: boolean) {
    if (open && narrow()) for (const k of Object.keys(this.panels) as PanelId[]) if (k !== id) this.panels[k] = false; // one sheet at a time on small screens
    this.panels[id] = open; if (id === 'feed' && open) this.unread = 0;
    try { localStorage.setItem(PANEL_KEY, JSON.stringify(this.panels)); } catch {}
    this.applyPanels(); if (id === 'story' && open) this.renderStorylines(); if (id === 'lb' && open) this.renderLB();
  }
  applyPanels() {
    const p = this.panels;
    this.feedWrap.classList.toggle('open', p.feed); this.lb.classList.toggle('open', p.lb);
    this.storyPanel.classList.toggle('open', p.story); this.storyPanel.classList.toggle('expanded', p.story && narrow()); this.storyPanel.classList.remove('folded');
    this.dock.querySelectorAll<HTMLElement>('[data-p]').forEach(b => { const on = p[b.dataset.p as PanelId]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    this.updateUnread();
  }
  updateUnread() { const b = this.dock.querySelector<HTMLElement>('[data-p="feed"]'); if (!b) return; const n = this.panels.feed ? 0 : this.unread; const t = n ? String(Math.min(n, 9)) + (n > 9 ? '+' : '') : ''; if (b.dataset.badge !== t) { b.dataset.badge = t; b.classList.toggle('badge-on', !!t); } }
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
      : ['letter', 'talk', 'gift', 'gossip', 'invite', 'party', 'bond', 'reflect', 'generous', 'lunch', 'breakfast', 'evening', 'social', 'meeting', 'market', 'calendar', 'prank', 'mediate'].includes(e.kind) ? 'social' : 'work';
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
    if (e.kind === 'letter') { el.style.cursor = 'pointer'; el.onclick = () => { const id = this.app.sim.letterEvents[e.id]; const l = this.app.sim.letterArchive.find(l => l.id === id); if (l) this.showLetter(l); }; }
    this.arcChip(el, e.id);
    this.applyFilter(el);
    this.feed.prepend(el); while (this.feed.children.length > 100) this.feed.lastChild!.remove();
    if (!this.panels.feed && e.imp >= 6) { this.unread++; this.updateUnread(); }
    this.eventBubble(e);
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
  // a short bubble over the actor for an interaction that has no spoken line of its own (the chronicle keeps the full text)
  eventBubble(e: SimEvent) {
    const s = this.app.sim, eb = eventBubble(e, id => s.byId.get(id)?.first ?? ''); if (!eb) return;
    const v = s.byId.get(eb.who); if (!v || v.inside) return;
    const b = this.bubbles.get(eb.who); if (b && b.until > performance.now()) return;
    if (this.convo.some(c => c.who === eb.who && c.at < s.clock + 12)) return; // they're about to say something themselves
    this.bubble(eb.who, eb.text, eb.emoji, 2.6, e.actors[1]);
  }
  promoteCaption(e: SimEvent, el: HTMLElement) {
    if (e.kind === 'life') return;
    let visibleInFeed = el.style.display !== 'none' && this.panels.feed && this.feed.getClientRects().length > 0;
    for (let panel: HTMLElement | null = this.feed; visibleInFeed && panel; panel = panel.parentElement) {
      const style = getComputedStyle(panel);
      if (style.display === 'none' || style.visibility !== 'visible' || style.opacity === '0') visibleInFeed = false;
    }
    // one short line only; the full story is a tap away in the chronicle
    if (e.imp >= 7 && !visibleInFeed) this.captionText(`${e.icon} ${this.linkify(shortLine(this.isLie(e) ? cleanLie(e.text) : e.text, 12))}`);
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
  captionTO: any; captionText(html: string) { if (this.quiet) return; this.caption.innerHTML = html; this.caption.classList.add('show'); clearTimeout(this.captionTO); this.captionTO = setTimeout(() => this.caption.classList.remove('show'), 4500); }
  letterHTML(l: import('../sim/letters').Letter) { return `<article class="handwritten"><span aria-hidden="true">💮 ✉️</span><p>${esc(l.text).replace(/\n/g, '<br>')}</p></article>`; }
  showLetter(l: import('../sim/letters').Letter, floating = false) {
    // floating = a small toast ("✉️ A note from Ollie") that expands into the handwritten card when tapped
    if (floating) { if (this.quiet) return; const s = this.app.sim, from = s.byId.get(l.from)?.first ?? 'someone', to = s.byId.get(l.to)?.first ?? '';
      this.toasts.querySelector('.letter-toast')?.remove();
      const el = h('button', 'letter-toast', `<span class="lt-ic">✉️</span><span class="lt-tx"><b>${esc(from)} → ${esc(to)}</b><small>${esc(shortLine(l.text.split('\n').map(x => x.trim()).find(x => x.split(' ').length >= 3) ?? l.text, 6))}</small></span>`);
      el.title = 'Read the letter'; el.onclick = () => { el.remove(); this.showLetter(l); }; this.toasts.appendChild(el); setTimeout(() => el.classList.add('out'), 6500); setTimeout(() => el.remove(), 7300); }
    else { this.modal.innerHTML = `<div class="letter-view"><button class="letter-close">Close</button>${this.letterHTML(l)}</div>`; this.modal.classList.remove('hidden'); this.modal.querySelector<HTMLButtonElement>('.letter-close')!.onclick = () => this.closeModal(); }
  }
  toastQ: [string, string][] = []; quiet = false;
  private toastTimers = new WeakMap<Element, ReturnType<typeof setTimeout>[]>();
  refreshToast(t: Element) {
    for (const timer of this.toastTimers.get(t) ?? []) clearTimeout(timer);
    t.classList.remove('out');
    this.toastTimers.set(t, [setTimeout(() => t.classList.add('out'), 4200), setTimeout(() => { t.remove(); this.toastTimers.delete(t); const n = this.toastQ.shift(); if (n) this.toast(n[0], n[1]); }, 5000)]);
  }
  toast(title: string, desc: string) { if (this.quiet) return;
    // the same achievement again (a story reaching more people) refreshes the toast already showing or queued, never stacks a twin
    const same = [...this.toasts.children].find(t => t.querySelector('b')?.textContent === title); if (same) { same.querySelector('span')!.innerHTML = this.linkify(shortLine(desc, 10)); this.refreshToast(same); return; }
    const q = this.toastQ.find(t => t[0] === title); if (q) { q[1] = desc; return; }
    if (this.toasts.children.length >= 2) { if (this.toastQ.length < 6) this.toastQ.push([title, desc]); return; } const t = h('div', 'toast', `<b>${title}</b><span>${this.linkify(shortLine(desc, 10))}</span>`); t.title = desc; this.toasts.appendChild(t); this.app.sound.play('toast'); this.refreshToast(t); }
  // Speech bubble: a short line (the full text stays in sim.transcripts / the chronicle), tinted by mood.
  // In a two-way exchange the listener's bubble steps aside so the pair alternates.
  bubble(id: string, text: string, emoji: string, dur: number, listener?: string) {
    if (this.quiet) return; // fast-forwarding: the transcript keeps the line, the screen doesn't
    let b = this.bubbles.get(id); if (!b) { const el = h('div', 'bubble'); this.overlay.appendChild(el); b = { el, until: 0, t0: 0, full: '', occ: false, occT: 0 }; this.bubbles.set(id, b); }
    const now = performance.now(), short = shortLine(text), mood = moodOf(emoji);
    const paint = (t: string) => setHTML(b!.el, `${emoji ? `<span class="em">${emoji}</span>` : ''}<span class="bt">${esc(t)}</span>`);
    paint(short); b.full = text; b.el.className = `bubble m-${mood}`;
    void b.el.offsetWidth; b.el.classList.add('pop');
    b.t0 = now; b.until = now + Math.max(2.2, dur) * 1000 / Math.max(1, Math.sqrt(this.app.speed || 1));
    if (listener) { const o = this.bubbles.get(listener); if (o && o.until > now) o.until = Math.min(o.until, now + 250); }
    const v = this.app.sim.byId.get(id), bubble = b, token = {};
    bubble.rewriteToken = token;
    // the optional LLM may rephrase, but whatever it says is clipped back to bubble length
    if (v && llm.status().enabled) void llm.rewrite(text, this.rewriteContext(v, 'Spoken aloud in a small speech bubble (keep it under 8 words) while ' + v.doing, listener)).then(rewritten => {
      if (bubble.rewriteToken === token && performance.now() < bubble.until && llm.status().enabled) paint(shortLine(rewritten));
    });
  }
  private rewriteContext(v: Villager, context: string, listener?: string): RewriteContext {
    const u = listener ? this.app.sim.byId.get(listener) : undefined;
    return { speaker: v.id, persona: `${v.name}, ${JOB_INFO[v.job].label}. ${v.def.bio}. Traits: ${JSON.stringify(v.traits)}. Mood: ${JSON.stringify(v.emotions)}. Listener: ${u ? `${u.name}; opinion ${v.opinion[u.id] ?? 0}; ${v.partner === u.id ? 'sweetheart' : v.family.includes(u.id) ? 'family' : 'fellow villager'}` : 'private thought or no specific listener'}.`, context };
  }
  private mindText(v: Villager, text: string, about?: string) { return llm.status().enabled ? llm.display(text, this.rewriteContext(v, 'Private reflection; ' + v.doing, about)) : text; }
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
    const status = llm.status(), chip = this.root.querySelector<HTMLElement>('#llm-status')!;
    chip.hidden = !status.enabled; const label = status.ok ? '🧠 LLM · ok' : '🧠 LLM · offline'; if (chip.textContent !== label) chip.textContent = label;
    while (this.convo.length && this.convo[0].at <= s.clock) { const c = this.convo.shift()!; if (c.at < s.clock - 8) continue; const v = s.byId.get(c.who); if (v && !v.inside) this.bubble(c.who, c.text, c.emoji, 3, c.listener); }
    if (this.convo.length > 60) this.convo.splice(0, this.convo.length - 60);
    const W = window.innerWidth, HT = this.safeTop;
    { const far = this.app.camDist() > 42; this.markT += dt; for (const m of this.marks) { if (!far) { this.setDisp(m.el, false); continue; } const p = this.app.project(m.x, 5, m.z); const on = p.on && p.y > HT + 10; this.setDisp(m.el, on); if (on) m.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`; } }
    // ---- name tags & speech bubbles ----------------------------------------------------------------
    // Tags: only on hover, or for the selected / followed villager at close range.
    // Bubbles: at most 4 (3 on phones), nearest the camera / focus first; they shrink with distance, hide when far
    // or behind a building, fade in and out, and never cover the open villager card.
    const cam = this.app.camPos(), sel = this.app.selected, foc = this.app.focus, hov = this.app.hovered, maxB = narrow() ? 3 : 4;
    type Cand = { id: string; el: HTMLElement; x: number; y: number; w: number; h: number; sc: number; below: boolean; pri: number; fading: boolean };
    const cands: Cand[] = [];
    for (const v of s.villagers) {
      const pos = v.avatar.root.position, hh = v.avatar.height, tag = this.tags.get(v.id)!, p = this.app.project(pos.x, hh + .55, pos.z);
      const vis = p.on && !v.inside && v.avatar.alpha > .3, d = Math.hypot(cam.x - pos.x, cam.y - (pos.y + hh), cam.z - pos.z);
      const key = v.id === sel || v.id === foc;
      const showTag = vis && (v.id === hov || (key && d < 24));
      this.setDisp(tag, showTag); const isSel = sel === v.id; if (tag.classList.contains('sel') !== isSel) tag.classList.toggle('sel', isSel);
      if (showTag) { const { w: tw, h: th } = this.sz(tag); const tx = Math.max(tw / 2 + 4, Math.min(W - tw / 2 - 4, p.x)), ty = Math.max(HT + th, p.y); tag.style.transform = `translate(${tx}px, ${ty}px) translate(-50%, -100%)`; }
      const b = this.bubbles.get(v.id); if (!b) continue;
      const live = now < b.until + 350, fading = now >= b.until;
      let show = vis && live && d < (key ? 60 : 42);
      if (show && now - b.occT > 250) { b.occT = now; b.occ = !key && this.app.occluded(pos.x, pos.y + hh + .4, pos.z); }
      if (show && b.occ) show = false;
      if (!show) { this.setDisp(b.el, false); continue; }
      this.setDisp(b.el, true);
      const q = this.app.project(pos.x, hh + .95, pos.z), sc = Math.max(.8, Math.min(1.08, 21 / d)), z = this.sz(b.el);
      const cx = q.x - W / 2, cy = q.y - innerHeight / 2;
      const pri = (v.id === sel ? 1e9 : v.id === foc ? 1e8 : 0) + (1000 - d * 12) - Math.hypot(cx, cy) * .05 + (fading ? -500 : 0) + b.t0 * 1e-6;
      cands.push({ id: v.id, el: b.el, x: q.x, y: q.y - (showTag ? 16 : 0), w: z.w * sc, h: z.h * sc, sc, below: false, pri, fading });
    }
    cands.sort((a, b) => b.pri - a.pri);
    const rect = (a: Cand) => ({ l: a.x - a.w / 2 - 3, r: a.x + a.w / 2 + 3, t: a.below ? a.y - 3 : a.y - a.h - 3, b: a.below ? a.y + a.h + 3 : a.y + 3 });
    const hit = (p: { l: number; r: number; t: number; b: number }, q: { l: number; r: number; t: number; b: number }) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b;
    const obst: { l: number; r: number; t: number; b: number }[] = [];
    if (sel && this.cardRect) obst.push(this.cardRect);
    const placed: Cand[] = [];
    for (const a of cands) {
      a.x = Math.max(a.w / 2 + 4, Math.min(W - a.w / 2 - 4, a.x));
      if (a.y - a.h < HT) { a.below = true; a.y = Math.max(HT, a.y + 30); }
      let ok = placed.length < maxB;
      if (ok) for (let tries = 0; tries < 3; tries++) {
        const blocker = placed.find(o => hit(rect(a), rect(o)));
        if (!blocker) break;
        if (a.below || tries === 2) { ok = false; break; } a.y = blocker.y - blocker.h - 6; if (a.y - a.h < HT) { ok = false; break; }
      }
      if (ok && a.pri < 1e8 && obst.some(o => hit(rect(a), o))) ok = false;
      if (ok) placed.push(a);
      if (a.el.classList.contains('below') !== a.below) a.el.classList.toggle('below', a.below);
      const out = !ok || a.fading; if (a.el.classList.contains('out') !== out) a.el.classList.toggle('out', out);
      if (ok) a.el.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px) translate(-50%, ${a.below ? '0%' : '-100%'}) scale(${a.sc.toFixed(3)})`;
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
    this.cardT -= dt; if (this.cardT <= 0) { this.cardT = .35; const cal = calendarFor(s.day); setHTML(this.clock, `<b><span class="wkd">${cal.weekday} · </span>${cal.dayOfSeason} ${cal.season}<span class="dno"> · Day ${s.day}</span></b> · ${fmtTime(s.clock)} ${s.rain > .4 ? '🌧️' : s.hour >= 20 || s.hour < 6 ? '🌙' : s.hour < 8 ? '🌅' : '☀️'}${s.finaleUntil > s.clock ? ' 🎆' : s.festivalUntil > s.clock ? ' 🎪' : ''}${s.visitorUntil > s.clock ? ' 🧳' : ''}`); if (this.calOpen) this.renderCal();
      this.measureChrome();
      this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed! === this.app.speed)); { const m = this.root.querySelector('#mode') as HTMLElement, html = this.app.mode === 'director' ? '🎬<span> Director</span>' : '🕹️<span> Free cam</span>'; if (m.innerHTML !== html) m.innerHTML = html; }
      this.renderCard(); if (this.panels.lb) this.renderLB(); this.storyT -= .35; if (this.storyT <= 0) { this.storyT = 1.05; this.renderStorylines(); }
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
      const d = start + i; if (d < 1) continue; const c = calendarFor(d), today = d === s.day, tg = c.dayOfSeason === 7 ? ['🎆', 'Season finale · 18–23h'] : c.tags[0] ? TAG[c.tags[0]] : null;
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
    const th = this.card.querySelector('.thought'); if (th) setHTML(th, `💭 ${esc(this.mindText(v, v.thought))}`);
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
    if (this.tab === 'rel') body = [...s.villagers].filter(u => u !== v).sort((a, b) => (v.opinion[b.id] ?? 0) - (v.opinion[a.id] ?? 0)).map(u => { const o = Math.round(v.opinion[u.id] ?? 0), back = Math.round(u.opinion[v.id] ?? 0), bel = v.mem.belief(u.id); return `<div class="rel" data-id="${u.id}"><span class="dot" style="background:${VCOLOR[u.id]}"></span><span class="n">${u.first}${v.family.includes(u.id) ? ' 👪' : ''}${u.alliance && u.alliance === v.alliance ? ' 🚩' : ''}</span><span class="ob"><i class="${o < 0 ? 'neg' : 'pos'}" style="${o < 0 ? 'right:50%' : 'left:50%'};width:${Math.abs(o) / 2}%"></i></span><span class="lab">${this.relLabel(o)}</span><span class="back" title="How ${u.first} feels about ${v.first}">${back >= 35 ? '💚' : back <= -35 ? '💢' : '·'}</span>${bel ? `<div class="bel">“${esc(this.mindText(v, bel.text, u.id))}”</div>` : ''}</div>`; }).join('');
    if (this.tab === 'plan') body = v.plan.filter(b => b.to > s.clock - 60).reduce((acc: PlanBlock[], b) => { const p = acc[acc.length - 1]; if (p && p.act === b.act && p.note === b.note && Math.abs(p.to - b.from) < 1) acc[acc.length - 1] = { ...p, to: b.to }; else acc.push(b); return acc; }, []).map(b => `<div class="pl ${s.clock >= b.from && s.clock < b.to ? 'now' : ''} ${b.act === 'event' ? 'evt' : ''}"><span class="t">${fmtTime(b.from)}–${fmtTime(b.to)}</span>${esc(b.note)}${dayOf(b.from) > s.day ? ' <i class="muted">(tomorrow)</i>' : ''}</div>`).join('') + (v.intent ? `<div class="intent">🎯 ${esc(v.intent)}</div>` : '');
    if (this.tab === 'mem') body = `${v.mem.beliefs.length ? `<div class="sub">Beliefs (from reflection)</div>${v.mem.beliefs.map(b => `<div class="mem refl">💭 ${esc(this.mindText(v, b.text, b.about))}</div>`).join('')}` : ''}<div class="sub">Most salient memories</div>` + v.mem.retrieve(s.clock, [], 10).map(m => `<div class="mem k-${m.kind}"><span class="t">${fmtTime(m.t)}</span><span class="imp" title="importance">${'●'.repeat(Math.ceil(m.imp / 2))}</span> ${esc(m.text)}</div>`).join('') + `<div class="sub">Knows ${v.mem.known.size} pieces of news · ${v.mem.items.length} memories</div>`;
    if (this.tab === 'letters') body = s.letterArchive.filter(l => l.from === v.id || (l.to === v.id && l.read !== undefined) || l.readers.includes(v.id)).slice().reverse().map(l => `<div class="sub">${l.from === v.id ? 'Sent' : 'Received'} · ${l.delivered === undefined ? 'In transit' : l.read === undefined ? 'Delivered' : 'Read'}</div>${this.letterHTML(l)}`).join('') || '<div class="muted">No letters yet.</div>';
    if (this.tab === 'story') body = v.story.slice().reverse().slice(0, 30).map(x => `<div class="st"><span class="t">${fmtTime(x.t)}</span>${this.rich(x.text)}</div>`).join('') || '<div class="muted">Nothing yet.</div>';
    if (refresh) {
      const tb = this.card.querySelector<HTMLElement>('.tb')!, top = tb.scrollTop, left = tb.scrollLeft, cardTop = this.card.scrollTop;
      setHTML(tb, body); setHTML(this.card.querySelector('.inv')!, inv);
      tb.scrollTop = top; tb.scrollLeft = left; this.card.scrollTop = cardTop;
    } else {
    this.card.innerHTML = `<button class="x">✕</button><div class="hd"><div class="pt"></div><div><div class="nmb" style="color:${VCOLOR[v.id]}">${v.name} <span class="md">${this.mood(v)}</span></div><div class="jb">${JOB_INFO[v.job].label} · ${v.def.age}</div><div class="gl">🎯 ${GOAL_LABEL[v.goal]}</div>${al ? `<div class="al" style="--c:${al.color}">🚩 ${al.name}</div>` : ''}</div></div>
      <div class="thought">💭 ${esc(this.mindText(v, v.thought))}</div><div class="doing">▶ ${esc(v.doing)}${v.inside ? ` <span class="muted">(inside ${s.place(v.inside).name})</span>` : ''}</div>
      ${bar('🍞 Fed', v.needs.food, '#e0a64a')}${bar('⚡ Energy', v.needs.energy, '#6cc36c')}${bar('💬 Social', v.needs.social, '#6aa6e8')}
      <div class="inv">${inv}</div><div class="traits">${traits}</div>
      <div class="tabs">${[['rel', 'Relationships'], ['plan', 'Plan'], ['mem', 'Mind'], ['story', 'Story'], ['letters', 'Letters']].map(([k, l]) => `<button data-t="${k}" class="${this.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="tb">${body}</div>`;
    const pt = this.card.querySelector('.pt')!; pt.appendChild(this.app.portrait(v.id));
    (this.card.querySelector('.x') as HTMLElement).onclick = () => this.app.select(null);
    this.card.querySelectorAll<HTMLElement>('[data-t]').forEach(b => b.onclick = () => { this.tab = b.dataset.t!; this.renderCard(); });
    }
    this.card.querySelectorAll<HTMLElement>('.rel').forEach(b => b.onclick = () => this.app.select(b.dataset.id!));
    this.card.querySelectorAll<HTMLElement>('.nm').forEach(a => a.onclick = () => this.app.select(a.dataset.id!));
  }
  closeModal() { this.modal.classList.add('hidden'); this.modal.innerHTML = ''; }
  renderStorylines() {
    const list = storylines(this.app.sim), box = this.storyPanel.querySelector('.storycards')!;
    for (const [id, el] of this.storyCards) if (!list.some(s => s.id === id)) { el.remove(); this.storyCards.delete(id); }
    list.forEach((s, i) => {
      let el = this.storyCards.get(s.id); if (!el) { el = h('article', 'guidecard'); this.storyCards.set(s.id, el); }
      const age = s.last ? Math.max(0, this.app.sim.clock - s.last.t) : 0, ago = age < 60 ? `${Math.floor(age)}m ago` : `${Math.floor(age / 60)}h ago`;
      const pinned = this.app.pinnedStory === s.id;
      setHTML(el, `<div class="guideheading"><b>${s.emoji} ${s.resolved ? 'Resolved: ' : ''}${esc(s.title)}</b><button data-pin="${s.id}" aria-label="${pinned ? 'Unpin' : 'Follow'} storyline" aria-pressed="${pinned}" ${s.resolved ? 'disabled' : ''}>${pinned ? '📌' : '＋ Pin'}</button></div><small>${esc(s.status)}</small><p>${esc(s.teaser)}</p><div>${s.actors.map(id => this.name(id)).join(' · ')}</div><meter min="0" max="1" value="${s.heat}" aria-label="${s.kind === 'feud' ? 'Feud heat' : 'Story momentum'}"></meter><div class="guidelast">${s.last ? `Last: ${esc(s.last.text)} · ${ago}` : 'The first chapter is still being written…'}</div>`);
      if (box.children[i] !== el) box.insertBefore(el, box.children[i] ?? null);
    });
    box.classList.toggle('empty', !list.length); box.setAttribute('data-empty', 'A quiet chapter… watch for new stories.');
    const pin = this.app.pinnedStory, title = pin ? findStory(this.app.sim, pin)?.title : null;
    this.storyChip.classList.toggle('hidden', !pin); if (pin) this.storyChip.textContent = `📌 Following: ${title ?? 'storyline'}  ✕`;
  }
  view(kind: string) {
    if (kind === 'storylines') { this.setPanel('story', !this.panels.story); return; }
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
