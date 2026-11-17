// Inspect licensed GLBs: node tools/inspect-glb.mjs file.glb...
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const root = doc.getRoot();
  const nodes = root.listNodes().map(n => ({ name: n.getName(), t: n.getTranslation(), r: n.getRotation(), s: n.getScale(), mesh: !!n.getMesh(), kids: n.listChildren().length }));
  let tris = 0; const attrs = new Set(); const mats = root.listMaterials().map(m => m.getName() + ' ' + JSON.stringify(m.getBaseColorFactor()) + (m.getBaseColorTexture() ? ' tex' : ''));
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { p.listSemantics().forEach(s => attrs.add(s)); const idx = p.getIndices(); tris += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3; }
  console.log(f.split('/').pop(), { tris, attrs: [...attrs], mats, nodes: nodes.slice(0, 6), nNodes: nodes.length });
}
