#!/usr/bin/env node
// Download the compressed licensed model pack from the PRIVATE Vercel Blob
// store and unpack it where `npm run deploy:dist` looks for models:
//   .models-pack/licensed      -> public/licensed (symlink, gitignored)
//   .models-pack/owned-assets  -> pass as ASTRA_ASSET_ROOT
// Used by CI (.github/workflows/deploy.yml). Needs BLOB_READ_WRITE_TOKEN in the
// environment. Never prints the token. Verifies the pack's sha256.
import {get} from '@vercel/blob';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packDir = join(root, '.models-pack');
const linkPath = join(root, 'public', 'licensed');
if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is not set');

async function readAll(pathname) {
  const res = await get(pathname, {access: 'private', useCache: false});
  if (!res || res.statusCode !== 200) throw new Error(`Blob ${pathname} not found`);
  return Buffer.from(await new Response(res.stream).arrayBuffer());
}

const meta = JSON.parse((await readAll('models/latest.json')).toString('utf8'));
const buf = await readAll(meta.pathname);
const sha = createHash('sha256').update(buf).digest('hex');
if (sha !== meta.sha256) throw new Error(`Model pack checksum mismatch for ${meta.pathname}`);
rmSync(packDir, {recursive: true, force: true});
mkdirSync(packDir, {recursive: true});
const tarFile = join(packDir, 'pack.tar.gz');
writeFileSync(tarFile, buf);
const tar = spawnSync('tar', ['-xzf', tarFile, '-C', packDir], {stdio: 'inherit'});
if (tar.status !== 0) throw new Error('tar extract failed');
rmSync(tarFile);

let linkExists = false;
try { lstatSync(linkPath); linkExists = true; } catch {}
if (linkExists) {
  console.log('public/licensed already exists; leaving it alone (pass ASTRA_* roots yourself).');
} else {
  symlinkSync(join(packDir, 'licensed'), linkPath, 'dir');
}
console.log(`Fetched ${meta.pathname}: ${meta.files} files, ${(meta.bytes / 1e6).toFixed(1)} MB (created ${meta.createdAt}).`);
console.log(`For deploy:dist set ASTRA_ASSET_ROOT=${join(packDir, 'owned-assets')}`);
