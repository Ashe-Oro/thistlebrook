// Synthesised soundscape (no audio files): effects, an ambience bed and an adaptive score. Muted until the
// viewer turns sound on. Browsers only allow audio after a gesture, so a saved "on" setting waits for the first click or key.
import { Music, MusicState, MusicCue } from '../audio/music';
import { Ambience } from '../audio/ambience';
export interface AudioSettings { muted: boolean; music: boolean; amb: boolean; vol: number }
const KEY = 'thistlebrook.audio';
export class Sound {
  ctx: AudioContext | null = null; master!: GainNode; sfx!: GainNode; muted = true; last: Record<string, number> = {}; noiseBuf?: AudioBuffer;
  music?: Music; amb?: Ambience; settings: AudioSettings = { muted: true, music: true, amb: true, vol: .6 };
  onChange?: () => void;
  constructor() {
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch {}
    if (!this.settings.muted && typeof window !== 'undefined') { /* restore "sound on" at the first gesture */
      const go = () => { removeEventListener('pointerdown', go, true); removeEventListener('keydown', go, true); if (this.muted && !this.settings.muted) this.setMuted(false); };
      addEventListener('pointerdown', go, true); addEventListener('keydown', go, true);
    }
  }
  private save() { try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch {} this.onChange?.(); }
  ensure() { if (this.ctx) return; const C = (window as any).AudioContext || (window as any).webkitAudioContext; if (!C) return; this.ctx = new C(); const c = this.ctx!;
    this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(this.master);
    this.music = new Music(c, comp, (Math.random() * 1e9) | 0); this.music.setEnabled(this.settings.music, 0); this.music.setVolume(this.settings.vol, 0);
    this.amb = new Ambience(c, this.master, (Math.random() * 1e9) | 0); this.amb.setEnabled(this.settings.amb, 0); }
  setMuted(m: boolean) { this.muted = m; this.settings.muted = m; if (!m) { this.ensure(); this.ctx?.resume(); } if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : .55, this.ctx.currentTime, .15); this.save(); }
  setMusic(on: boolean) { this.settings.music = on; this.music?.setEnabled(on); this.save(); }
  setAmbience(on: boolean) { this.settings.amb = on; this.amb?.setEnabled(on); this.save(); }
  setVolume(v: number) { this.settings.vol = v; this.music?.setVolume(v); this.save(); }
  cue(c: MusicCue) { if (!this.muted && this.music) this.music.cue(c); (window as any).__musicCues?.push([performance.now(), c]); }
  /* per frame: drive the ambience bed and the score */
  update(s: MusicState) { if (this.muted || !this.ctx || this.ctx.state !== 'running') return; this.music?.update(s); this.amb?.update(s); }
  private env(g: GainNode, t: number, a: number, peak: number, dec: number) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); }
  tone(freq: number, dur = .2, type: OscillatorType = 'sine', vol = .2, slide = 0) { if (this.muted || !this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur); this.env(g, t, .005, vol, dur); o.connect(g).connect(this.sfx); o.start(t); o.stop(t + dur + .05); }
  noise(dur = .15, freq = 800, vol = .25, q = 1) { if (this.muted || !this.ctx || !this.noiseBuf) return; const t = this.ctx.currentTime, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); s.buffer = this.noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; this.env(g, t, .003, vol, dur); s.connect(f).connect(g).connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur + .05); }
  play(kind: string, vol = 1) {
    if (this.muted || !this.ctx || vol < .05) return; const now = performance.now(); if (now - (this.last[kind] ?? 0) < 90) return; this.last[kind] = now;
    switch (kind) {
      case 'chop': this.noise(.12, 500, .35 * vol, 2); this.tone(140, .1, 'triangle', .15 * vol, .6); break;
      case 'mine': this.tone(1400, .15, 'square', .05 * vol, .8); this.noise(.08, 2500, .2 * vol, 3); break;
      case 'anvil': this.tone(1800, .4, 'sine', .12 * vol); this.tone(2650, .3, 'sine', .06 * vol); break;
      case 'fall': this.noise(.6, 180, .5 * vol, .7); this.tone(70, .5, 'sine', .3 * vol, .5); break;
      case 'coins': [0, .07, .14].forEach((d, i) => setTimeout(() => this.tone(1500 + i * 300, .15, 'sine', .08 * vol), d * 1000)); break;
      case 'scuffle': for (let i = 0; i < 5; i++) setTimeout(() => this.noise(.08, 300 + Math.random() * 500, .3 * vol, 1), i * 120); break;
      case 'toast': [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, .25, 'triangle', .12), i * 90)); break;
      case 'pop': this.tone(600, .08, 'sine', .1 * vol, 1.8); break;
      case 'thunder': this.noise(1.8, 120, .6 * vol, .35); this.tone(48, 1.4, 'sine', .25 * vol, .6); break;
      case 'splash': this.noise(.18, 1800, .22 * vol, 1.6); this.tone(520, .07, 'sine', .05 * vol, .5); break;
      case 'paper': this.noise(.25, 3000, .15, .5); break;
    }
  }
}
