// OWNER: grok-style lane. Captures old vs ?look=v2 stills on fixed cameras and
// probes draw calls (GL wrapper), frame time (N back-to-back renders + 1px
// readback, SwiftShader) and triangles. Usage:
//   node tools/grok-style-shots.mjs --look old|v2 --tag r1 [--port 5214] [--perf] [--views wide,close] [--hours day,sunset,night]
import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const look=arg('look','old'),tag=arg('tag','r0'),port=arg('port','5214'),out=arg('out','shots/grok-style'),extra=arg('q','');
const CAMS={wide:{x:-57,z:-6,zoom:3.1},close:{x:-60,z:-4,zoom:5.6}};
const HOURS={day:11,sunset:17.6,night:21.5};
const views=arg('views','wide,close').split(','),hours=arg('hours','day,sunset,night').split(',');
mkdirSync(out,{recursive:true});
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const result={look,tag,shots:[],probe:{}};
try{
 const p=await b.newPage({viewport:{width:1280,height:800}});const errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await p.addInitScript(()=>{
  window.requestAnimationFrame=()=>0;
  const S={calls:0,tris:0};window.__GL=S;const t=(m,c)=>m===4?c/3:(m===5||m===6)?Math.max(0,c-2):0;
  for(const proto of [WebGL2RenderingContext.prototype,WebGLRenderingContext.prototype]){
   const de=proto.drawElements;proto.drawElements=function(m,c){S.calls++;S.tris+=t(m,c);return de.apply(this,arguments)};
   const da=proto.drawArrays;proto.drawArrays=function(m,f,c){S.calls++;S.tris+=t(m,c);return da.apply(this,arguments)};
   const dei=proto.drawElementsInstanced;if(dei)proto.drawElementsInstanced=function(m,c,ty,o,n){S.calls++;S.tris+=t(m,c)*n;return dei.apply(this,arguments)};
   const dai=proto.drawArraysInstanced;if(dai)proto.drawArraysInstanced=function(m,f,c,n){S.calls++;S.tris+=t(m,c)*n;return dai.apply(this,arguments)};
  }
 });
 const url=`http://127.0.0.1:${port}/?capture&view=downtown&hour=11${look==='v2'?'&look=v2':''}${extra?'&'+extra:''}`;
 await p.goto(url);await p.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:400000,polling:500});
 const err=await p.evaluate(()=>window.__astraError);if(err)throw new Error(err);
 await p.addStyleTag({content:'.astra-ui,.ui,#hud,.loading,[class*="toast"],body>div:not(#app){display:none!important}'});
 for(const v of views)for(const h of hours){
  await p.evaluate(([cam,hour])=>{__astra.setPaused(true);__astra.view(cam);__astra.setHour(hour);__astra.step(0);__astra.step(0);},[CAMS[v],HOURS[h]]);
  const file=`${out}/${tag}-${look}-${v}-${h}.png`;await p.screenshot({path:file,timeout:240000});result.shots.push(file);console.log('still',file);
 }
 if(process.argv.includes('--perf')){
  result.probe=await p.evaluate(([cam])=>{const a=__astra;a.view(cam);a.setHour(11);a.step(0);
   const gl=a.renderer.getContext(),px=new Uint8Array(4);const S=window.__GL;
   S.calls=0;S.tris=0;a.step(0);const calls=S.calls,tris=Math.round(S.tris);
   gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);const N=8;const t=performance.now();for(let i=0;i<N;i++)a.step(0);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
   const ms=(performance.now()-t)/N;a.setHour(21.5);a.step(0);S.calls=0;a.step(0);const nightCalls=S.calls;
   const t2=performance.now();for(let i=0;i<N;i++)a.step(0);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
   return {glCallsDay:calls,glCallsNight:nightCalls,tris,threeCalls:a.renderer.info.render.calls,msPerFrameDay:+ms.toFixed(1),msPerFrameNight:+((performance.now()-t2)/N).toFixed(1),people:a.residents.people.length};
  },[CAMS.wide]);
  console.log('probe',JSON.stringify(result.probe));
 }
 result.lookState=await p.evaluate(()=>__astra.look?.state&&{tubed:__astra.look.state.tubed,tubeMaterials:__astra.look.state.tubeMaterials});console.log('look',JSON.stringify(result.lookState));
 result.errors=errors;if(errors.length)console.log('errors',errors);
 writeFileSync(`${out}/${tag}-${look}-probe.json`,JSON.stringify(result,null,1));
}finally{await b.close();}
