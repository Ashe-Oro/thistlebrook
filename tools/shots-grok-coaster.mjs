// Copperhead coaster evidence (grok-coaster lane). Port 5216:
//   npx vite --port 5216 --strictPort  then  node tools/shots-grok-coaster.mjs [--tag before|after] [--film] [--views a,b]
import {chromium} from 'playwright-core';
import {mkdirSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const port=process.env.PORT||5216,tag=arg('--tag','after'),dir='shots/grok-coaster/';mkdirSync(dir,{recursive:true});
const VIEWS=JSON.parse(arg('--json','null'))||{
 ashe:{x:199,z:-66,zoom:5.2,hour:12},
 wide:{x:212,z:-70,zoom:2.4,hour:12},
 lift:{x:186,z:-66,zoom:4.5,hour:12},
 back:{x:222,z:-80,zoom:4.2,hour:12},
};
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1024,height:560}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto(`http://localhost:${port}/?view=themepark&seed=831&capture=1`);
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:400000,polling:500});
 const err=await page.evaluate(()=>window.__astraError);if(err)throw Error(err);
 await page.evaluate(()=>{document.querySelector('.loading')?.remove();const intro=document.querySelector('.intro');if(intro)intro.style.display='none';for(let i=0;i<40;i++)__astra.step(.1,false);__astra.step(0);});
 const only=arg('--views',null)?.split(',');
 if(!process.argv.includes('--film'))for(const [name,v]of Object.entries(VIEWS)){if(only&&!only.includes(name))continue;
  await page.evaluate(v=>{__astra.view({x:v.x,z:v.z,zoom:v.zoom});__astra.setHour(v.hour);for(let i=0;i<10;i++)__astra.step(.1,false);__astra.step(0);},v);
  await page.screenshot({path:`${dir}${tag}-${name}.png`,timeout:180000});console.log('shot',tag,name);}
 if(process.argv.includes('--film')){
  const frames=dir+'.frames/';rmSync(frames,{recursive:true,force:true});mkdirSync(frames,{recursive:true});
  // Wait until train 0 crests the far curve, then follow it down the drop and over the camelback.
  const car=()=>{const c=__astra.world.expansions.themepark.rides.rides.copperhead.trains[0][0].position;return [c.x+220,c.y,c.z-52];};
  await page.evaluate(()=>{__astra.setHour(16.5);});
  await page.evaluate(src=>{const car=eval(src);for(let i=0;i<4000;i++){const [x,y,z]=car();if(y>20&&z<-95&&x>240)break;__astra.step(.05,false);}},`(${car})`);
  await page.evaluate(src=>{const car=eval(src),[x,,z]=car();window.__cam=[x,z];__astra.setHour(16.5);},`(${car})`);
  for(let i=0;i<96;i++){await page.evaluate(src=>{const car=eval(src);__astra.step(1/12,false);const [x,,z]=car();const c=window.__cam;c[0]+=(x-c[0])*.3;c[1]+=(z-c[1])*.3;__astra.view({x:c[0],z:c[1],zoom:4.2});__astra.step(0);},`(${car})`);for(let attempt=0;;attempt++){try{await page.screenshot({path:frames+String(i).padStart(4,'0')+'.jpg',type:'jpeg',quality:86,timeout:300000});break;}catch(e){if(attempt>=2)throw e;console.log('retry frame',i);}}if(i%24===0)console.log('film',i);}
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','12','-i',frames+'%04d.jpg','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',`${dir}${tag}-ride.mp4`]);rmSync(frames,{recursive:true});
 }
 if(errors.length)console.log('page errors',errors.slice(0,5));
}finally{await browser.close();}
