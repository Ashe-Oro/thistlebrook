// Stages the production static site for Vercel in deploy-out/ (gitignored: it contains the licensed GLBs and the
// release bundle with the licensed character engine compiled in). Nothing here is ever committed.
//   node tools/deploy.mjs            -> release build + deploy-out/ + deploy-out/.manifest.json (path, sha1, size)
//   cd deploy-out && vercel deploy --prod --yes --scope ashe-oros-projects   (project: thistlebrook)
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); process.chdir(root);
execFileSync('node', ['tools/build.mjs', '--release'], { stdio: 'inherit' });
const out = 'deploy-out'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
const sha = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
// App shell. app.js / style.css are versioned by content hash in index.html so they can be cached forever.
for (const f of ['app.js', 'style.css']) fs.copyFileSync(`dist/${f}`, `${out}/${f}`);
let html = fs.readFileSync('dist/index.html', 'utf8');
for (const f of ['app.js', 'style.css']) html = html.replace(`"/${f}"`, `"/${f}?v=${sha(`dist/${f}`).slice(0, 10)}"`);
fs.writeFileSync(`${out}/index.html`, html);
// Draco decoders only (Apache-2.0); the encoders are not needed at runtime.
for (const f of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) for (const d of ['', 'gltf/']) {
  fs.mkdirSync(`${out}/draco/${d}`, { recursive: true }); fs.copyFileSync(`dist/draco/${d}${f}`, `${out}/draco/${d}${f}`); }
// Only the GLBs the game references (src/ mentions the model name).
const src = execFileSync('bash', ['-c', 'cat $(find src -name "*.ts")'], { maxBuffer: 64 << 20 }).toString();
let n = 0;
for (const pack of fs.readdirSync('licensed/glb')) for (const f of fs.readdirSync(`licensed/glb/${pack}`)) {
  const name = f.replace(/\.glb$/, ''); if (f === name || !new RegExp(`\\b${name}\\b`).test(src)) continue;
  fs.mkdirSync(`${out}/glb/${pack}`, { recursive: true }); fs.copyFileSync(`licensed/glb/${pack}/${f}`, `${out}/glb/${pack}/${f}`); n++;
}
const long = 'public, max-age=31536000, immutable', week = 'public, max-age=604800, stale-while-revalidate=86400';
fs.writeFileSync(`${out}/vercel.json`, JSON.stringify({
  cleanUrls: false, trailingSlash: false,
  headers: [
    { source: '/', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
    { source: '/index.html', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
    { source: '/(app.js|style.css)', headers: [{ key: 'Cache-Control', value: long }] },
    { source: '/draco/(.*)', headers: [{ key: 'Cache-Control', value: long }] },
    { source: '/glb/(.*)', headers: [{ key: 'Cache-Control', value: week }, { key: 'Content-Type', value: 'model/gltf-binary' }] },
    { source: '/(.*)', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] },
  ],
}, null, 2));
const files = execFileSync('find', [out, '-type', 'f']).toString().trim().split('\n').filter(f => !f.endsWith('.manifest.json'))
  .map(f => ({ file: path.relative(out, f), sha: sha(f), size: fs.statSync(f).size }));
fs.writeFileSync(`${out}/.manifest.json`, JSON.stringify(files, null, 1));
console.log(`deploy-out: ${files.length} files (${n} GLBs), ${(files.reduce((a, f) => a + f.size, 0) / 1e6).toFixed(1)} MB`);
