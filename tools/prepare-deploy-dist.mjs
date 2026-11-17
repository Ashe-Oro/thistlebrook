#!/usr/bin/env node
// Build a Vercel-ready dist that contains only the licensed / owned-asset
// models the Thistlebrook town actually requests. Vite never copies public/licensed;
// this script compiles the default world, walks catalog/registry placements,
// copies those files (dereferenced) to the URL paths the loaders use, then
// optionally confirms the set with a headless run against a static server.
import {spawnSync} from 'node:child_process';
import {createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync, realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {dirname, extname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {getAsset} from '../src/catalog/library/index.js';
import {TOWNSFOLK} from '../src/catalog/townsfolk.js';
import {TOWNSFOLK_VARIANTS} from '../src/catalog/townsfolk-variants.js';
import {VILLAGERS} from '../src/catalog/villagers.js';
import {compressDir} from './compress-dist-glbs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const publicDir = join(root, 'public');
const licensedRoot = realpathSync(join(publicDir, 'licensed'));
const assetRoot = resolve(process.env.ASTRA_ASSET_ROOT || '/workspace/threejs-assets');
const fairgroundRoot = resolve(process.env.ASTRA_FAIRGROUND_ROOT || join(publicDir, 'licensed/fairground'));
const args = new Set(process.argv.slice(2));
const skipBuild = args.has('--skip-build');
const skipVerify = args.has('--skip-verify');
// Raw pack GLBs are uncompressed flat-shaded meshes; ship them Draco/meshopt
// compressed unless --no-compress (kept for before/after measurement).
const skipCompress = args.has('--no-compress');
const seed = Number((process.argv.find((a, i, all) => all[i - 1] === '--seed') || '831'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ktx2': 'image/ktx2',
  '.svg': 'image/svg+xml',
};

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, acc);
    else if (entry.isFile() || entry.isSymbolicLink()) acc.push(path);
  }
  return acc;
}

function readSrc(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function listJs(dir, acc = []) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') listJs(path, acc);
    else if (entry.isFile() && /\.(js|mjs|json)$/.test(entry.name)) acc.push(path);
  }
  return acc;
}

function addUrl(urls, url) {
  const path = url.startsWith('/') ? url : `/${url}`;
  if (path.includes('..')) throw new Error(`Refusing unsafe URL path ${path}`);
  const base = path.split('/').at(-1);
  if (!base || base === '.glb' || base === 'x.glb') return;
  urls.add(path);
}

function catalogPath(entry) {
  return entry?.source === 'mesh' && entry.path ? entry.path.replace(/^\//, '') : null;
}

function libraryUrl(id) {
  const asset = getAsset(id);
  return '/owned-assets/' + asset.path.split('/').map(encodeURIComponent).join('/');
}

function decodeUrlPath(url) {
  return decodeURIComponent(url.split('?')[0]);
}

function resolveOwnedAsset(rel) {
  const pack = rel.split('/')[0];
  if (pack === 'fairground') return resolve(fairgroundRoot, rel.slice(pack.length + 1));
  return resolve(assetRoot, rel);
}

function sourceForUrl(urlPath) {
  const rel = decodeUrlPath(urlPath).replace(/^\//, '');
  if (rel.startsWith('owned-assets/')) {
    const rest = rel.slice('owned-assets/'.length);
    const file = resolveOwnedAsset(rest);
    const base = rest.split('/')[0] === 'fairground' ? fairgroundRoot : assetRoot;
    if (!file.startsWith(base + sep) && file !== base) throw new Error(`Owned-asset path escaped root: ${rel}`);
    return file;
  }
  if (rel.startsWith('licensed/')) {
    const file = resolve(licensedRoot, rel.slice('licensed/'.length));
    if (!file.startsWith(licensedRoot + sep) && file !== licensedRoot) throw new Error(`Licensed path escaped root: ${rel}`);
    return file;
  }
  if (rel.startsWith('draco/')) {
    const file = resolve(publicDir, rel);
    if (!file.startsWith(join(publicDir, 'draco') + sep) && file !== join(publicDir, 'draco')) throw new Error(`Draco path escaped: ${rel}`);
    return file;
  }
  return null;
}

function collectUrls(catalog) {
  const urls = new Set();
  const town = compileWorld(catalog, Number.isFinite(seed) ? seed : 831);
  const catalogIds = new Set();

  for (const b of town.buildings || []) if (!b.custom && b.id) catalogIds.add(b.id);
  for (const p of [...(town.props || []), ...(town.trees || [])]) if (p.id) catalogIds.add(p.id);
  for (const p of town.supplemental || []) if (p.asset) catalogIds.add(p.asset);
  for (const p of town.landscape?.models || []) if (p.asset) catalogIds.add(p.asset);

  for (const person of [...TOWNSFOLK, ...(TOWNSFOLK_VARIANTS || []), ...VILLAGERS]) {
    if (person.id) catalogIds.add(person.id);
  }

  const srcFiles = listJs(join(root, 'src'));
  const idRe = /\b(?:cv|farm|nat|townsfolk)-[a-z0-9-]+/g;
  const licensedRe = /(?:^|["'`])(licensed\/[a-z0-9_./-]+\.glb)/gi;
  const ownedNameRe = /(?:loadFairgroundGeometry|fairgroundModel|fairgroundMesh)\(\s*['"]([a-z0-9_./-]+)['"]/gi;
  const addRe = /\badd\(\s*['"]([a-z0-9_./-]+)['"]/g;
  const assetFieldRe = /asset\s*:\s*['"]([a-z0-9_./-]+)['"]/g;
  const propRe = /\bprop\(\s*['"]([a-z0-9_./-]+)['"]/g;
  const libraryIdRe = /loadLibraryAsset\(\s*['"]([^'"]+)['"]/g;
  const tileFieldRe = /tile\s*:\s*['"]([a-z0-9_./-]+)['"]/g;
  let themeparkSource = '';

  for (const file of srcFiles) {
    const text = readFileSync(file, 'utf8');
    for (const id of text.match(idRe) || []) catalogIds.add(id);
    for (const match of text.matchAll(licensedRe)) addUrl(urls, match[1]);
    for (const match of text.matchAll(libraryIdRe)) {
      try { addUrl(urls, libraryUrl(match[1])); } catch {}
    }
    if (file.includes(`${sep}themepark`)) {
      themeparkSource += '\n' + text;
      for (const re of [ownedNameRe, addRe, assetFieldRe, tileFieldRe]) {
        for (const match of text.matchAll(re)) {
          const name = match[1];
          if (name.startsWith('licensed/')) addUrl(urls, name);
          else if (name.startsWith('fairground/')) addUrl(urls, `licensed/${name}${name.endsWith('.glb') ? '' : '.glb'}`);
          else if (name.startsWith('prebuilds/')) addUrl(urls, `licensed/fairground/${name}${name.endsWith('.glb') ? '' : '.glb'}`);
          else {
            const pre = join(fairgroundRoot, 'prebuilds', `${name}.glb`);
            if (existsSync(pre)) addUrl(urls, `licensed/fairground/prebuilds/${name}.glb`);
            else addUrl(urls, `licensed/fairground/${name}.glb`);
          }
        }
      }
    }
    if (file.endsWith(`${sep}outskirts.js`)) {
      for (const match of text.matchAll(propRe)) addUrl(urls, `licensed/astra-outskirts/${match[1]}.glb`);
    }
  }

  for (const id of catalogIds) {
    const path = catalogPath(catalog.get(id));
    if (path) addUrl(urls, path);
  }

  const libraryIds = new Set();
  for (const scene of town.catalogScenes || []) {
    for (const member of scene.members || []) if (member.asset) libraryIds.add(member.asset);
    for (const slot of scene.slots || []) if (slot.asset) libraryIds.add(slot.asset);
  }
  for (const place of town.registry?.places || []) {
    if (place.canonicalAsset) {
      try { getAsset(place.canonicalAsset); libraryIds.add(place.canonicalAsset); } catch {}
    }
  }
  for (const id of libraryIds) addUrl(urls, libraryUrl(id));

  // Any fairground file whose stem is mentioned in themepark sources, including
  // prebuild compounds and tile names that are concatenated rather than quoted.
  for (const file of walkFiles(fairgroundRoot).filter((f) => f.endsWith('.glb'))) {
    const rel = relative(fairgroundRoot, file).split(sep).join('/');
    const stem = rel.replace(/\.glb$/, '');
    const base = stem.split('/').at(-1);
    if (themeparkSource.includes(stem) || themeparkSource.includes(base) || themeparkSource.includes(`prebuilds/${base}`)) {
      addUrl(urls, `licensed/fairground/${rel}`);
    }
  }
  addUrl(urls, 'licensed/nature/rowboat.glb');
  for (const name of Object.keys(JSON.parse(readFileSync(join(root, 'src/astra/outskirts-bounds.json'), 'utf8')))) {
    addUrl(urls, `licensed/astra-outskirts/${name}.glb`);
  }
  for (const file of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
    addUrl(urls, `draco/${file}`);
  }

  return {town, urls, catalogIds, libraryIds};
}

function ensureDir(file) {
  mkdirSync(dirname(file), {recursive: true});
}

function copyDereferenced(src, dest) {
  const resolved = realpathSync(src);
  ensureDir(dest);
  if (existsSync(dest)) rmSync(dest);
  copyFileSync(resolved, dest);
  const st = statSync(dest);
  if (st.isSymbolicLink()) throw new Error(`Copy left a symlink: ${dest}`);
  return st.size;
}

function copyUrls(urls) {
  const copied = [];
  const missing = [];
  for (const url of [...urls].sort()) {
    if (url.startsWith('/assets/') || url.endsWith('.html') || url.endsWith('.css')) continue;
    const src = sourceForUrl(url);
    if (!src) continue;
    if (!existsSync(src) || !statSync(src).isFile()) {
      missing.push({url, src});
      continue;
    }
    const dest = join(distDir, decodeUrlPath(url).replace(/^\//, ''));
    const size = copyDereferenced(src, dest);
    copied.push({url, size, src: relative(root, src)});
  }
  if (missing.length) {
    console.warn(`Skipping ${missing.length} collected paths with no source file:`);
    for (const m of missing.slice(0, 30)) console.warn(`  ${m.url} <- ${m.src}`);
    if (missing.length > 30) console.warn(`  … ${missing.length - 30} more`);
  }
  return {copied, missing};
}

function distStats() {
  const files = walkFiles(distDir);
  let bytes = 0;
  const hashes = new Map();
  for (const file of files) {
    const buf = readFileSync(file);
    bytes += buf.length;
    const digest = createHash('sha1').update(buf).digest('hex');
    hashes.set(digest, (hashes.get(digest) || 0) + 1);
  }
  const uniqueBytes = [...files].reduce((sum, file) => {
    // recompute unique by first occurrence
    return sum;
  }, 0);
  const seen = new Set();
  let unique = 0;
  for (const file of files) {
    const digest = createHash('sha1').update(readFileSync(file)).digest('hex');
    if (seen.has(digest)) continue;
    seen.add(digest);
    unique += statSync(file).size;
  }
  const glbs = files.filter((f) => f.endsWith('.glb') || f.endsWith('.gltf'));
  return {files: files.length, bytes, uniqueBytes: unique, glbs: glbs.length, mb: bytes / 1e6, uniqueMb: unique / 1e6};
}

function isAssetRequest(url) {
  return /\.(glb|gltf|bin|png|jpe?g|webp|ktx2|ktx)(?:\?|$)/i.test(url);
}

function startStaticServer() {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = resolve(distDir, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(distDir + sep) && file !== distDir) {
      res.writeHead(403).end();
      return;
    }
    const target = existsSync(file) && statSync(file).isDirectory() ? join(file, 'index.html') : file;
    if (!existsSync(target) || !statSync(target).isFile()) {
      res.writeHead(404, {'Content-Type': 'text/plain'}).end('404');
      return;
    }
    res.writeHead(200, {'Content-Type': MIME[extname(target)] || 'application/octet-stream'});
    createReadStream(target).on('error', () => res.end()).pipe(res);
  });
  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => resolveServer({server, port: server.address().port}));
  });
}

async function verify() {
  const {server, port} = await startStaticServer();
  const origin = `http://127.0.0.1:${port}`;
  const requests = [];
  const missing = [];
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    page.on('response', (response) => {
      const url = response.url();
      if (!isAssetRequest(url) && !url.includes('/draco/')) return;
      const rec = {url, status: response.status(), path: new URL(url).pathname};
      requests.push(rec);
      if (response.status() >= 400) missing.push(rec);
    });
    page.on('requestfailed', (request) => {
      const url = request.url();
      if (!isAssetRequest(url) && !url.includes('/draco/')) return;
      const rec = {url, status: 0, path: new URL(url).pathname, failure: request.failure()?.errorText};
      requests.push(rec);
      missing.push(rec);
    });
    await page.goto(`${origin}/`, {waitUntil: 'domcontentloaded', timeout: 120000});
    const outcome = await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 180000, polling: 200});
    const error = await page.evaluate(() => window.__astraError || null);
    const ready = await page.evaluate(() => !!window.__ready);
    await page.waitForTimeout(1500);
    return {origin, ready, error, requests, missing, outcome: !!outcome};
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
}

// Some models ship under two URLs (e.g. /licensed/astra-outskirts/camp_tent.glb
// and /owned-assets/nature/.../camp_tent.glb) because different districts load
// them through different loaders. Map every byte-identical copy to one
// canonical URL so a visit downloads and decodes it once. The map holds URL
// paths only and is inlined into dist/index.html for src/gltf-loader.js.
function writeAliases() {
  const byHash = new Map();
  for (const file of walkFiles(distDir).filter((f) => f.endsWith('.glb')).sort()) {
    const digest = createHash('sha1').update(readFileSync(file)).digest('hex');
    const url = '/' + relative(distDir, file).split(sep).map(encodeURIComponent).join('/');
    if (!byHash.has(digest)) byHash.set(digest, []);
    byHash.get(digest).push(url);
  }
  const aliases = {};
  for (const urls of byHash.values()) {
    if (urls.length < 2) continue;
    // Prefer /owned-assets (the library path) as the canonical copy.
    const canonical = urls.find((u) => u.startsWith('/owned-assets/')) || urls[0];
    for (const url of urls) if (url !== canonical) aliases[url] = canonical;
  }
  const indexFile = join(distDir, 'index.html');
  let html = readFileSync(indexFile, 'utf8').replace(/<script id="asset-aliases">[\s\S]*?<\/script>\n?/, '');
  html = html.replace('<head>', `<head>\n    <script id="asset-aliases">window.__assetAliases=${JSON.stringify(aliases)};</script>`);
  writeFileSync(indexFile, html);
  console.log(`Asset aliases: ${Object.keys(aliases).length} duplicate URLs mapped to a canonical copy`);
}

function runBuild() {
  const result = spawnSync('npm', ['run', 'build'], {cwd: root, stdio: 'inherit'});
  if (result.status !== 0) throw new Error(`vite build failed with status ${result.status}`);
}

function writeManifest(data) {
  const outDir = join(root, 'out');
  mkdirSync(outDir, {recursive: true});
  const path = join(outDir, 'deploy-dist-manifest.json');
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  return path;
}

function formatMb(bytes) {
  return `${(bytes / 1e6).toFixed(1)}MB`;
}

const catalog = resolveAll(JSON.parse(readFileSync(join(root, 'src/catalog/bounds.json'), 'utf8')));
if (!skipBuild) runBuild();
if (!existsSync(join(distDir, 'index.html'))) throw new Error('dist/index.html missing; run without --skip-build');

const collected = collectUrls(catalog);
const copiedResult = copyUrls(collected.urls);
let copied = copiedResult.copied;
let compression = null;
async function compressAndAlias() {
  if (skipCompress) return;
  compression = await compressDir(distDir);
  console.log(`Compressed GLBs: ${formatMb(compression.before)} -> ${formatMb(compression.after)} across ${compression.files} files`);
  for (const [k, v] of Object.entries(compression.byChoice)) console.log(`  ${k}: ${v.files} files ${formatMb(v.before)} -> ${formatMb(v.after)}`);
  writeAliases();
}
await compressAndAlias();
let stats = distStats();
console.log(`Collected ${collected.urls.size} asset URLs from seed ${Number.isFinite(seed) ? seed : 831}; copied ${copied.length} files.`);
console.log(`dist: ${formatMb(stats.bytes)} / ${stats.files} files / ${stats.glbs} glb|gltf (unique content ${formatMb(stats.uniqueBytes)})`);

let verification = null;
if (!skipVerify) {
  verification = await verify();
  const needed = new Set();
  for (const rec of verification.requests) {
    if (rec.path.startsWith('/assets/')) continue;
    needed.add(rec.path);
  }
  if (verification.missing.length) {
    const extra = [];
    for (const rec of verification.missing) {
      try {
        const src = sourceForUrl(rec.path);
        if (src && existsSync(src)) {
          copyDereferenced(src, join(distDir, rec.path.replace(/^\//, '')));
          extra.push(rec.path);
        }
      } catch (err) {
        console.error(err.message);
      }
    }
    if (extra.length) {
      console.log(`Copied ${extra.length} files discovered by the headless run, re-verifying.`);
      copied = [...copied, ...extra.map((url) => ({url, recovered: true}))];
      await compressAndAlias();
      verification = await verify();
    }
  }
  stats = distStats();
  console.log(`dist after verify: ${formatMb(stats.bytes)} / ${stats.files} files / ${stats.glbs} glb|gltf (unique content ${formatMb(stats.uniqueBytes)})`);
  const assetReqs = verification.requests.filter((r) => isAssetRequest(r.url));
  const notFound = assetReqs.filter((r) => r.status === 404 || r.status === 0);
  console.log(`Headless: ready=${verification.ready} error=${verification.error || 'none'} asset-requests=${assetReqs.length} 404s=${notFound.length}`);
  if (!verification.ready || verification.error || notFound.length) {
    const detail = (verification.missing.length ? verification.missing : notFound).slice(0, 20);
    console.error(detail);
    throw new Error('Headless verification failed');
  }
  // Ensure every recorded asset request has a file in dist.
  const missingOnDisk = assetReqs.filter((r) => !existsSync(join(distDir, r.path.replace(/^\//, ''))));
  if (missingOnDisk.length) throw new Error(`Requested assets missing on disk: ${missingOnDisk.map((r) => r.path).join(', ')}`);
}

const manifest = writeManifest({
  seed: Number.isFinite(seed) ? seed : 831,
  urls: [...collected.urls].sort(),
  copied,
  stats,
  compression,
  verification: verification && {
    ready: verification.ready,
    error: verification.error,
    requests: verification.requests,
    missing: verification.missing,
  },
});
console.log(`Manifest: ${relative(root, manifest)}`);
if (stats.bytes > 950e6) {
  console.warn(`WARNING: dist is ${formatMb(stats.bytes)}, above the 950MB comfort cap (Vercel Pro CLI limit is 1GB).`);
}
