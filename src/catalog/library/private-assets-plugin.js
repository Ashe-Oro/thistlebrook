import { resolve, sep } from 'node:path';
import { createReadStream, statSync } from 'node:fs';
// Private disk mapping, shared by dev and preview. Never enters build output.
export function privateLibraryPlugin(){
 const root=resolve(process.env.ASTRA_ASSET_ROOT||'/workspace/threejs-assets');
 // Packs kept in the project's private licensed mapping (see inventory-library.mjs).
 const extra={fairground:resolve(process.env.ASTRA_FAIRGROUND_ROOT||'public/licensed/fairground')};
 const install=server=>{server.middlewares.use((req,res,next)=>{
  if(!req.url?.startsWith('/owned-assets/'))return next();
  let path,base=root;try{const rel=decodeURIComponent(req.url.split('?')[0].slice('/owned-assets/'.length)),pack=rel.split('/')[0];if(extra[pack]){base=extra[pack];path=resolve(base,rel.slice(pack.length+1));}else path=resolve(root,rel);}catch{return next();}
  if(!path.startsWith(base+sep)||!(/\.(glb|png|jpe?g|webp)$/.test(path))){res.statusCode=403;res.end();return;}
  try{if(!statSync(path).isFile())return next();}catch{return next();}
  const extension=path.split('.').at(-1);res.setHeader('Content-Type',({glb:'model/gltf-binary',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'})[extension]);
  if(req.method==='HEAD')return res.end();
  createReadStream(path).on('error',next).pipe(res);
 });};
 return {name:'astra-private-owned-library',configureServer:install,configurePreviewServer:install};
}
