// OWNER: grok-skins lane (Grok). Fixed-camera stills + GL draw-call probe per skin.
// Works against any build (old builds without skins just ignore ?skin=).
//   node tools/grok-skins-shots.mjs --port 5218 --tag new --skins cel,neon,autumn,winter [--live] [--views wide,close] [--hours day,night]
// --live loads once with the first skin and switches the rest with __astra.setSkin (no reload).
import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const port=arg('port','5218'),tag=arg('tag','new'),out=arg('out','shots/grok-skins'),skins=arg('skins','cel').split(','),live=process.argv.includes('--live');
export const CAMS={wide:{x:-40,z:-2,zoom:1.9},downtown:{x:-57,z:-6,zoom:3.1},close:{x:-60,z:-4,zoom:5.6}};
const HOURS={day:11,sunset:17.6,night:21.5};
const views=arg('views','wide,downtown').split(','),hours=arg('hours','day,night').split(',');
mkdirSync(out,{recursive:true});
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const result={tag,live,skins:{}};
const init=()=>{window.requestAnimationFrame=()=>0;const S={calls:0,tris:0};window.__GL=S;const t=(m,c)=>m===4?c/3:(m===5||m===6)?Math.max(0,c-2):0;
 for(const proto of [WebGL2RenderingContext.prototype,WebGLRenderingContext.prototype]){
  const de=proto.drawElements;proto.drawElements=function(m,c){S.calls++;S.tris+=t(m,c);return de.apply(this,arguments)};
  const da=proto.drawArrays;proto.drawArrays=function(m,f,c){S.calls++;S.tris+=t(m,c);return da.apply(this,arguments)};
  const dei=proto.drawElementsInstanced;if(dei)proto.drawElementsInstanced=function(m,c,ty,o,n){S.calls++;S.tris+=t(m,c)*n;return dei.apply(this,arguments)};
  const dai=proto.drawArraysInstanced;if(dai)proto.drawArraysInstanced=function(m,f,c,n){S.calls++;S.tris+=t(m,c)*n;return dai.apply(this,arguments)};}};
async function open(skin){
 const p=await b.newPage({viewport:{width:1280,height:800}});const errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await p.addInitScript(init);
 await p.goto(`http://127.0.0.1:${port}/?capture&view=downtown&hour=11&skin=${skin}`);
 await p.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:1500000,polling:500});
 const err=await p.evaluate(()=>window.__astraError);if(err)throw new Error(err);
 await p.addStyleTag({content:'.astra-ui,.ui,#hud,.loading,[class*="toast"],body>div:not(#app){display:none!important}'});
 return {p,errors};
}
async function capture(p,skin){
 const r={shots:[],probe:{}};
 for(const v of views)for(const h of hours){
  const probe=await p.evaluate(([cam,hour])=>{const a=__astra;a.setPaused(true);a.view(cam);a.setHour(hour);a.step(0);a.step(0);const S=window.__GL;S.calls=0;S.tris=0;a.step(0);return {calls:S.calls,tris:Math.round(S.tris)};},[CAMS[v],HOURS[h]]);
  const file=`${out}/${tag}-${skin}-${v}-${h}.png`;await p.screenshot({path:file,timeout:900000});r.shots.push(file);r.probe[`${v}-${h}`]=probe;console.log('still',file,JSON.stringify(probe));
 }
 r.skinState=await p.evaluate(()=>__astra.skin?.state?{...__astra.skin.state}:null);
 return r;
}
try{
 if(live){const {p,errors}=await open(skins[0]);for(const s of skins){await p.evaluate(s=>__astra.setSkin&&__astra.setSkin(s),s);const name=result.skins[s]?s+'-back':s;result.skins[name]=await capture(p,name);}result.errors=errors;}
 else for(const s of skins){const {p,errors}=await open(s);result.skins[s]=await capture(p,s);result.skins[s].errors=errors;await p.close();}
 writeFileSync(`${out}/${tag}-probe.json`,JSON.stringify(result,null,1));console.log('wrote',`${out}/${tag}-probe.json`);
}finally{await b.close();}
