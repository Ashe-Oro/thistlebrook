// Local static server: dist/ app + licensed GLBs at /glb (never deploy licensed/ publicly).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.png': 'image/png', '.map': 'application/json' };
export function start(port = Number(process.env.PORT || 5173)) {
  const server = http.createServer((q, r) => {
    let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
    const p = u.startsWith('/glb/') ? path.join(root, 'licensed', u) : path.join(root, 'dist', u);
    if (!p.startsWith(root)) { r.writeHead(403); return r.end(); }
    fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end('not found'); } r.writeHead(200, { 'content-type': T[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-cache' }); r.end(d); });
  });
  return new Promise(res => server.listen(port, '127.0.0.1', () => res(server)));
}
if (process.argv[1] && process.argv[1].endsWith('serve.mjs')) { const s = await start(); console.log(`Terrarium on http://127.0.0.1:${s.address().port}`); }
