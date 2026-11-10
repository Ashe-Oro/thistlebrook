/* Thistlebrook's adaptive score: original, generative, and synthesised live in WebAudio (no samples).
   By day, sparse open-voiced piano phrases drift over long silences. Near the plaza they turn into a warmer
   village variation with a lilting 3/4 left hand. At night the score uses felt piano and celesta over low strings.
   Rain darkens and mutes it. Festivals and season finales get a jig on fiddle and flute with light percussion.
   Story cues add a tension sting, a resolution flourish, and a tender wedding motif.
   Every note is scheduled ahead on the audio clock, so the same engine renders live or into an OfflineAudioContext. */

export interface MusicState { night: number; plaza: number; rain: number; winter: number; festival: boolean; finale: boolean }
export type MusicCue = 'sting' | 'flourish' | 'wedding';
type Ctx = BaseAudioContext;
type Chord = { root: number; iv: number[] };
interface Theme { name: string; tonic: number; scale: number[]; color: number[]; chords: Record<number, number[]>; next: Record<number, number[]>; bpm: number; gap: [number, number]; reg: number; lh: number; answer: number }

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
function mulberry(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* Open voicings: root, fifth, then a ninth or tenth on top. */
const ADD9 = [0, 7, 14, 16], MAJ7 = [0, 7, 11, 16], M7 = [0, 7, 10, 15], SUS2 = [0, 7, 14, 19], M9 = [0, 7, 14, 15], MAJ = [0, 7, 12, 16];
const THEMES: Record<string, Theme> = {
  field: { name: 'field', tonic: 62, scale: [0, 2, 4, 7, 9], color: [6, 11], bpm: 66, gap: [4, 10], reg: 62, lh: 38, answer: .4,
    chords: { 0: ADD9, 5: MAJ7, 9: M7, 7: SUS2, 2: M7 }, next: { 0: [5, 9, 7, 2], 5: [0, 9, 7], 9: [5, 7, 0], 7: [0, 5, 9], 2: [7, 5] } },
  village: { name: 'village', tonic: 65, scale: [0, 2, 4, 7, 9], color: [5, 10], bpm: 84, gap: [3, 8], reg: 65, lh: 41, answer: .55,
    chords: { 0: MAJ, 5: ADD9, 10: MAJ, 7: SUS2, 9: M7 }, next: { 0: [5, 10, 7, 9], 5: [0, 7, 10], 10: [5, 0], 7: [0, 9], 9: [5, 7] } },
  night: { name: 'night', tonic: 57, scale: [0, 3, 5, 7, 10], color: [2, 9], bpm: 50, gap: [6, 13], reg: 57, lh: 33, answer: .25,
    chords: { 0: M9, 8: MAJ7, 5: M7, 3: ADD9, 10: SUS2 }, next: { 0: [8, 5, 3, 10], 8: [0, 3, 10], 5: [0, 8], 3: [8, 10, 0], 10: [0, 3] } },
  rain: { name: 'rain', tonic: 62, scale: [0, 2, 3, 7, 9], color: [5, 10], bpm: 56, gap: [6, 13], reg: 62, lh: 38, answer: .3,
    chords: { 0: M9, 5: ADD9, 10: MAJ7, 3: MAJ7 }, next: { 0: [5, 10, 3], 5: [0, 10], 10: [3, 0], 3: [5, 0] } },
};
/* Original motifs as degrees of the five-note scale, with lengths in beats. */
const MOTIFS: [number, number][][] = [
  [[4, 1], [3, .5], [2, 1.5], [0, 1], [1, 3]],
  [[0, .5], [2, .5], [4, 2], [5, 1], [4, 3]],
  [[2, 1], [4, 1], [3, .5], [2, .5], [1, 1], [2, 3]],
  [[5, 1.5], [4, .5], [2, 1], [3, 1], [1, 3]],
  [[0, 1], [4, 1], [5, .5], [6, 1.5], [4, 1], [3, 2.5]],
  [[7, 2], [5, 1], [4, 1], [2, 1.5], [3, .5], [1, 3]],
  [[1, .5], [2, .5], [4, 1], [2, 1], [0, 3]],
  [[3, 1], [2, .5], [3, .5], [5, 2], [4, 1], [2, 3]],
  [[4, 2], [5, .5], [4, .5], [2, 2], [0, 3]],
  [[2, .5], [3, .5], [4, .5], [7, 2.5], [6, 1], [4, 3]],
];
/* Jig cells for festivals: degrees of the seven-note major scale, relative to each bar's chord root. */
const JIG = [[0, 2, 4, 2, 0, 2], [4, 2, 0, -1, 0, 2], [0, 1, 2, 4, 2, 1], [7, 4, 2, 4, 2, 0], [2, 4, 4, 5, 4, 2], [4, 5, 7, 5, 4, 2], [0, -1, 0, 2, 4, 7]];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

export class Music {
  ctx: Ctx; private out: GainNode; private mix: GainNode; private tone: BiquadFilterNode; private festBus: GainNode; private festLP: BiquadFilterNode;
  private noise: AudioBuffer; private r: () => number; private phrases: { g: GainNode; end: number }[] = [];
  private nextAt = 2; private theme = 'field'; private chord = 0; private lastMotif = -1; private lastCue: Record<string, number> = {};
  private fest: null | { nextBar: number; bar: number; finale: boolean; sec: number[][][]; ending: number } = null;
  private s: MusicState = { night: 0, plaza: 0, rain: 0, winter: 0, festival: false, finale: false };
  enabled = true; volume = .7; private primed = false; log?: (msg: string) => void;
  constructor(ctx: Ctx, dest: AudioNode, seed = 20261110) {
    this.ctx = ctx; this.r = mulberry(seed);
    this.out = ctx.createGain(); this.out.gain.value = this.volume; this.out.connect(dest);
    this.tone = ctx.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 16000; this.tone.Q.value = .4; this.tone.connect(this.out);
    this.mix = ctx.createGain(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 65; hp.Q.value = .5; this.mix.connect(hp).connect(this.tone); /* keeps the low left hand from muddying small speakers */
    const verb = ctx.createConvolver(); verb.buffer = this.impulse(2.8); const wet = ctx.createGain(); wet.gain.value = .42; this.mix.connect(verb).connect(wet).connect(hp);
    this.festLP = ctx.createBiquadFilter(); this.festLP.type = 'lowpass'; this.festLP.frequency.value = 12000; this.festBus = ctx.createGain(); this.festBus.gain.value = 0; this.festBus.connect(this.festLP).connect(this.mix);
    const n = ctx.sampleRate, b = ctx.createBuffer(1, n, n), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = this.r() * 2 - 1; this.noise = b;
  }
  private impulse(sec: number) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * sec), b = this.ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const k = i / n; lp += ((this.r() * 2 - 1) - lp) * (.55 - .4 * k); d[i] = lp * Math.pow(1 - k, 2.6) * (i < sr * .012 ? i / (sr * .012) : 1); } }
    return b;
  }
  setVolume(v: number, now = this.ctx.currentTime) { this.volume = v; this.out.gain.setTargetAtTime(this.enabled ? v : 0, now, .3); }
  setEnabled(on: boolean, now = this.ctx.currentTime) { this.enabled = on; this.out.gain.setTargetAtTime(on ? this.volume : 0, now, .4); if (on) this.nextAt = Math.max(this.nextAt, now + 1.5); }

  /* ---------------- instruments ---------------- */
  private pan(dest: AudioNode, p: number) { const n = this.ctx.createStereoPanner(); n.pan.value = clamp(p, -1, 1); n.connect(dest); return n; }
  piano(dest: AudioNode, t: number, m: number, vel: number, dur: number, felt = false) {
    const c = this.ctx, f = mtof(m), g = c.createGain(), lp = c.createBiquadFilter(), peak = vel * (felt ? .2 : .17);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(felt ? 380 + 1500 * vel : 900 + 4200 * vel, t); lp.frequency.setTargetAtTime(felt ? 320 : 700, t + .02, .7);
    const tau = clamp(1.7 * Math.pow(440 / f, .35), .5, 3) * (felt ? .8 : 1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + (felt ? .014 : .004)); g.gain.setTargetAtTime(peak * .5, t + .02, .25); g.gain.setTargetAtTime(0, t + .3, tau); g.gain.setTargetAtTime(0, t + Math.max(.35, dur), .32);
    lp.connect(g).connect(this.pan(dest, (m - 62) / 36));
    const parts = felt ? [[1, 1], [2.001, .22]] : [[1, 1], [2.002, .38], [3.007, .13]];
    for (const [k, a] of parts) { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f * k; o.detune.value = (this.r() - .5) * 5; og.gain.value = a; o.connect(og).connect(lp); o.start(t); o.stop(t + Math.max(.35, dur) + 1.6); }
    if (!felt) { const s = c.createBufferSource(), bp = c.createBiquadFilter(), hg = c.createGain(); s.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = Math.min(6000, f * 4); bp.Q.value = 1.2; hg.gain.setValueAtTime(vel * .05, t); hg.gain.setTargetAtTime(0, t, .012); s.connect(bp).connect(hg).connect(lp); s.start(t, this.r() * .5); s.stop(t + .08); }
  }
  celesta(dest: AudioNode, t: number, m: number, vel: number, glass = false) {
    const c = this.ctx, f = mtof(m), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * (glass ? 3.53 : 4); mg.gain.setValueAtTime(f * 1.3 * vel, t); mg.gain.setTargetAtTime(0, t, glass ? .5 : .22);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * .12, t + .003); g.gain.setTargetAtTime(0, t + .004, glass ? 1.7 : 1);
    mod.connect(mg).connect(car.frequency); car.connect(g).connect(this.pan(dest, (m - 70) / 30));
    car.start(t); mod.start(t); car.stop(t + 5); mod.stop(t + 5);
  }
  pad(dest: AudioNode, t: number, ms: number[], dur: number, vol: number, bright: number, strings = false) {
    const c = this.ctx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300 + 900 * bright; lp.Q.value = .3;
    const att = strings ? 1.6 : 2.6; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.setTargetAtTime(0, t + Math.max(att, dur), 1.4);
    lp.connect(g).connect(dest);
    let lfo: OscillatorNode | null = null, lg: GainNode | null = null;
    if (strings) { lfo = c.createOscillator(); lfo.frequency.value = 4.6; lg = c.createGain(); lg.gain.value = 5; lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 7); }
    for (const m of ms) for (const dt of [-7, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt; if (lg) lg.connect(o.detune); const og = c.createGain(); og.gain.value = .5 / ms.length; o.connect(og).connect(lp); o.start(t); o.stop(t + dur + 7); }
  }
  flute(dest: AudioNode, t: number, m: number, dur: number, vel: number) {
    const c = this.ctx, f = mtof(m), o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 2; const g2 = c.createGain(); g2.gain.value = .12;
    vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .005, t + Math.min(.4, dur)); vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    lp.type = 'lowpass'; lp.frequency.value = 3200;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * .11, t + .06); g.gain.setTargetAtTime(vel * .085, t + .07, .2); g.gain.setTargetAtTime(0, t + dur, .07);
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(this.pan(dest, .25));
    const s = c.createBufferSource(), bp = c.createBiquadFilter(), bg = c.createGain(); s.buffer = this.noise; s.loop = true; bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 1.5; bg.gain.setValueAtTime(vel * .02, t); bg.gain.setTargetAtTime(vel * .006, t + .05, .1); bg.gain.setTargetAtTime(0, t + dur, .05); s.connect(bp).connect(bg).connect(g);
    for (const n of [o, o2, vib]) { n.start(t); n.stop(t + dur + .5); } s.start(t, this.r() * .5); s.stop(t + dur + .5);
  }
  fiddle(dest: AudioNode, t: number, m: number, dur: number, vel: number) {
    const c = this.ctx, f = mtof(m), o = c.createOscillator(), g = c.createGain(), pk = c.createBiquadFilter(), lp = c.createBiquadFilter(), vib = c.createOscillator(), vg = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f * .985, t); o.frequency.linearRampToValueAtTime(f, t + .05);
    vib.frequency.value = 5.6; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .006, t + Math.min(.3, dur)); vib.connect(vg).connect(o.frequency);
    pk.type = 'peaking'; pk.frequency.value = 1000; pk.gain.value = 5; pk.Q.value = 1.2; lp.type = 'lowpass'; lp.frequency.value = 3000;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * .07, t + .045); g.gain.setTargetAtTime(vel * .055, t + .05, .15); g.gain.setTargetAtTime(0, t + dur, .06);
    o.connect(pk).connect(lp).connect(g).connect(this.pan(dest, -.25)); o.start(t); vib.start(t); o.stop(t + dur + .5); vib.stop(t + dur + .5);
  }
  drum(dest: AudioNode, t: number, vel: number) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + .12);
    g.gain.setValueAtTime(vel * .5, t); g.gain.setTargetAtTime(0, t + .005, .09); o.connect(g).connect(dest); o.start(t); o.stop(t + .6);
    this.hiss(dest, t, vel * .1, 700, 'lowpass', .03);
  }
  private hiss(dest: AudioNode, t: number, vol: number, freq: number, type: BiquadFilterType, tau: number, q = .8) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.setTargetAtTime(0, t + .002, tau); s.connect(f).connect(g).connect(dest); s.start(t, this.r() * .8); s.stop(t + tau * 8 + .05);
  }
  tamb(dest: AudioNode, t: number, vel: number) { this.hiss(dest, t, vel * .16, 6500, 'highpass', .045); }
  sleigh(dest: AudioNode, t: number, vel: number) { for (let i = 0; i < 4; i++) { const tt = t + i * .045 + this.r() * .01; this.hiss(dest, tt, vel * .05, 7500, 'bandpass', .05, 4); this.celesta(dest, tt, 98 + [0, 4, 7, 12][i], vel * .25, true); } }

  /* ---------------- composition ---------------- */
  private pickTheme(s: MusicState) {
    const nightW = clamp((s.night - .3) / .4), dayW = 1 - nightW, rainW = clamp((s.rain - .25) / .4);
    const w: Record<string, number> = { night: nightW, rain: dayW * rainW, village: dayW * (1 - rainW) * s.plaza, field: dayW * (1 - rainW) * (1 - s.plaza) };
    w[this.theme] *= 1.6; /* hysteresis: themes don't flicker at dawn and dusk */
    let sum = 0; for (const k in w) sum += w[k]; let x = this.r() * sum; for (const k in w) { x -= w[k]; if (x <= 0) return k; } return 'field';
  }
  private phraseBus(t: number) { const g = this.ctx.createGain(); g.gain.value = 1; g.connect(this.mix); this.phrases.push({ g, end: t + 30 }); this.phrases = this.phrases.filter(p => p.end > t - 5); return g; }
  private duck(now: number) { for (const p of this.phrases) if (p.end > now) { p.g.gain.setTargetAtTime(0, now, .25); p.end = now; } }
  private degToMidi(th: Theme, d: number) { const n = th.scale.length, o = Math.floor(d / n), i = ((d % n) + n) % n; return th.tonic + th.scale[i] + 12 * o; }
  private schedulePhrase(t: number) {
    const s = this.s, prev = this.theme; this.theme = this.pickTheme(s); const th = THEMES[this.theme];
    if (this.theme !== prev || !(this.chord in th.chords)) this.chord = 0; else { const nx = th.next[this.chord]; this.chord = nx[Math.floor(this.r() * nx.length)]; }
    const bus = this.phraseBus(t), night = this.theme === 'night', rain = this.theme === 'rain', village = this.theme === 'village', winter = s.winter > .5;
    const felt = night || rain || (s.night > .2 && this.r() < .5), beat = 60 / th.bpm;
    const mel: 'piano' | 'celesta' | 'flute' | 'glass' = winter && this.r() < .4 ? 'glass' : night && this.r() < .4 ? 'celesta' : village && this.r() < .3 ? 'flute' : 'piano';
    /* left hand: an open chord rolled upwards, slow and soft */
    const ch = th.chords[this.chord], lhRoot = th.lh + this.chord - (this.chord > 7 ? 12 : 0), lhNotes = ch.map(iv => lhRoot + iv);
    let tt = t; lhNotes.forEach((m, i) => this.piano(bus, tt + i * (.07 + this.r() * .06), m, (i === 0 ? .22 : .28) + this.r() * .1 - i * .02, 4 * beat, true));
    /* melody: a motif, transformed, maybe answered */
    let notes = this.motif(th); if (this.r() < th.answer) { const ans = this.motif(th, true); notes = notes.concat([[NaN, 1 + this.r()] as [number, number]], ans); }
    tt = t + beat * (1 + this.r());
    const total = notes.reduce((n, x) => n + x[1], 0); let acc = 0, lastM = th.reg;
    for (let i = 0; i < notes.length; i++) {
      const [d, len] = notes[i], k = acc / total; acc += len;
      const rit = 1 + Math.max(0, k - .7) * 1.1, rub = 1 + (this.r() - .5) * .18, dur = len * beat * rit * rub;
      if (!Number.isNaN(d)) {
        const m = this.degToMidi(th, d) + (th.reg - th.tonic - (th.reg - th.tonic) % 12), vel = .32 + .3 * Math.sin(Math.PI * clamp(k + .1)) + (this.r() - .5) * .08;
        if (len >= 1.5 && this.r() < .15) this.piano(bus, tt - .07, this.degToMidi(th, d + 1) + (m - this.degToMidi(th, d)), vel * .45, .1, felt);
        if (mel === 'piano') this.piano(bus, tt, m, vel, dur * 1.1, felt);
        else if (mel === 'celesta' || mel === 'glass') { this.celesta(bus, tt, m + (mel === 'celesta' ? 12 : 0), vel, mel === 'glass'); if (mel === 'glass') this.piano(bus, tt, m, vel * .5, dur, true); }
        else this.flute(bus, tt, m, dur * .95, vel + .1);
        if (night && len >= 2 && this.r() < .3) this.piano(bus, tt + .02, m - 9, vel * .5, dur, true); /* a soft sixth beneath */
        lastM = m;
      }
      tt += dur;
      if (village && i === Math.floor(notes.length / 2)) { const nx = th.next[this.chord]; const c2 = nx[0]; this.waltz(bus, tt, th, c2, beat); }
    }
    if (village) this.waltz(bus, t + beat, th, this.chord, beat);
    /* pads carry the harmony and overlap into the next phrase, which smooths dawn and dusk */
    const padVol = night ? .05 : rain ? .045 : village ? .02 : .03;
    if (this.r() < (night ? .85 : .6)) this.pad(bus, t, lhNotes.slice(1).map(m => m + 12), tt - t + 2, padVol, night ? .25 : rain ? .2 : .5, night);
    if (winter && !night && this.r() < .35) this.sleigh(bus, t + .2, .7);
    const phraseEnd = tt + 1.5; this.phrases[this.phrases.length - 1].end = phraseEnd + 4;
    /* silence, the most important instrument; sometimes a single far-off note answers inside it */
    const gap = th.gap[0] + this.r() * (th.gap[1] - th.gap[0]); if (this.r() < .3) this.piano(bus, phraseEnd + gap * .5, lastM + (this.r() < .5 ? -5 : 7), .18, 2, true);
    this.nextAt = phraseEnd + gap; this.log?.(`${t.toFixed(1)}s ${this.theme} chord ${this.chord} ${mel} ${notes.length} notes, gap ${gap.toFixed(1)}s`);
  }
  private motif(th: Theme, answer = false): [number, number][] {
    let i = Math.floor(this.r() * MOTIFS.length); if (i === this.lastMotif) i = (i + 1) % MOTIFS.length; this.lastMotif = i;
    let m = MOTIFS[i].map(x => [x[0], x[1]] as [number, number]);
    if (this.r() < .25) m = m.slice(0, 3 + Math.floor(this.r() * 2)).concat([[m[m.length - 1][0], 2.5]]);
    if (this.r() < .25) { const p = m[0][0]; m = m.map(([d, l]) => [2 * p - d, l]); }
    if (this.r() < .15) { const ls = m.map(x => x[1]); m = m.reverse().map(([d], k) => [d, ls[k]]); }
    if (this.r() < .3) m = m.map(([d, l]) => [d, l * 1.5]);
    const shift = answer ? -1 - Math.floor(this.r() * 2) : Math.floor(this.r() * 5) - 2; m = m.map(([d, l]) => [d + shift, l]);
    if (answer) m[m.length - 1][0] = Math.round(m[m.length - 1][0] / 5) * 5; /* answers come home to the tonic */
    for (const x of m) x[0] = clamp(x[0], -3, 9);
    void th; return m;
  }
  private waltz(bus: AudioNode, t: number, th: Theme, chord: number, beat: number) {
    const root = th.lh + chord - (chord > 7 ? 12 : 0), iv = th.chords[chord] ?? MAJ;
    for (let bar = 0; bar < 2; bar++) { const b0 = t + bar * 3 * beat; this.piano(bus, b0, root, .3, beat, true); for (const k of [1, 2]) { this.piano(bus, b0 + k * beat + .01, root + 12 + iv[1] - 7 + 7, .14, beat * .6, true); this.piano(bus, b0 + k * beat + .02, root + 12 + (iv[3] - 12), .12, beat * .6, true); } }
  }

  /* ---------------- festival jig ---------------- */
  private genSection(b: boolean): number[][][] {
    const prog = b ? [3, 0, 4, 0, 3, 0, 4, 0] : [0, 3, 0, 4, 0, 3, 4, 0], bars: number[][][] = [];
    for (let i = 0; i < 8; i++) {
      const root = prog[i]; let cell = JIG[Math.floor(this.r() * JIG.length)].map(d => d + root + (b ? 7 : 0));
      if (this.r() < .3) { const k = 1 + Math.floor(this.r() * 4); cell[k] += this.r() < .5 ? 1 : -1; }
      if (i === 3) cell = [cell[0], cell[1], cell[2], (b ? 11 : 4), NaN, NaN];
      if (i === 7) cell = [cell[0], cell[1], cell[2], (b ? 7 : 0), NaN, NaN];
      bars.push([[root], cell]);
    }
    return bars;
  }
  private startFest(now: number, finale: boolean) {
    this.duck(now); const t = now + .6;
    this.fest = { nextBar: t, bar: 0, finale, sec: this.genSection(false), ending: -1 };
    this.festBus.gain.cancelScheduledValues(now); this.festBus.gain.setValueAtTime(this.festBus.gain.value, now); this.festBus.gain.linearRampToValueAtTime(1, now + 2.5);
    this.log?.(`${now.toFixed(1)}s festival${finale ? ' (finale)' : ''} begins`);
  }
  private scheduleBar() {
    const F = this.fest!, e = .2, t0 = F.nextBar, sec = Math.floor(F.bar / 8) % 4, idx = F.bar % 8;
    if (idx === 0 && F.bar > 0) F.sec = this.genSection(sec >= 2);
    if (idx === 0 && sec === 1) F.sec = F.sec.map((bar, i) => i === 7 || i === 3 ? bar : [bar[0], bar[1].map((d, k) => k === 2 && this.r() < .5 ? d + 2 : d)]);
    const [[root], cell] = F.sec[idx], pos = [0, .36, .66, 1, 1.36, 1.66].map(x => x * 3 * e), bus = this.festBus, G = 67;
    const dm = (d: number) => G + MAJOR[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const lead = sec >= 2 ? 'flute' : 'fiddle';
    for (let k = 0; k < 6; k++) {
      const d = cell[k]; if (Number.isNaN(d)) continue; let n = 1; while (k + n < 6 && Number.isNaN(cell[k + n])) n++;
      const len = (k + n < 6 ? pos[k + n] : 6 * e) - pos[k], vel = (k === 0 || k === 3 ? .75 : .55) + this.r() * .1;
      const at = t0 + pos[k] + (this.r() - .5) * .012;
      if (lead === 'fiddle' || F.finale) this.fiddle(bus, at, dm(d) - (lead === 'flute' ? 12 : 0), len * .92, vel);
      if (lead === 'flute' || F.finale) this.flute(bus, at, dm(d) + (lead === 'fiddle' ? 12 : 0), len * .9, vel * (F.finale && lead === 'fiddle' ? .7 : 1));
    }
    const bass = 43 + MAJOR[root % 7], third = 55 + MAJOR[(root + 2) % 7], fifth = 55 + MAJOR[(root + 4) % 7];
    this.piano(bus, t0, bass, .5, 2 * e); this.piano(bus, t0 + pos[3], bass + 7, .42, 2 * e);
    for (const k of [2, 5]) { this.piano(bus, t0 + pos[k], third, .26, e); this.piano(bus, t0 + pos[k] + .008, fifth, .24, e); }
    this.drum(bus, t0, F.finale ? .8 : .6); this.drum(bus, t0 + pos[3], F.finale ? .5 : .35);
    for (const k of [2, 5]) this.tamb(bus, t0 + pos[k], F.finale ? .9 : .6);
    if (F.finale) { for (const k of [1, 4]) this.tamb(bus, t0 + pos[k], .35); if (idx === 0) this.pad(bus, t0, [bass + 12, third + 12, fifth + 12], 8 * 6 * e - 1, .03, .7); }
    F.nextBar = t0 + 6 * e; F.bar++;
    if (F.ending >= 0 && idx === 7) { this.piano(bus, F.nextBar, 43, .55, 3); this.piano(bus, F.nextBar + .05, 62, .4, 3); this.piano(bus, F.nextBar + .1, 71, .4, 3); this.celesta(bus, F.nextBar + .1, 79, .5); this.fest = null; this.festBus.gain.setTargetAtTime(0, F.nextBar + 3, .8); this.nextAt = F.nextBar + 6; this.log?.(`${F.nextBar.toFixed(1)}s festival ends with a cadence`); }
  }

  /* ---------------- story cues ---------------- */
  cue(c: MusicCue, now = this.ctx.currentTime) {
    if (!this.enabled || now - (this.lastCue[c] ?? -99) < 8) return; this.lastCue[c] = now; this.log?.(`${now.toFixed(1)}s cue ${c}`);
    const t = now + .05, th = THEMES[this.theme], fest = !!this.fest;
    if (c === 'sting') {
      if (!fest) this.duck(now); const bus = this.phraseBus(t), base = th.tonic - 24;
      [0, 1, 6].forEach((iv, i) => this.piano(bus, t + i * .03, base + iv, .55, 2.5, true));
      const c2 = this.ctx, g = c2.createGain(), trem = c2.createOscillator(), tg = c2.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + 1.2); g.gain.setTargetAtTime(0, t + 1.6, .5);
      trem.frequency.value = 9; tg.gain.value = .025; trem.connect(tg).connect(g.gain); trem.start(t); trem.stop(t + 4);
      const lp = c2.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(g).connect(bus);
      for (const m of [base + 12, base + 13]) { const o = c2.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.connect(lp); o.start(t); o.stop(t + 4); }
      this.piano(bus, t + 1.4, th.tonic + 13, .35, 1.5, true);
      if (!fest) this.nextAt = Math.max(this.nextAt, now + 6);
    } else if (c === 'flourish') {
      const bus = this.phraseBus(t); const steps = [0, 2, 4, 5, 7, 9]; steps.forEach((d, i) => this.celesta(bus, t + i * .085, this.degToMidi(THEMES.field, d) + 12, .5 + i * .05));
      const root = 50; [0, 7, 14, 16, 19].forEach((iv, i) => this.piano(bus, t + .55 + i * .05, root + iv, .38, 3));
      if (!fest) { this.nextAt = Math.max(this.nextAt, now + 6); }
    } else if (c === 'wedding') {
      if (fest) return; this.duck(now); const bus = this.phraseBus(t), beat = 1.05;
      /* an original tender motif in F, under a warm pad */
      const mel: [number, number][] = [[72, 1], [74, .5], [77, .5], [76, 1.5], [74, .5], [72, 1], [69, 1], [70, .5], [72, .5], [74, 1], [72, 3]];
      let tt = t + .8; for (const [m, l] of mel) { this.piano(bus, tt, m, .5, l * beat * 1.1); tt += l * beat * (1 + (this.r() - .5) * .1); }
      [[41, [0, 7, 14, 16]], [46, [0, 7, 11, 16]], [43, [0, 7, 10, 15]], [41, [0, 7, 14, 16]]].forEach(([r, iv], k) => (iv as number[]).forEach((x, i) => this.piano(bus, t + k * 2.6 * beat + i * .09, (r as number) + x, .3 - i * .03, 2.6 * beat, true)));
      this.pad(bus, t, [53, 60, 65, 69], tt - t + 1, .035, .5);
      this.nextAt = Math.max(this.nextAt, tt + 5);
    }
  }

  /* ---------------- per-frame driver ---------------- */
  update(s: MusicState, now = this.ctx.currentTime) {
    if (!this.primed) { this.primed = true; this.s = { ...s }; }
    const k = .02; this.s.night += (s.night - this.s.night) * k * 3; this.s.plaza += (s.plaza - this.s.plaza) * k; this.s.rain += (s.rain - this.s.rain) * k; this.s.winter = s.winter; this.s.festival = s.festival; this.s.finale = s.finale;
    this.tone.frequency.setTargetAtTime(16000 - 12500 * clamp((this.s.rain - .2) / .5) - 5000 * this.s.night, now, 1.5);
    if (!this.enabled) return;
    if (s.festival || s.finale) {
      if (!this.fest) this.startFest(now, s.finale); const F = this.fest!; F.finale = s.finale; F.ending = -1;
      this.festLP.frequency.setTargetAtTime(1800 + 10000 * s.plaza, now, .8); this.festBus.gain.setTargetAtTime(.5 + .5 * s.plaza, now + 2.5, 1);
      while (this.fest && this.fest.nextBar < now + .5) this.scheduleBar();
      return;
    }
    if (this.fest) { this.fest.ending = 1; while (this.fest && this.fest.nextBar < now + .5) this.scheduleBar(); return; }
    if (now >= this.nextAt - .25) this.schedulePhrase(Math.max(now + .05, this.nextAt));
  }
}
