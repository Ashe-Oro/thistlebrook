// M4 local Chrome/SwiftShader evidence. npm run build first.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/village-props/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const part=process.argv.find(a=>a.startsWith('--part='))?.split('=')[1];
const evidence=part&&existsSync(dir+'evidence.json')?JSON.parse(readFileSync(dir+'evidence.json')):{errors:[],shots:[],checks:[]};
const checkpoint=()=>{evidence.checks=[...new Set(evidence.checks)];writeFileSync(dir+'evidence.json',JSON.stringify(evidence,null,2)+'\n');};
function record(shot){evidence.shots=evidence.shots.filter(s=>s.name!==shot.name);evidence.shots.push(shot);checkpoint();}
const server=await preview({preview:{port:0,host:'127.0.0.1'}});let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>{evidence.errors.push(String(e.stack||e));console.error(e);});
 await page.goto(server.resolvedUrls.local[0]+'?size=large&seed=1234&life=1&hour=16&timescale=0&prmax=0.7&shadowMap=256&post=0',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__ready===true,null,{timeout:120000});
 console.log('ready');if(part==='video'){await page.setViewportSize({width:640,height:360});await page.evaluate(()=>{__post.setOptions({post:false,hull:false});__renderer.shadowMap.enabled=false;const center=__life.props.world.registry.places.find(p=>p.type==='well').pos;__scene.traverse(o=>{const i=o.userData.inst;if(i&&Math.hypot(i.pos[0]-center[0],i.pos[1]-center[1])>26)o.visible=false;});});}await page.evaluate(()=>{__renderer.shadowMap.autoUpdate=false;});await page.evaluate(()=>{document.getElementById('look')?.classList.add('collapsed');window.__captureNow=performance.now();performance.now=()=>window.__captureNow;});
 async function tick(n=1){for(let i=0;i<n;i++)await page.evaluate(()=>{__captureNow+=1000/6;return new Promise(r=>requestAnimationFrame(r));});}
 async function approach(tool){return page.evaluate(tool=>{
  const p=__life.props,w=p.world;
  const place=tool==='ringBell'?w.registry.places.find(x=>x.id===w.props.bellPlaceId):tool==='openDoor'?w.registry.places.find(x=>p.doors.has(x.id)):w.registry.places.find(x=>x.type===({sit:'seat',drawWater:'well',buy:'market'}[tool])&&(tool!=='buy'||x.catalogId==='cv-market-stall')&&(tool!=='sit'||x.catalogId==='cv-bench')&&x.points.some(pt=>pt.kind==='entry'&&pt.node>=0));
  if(!place)throw Error('missing place for '+tool);
  const pos=[...w.props.approach(place,tool)];if(tool==='ringBell'){const f=place.points.find(p=>p.kind==='entry').facing;pos[0]+=f[1]*1.5;pos[1]-=f[0]*1.5;}__life.interiors.player.position.set(pos[0],0,pos[1]);return place.id;
 },tool);}
 async function frame(tool){await page.evaluate(tool=>__life.props.view({bell:tool==='ringBell'}),tool);await tick();}
 async function key(tool){await page.keyboard.press('e');await tick(4);const last=await page.evaluate(()=>__life.props.history.at(-1));assert.equal(last?.action,tool,JSON.stringify(last));assert(last.ok);return last;}
 async function shot(name,tool){console.log('capture',name);await page.evaluate(()=>__post.setOptions({post:true,hull:true}));await frame(tool);await page.screenshot({path:dir+name+'.png'});record({name,...await page.evaluate(()=>__life.props.inspect())});await page.evaluate(()=>__post.setOptions({post:false}));console.log('shot',name);}
 // Invalid requests and remote actions cannot mutate inventory.
 if(part!=='video'){const invalid=await page.evaluate(()=>{const p=__life.props;return [p.run('buy','missing'),p.run('drawWater',{type:'well'},{pos:[999,999],inventory:{}})];});assert(invalid.every(r=>!r.ok));}
 if(!part||part==='outdoor'||part==='bell')for(const [tool,name] of [['sit','sit'],['drawWater','well'],['buy','stall-buy'],['ringBell','bell']]){
  if(part==='bell'&&tool!=='ringBell')continue;await approach(tool);await tick();await key(tool);await shot(name,tool);if(tool==='sit'){assert(await page.evaluate(()=>__life.props.seated));await page.keyboard.press('e');await tick();}
 }
 if(!part||part==='indoor'){
 await approach('openDoor');await tick(2);await key('openDoor');assert(await page.evaluate(()=>!!__life.interior));
 await page.evaluate(()=>{const r=__life.interiors.rooms.find(r=>r.id===__life.interior.id);__life.interiors.player.position.set(r.origin[0],0,r.origin[1]+3);__life.interiors.view(Math.PI);});await tick(2);
 // Keep the interiors camera for a readable open leaf / doorway image.
 await page.evaluate(()=>__post.setOptions({post:true,hull:true}));await tick(2);await page.screenshot({path:dir+'door.png'});record({name:'door',...await page.evaluate(()=>__life.props.inspect())});
 await page.evaluate(()=>{const r=__life.interiors.rooms.find(r=>r.id===__life.interior.id);__life.interiors.player.position.set(r.origin[0],0,r.origin[1]+4.25);});await tick();await key('closeDoor');assert.equal(await page.evaluate(()=>__life.interior),null);
 // Verify every enterable building through the typed path and existing fades.
 for(const room of ['bakery','inn','store','smithy']){
  const id=await page.evaluate(room=>{const p=__life.props,d=[...p.doors].find(([,d])=>d.room.id===room),pos=d[1].room.trigger;__life.interiors.player.position.set(pos[0],0,pos[1]);return d[0];},room);await tick();
  assert((await page.evaluate(id=>__life.props.run('openDoor',id),id)).ok);await tick(4);assert.equal(await page.evaluate(()=>__life.interior.id),room);
  if(room==='inn'){
   await page.evaluate(()=>{const r=__life.interiors.rooms.find(r=>r.id==='inn');__life.interiors.player.position.set(r.origin[0]-3,0,r.origin[1]+1.3);__life.interiors.view(0,.15);});await tick();await key('eat');await page.evaluate(()=>__post.setOptions({post:true,hull:true}));await tick();await page.screenshot({path:dir+'inn-mug.png'});record({name:'inn-mug',...await page.evaluate(()=>__life.props.inspect())});
  }
  await page.evaluate(()=>{const r=__life.interiors.rooms.find(r=>r.id===__life.interior.id);__life.interiors.player.position.set(r.origin[0],0,r.origin[1]+4.25);});await tick();await key('closeDoor');evidence.checks.push(room+' typed open/close + fade');checkpoint();console.log('door checked',room);
 }
 }
 // walkTo returns registry entry routes; its player adapter follows every waypoint.
 if(part!=='video'){const walk=await page.evaluate(()=>{const p=__life.props,target=p.world.registry.places.find(x=>x.type==='market'&&x.points.some(pt=>pt.node>=0));return p.run('walkTo',target.id);});assert(walk.ok&&walk.path.length);await tick(8);await page.keyboard.press('w');await page.keyboard.up('w');
 evidence.checks.push('registry walkTo route, invalid target / distance guards, keyboard sit/well/buy/bell, inn meal');}
 if((!part&&!process.argv.includes('--stills-only'))||part==='video'){
  const captureSession=await page.context().newCDPSession(page);const frames=dir+'frames/';rmSync(frames,{recursive:true,force:true});mkdirSync(frames,{recursive:true});evidence.video={samples:[]};
  await page.evaluate(()=>{__post.setOptions({post:false,hull:false});__renderer.shadowMap.enabled=false;});
  for(let f=0;f<48;f++){
   const tool=f<24?'drawWater':'ringBell';if(f===0||f===24){await approach(tool);await tick();await page.keyboard.press('e');await tick();const result=await page.evaluate(()=>__life.props.history.at(-1));assert.equal(result.action,tool);evidence.video.samples.push({frame:f,...result});checkpoint();}await frame(tool);const captured=await captureSession.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});writeFileSync(frames+String(f).padStart(4,'0')+'.png',Buffer.from(captured.data,'base64'));if(f%24===0)console.log('video frame',f);
  }
  execFileSync('ffmpeg',['-y','-framerate','6','-i',frames+'%04d.png','-c:v','libx264','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',dir+'village-props.mp4'],{stdio:'pipe'});rmSync(frames,{recursive:true,force:true});evidence.video={...evidence.video,path:'village-props.mp4',seconds:8,fps:6,viewport:part==='video'?[640,360]:[1280,720],captureRadius:part==='video'?26:null};checkpoint();
 }
 assert.deepEqual(evidence.errors,[]);console.log('capture checks passed',part||'all');
}finally{checkpoint();await browser?.close();await new Promise(r=>server.httpServer.close(r));}
