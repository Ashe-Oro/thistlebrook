// OWNER: grok-style lane. Bytes on the wire until window.__ready (CDP encodedDataLength).
// usage: node tools/grok-style-bytes.mjs <url>
import {chromium} from 'playwright-core';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1280,height:800}});const cdp=await p.context().newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
let total=0,n=0;const by={},urls={};cdp.on('Network.responseReceived',e=>urls[e.requestId]=e.response.url);
cdp.on('Network.loadingFinished',e=>{total+=e.encodedDataLength;n++;const u=(urls[e.requestId]||'').split('?')[0];const k=u.includes('/src/')||u.includes('/node_modules/')||u.includes('/@')?'js':(u.match(/\.(\w+)$/)||[,'other'])[1];by[k]=(by[k]||0)+e.encodedDataLength;});
await p.goto(process.argv[2]);await p.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:400000,polling:500});await p.waitForTimeout(3000);
console.log(JSON.stringify({url:process.argv[2],requests:n,bytes:total,MB:+(total/1e6).toFixed(2),byTypeMB:Object.fromEntries(Object.entries(by).map(([k,v])=>[k,+(v/1e6).toFixed(2)]))}));await b.close();
