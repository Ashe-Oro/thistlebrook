// OWNER: grok-skins lane (Grok). Short clip of live skin switching on one page
// (no reload): wide view, evening sweep, K hotkey pressed every SEG frames,
// in-game picker visible. SwiftShader, offline frames -> mp4.
import {chromium} from 'playwright-core';
import {mkdirSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const port=process.argv[2]||'5218',out='shots/grok-skins',tmp=`${out}/.frames`,SEG=14,SKINS=5,N=SEG*SKINS,FPS=7;
rmSync(tmp,{recursive:true,force:true});mkdirSync(tmp,{recursive:true});
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await b.newPage({viewport:{width:1100,height:690}});await p.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await p.goto(`http://127.0.0.1:${port}/?capture&view=downtown&hour=11`);await p.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:600000,polling:500});
 await p.evaluate(()=>{__astra.setPaused(true);__astra.view({x:-44,z:-3,zoom:2.3});});
 for(let i=0;i<N;i++){
  if(i&&i%SEG===0){await p.mouse.move(550,300);await p.keyboard.press('KeyK');}
  const t=(i%SEG)/(SEG-1);
  await p.evaluate(([t,i])=>{const a=__astra;a.view({x:-44-2*(i/70),z:-3+1.5*(i/70),zoom:2.3+.5*(i/70)});a.setHour(10.5+11*t);a.step(0);},[t,i]);
  await p.screenshot({path:`${tmp}/${String(i).padStart(4,'0')}.png`});if(i%10===0)console.log('frame',i,await p.evaluate(()=>__astra.skin.state.skin));
 }
 execFileSync('ffmpeg',['-y','-framerate',String(FPS),'-i',`${tmp}/%04d.png`,'-vf','minterpolate=fps=21:mi_mode=blend,scale=1100:-2','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/skins-live-switch.mp4`],{stdio:'ignore'});
 console.log('video',`${out}/skins-live-switch.mp4`);
}finally{await b.close();}
