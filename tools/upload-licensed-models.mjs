#!/usr/bin/env node
// Package the Draco/meshopt-compressed model set from a fresh `npm run
// deploy:dist` (dist/licensed + dist/owned-assets) into one tarball and upload
// it to the PRIVATE Vercel Blob store `cel-village-models`. CI downloads it with
// tools/fetch-licensed-models.mjs. The models are licensed-derived: they live
// only in dist/, .licensed-cache/ and private Blob, never in git.
//
// Usage (needs BLOB_READ_WRITE_TOKEN in the environment, never on argv):
//   npm run deploy:dist && npm run models:upload [-- --prune] [-- --dry-run]
import {put, list, del} from '@vercel/blob';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const stage = join(root, '.licensed-cache', 'models-pack');
const tarball = join(root, '.licensed-cache', 'models-pack.tar.gz');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const prune = args.has('--prune');
export const PREFIX = 'models/';
export const POINTER = 'models/latest.json';

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, {withFileTypes: true})) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}

for (const sub of ['licensed', 'owned-assets']) {
  if (!existsSync(join(distDir, sub))) throw new Error(`dist/${sub} missing: run \`npm run deploy:dist\` first`);
}
rmSync(stage, {recursive: true, force: true});
mkdirSync(stage, {recursive: true});
cpSync(join(distDir, 'licensed'), join(stage, 'licensed'), {recursive: true, dereference: true});
cpSync(join(distDir, 'owned-assets'), join(stage, 'owned-assets'), {recursive: true, dereference: true});
// prepare-deploy-dist resolves /owned-assets/fairground/* through the
// fairground root (public/licensed/fairground), so mirror those files there.
const ownedFair = join(stage, 'owned-assets', 'fairground');
let mirrored = 0;
for (const file of walk(ownedFair)) {
  const dest = join(stage, 'licensed', 'fairground', relative(ownedFair, file));
  if (!existsSync(dest)) { mkdirSync(dirname(dest), {recursive: true}); cpSync(file, dest); mirrored++; }
}
const files = walk(stage);
const rawBytes = files.reduce((s, f) => s + statSync(f).size, 0);
const tar = spawnSync('tar', ['-czf', tarball, '-C', stage, 'licensed', 'owned-assets'], {stdio: 'inherit'});
if (tar.status !== 0) throw new Error('tar failed');
const buf = readFileSync(tarball);
const sha256 = createHash('sha256').update(buf).digest('hex');
const pathname = `${PREFIX}cel-village-models-${sha256.slice(0, 16)}.tar.gz`;
const meta = {pathname, sha256, bytes: buf.length, rawBytes, files: files.length, mirroredFairground: mirrored, createdAt: new Date().toISOString()};
console.log(`Pack: ${files.length} files, ${(rawBytes / 1e6).toFixed(1)} MB -> ${(buf.length / 1e6).toFixed(1)} MB tar.gz, sha256 ${sha256.slice(0, 16)}…`);
if (dryRun) { console.log('Dry run: not uploading.'); process.exit(0); }
if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is not set');

await put(pathname, buf, {access: 'private', contentType: 'application/gzip', multipart: true, allowOverwrite: true, addRandomSuffix: false});
await put(POINTER, JSON.stringify(meta, null, 2) + '\n', {access: 'private', contentType: 'application/json', allowOverwrite: true, addRandomSuffix: false, cacheControlMaxAge: 60});
console.log(`Uploaded ${pathname} and updated ${POINTER}.`);
if (prune) {
  const {blobs} = await list({prefix: PREFIX});
  const stale = blobs.filter((b) => b.pathname.endsWith('.tar.gz') && b.pathname !== pathname);
  if (stale.length) await del(stale.map((b) => b.url));
  console.log(`Pruned ${stale.length} older pack(s).`);
}
