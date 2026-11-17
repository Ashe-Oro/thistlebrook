// OWNER: grok-style lane. 15 s tour of Downtown in look v2: dusk -> night,
// slow push-in from the wide camera to the square. SwiftShader, offline frames.
import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const out='shots/grok-style',tmp=`${out}/.frames`,N=90,FPS=6;rmSync(tmp,{recursive:true,force:true});mkdirSync(tmp,{recursive:true});
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await b.newPage({viewport:{width:960,height:600}});await p.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await p.goto('http://127.0.0.1:5214/?capture&view=downtown&hour=17&look=v2');await p.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:400000,polling:500});
 await p.addStyleTag({content:'.astra-ui,#hud,.loading,body>div:not(#app){display:none!important}'});
 for(let i=0;i<N;i++){
  const t=i/(N-1),e=t*t*(3-2*t);
  const jpg=await p.evaluate(([e,t])=>{const a=__astra;a.view({x:-57-3*e,z:-6+2*e,zoom:3.1+2.3*e});a.setHour(17.2+4.6*t);for(let k=0;k<2;k++)a.step(.1,false);a.step(0);return a.renderer.domElement.toDataURL('image/jpeg',.9).split(',')[1];},[e,t]);
  writeFileSync(`${tmp}/${String(i).padStart(4,'0')}.jpg`,Buffer.from(jpg,'base64'));if(i%10===0)console.log('frame',i);
 }
 execFileSync('ffmpeg',['-y','-framerate',String(FPS),'-i',`${tmp}/%04d.jpg`,'-vf','minterpolate=fps=24:mi_mode=blend','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/v2-downtown-tour.mp4`],{stdio:'ignore'});
 console.log('video',`${out}/v2-downtown-tour.mp4`);
}finally{await b.close();}
