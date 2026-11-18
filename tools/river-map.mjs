// Top-down plan of the world's water, terrain and roads (review aid, no GLBs).
// Usage: node tools/river-map.mjs out.png [minX minZ maxX maxZ]
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {MAINLAND} from '../src/compiler/landscape.js';
import {riverZ} from '../src/compiler/astra.js';
import {LAKE} from '../src/astra/outskirts-layout.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const town=compileWorld(catalog,831);
const [out='/tmp/river-map.png',...v]=process.argv.slice(2);const [minX,minZ,maxX,maxZ]=v.length?v.map(Number):[-260,-290,400,400];
const S=Math.min(1600/(maxX-minX),1600/(maxZ-minZ)),W=(maxX-minX)*S,H=(maxZ-minZ)*S,X=x=>((x-minX)*S).toFixed(1),Z=z=>((z-minZ)*S).toFixed(1);
const poly=(pts,attrs)=>`<polygon points="${pts.map(p=>X(p[0])+','+Z(p[1])).join(' ')}" ${attrs}/>`;
const line=(pts,attrs)=>`<polyline points="${pts.map(p=>X(p[0])+','+Z(p[1])).join(' ')}" fill="none" ${attrs}/>`;
const rect=(b,attrs)=>`<rect x="${X(b.min[0])}" y="${Z(b.min[1])}" width="${((b.max[0]-b.min[0])*S).toFixed(1)}" height="${((b.max[1]-b.min[1])*S).toFixed(1)}" ${attrs}/>`;
let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#7fb6c0"/>`;
s+=poly(MAINLAND,'fill="#b6c48c" stroke="#d9c799" stroke-width="3"');
for(const r of town.regions)s+=rect({min:[r.bounds.minX,r.bounds.minZ],max:[r.bounds.maxX,r.bounds.maxZ]},'fill="none" stroke="#6a7" stroke-dasharray="4 3"');
for(const h of town.landscape.hills)s+=`<circle cx="${X(h.pos[0])}" cy="${Z(h.pos[1])}" r="${(h.radius*S).toFixed(1)}" fill="${h.mountain?'#8e9d7b':'#9eaf77'}" opacity=".8"/>`;
for(const f of town.outskirts.fields)s+=rect({min:[f.x-f.w/2,f.z-f.d/2],max:[f.x+f.w/2,f.z+f.d/2]},'fill="#d8c27a"');
const water=town.water;
if(water){for(const c of water.reaches)for(const p of c.points)s+=`<circle cx="${X(p[0])}" cy="${Z(p[1])}" r="${(p[3]*S).toFixed(1)}" fill="#4f9fb0"/>`;
 for(const b of water.bridges||[]){const c=Math.sin(b.yaw)*b.length/2,d=Math.cos(b.yaw)*b.length/2;s+=line([[b.pos[0]-c,b.pos[1]-d],[b.pos[0]+c,b.pos[1]+d]],`stroke="#8b5a2b" stroke-width="${(b.width*S).toFixed(1)}"`);}}
else{const pts=[];for(let x=town.riverBounds.minX;x<=town.riverBounds.maxX;x+=1)pts.push([x,riverZ(x)]);s+=line(pts,`stroke="#4f9fb0" stroke-width="${(5.3*S).toFixed(1)}"`);for(const x of town.bridges)s+=line([[x,riverZ(x)-3.7],[x,riverZ(x)+3.7]],`stroke="#8b5a2b" stroke-width="${(3.3*S).toFixed(1)}"`);}
s+=`<ellipse cx="${X(LAKE.x)}" cy="${Z(LAKE.z)}" rx="${(LAKE.rx*S).toFixed(1)}" ry="${(LAKE.rz*S).toFixed(1)}" fill="#4f9fb0"/>`;
for(const r of town.roads){if(r.centerline)s+=line(r.centerline,`stroke="#5c6a62" stroke-width="${(5.6*S).toFixed(1)}" opacity=".9"`);else s+=line([r.a,r.b],`stroke="${r.kind==='trail'||r.kind==='walk'||r.kind==='boardwalk'?'#c9a66b':'#5c6a62'}" stroke-width="${Math.max(1,r.width*S).toFixed(1)}" opacity=".9"`);}
for(const b of town.buildings)s+=rect(b.box,'fill="#b9574a"');
for(const v of town.venues)if(v.box)s+=rect(v.box,'fill="none" stroke="#a33" stroke-width="1"');
for(const t of town.trees)s+=`<circle cx="${X(t.pos[0])}" cy="${Z(t.pos[1])}" r="${Math.max(1,S*.8)}" fill="#3d6b3a"/>`;
for(const t of town.outskirts.trees)s+=`<circle cx="${X(t.pos[0])}" cy="${Z(t.pos[1])}" r="${Math.max(1,S*.8)}" fill="#2d5b2a"/>`;
for(const m of town.landscape.models)s+=`<circle cx="${X(m.pos[0])}" cy="${Z(m.pos[1])}" r="${Math.max(1,S*.6)}" fill="${m.asset.includes('pine')?'#1d4b1a':m.asset.includes('tree')?'#4c8a3a':m.asset.includes('rock')?'#777':'#c9d27a'}"/>`;
for(const m of town.modelPlacements||[])s+=`<circle cx="${X(m.pos[0])}" cy="${Z(m.pos[1])}" r="${Math.max(1,S*.5)}" fill="#e0a" opacity=".6"/>`;
for(const tr of town.woods?.trails||[])s+=line(tr.points.map(p=>[p[0],p[2]]),`stroke="#a0703a" stroke-width="${Math.max(1,tr.width*S).toFixed(1)}"`);
for(const sc of town.catalogScenes||[])for(const m of sc.members)s+=rect(m.box,'fill="#e0a" opacity=".5"');
for(const p of town.props)if(p.pos)s+=`<circle cx="${X(p.pos[0])}" cy="${Z(p.pos[1])}" r="1.2" fill="#e0a"/>`;
// grid
for(let x=Math.ceil(minX/20)*20;x<=maxX;x+=20)s+=`<line x1="${X(x)}" y1="0" x2="${X(x)}" y2="${H}" stroke="#000" stroke-opacity=".08"/><text x="${X(x)}" y="12" font-size="10">${x}</text>`;
for(let z=Math.ceil(minZ/20)*20;z<=maxZ;z+=20)s+=`<line x1="0" y1="${Z(z)}" x2="${W}" y2="${Z(z)}" stroke="#000" stroke-opacity=".08"/><text x="2" y="${Z(z)}" font-size="10">${z}</text>`;
s+='</svg>';writeFileSync(out.replace(/\.png$/,'.svg'),s);
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:Math.ceil(W),height:Math.ceil(H)}});await page.setContent(s);await page.screenshot({path:out});await browser.close();console.log(out);
