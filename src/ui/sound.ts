// Tiny synthesized soundscape (no audio files). Muted by default.
export class Sound {
  ctx: AudioContext | null = null; master!: GainNode; muted = true; rainGain?: GainNode; last: Record<string, number> = {}; noiseBuf?: AudioBuffer;
  ensure() { if (this.ctx) return; const C = (window as any).AudioContext || (window as any).webkitAudioContext; if (!C) return; this.ctx = new C(); this.master = this.ctx!.createGain(); this.master.gain.value = .5; this.master.connect(this.ctx!.destination);
    const n = this.ctx!.sampleRate * 2, b = this.ctx!.createBuffer(1, n, this.ctx!.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b;
    const src = this.ctx!.createBufferSource(); src.buffer = b; src.loop = true; const f = this.ctx!.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; this.rainGain = this.ctx!.createGain(); this.rainGain.gain.value = 0; src.connect(f).connect(this.rainGain).connect(this.master); src.start(); }
  setMuted(m: boolean) { this.muted = m; if (!m) { this.ensure(); this.ctx?.resume(); } if (this.master) this.master.gain.value = m ? 0 : .5; }
  private env(g: GainNode, t: number, a: number, peak: number, dec: number) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); }
  tone(freq: number, dur = .2, type: OscillatorType = 'sine', vol = .2, slide = 0) { if (this.muted || !this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur); this.env(g, t, .005, vol, dur); o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + .05); }
  noise(dur = .15, freq = 800, vol = .25, q = 1) { if (this.muted || !this.ctx || !this.noiseBuf) return; const t = this.ctx.currentTime, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); s.buffer = this.noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; this.env(g, t, .003, vol, dur); s.connect(f).connect(g).connect(this.master); s.start(t, Math.random()); s.stop(t + dur + .05); }
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
      case 'bird': { const f = 2200 + Math.random() * 1500; this.tone(f, .09, 'sine', .04 * vol, 1.3); setTimeout(() => this.tone(f * 1.1, .07, 'sine', .035 * vol, .8), 110); break; }
      case 'cricket': this.tone(4200, .04, 'square', .012 * vol); setTimeout(() => this.tone(4200, .04, 'square', .012 * vol), 60); break;
      case 'thunder': this.noise(1.8, 120, .6 * vol, .35); this.tone(48, 1.4, 'sine', .25 * vol, .6); break;
      case 'paper': this.noise(.25, 3000, .15, .5); break;
    }
  }
  ambient(night: number, rain: number, dt: number) { if (this.muted || !this.ctx) return; if (this.rainGain) this.rainGain.gain.value = rain * .18; if (Math.random() < dt * (night > .5 ? 1.5 : .6) && rain < .5) this.play(night > .5 ? 'cricket' : 'bird', .8); }
}
