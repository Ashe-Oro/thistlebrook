#!/usr/bin/env node
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';

const [stage = 'after', source = 'dist', profile] = process.argv.slice(2);
const phoneOpening = profile === '--phone-opening';
const output = process.env.LOAD_PROBE_DIR || '/workspace/scratch/fast-load';
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.wasm':'application/wasm', '.json':'application/json', '.png':'image/png'};
const targets = phoneOpening ? {phoneReadyBytes:3590000} :
  {desktopReadyBytes:5e6,phoneReadyBytes:4e6,maxStreamedRatio:.7,wideTriangles:28840000};

function compare(history) {
  const {before,after} = history;
  if (!before?.desktop || !before.phone || !after?.desktop || !after.phone) return;
  const desktop = after.desktop;
  const phone = after.phone;
  if (phoneOpening) return {
    phoneReady:phone.bytesUntilReady<=targets.phoneReadyBytes,
    phoneReadyBytesSaved:before.phone.bytesUntilReady-phone.bytesUntilReady,
  };
  return {
    desktopReady:desktop.bytesUntilReady<=targets.desktopReadyBytes,
    phoneReady:phone.bytesUntilReady<=targets.phoneReadyBytes,
    desktopStreamedReduction:1-desktop.totalBytes/before.desktop.totalBytes,
    phoneStreamedReduction:1-phone.totalBytes/before.phone.totalBytes,
    totalTransfer:['desktop','phone'].every(device=>after[device].totalBytes<=before[device].totalBytes*targets.maxStreamedRatio),
    wideTriangles:desktop.views.wide.triangles<=targets.wideTriangles,
    drawCalls:['desktop','phone'].every(device=>Object.entries(after[device].views)
      .every(([view,stats])=>stats.drawCalls<=before[device].views[view].drawCalls)),
  };
}

const report = resolve(output,'probe.json');
async function writeReport(history) {
  history.targets = targets;
  history.comparison = compare(history);
  await writeFile(report,JSON.stringify(history,null,2)+'\n');
}

if (stage === '--summarize') {
  await writeReport(JSON.parse(await readFile(report,'utf8')));
  process.exit(0);
}

let server;
let origin = source;
if (!/^https?:\/\//.test(source)) {
  const root = resolve(source);
  const compressed = new Map();
  server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
      if (!file.startsWith(root + sep)) return res.writeHead(403).end();
      const info = await stat(file);
      if (!info.isFile()) return res.writeHead(404).end();
      if (!compressed.has(file)) {
        const raw = await readFile(file);
        const gzip = gzipSync(raw);
        compressed.set(file, gzip.length < raw.length ? [gzip,'gzip'] : [raw,'identity']);
      }
      const [body,encoding] = compressed.get(file);
      res.writeHead(200, {'Content-Type':mime[extname(file)] || 'application/octet-stream', 'Content-Length':body.length, 'Content-Encoding':encoding});
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = 'http://127.0.0.1:' + server.address().port;
}
await mkdir(output, {recursive:true});
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-watchdog','--enable-unsafe-swiftshader']});
const result = {source, megabitsPerSecond:20};
try {
  for (const [device, viewport] of [['desktop',{width:1440,height:900}],['phone',{width:390,height:844}]]) {
    const context = await browser.newContext({viewport, isMobile:device === 'phone', hasTouch:device === 'phone', reducedMotion:'reduce'});
    const page = await context.newPage();
    await page.addInitScript(warmCallbacks => {
      const schedule = window.requestAnimationFrame.bind(window);
      // Freeze the render loop on ready so SwiftShader can finish each still.
      let ready;
      Object.defineProperty(window,'__ready',{
        configurable:true,get:()=>ready,set(value) {
          ready=value;
          if (value) {
            window.__probeReadyAt=performance.now();
            window.__probeReadyDistricts=window.__astra?.stream?.audit();
          }
        },
      });
      window.requestAnimationFrame = callback => !ready || warmCallbacks-- > 0 ? schedule(callback) : 0;
    }, ['streaming','lod'].includes(stage) ? 1 : 0);
    const cdp = await context.newCDPSession(page);
    const requests = new Map();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', {cacheDisabled:true});
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:25,downloadThroughput:20e6/8,uploadThroughput:20e6/8});
    cdp.on('Network.requestWillBeSent', ({requestId,request}) => requests.set(requestId,{url:request.url,bytes:0}));
    cdp.on('Network.responseReceived', ({requestId,response}) => {
      const request = requests.get(requestId);
      if (request) request.status = response.status;
    });
    cdp.on('Network.dataReceived', ({requestId,encodedDataLength}) => {
      const request = requests.get(requestId);
      if (request) request.bytes += encodedDataLength;
    });
    cdp.on('Network.loadingFinished', ({requestId,encodedDataLength}) => {
      const request = requests.get(requestId);
      if (request) request.bytes = encodedDataLength;
    });
    const bytes = () => [...requests.values()].reduce((sum, request) => sum + request.bytes, 0);
    await page.goto(origin + '/?seed=831&capture=1',{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout:240000,polling:25});
    const bytesUntilReady = bytes();
    const openingRequests = [...requests.values()].filter(r=>r.bytes>0).sort((a,b)=>b.bytes-a.bytes).slice(0,16).map(r=>({path:new URL(r.url).pathname,bytes:r.bytes}));
    console.log(stage,device,'ready',bytesUntilReady,JSON.stringify(openingRequests));
    const readyDistricts = await page.evaluate(() => window.__probeReadyDistricts);
    const readyMs = await page.evaluate(() => {
      if (window.__astraError) throw new Error(window.__astraError);
      return window.__readyAt ?? window.__probeReadyAt;
    });
    await page.evaluate(() => {window.__astra.setPaused(true);});
    console.log(stage,device,'paused');
    // The render loop is frozen at ready, so this captures what the first
    // visitor sees even if the background queue starts before the screenshot.
    if (phoneOpening && !process.env.LOAD_PROBE_NO_STILLS) {
      await page.screenshot({path:resolve(output,stage+'-'+device+'.png'),timeout:120000});
    }
    await page.evaluate(() => window.__astra.streamed);
    console.log(stage,device,'stream complete');
    await page.waitForLoadState('networkidle',{timeout:30000}).catch(error=>{if(error.name!=='TimeoutError')throw error;});
    const districts = await page.evaluate(() => window.__astra.stream?.audit());
    const totalBytes = bytes();
    console.log(stage,device,'transferred',totalBytes);
    const views = {};
    for (const view of phoneOpening || device === 'phone' ? ['opening'] : ['opening','wide','close']) {
      if (view !== 'opening') await page.evaluate(view => {
        const a = window.__astra;
        if (view === 'wide') a.view({...a.controls.state(), zoom:.12});
        else a.view('harvest');
      }, view);
      const stats = await page.evaluate(async () => {
        const a = window.__astra;
        a.setHour(10.4);
        await a.viewReady?.();
        // Direct renders expose town geometry instead of the postprocessing quad.
        const start = performance.now();
        a.step(0);
        const {calls,triangles} = a.renderer.info.render;
        return {drawCalls:calls,triangles,frameMs:performance.now()-start};
      });
      console.log(stage,device,view,JSON.stringify(stats));
      if (!phoneOpening && !process.env.LOAD_PROBE_NO_STILLS) {
        await page.screenshot({path:resolve(output,stage+'-'+device+'-'+view+'.png'),timeout:120000});
        console.log(stage,device,view,'captured');
      }
      views[view] = stats;
    }
    result[device] = {bytesUntilReady,readyMs,totalBytes,views,readyDistricts,districts,openingRequests,errors,failed:[...requests.values()].filter(r=>r.status>=400).map(r=>new URL(r.url).pathname)};
    if (phoneOpening && stage === 'after') {
      const camera = () => page.evaluate(() => window.__astra.controls.state());
      const opening = await camera();
      await page.locator('.world-nav summary').click();
      await page.getByRole('button', {name:'The whole world',exact:true}).click();
      const overview = await camera();
      assert(overview.zoom < opening.zoom);
      await page.getByRole('button', {name:'Reset view'}).click();
      assert.deepEqual(await camera(),opening);
      const minZoom = await page.evaluate(() => {
        const button = document.querySelector('#zoom-out');
        for (let i=0;i<24&&!button.disabled;i++) button.click();
        return window.__astra.controls.state().zoom;
      });
      assert(minZoom <= overview.zoom);
      await page.locator('#app canvas').focus();
      await page.keyboard.press('Home');
      assert.deepEqual(await camera(),opening);
      const linked = {x:12,z:-23,zoom:2.5,rotation:0};
      if (device === 'phone') {
        await page.goto(origin+'/?seed=831&capture=1&view=downtown#x=12&y=-23&zoom=2.5',{waitUntil:'domcontentloaded',timeout:120000});
        await page.waitForFunction(() => window.__ready, null, {timeout:120000,polling:25});
        assert.deepEqual(await camera(),linked);
        await page.evaluate(() => {location.hash='#x=88.74&y=18';});
        await page.waitForFunction(() => window.__astra.controls.state().x===88.74, null, {polling:25});
        assert.deepEqual(await camera(),{x:88.74,z:18,zoom:opening.zoom,rotation:0});
      }
      result[device].navigation = {opening,overview,minZoom,homeButton:true,homeKey:true,...(device==='phone'?{initialHash:true,coordinatesOnlyHash:true}:{})};
    }
    console.log(device, JSON.stringify(result[device]));
    let history = {};
    try { history = JSON.parse(await readFile(report,'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    history[stage] = result;
    await writeReport(history);
    await context.close();
  }
} finally {
  await browser.close();
  if (server) await new Promise(done => server.close(done));
}
