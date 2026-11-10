// node tools/music/render.mjs — renders score previews to shots/audio/*.mp3 (and any trace given as TRACE=file.json OUT=name SECS=n).
import { chromium } from 'playwright'; import * as esbuild from 'esbuild'; import fs from 'node:fs'; import http from 'node:http'; import { execFileSync } from 'node:child_process';
const DIR = '/tmp/music-prev'; fs.mkdirSync(DIR, { recursive: true }); fs.mkdirSync('shots/audio', { recursive: true });
await esbuild.build({ entryPoints: ['tools/music/preview.ts'], bundle: true, format: 'esm', outfile: `${DIR}/prev.js`, logLevel: 'error' });
fs.writeFileSync(`${DIR}/index.html`, '<!doctype html><script type="module" src="prev.js"></script>');
const srv = http.createServer((q, r) => { const f = `${DIR}${q.url === '/' ? '/index.html' : q.url}`; if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(fs.readFileSync(f)); }).listen(5291);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' }); const p = await b.newPage(); p.on('console', m => m.type() === 'error' && console.log('console', m.text())); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:5291/'); await p.waitForFunction(() => window.renderMusic);
const base = { night: 0, plaza: 0, rain: 0, winter: 0, festival: false, finale: false };
const ramp = (secs, f) => { const fr = []; for (let t = 0; t <= secs; t += .5) fr.push({ t, s: { ...base, ...f(t / secs, t) } }); return fr; };
let jobs = [
  ['day_field', 45, [{ t: 0, s: { ...base, night: 0 } }]],
  ['village', 45, [{ t: 0, s: { ...base, plaza: 1 } }]],
  ['night', 45, [{ t: 0, s: { ...base, night: 1 } }]],
  ['festival', 30, [{ t: 0, s: { ...base, plaza: 1, festival: true } }, { t: 22, s: { ...base, plaza: 1, festival: true, finale: true } }]],
];
if (process.env.TRACE) jobs = [[process.env.OUT, +process.env.SECS, JSON.parse(fs.readFileSync(process.env.TRACE, 'utf8'))]];
if (process.env.ONLY) jobs = jobs.filter(j => process.env.ONLY.split(',').includes(j[0]));
void ramp;
for (const [name, secs, frames] of jobs) {
  const r = await p.evaluate(([f, s]) => window.renderMusic(f, s, 7), [frames, secs]);
  const raw = Buffer.from(r.b64, 'base64'), hdr = Buffer.alloc(44); const n = raw.length;
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + n, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(44100, 24); hdr.writeUInt32LE(44100 * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(n, 40);
  const wav = `${DIR}/${name}.wav`; fs.writeFileSync(wav, Buffer.concat([hdr, raw]));
  const out = process.env.TRACE ? `${DIR}/${name}.mp3` : `shots/audio/${name}.mp3`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '160k', out]);
  console.log(name, 'peak', r.peak.toFixed(3), 'rms', r.rms.toFixed(4), '->', out); console.log('  ' + r.log.join('\n  '));
}
await b.close(); srv.close();
