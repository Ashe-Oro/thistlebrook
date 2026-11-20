#!/usr/bin/env node
// Build the shipped Hunyuan3D vehicle set from the box-only pipeline output.
// Reads HY3D_SRC (default /workspace/shots/tesla-hy3d/processed), simplifies
// each mesh to its triangle budget, shrinks the baseColor to a small JPEG,
// Draco-compresses, and writes public/licensed/hy3d/<slug>.glb (gitignored;
// shipped with deploy:dist + models:upload like pack models).
// Usage: npm run models:hy3d [-- --only roadster-white]
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld, simplify, draco, dedup, prune} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'src/astra/hy3d/models.json'), 'utf8'));
const src = resolve(process.env.HY3D_SRC || '/workspace/shots/tesla-hy3d/processed');
const outDir = join(root, 'public', manifest.dir);
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule(),
});
mkdirSync(outDir, {recursive: true});
const reportPath = join(outDir, 'build-report.json');
const report = only && existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')).models : {};
const triangleCount = (root) => root.listMeshes().flatMap(mesh => mesh.listPrimitives())
  .reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0);
for (const [slug, m] of Object.entries(manifest.models)) {
  if (only && slug !== only) continue;
  const file = join(src, m.source);
  if (!existsSync(file)) { console.warn(`skip ${slug}: ${file} missing`); continue; }
  const doc = await io.read(file);
  const r = doc.getRoot();
  const tris0 = triangleCount(r);
  await doc.transform(weld(), simplify({simplifier: MeshoptSimplifier, ratio: Math.min(1, m.tris / tris0), error: 0.01, lockBorder: false}));
  const remaining = triangleCount(r);
  if (remaining > m.tris) {
    await doc.transform(simplify({simplifier: MeshoptSimplifier, ratio: m.tris / remaining, error: 1, lockBorder: false}));
    if (triangleCount(r) > m.tris) throw new Error(`${slug} could not meet its ${m.tris}-triangle budget`);
  }
  // Untextured looks drop normals-only extras; textured ones get a small JPEG.
  for (const t of r.listTextures()) {
    if (m.look !== 'tex') { t.dispose(); continue; }
    const jpg = await sharp(Buffer.from(t.getImage())).resize(m.texture, m.texture, {kernel: 'lanczos3'}).jpeg({quality: 82, mozjpeg: true}).toBuffer();
    t.setImage(new Uint8Array(jpg)).setMimeType('image/jpeg').setURI(`${slug}.jpg`);
  }
  for (const mat of r.listMaterials()) { mat.setName(`hy3d-${slug}`); mat.setMetallicFactor(0).setRoughnessFactor(1); }
  r.listMeshes().forEach((x) => x.setName(`hy3d-${slug}`));
  r.listNodes().forEach((n, i) => n.setName(i ? `hy3d-${slug}-${i}` : `hy3d-${slug}`));
  await doc.transform(dedup(), prune(), draco({method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12}));
  const out = join(outDir, `${slug}.glb`);
  writeFileSync(out, await io.writeBinary(doc));
  const tris = triangleCount(r);
  report[slug] = {tris, bytes: statSync(out).size, sourceBytes: statSync(file).size};
  console.log(`${slug}: ${tris0} -> ${tris} tris, ${(statSync(file).size / 1e6).toFixed(2)} MB -> ${(statSync(out).size / 1e3).toFixed(0)} KB`);
}
const total = Object.values(report).reduce((s, x) => s + x.bytes, 0);
console.log(`total ${(total / 1e6).toFixed(2)} MB for ${Object.keys(report).length} models`);
writeFileSync(reportPath, JSON.stringify({total, models: report}, null, 2) + '\n');
