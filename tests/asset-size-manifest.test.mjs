import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {SIZE_MANIFEST,writeAssetSizes} from '../tools/asset-size-manifest.mjs';

test('the deployed size manifest records staged bytes and aliases',()=>{
  const dir = mkdtempSync(join(tmpdir(),'asset-sizes-'));
  try {
    const aliases = {'/licensed/original.glb':'/models/abc.glb'};
    const index = '<script>window.__assetAliases='+JSON.stringify(aliases)+';</script>';
    writeFileSync(join(dir,'index.html'),index);
    mkdirSync(join(dir,'models'));
    writeFileSync(join(dir,'models','abc.glb'),Buffer.alloc(800));
    writeFileSync(join(dir,'models','later scene.glb'),Buffer.alloc(200));
    const opening = {phone:{requests:['/models/abc.glb','/models/abc.glb','/missing.glb'],models:['/models/abc.glb']}};
    const streamed = ['/models/abc.glb','/models/later%20scene.glb','/missing.glb'];
    writeAssetSizes(dir,opening,streamed);
    writeAssetSizes(dir,opening,streamed);
    const data = JSON.parse(readFileSync(join(dir,SIZE_MANIFEST),'utf8'));
    for (const url of ['/index.html','/models/abc.glb','/models/later%20scene.glb']) {
      assert.equal(data.sizes[url],statSync(join(dir,decodeURIComponent(url))).size);
    }
    assert.deepEqual(data.aliases,aliases);
    assert.equal(data.sizes['/licensed/original.glb'],data.sizes['/models/abc.glb']);
    assert.equal(data.sizes['/'+SIZE_MANIFEST],undefined);
    assert.deepEqual(data.streamed,['/models/later%20scene.glb']);
    assert.deepEqual(data.opening.phone,{downloads:['/models/abc.glb'],models:['/models/abc.glb']});
  } finally {
    rmSync(dir,{recursive:true,force:true});
  }
});
