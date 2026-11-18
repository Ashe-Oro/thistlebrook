// Top-down plan of the railway loop against roads, water, parcels and the
// reserved neighbour lanes (review aid, no GLBs).
// Usage: node tools/railway-map.mjs out.png [minX minZ maxX maxZ]
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {MAINLAND} from '../src/compiler/landscape.js';
let RESERVED=[];try{RESERVED=(await import('../src/compiler/railway.js')).RAIL_RESERVED;}catch{}
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const town=compileWorld(catalog,831);
const [out='/tmp/railway-map.png',...v]=process.argv.slice(2);const [minX,minZ,maxX,maxZ]=v.length?v.map(Number):[-260,-290,400,400];
const S=Math.min(1800/(maxX-minX),1800/(maxZ-minZ)),W=(maxX-minX)*S,H=(maxZ-minZ)*S,X=x=>((x-minX)*S).toFixed(1),Z=z=>((z-minZ)*S).toFixed(1);
const poly=(pts,attrs)=>`<polygon points="${pts.map(p=>X(p[0])+','+Z(p[1])).join(' ')}" ${attrs}/>`;
const line=(pts,attrs)=>`<polyline points="${pts.map(p=>X(p[0])+','+Z(p[1])).join(' ')}" fill="none" ${attrs}/>`;
const rect=(b,attrs)=>`<rect x="${X(b.min[0])}" y="${Z(b.min[1])}" width="${((b.max[0]-b.min[0])*S).toFixed(1)}" height="${((b.max[1]-b.min[1])*S).toFixed(1)}" ${attrs}/>`;
const text=(p,t,size=9,fill='#222')=>`<text x="${X(p[0])}" y="${Z(p[1])}" font-size="${size}" fill="${fill}" font-family="sans-serif">${t}</text>`;
let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#7fb6c0"/>`;
s+=poly(MAINLAND,'fill="#b6c48c"');
for(const r of town.regions)s+=rect({min:[r.bounds.minX,r.bounds.minZ],max:[r.bounds.maxX,r.bounds.maxZ]},'fill="none" stroke="#264" stroke-dasharray="4 3"')+text([r.bounds.minX+1,r.bounds.minZ+4],r.id,9,'#264');
for(const h of town.landscape?.hills||[])s+=`<circle cx="${X(h.pos[0])}" cy="${Z(h.pos[1])}" r="${(h.radius*S).toFixed(1)}" fill="${h.mountain?'#8e9d7b':'#9eaf77'}" opacity=".8"/>`;
for(const t of town.trees||[])s+=`<circle cx="${X(t.pos[0])}" cy="${Z(t.pos[1])}" r="${Math.max(1,S*.7)}" fill="#3d6b3a"/>`;
for(const r of RESERVED)s+=poly(r.area,'fill="#f0a" fill-opacity=".12" stroke="#f0a" stroke-dasharray="6 3"')+text(r.area[0],r.id,10,'#a06');
for(const reach of town.water.reaches)s+=line(reach.points,`stroke="#3f8fa0" stroke-width="${(2*Math.max(...reach.points.map(p=>p[3]))*S).toFixed(1)}" stroke-linejoin="round"`);
for(const p of town.water.pools||[])if(p.pos)s+=`<circle cx="${X(p.pos[0])}" cy="${Z(p.pos[1])}" r="${((p.radius||3)*S).toFixed(1)}" fill="#3f8fa0"/>`;
for(const r of town.roads){const pts=r.centerline||[r.a,r.b];const walk=['trail','walk','boardwalk','visitor-walk','door','venue','pedestrian'].includes(r.kind);s+=line(pts,`stroke="${walk?'#c9a66b':r.kind==='rail'?'#000':'#5c6a62'}" stroke-width="${Math.max(walk?.6:1,(r.width||1)*S).toFixed(1)}" opacity=".9"`);}
for(const b of town.water.bridges||[])if(b.pos)s+=`<circle cx="${X(b.pos[0])}" cy="${Z(b.pos[1])}" r="2" fill="#8b5a2b"/>`;
for(const b of town.buildings)s+=rect(b.box,'fill="#b9574a"');
for(const v of town.venues)if(v.box)s+=rect(v.box,'fill="none" stroke="#a33" stroke-width="1"');
for(const d of town.districts)s+=text(d.center,d.name,11,'#000');
const rail=town.railway;
if(rail){const vis=[],tun=[];let run=null;for(const q of rail.samples){const t=q.tunnel?tun:vis;if(!run||run.t!==t){run={t,pts:[]};t.push(run.pts);}run.pts.push(q.p);}
 for(const pts of vis)s+=line(pts,`stroke="#222" stroke-width="${(2.4*S).toFixed(1)}"`);for(const pts of tun)s+=line(pts,`stroke="#555" stroke-width="2" stroke-dasharray="6 4"`);
 for(const st of rail.stations)s+=poly(st.polygon,'fill="#fd4" stroke="#000"')+text(st.polygon[0],st.name,11,'#600');
 for(const c of rail.crossings)s+=`<circle cx="${X(c.pos[0])}" cy="${Z(c.pos[1])}" r="5" fill="none" stroke="#f00" stroke-width="2"/>`;
 if(rail.yard)s+=line(rail.yard.track,`stroke="#555" stroke-width="${(2*S).toFixed(1)}"`);}
else if(town.workRail)s+=line([[town.workRail.minX,town.workRail.z],[town.workRail.maxX,town.workRail.z]],'stroke="#000" stroke-width="3"');
for(let x=Math.ceil(minX/20)*20;x<=maxX;x+=20)s+=`<line x1="${X(x)}" y1="0" x2="${X(x)}" y2="${H}" stroke="#000" stroke-opacity=".1"/>`+text([x,minZ+6],x,10);
for(let z=Math.ceil(minZ/20)*20;z<=maxZ;z+=20)s+=`<line x1="0" y1="${Z(z)}" x2="${W}" y2="${Z(z)}" stroke="#000" stroke-opacity=".1"/>`+text([minX+1,z],z,10);
s+='</svg>';writeFileSync(out.replace(/\.png$/,'.svg'),s);
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:Math.ceil(W),height:Math.ceil(H)}});await page.setContent(s);await page.screenshot({path:out});await browser.close();console.log(out);
