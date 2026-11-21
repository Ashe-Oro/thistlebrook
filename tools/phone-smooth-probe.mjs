#!/usr/bin/env node
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {setTimeout as delay} from 'node:timers/promises';

const [stage, source, ...requested] = process.argv.slice(2);
if (!stage || !source) throw new Error('Usage: node tools/phone-smooth-probe.mjs <stage> <dist> [phone6 phone4 desktop]');
const output=process.env.PHONE_SMOOTH_DIR || '/workspace/scratch/phone-smooth';
const stills=requested.includes('--stills');
const selected=requested.filter(arg=>arg!=='--stills');
const profiles=selected.length ? selected : ['phone6','phone4','desktop'];
const root=resolve(source);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm',
  '.glb':'model/gltf-binary','.json':'application/json','.ktx2':'image/ktx2','.png':'image/png'};
const server=createServer(async(req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const file=resolve(root, '.'+(path==='/'?'/index.html':path));
    if (!file.startsWith(root+sep)) {res.writeHead(403).end();return;}
    const info=await stat(file);
    if (!info.isFile()) {res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':info.size});
    await pipeline(createReadStream(file),res);
  }catch{if(!res.headersSent)res.writeHead(404).end();}
});
await mkdir(output,{recursive:true});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port+'/?seed=831&hour=10.4'+(stills?'&capture=1':'');
const report=resolve(output,'probe.json');
const categories=['devtools.timeline','disabled-by-default-devtools.timeline','blink.user_timing','v8','v8.execute',
  'disabled-by-default-v8.cpu_profiler','gpu','viz','cc','input','latencyInfo','toplevel'];
const args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-watchdog','--enable-unsafe-swiftshader'];
const sameCamera=(a,b)=>a.x===b.x&&a.z===b.z&&a.zoom===b.zoom&&a.rotation===b.rotation;
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.ceil(p*values.length)-1]:null;
async function saveTrace(cdp,path) {
  const complete=new Promise(done=>cdp.once('Tracing.tracingComplete',done));
  await cdp.send('Tracing.end');
  const {stream}=await complete;
  async function* chunks() {
    while(true) {
      const {data,base64Encoded,eof}=await cdp.send('IO.read',{handle:stream});
      yield Buffer.from(data,base64Encoded?'base64':'utf8');
      if(eof) break;
    }
  }
  await writeFile(path,chunks());
  await cdp.send('IO.close',{handle:stream});
}

try {
  for(const profile of profiles) {
    const phone=profile.startsWith('phone');
    const rate=phone?Number(profile.slice(5)):1;
    if(![1,4,6].includes(rate))throw new Error('Unknown profile '+profile);
    const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args});
    try {
      const context=await browser.newContext(phone
        ?{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}
        :{viewport:{width:1440,height:900}});
      const page=await context.newPage();
      const cdp=await context.newCDPSession(page);
      const errors=[],failed=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('response',response=>{if(response.status()>=400)failed.push(new URL(response.url()).pathname);});
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:stills?1:rate});
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
      await page.addInitScript(()=>{
        const nativeRAF=window.requestAnimationFrame.bind(window);
        const blocked=[];
        const probe=window.__phoneProbe={frames:[],events:[],rendered:0,freeze:false,record:false,
          resume(){
            probe.freeze=false;
            blocked.splice(0).forEach(callback=>window.requestAnimationFrame(callback));
          }
        };
        let ready;
        Object.defineProperty(window,'__ready',{configurable:true,get:()=>ready,set(value){
          ready=value;
          if(value){
            performance.mark('phone-probe:ready');
            probe.readyDistricts=window.__astra.stream?.audit();
            probe.freeze=true;
          }
        }});
        window.requestAnimationFrame=callback=>nativeRAF(timestamp=>{
          if(probe.freeze){blocked.push(callback);return;}
          const a=window.__astra;
          const before=a?.renderer.info.render.frame;
          const start=performance.now();
          callback(timestamp);
          if(!a||a.renderer.info.render.frame===before)return;
          probe.rendered++;
          if(probe.record)probe.frames.push({timestamp,start,end:performance.now(),frame:probe.rendered,
            calls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles,
            pixelRatio:a.renderer.getPixelRatio(),camera:a.controls.state()});
        });
      });
      if(!stills)await cdp.send('Tracing.start',{categories:categories.join(','),transferMode:'ReturnAsStream'});
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
      await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:240000,polling:50});
      const ready=await page.evaluate(()=>{
        if(window.__astraError)throw new Error(window.__astraError);
        const a=window.__astra;
        return {readyMs:window.__readyAt,readyDistricts:window.__phoneProbe.readyDistricts,
          opening:{...a.controls.state()},drawCalls:a.renderer.info.render.calls};
      });
      console.log(stage,profile,'ready',ready.readyMs,ready.drawCalls);
      if(stills){
        await page.screenshot({path:resolve(output,`${stage}-${profile}-ready.png`),timeout:120000});
      }else{
        await saveTrace(cdp,resolve(output,`${stage}-${profile}-startup.trace.json`));
      }

      // Keep background streaming separate from the settled gesture test.
      await page.evaluate(async stills=>{
        const a=window.__astra;
        if(stills)a.setPaused(true);
        await a.streamed;
        await a.viewReady();
      },stills);
      const districts=await page.evaluate(()=>window.__astra.stream?.audit());
      console.log(stage,profile,'streamed',Object.keys(districts||{}).length);
      let pan;
      if(phone&&!stills){
        await page.evaluate(()=>{
          const p=window.__phoneProbe;
          const a=window.__astra;
          const canvas=a.renderer.domElement;
          let previous;
          canvas.addEventListener('pointerdown',e=>{
            if(e.pointerType!=='touch')return;
            previous=a.controls.state();
            p.record=true;
            p.panStart=performance.now();
            performance.mark('phone-probe:pan-start');
          });
          canvas.addEventListener('pointermove',e=>{
            if(e.pointerType!=='touch'||!p.record)return;
            p.resume();
            const next=a.controls.state();
            p.events.push({time:performance.now(),eventTime:e.timeStamp,frame:p.rendered,
              clientX:e.clientX,clientY:e.clientY,changed:previous?.x!==next.x||previous?.z!==next.z,...next});
            previous=next;
          });
          canvas.addEventListener('pointerup',e=>{
            if(e.pointerType==='touch'){
              p.panEnd=performance.now();
              p.releaseFrame=p.rendered;
            }
          });
        });
        await cdp.send('Tracing.start',{categories:categories.join(','),transferMode:'ReturnAsStream'});
        const dispatch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
        await dispatch('touchStart',195,430);
        const start=performance.now();
        const moves=[];
        for(let next=0;next<3000;next+=1000/30){
          await delay(Math.max(0,start+next-performance.now()));
          const t=(next+40)/3040;
          moves.push(dispatch('touchMove',195+105*Math.sin(t*Math.PI*2),430+95*Math.sin(t*Math.PI)));
        }
        await delay(Math.max(0,start+3000-performance.now()));
        await Promise.all([...moves,dispatch('touchEnd')]);
        // Keep the frame crossing the release boundary. A renderer stall can
        // span the entire gesture, in which case it must count in the result.
        await page.waitForFunction(()=>window.__phoneProbe.rendered>window.__phoneProbe.releaseFrame,
          null,{polling:50,timeout:60000});
        const data=await page.evaluate(()=>{
          const p=window.__phoneProbe;
          p.record=false;
          performance.mark('phone-probe:pan-end');
          return {frames:p.frames,events:p.events,panStart:p.panStart,panEnd:p.panEnd??performance.now(),releaseFrame:p.releaseFrame};
        });
        await saveTrace(cdp,resolve(output,`${stage}-${profile}-pan.trace.json`));
        const frames=data.frames.filter(f=>f.start>=data.panStart&&f.frame<=data.releaseFrame+1);
        const intervals=frames.slice(1).map((f,i)=>({end:f.start-data.panStart,ms:f.start-frames[i].start}));
        const events=data.events.filter(e=>e.changed);
        const latest=[...new Map(events.map(event=>[event.frame,event])).values()];
        const responses=latest.map(event=>{
          const first=data.frames.find(f=>f.frame>event.frame);
          const match=data.frames.find(f=>f.frame>event.frame&&sameCamera(f.camera,event));
          return {eventFrame:event.frame,firstFrame:first?.frame??null,matchFrames:match?match.frame-event.frame:null,
            eventToRenderMs:match?match.start-event.eventTime:null};
        });
        const renderedResponses=responses.filter(r=>r.firstFrame!==null&&r.firstFrame<=data.releaseFrame);
        pan={scheduledDurationMs:3000,durationMs:data.panEnd-data.panStart,intervals,
          submitP95Ms:percentile(frames.map(f=>f.end-f.start),.95),
          p95Ms:percentile(intervals.map(f=>f.ms),.95),
          maxAfterFirstSecondMs:percentile(intervals.filter(f=>f.end>=1000).map(f=>f.ms),1),
          maxEventToRenderFrames:renderedResponses.every(r=>r.matchFrames!==null)
            ?percentile(renderedResponses.map(r=>r.matchFrames),1):null,
          maxEventToRenderMs:percentile(renderedResponses.map(r=>r.eventToRenderMs).filter(v=>v!==null),1),
          cameraMisses:renderedResponses.filter(r=>r.matchFrames!==1).length,responses,
          cameraUpdatesDuringEvent:events.length,touchMoveEvents:data.events.length,...data};
        pan.frameCount=frames.length;
        console.log(stage,profile,'pan p95/max',pan.p95Ms,pan.maxAfterFirstSecondMs,'frames',pan.frameCount);
      }
      await page.evaluate(()=>{window.__phoneProbe.freeze=true;window.__astra.setPaused(true);});
      const views={};
      for(const view of ['opening','wide','harvest']) {
        const stats=await page.evaluate(async({view,camera})=>{
          const a=window.__astra;
          a.setHour(10.4);
          a.view(view==='opening'?camera:view==='wide'?{...camera,zoom:.12}:view);
          await a.viewReady();
          // Restore deterministic poses for the stills by loading a fresh
          // capture in the visual run below. These are normal-render stats.
          const start=performance.now();
          a.step(0);
          const {calls,triangles}=a.renderer.info.render;
          const groups={},triangleGroups={};
          const lists=a.renderer.renderLists.get(a.scene,0);
          for(const item of [...lists.opaque,...lists.transparent,...lists.transmissive]) {
            let parent=item.object;
            while(parent.parent && parent.parent!==a.scene)parent=parent.parent;
            const key=[parent.name||parent.userData.registryId||parent.type,item.object.isInstancedMesh?'InstancedMesh':item.object.type,item.material.type].join(' / ');
            groups[key]=(groups[key]||0)+1;
            const {object,geometry,group}=item;
            const triangles=object.isLine||object.isPoints?0:object.isBatchedMesh
              ?object._multiDrawCounts.subarray(0,object._multiDrawCount).reduce((sum,count)=>sum+count,0)/3
              :(group?.count??geometry.index?.count??geometry.attributes.position.count)*(object.isInstancedMesh?object.count:1)/3;
            triangleGroups[key]=(triangleGroups[key]||0)+triangles;
          }
          return {drawCalls:calls,triangles,submitMs:performance.now()-start,groups,triangleGroups};
        },{view,camera:ready.opening});
        views[view]=stats;
        if(stills)await page.screenshot({path:resolve(output,`${stage}-${profile}-${view}.png`),timeout:120000});
        console.log(stage,profile,view,stats.drawCalls,stats.triangles);
      }
      if(stills)continue;
      let history={};
      try{history=JSON.parse(await readFile(report,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
      history[stage]??={};
      history[stage][profile]={cpuThrottle:rate,viewport:page.viewportSize(),dpr:phone?3:1,
        browser:browser.version(),gpu:'ANGLE SwiftShader',...ready,districts,pan,views,failed,errors};
      const before=history.before?.phone6,after=history.after?.phone6;
      if(before&&after)history.comparison={
        readyImprovement:1-after.readyMs/before.readyMs,
        panP95Improvement:before.pan.p95Ms&&after.pan.p95Ms?1-after.pan.p95Ms/before.pan.p95Ms:null,
        maxPanAfterFirstSecondMs:after.pan.maxAfterFirstSecondMs,
        fingerToCameraFrames:after.pan.maxEventToRenderFrames,
        wideDrawCalls:Object.fromEntries(Object.entries(history.after).map(([name,p])=>[name,p.views.wide.drawCalls])),
        desktopReadyImprovement:history.after.desktop&&history.before.desktop
          ?1-history.after.desktop.readyMs/history.before.desktop.readyMs:undefined,
      };
      await writeFile(report,JSON.stringify(history,null,2)+'\n');
    }finally{await browser.close();}
  }
}finally{await new Promise(done=>server.close(done));}
