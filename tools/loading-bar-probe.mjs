#!/usr/bin/env node
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pipeline} from 'node:stream/promises';

const [source='dist',...flags] = process.argv.slice(2);
const baseline = flags.includes('--baseline');
const stills = baseline || flags.includes('--stills');
const output = process.env.LOADING_BAR_OUTPUT || '/workspace/scratch/loading-bar';
const root = resolve(source);
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm',
  '.glb':'model/gltf-binary','.json':'application/json','.ktx2':'image/ktx2','.png':'image/png'};
const profiles = {
  phone6:{rate:6,context:{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}},
  desktop:{rate:1,context:{viewport:{width:1440,height:900}}},
};
const selected = Object.keys(profiles).filter(profile=>flags.every(flag=>!(flag in profiles))||flags.includes(profile));
const server = createServer(async(req,res)=>{
  try {
    const path = decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const file = resolve(root,'.'+(path==='/'?'/index.html':path));
    if (!file.startsWith(root+sep)) {res.writeHead(403).end();return;}
    const info = await stat(file);
    if (!info.isFile()) {res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':info.size});
    await pipeline(createReadStream(file),res);
  } catch {
    if (!res.headersSent) res.writeHead(404).end();
  }
});
const args = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-watchdog','--enable-unsafe-swiftshader'];
const round = value=>Number(value.toFixed(3));

function curve(data) {
  const {samples,readyAt} = data;
  const start = readyAt*.05;
  let worst = {error:0};
  // The screen holds its previous paint between updates. Check both sides of each step.
  for (let i=0;i<samples.length-1;i++) {
    const {time,progress,phase} = samples[i];
    const end = samples[i+1].time;
    if (end<start) continue;
    for (const at of [Math.max(start,time),Math.min(readyAt,end)]) {
      const error = Math.abs(progress-at/readyAt);
      if (error>worst.error) worst = {error,at,progress,phase};
    }
  }
  if (samples[0].time>start) {
    const at = samples[0].time;
    if (at/readyAt>worst.error) worst = {error:at/readyAt,at,progress:0,phase:'plan'};
  }
  const nearDone = samples.find(sample=>sample.progress>=.99);
  return {readyMs:round(readyAt),window:'5–100% of navigation to ready',maxErrorPoints:round(worst.error*100),
    worstAtMs:round(worst.at),worstProgress:round(worst.progress),worstPhase:worst.phase,
    at99Ms:round(Math.max(0,readyAt-(nearDone?.time??readyAt))),within15Points:worst.error<=.15};
}

function plot(profile,{samples,readyAt},stats) {
  const x = ms=>60+ms/readyAt*620, y = fraction=>344-fraction*300;
  let line = 'M 60 344';
  for (const {time,progress} of samples) line += ` H ${round(x(Math.min(time,readyAt)))} V ${round(y(progress))}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 730 400" font-family="sans-serif" fill="#344c40">
  <rect width="730" height="400" fill="#fffdf4"/>
  <text x="60" y="26" font-size="19">${profile} · ${stats.maxErrorPoints} pp maximum error</text>
  <path d="M 60 44 V 344 H 680" fill="none" stroke="#839079"/>
  <path d="M 60 344 L 680 44" stroke="#aa875c" stroke-dasharray="5 5"/>
  <path d="${line}" fill="none" stroke="#507454" stroke-width="2"/>
  <text x="12" y="50" font-size="13">100%</text><text x="28" y="348" font-size="13">0%</text>
  <text x="60" y="366" font-size="13">0 s</text>
  <text x="680" y="366" text-anchor="end" font-size="13">${round(readyAt/1000)} s</text>
  <text x="370" y="387" text-anchor="middle" font-size="13">Elapsed time · dashed line shows elapsed fraction</text>
</svg>\n`;
}

async function saveStills(profile,data,frames,slimShot) {
  let chosen;
  const before = frames.filter(frame=>frame.time>=data.visibleAt && frame.time<data.readyAt);
  if (baseline) {
    chosen = {baseline:before[Math.floor(before.length/2)]};
  } else {
    const candidates = before.map(frame=>{
      const sample = data.samples.findLast(sample=>sample.time<=frame.time);
      return {...frame,progress:sample?.progress??0};
    });
    chosen = Object.fromEntries([10,50,90].map(percent=>[
      percent,candidates.reduce((best,frame)=>!best || Math.abs(frame.progress*100-percent)<Math.abs(best.progress*100-percent)?frame:best,null),
    ]));
  }
  const shots = {};
  for (const [label,frame] of Object.entries(chosen)) {
    if (!frame) throw new Error(`No ${label} frame for ${profile}`);
    const name = `${profile}-${label}.png`;
    await writeFile(resolve(output,name),frame.data,'base64');
    shots[label] = {name,time:round(frame.time),progress:frame.progress};
  }
  if (slimShot) {
    const name = `${profile}-slim.png`;
    await writeFile(resolve(output,name),slimShot);
    shots.slim = {name,visibleFromMs:round(data.slim.time)};
  }
  return shots;
}

if (!baseline) {
  const {opening} = JSON.parse(await readFile(resolve(root,'asset-sizes.json'),'utf8'));
  if (!opening.desktop?.models.length || !opening.phone?.models.length) throw new Error('Build dist with opening verification first');
}
await mkdir(output,{recursive:true});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url = 'http://127.0.0.1:'+server.address().port+'/?seed=831&hour=10.4';

try {
  for (const profile of selected) {
    const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args});
    try {
      const {rate,context:options} = profiles[profile];
      const context = await browser.newContext(options);
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate',{rate});
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
      const errors = [];
      page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(() => {
        window.__loadingProbe = {};
        new MutationObserver(()=>{
          if (!window.__loadingProbe.visibleAt && document.querySelector('.loading')) {
            window.__loadingProbe.visibleAt = performance.now();
          }
          if (window.__loadingProbe.slim) return;
          const slim = document.querySelector('.load-slim:not([hidden])');
          if (!slim) return;
          const rect = slim.getBoundingClientRect();
          const overlap = [...document.querySelectorAll('.view-tabs,.tools,.mobile-bar,.world-navigation')]
            .filter(node=>node.getClientRects().length).some(node=>{
              const other = node.getBoundingClientRect();
              return rect.left<other.right && rect.right>other.left && rect.top<other.bottom && rect.bottom>other.top;
            });
          window.__loadingProbe.slim = {time:performance.now(),overlap,pointerEvents:getComputedStyle(slim).pointerEvents};
        }).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
      });
      const frames = [];
      if (stills) {
        cdp.on('Page.screencastFrame',frame=>{
          frames.push(frame);
          cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>{});
        });
        await cdp.send('Page.startScreencast',{format:'png',everyNthFrame:1});
      }

      await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
      await page.waitForFunction(()=>window.__ready || window.__astraError,null,{polling:100,timeout:180000});
      if (!baseline) await page.waitForFunction(()=>window.__loadingProbe.slim,null,{polling:100,timeout:30000});
      let slimShot;
      if (stills) {
        await cdp.send('Page.stopScreencast');
        if (!baseline) {
          await page.waitForFunction(()=>{
            const slim = document.querySelector('.load-slim');
            return !slim.hidden && Number(getComputedStyle(document.querySelector('.loading')).opacity)<.01;
          },null,{polling:100,timeout:30000});
          slimShot = await page.screenshot({scale:'css',timeout:30000});
        }
      }
      const data = await page.evaluate(()=>({
        ...window.__loadingProbe,origin:performance.timeOrigin,readyAt:window.__readyAt,
        marks:Object.fromEntries(performance.getEntriesByType('mark').map(mark=>[mark.name,mark.startTime])),
        fonts:[...new Set([...document.fonts].filter(font=>font.status==='loaded').map(font=>font.family))],
        bootError:window.__astraError,samples:window.__loadProgress?.samples,workSamples:window.__loadProgress?.workSamples,
      }));
      if (data.bootError || errors.length || !data.readyAt) throw new Error(JSON.stringify({bootError:data.bootError,errors}));
      if (!baseline) {
        if (data.slim.overlap || data.slim.pointerEvents!=='none') throw new Error(JSON.stringify(data.slim));
        const {samples,readyAt} = data;
        const incomplete = samples.at(-1).progress!==1 || Math.abs(samples.at(-1).time-readyAt)>10;
        const invalid = samples.slice(0,-1).some((sample,i)=>sample.progress>=1 || sample.progress>samples[i+1].progress);
        if (incomplete || invalid) throw new Error('The displayed bar must rise monotonically to 100% at ready');
      }
      if (stills) {
        const {width,height} = options.viewport;
        const calibrated = frames.filter(frame=>frame.metadata.deviceWidth>=width && frame.metadata.deviceHeight>=height)
          .map(frame=>({data:frame.data,time:frame.metadata.timestamp*1000-data.origin}));
        const shots = await saveStills(profile,data,calibrated,slimShot);
        await writeFile(resolve(output,`${profile}-${baseline?'baseline':'shots'}.json`),JSON.stringify(shots,null,2)+'\n');
        console.log(profile,JSON.stringify(shots));
      } else {
        const stats = curve(data);
        await writeFile(resolve(output,`${profile}-curve.json`),JSON.stringify({...stats,...data},null,2)+'\n');
        await writeFile(resolve(output,`${profile}-curve.csv`),'time_ms,progress,phase,eta_s\n'+
          data.samples.map(({time,progress,phase,eta})=>[round(time),round(progress),phase,eta].join(',')).join('\n')+'\n');
        await writeFile(resolve(output,`${profile}-curve.svg`),plot(profile,data,stats));
        console.log(profile,JSON.stringify(stats));
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(done=>server.close(done));
}
