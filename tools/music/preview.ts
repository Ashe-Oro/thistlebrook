/* Offline renderer for score previews: drives the live Music engine through an OfflineAudioContext. */
import { Music, MusicState, MusicCue } from '../../src/audio/music';
import { Ambience } from '../../src/audio/ambience';
type Frame = { t: number; s: MusicState; cues?: MusicCue[] };
(window as any).renderMusic = async (frames: Frame[], seconds: number, seed = 7, amb = true) => {
  const sr = 44100, ctx = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr), log: string[] = [];
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.connect(ctx.destination);
  const m = new Music(ctx, comp, seed); m.log = x => log.push(x); m.setVolume(.9, 0); const a = amb ? new Ambience(ctx, comp, seed + 1) : null;
  let fi = 0;
  for (let t = 0; t < seconds; t += 1 / 30) {
    while (fi + 1 < frames.length && frames[fi + 1].t <= t) { fi++; for (const c of frames[fi].cues ?? []) m.cue(c, t); }
    m.update(frames[fi].s, t); a?.update(frames[fi].s, t);
  }
  const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  let peak = 0, sum = 0; for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); peak = Math.max(peak, a); sum += L[i] * L[i]; }
  const pcm = new Int16Array(n * 2); const g = peak > .98 ? .98 / peak : 1; for (let i = 0; i < n; i++) { pcm[2 * i] = Math.max(-32767, Math.min(32767, L[i] * g * 32767)); pcm[2 * i + 1] = Math.max(-32767, Math.min(32767, R[i] * g * 32767)); }
  const bytes = new Uint8Array(pcm.buffer); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { b64: btoa(bin), peak, rms: Math.sqrt(sum / n), log };
};
