// Encode shared texture payloads to Basis. The images are staged alongside the
// private model pack and referenced by their content hash in production GLBs.
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {KHRTextureBasisu} from '@gltf-transform/extensions';
import {listTextureSlots} from '@gltf-transform/functions';

const ktx = process.env.TOKTX || 'toktx';
const library = process.env.TOKTX_LIBRARY_PATH;
const env = library ? {...process.env,LD_LIBRARY_PATH:library} : process.env;
const available = spawnSync(ktx,['--version'],{env}).status === 0;
const hash = value => createHash('sha256').update(value).digest('hex').slice(0,24);

export function encodeTextures(doc, cache, {smallModels=false}={}) {
  const textures = doc.getRoot().listTextures();
  if (!textures.length || !available) return;
  mkdirSync(cache,{recursive:true});
  const work = mkdtempSync(join(tmpdir(),'fast-load-ktx-'));
  try {
    for (const texture of textures) {
      const image = texture.getImage();
      const size = texture.getSize();
      const format = {'image/jpeg':'jpg','image/png':'png'}[texture.getMimeType()];
      if (!format || !size || size.some(v=>v%4) || image.length < 4096) continue;
      const slots = listTextureSlots(texture);
      const srgb = slots.every(slot=>['baseColorTexture','emissiveTexture','diffuseTexture'].includes(slot));
      const quality = srgb ? ['--encode','etc1s','--qlevel','200','--clevel','3'] : ['--encode','uastc','--uastc_quality','2','--zcmp','12'];
      // Fitted street vehicles occupy less than 256 pixels even at maximum
      // map zoom. Keep artwork resolution on other uses.
      const resize = smallModels && size.every(value=>value>=512) ? ['--resize',size.map(value=>Math.floor(value/8)*4).join('x')] : [];
      const uri = join(cache,hash(Buffer.concat([Buffer.from('ktx-v2:'+srgb+':'+resize.join(' ')),image]))+'.ktx2');
      if (!existsSync(uri)) {
        const input = join(work,'input.'+format), output = join(work,'output.ktx2');
        writeFileSync(input,image);
        const result = spawnSync(ktx,['--t2','--threads','1','--genmipmap','--assign_oetf',srgb?'srgb':'linear',...quality,...resize,output,input],{env,encoding:'utf8'});
        if (result.status !== 0) throw new Error(result.stderr || 'toktx failed');
        writeFileSync(uri,readFileSync(output));
      }
      const encoded = readFileSync(uri);
      if (encoded.length >= image.length) continue;
      texture.setImage(encoded).setMimeType('image/ktx2');
    }
    if (textures.some(texture=>texture.getMimeType()==='image/ktx2')) doc.createExtension(KHRTextureBasisu).setRequired(true);
  } finally {
    rmSync(work,{recursive:true,force:true});
  }
}

export function externalizeBasis(bytes, addFile) {
  const jsonEnd = 20+bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.toString('utf8',20,jsonEnd));
  const external = (json.images||[]).filter(image=>image.mimeType==='image/ktx2'&&image.bufferView!==undefined);
  if (!external.length) return bytes;
  const bin = bytes.subarray(jsonEnd+8);
  const dropped = new Set();
  for (const image of external) {
    const {byteOffset=0,byteLength} = json.bufferViews[image.bufferView];
    const texture = bin.subarray(byteOffset,byteOffset+byteLength);
    const name = hash(texture)+'.ktx2';
    addFile(name,texture);
    image.uri = '/models/'+name;
    dropped.add(image.bufferView);
    delete image.bufferView;
  }
  // Preserve bufferView indices, including references in compression extensions.
  // Pack the retained views at aligned offsets and share one padding byte for
  // the now-unreferenced image views.
  const chunks = [Buffer.alloc(4)];
  let size = 4;
  json.bufferViews.forEach((view,index)=>{
    if (dropped.has(index)) {
      view.byteOffset = 0;
      view.byteLength = 1;
      return;
    }
    const offset = view.byteOffset||0;
    const data = bin.subarray(offset,offset+view.byteLength);
    view.byteOffset = size;
    chunks.push(data);
    size += data.length;
    const padding = (4-size%4)%4;
    if (padding) chunks.push(Buffer.alloc(padding));
    size += padding;
  });
  json.buffers[0].byteLength = size;
  const jsonText = Buffer.from(JSON.stringify(json));
  const header = Buffer.from(bytes.subarray(0,20));
  const jsonPadding = (4-jsonText.length%4)%4;
  header.writeUInt32LE(jsonText.length+jsonPadding,12);
  header.writeUInt32LE(20+jsonText.length+jsonPadding+8+size,8);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(size,0);
  binHeader.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,jsonText,Buffer.alloc(jsonPadding,32),binHeader,...chunks]);
}
