/* Synthesised ambience bed: wind, birds by day, crickets and an owl at night, rain. Like the score, it is
   scheduled on the audio clock, so it plays live and renders offline the same way. */
export interface AmbState { night: number; rain: number; winter: number }
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export class Ambience {
  ctx: BaseAudioContext; out: GainNode; private noise: AudioBuffer; private wind: GainNode; private windBP: BiquadFilterNode; private rainG: GainNode;
  private r: () => number; private nextBird = 1; private nextCricket = 0; private nextOwl = 20; private nextGust = 0; private gust = 0; enabled = true;
  constructor(ctx: BaseAudioContext, dest: AudioNode, seed = 99) {
    this.ctx = ctx; let a = seed >>> 0; this.r = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
    this.out = ctx.createGain(); this.out.gain.value = 1; this.out.connect(dest);
    const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = this.r() * 2 - 1; this.noise = b;
    const w = ctx.createBufferSource(); w.buffer = b; w.loop = true; this.windBP = ctx.createBiquadFilter(); this.windBP.type = 'bandpass'; this.windBP.frequency.value = 420; this.windBP.Q.value = .7;
    this.wind = ctx.createGain(); this.wind.gain.value = 0; w.connect(this.windBP).connect(this.wind).connect(this.out); w.start();
    const rs = ctx.createBufferSource(); rs.buffer = b; rs.loop = true; rs.playbackRate.value = .93; const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 1500;
    this.rainG = ctx.createGain(); this.rainG.gain.value = 0; rs.connect(rf).connect(this.rainG).connect(this.out); rs.start();
  }
  setEnabled(on: boolean, now = this.ctx.currentTime) { this.enabled = on; this.out.gain.setTargetAtTime(on ? 1 : 0, now, .3); }
  private chirp(t: number, f: number, dur: number, vol: number, slide: number, pan: number) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner(); p.pan.value = pan;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .2); g.gain.setTargetAtTime(0, t + dur * .6, dur * .25);
    o.connect(g).connect(p).connect(this.out); o.start(t); o.stop(t + dur * 2);
  }
  update(s: AmbState, now = this.ctx.currentTime) {
    if (!this.enabled) return;
    const night = clamp((s.night - .3) / .4), dry = 1 - clamp(s.rain * 2);
    if (now >= this.nextGust) { this.gust = .4 + this.r() * .6; this.nextGust = now + 3 + this.r() * 6; this.windBP.frequency.setTargetAtTime(300 + this.r() * 350 + s.winter * 250, now, 2); }
    this.wind.gain.setTargetAtTime((.012 + .02 * night + .03 * s.winter + .015 * s.rain) * this.gust, now, 1.8);
    this.rainG.gain.setTargetAtTime(s.rain * .16, now, 1.2);
    if (now >= this.nextBird) { /* a two- or three-note songbird phrase by day */
      if (night < .5 && dry > .3 && s.winter < .6) { const f = 2300 + this.r() * 1600, pan = this.r() * 1.6 - .8, n = 2 + Math.floor(this.r() * 3); for (let i = 0; i < n; i++) this.chirp(now + i * (.09 + this.r() * .05), f * (1 + (this.r() - .4) * .25), .08, .018 * (1 - night), 1.1 + this.r() * .3, pan); }
      this.nextBird = now + 1.5 + this.r() * 5;
    }
    if (now >= this.nextCricket) { /* cricket trills: three quick pulses, from a few directions */
      if (night > .3 && s.winter < .5 && dry > .3) { const pan = this.r() * 1.8 - .9, f = 4300 + this.r() * 500; for (let i = 0; i < 3; i++) this.chirp(now + i * .035, f, .025, .009 * night, 1, pan); }
      this.nextCricket = now + .25 + this.r() * .6;
    }
    if (now >= this.nextOwl) { /* hoo... hoo-hoo */
      if (night > .7 && dry > .5) { const pan = this.r() - .5; [[0, .42], [.75, .2], [1.0, .5]].forEach(([d, l]) => this.chirp(now + d, 390, l, .03, .93, pan)); }
      this.nextOwl = now + 18 + this.r() * 25;
    }
  }
}
