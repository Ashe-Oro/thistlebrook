import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright-core';
import { festivalFindings, STAGE_BOX, STAGE_TARGET } from '../src/astra/festival-plan.js';

const args = process.argv.slice(2);
const option = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const before = args.includes('--before');
const film = args.includes('--film');
const benchmark = args.includes('--benchmark');
const dir = new URL('../shots/music-festival/', import.meta.url).pathname;
const origin = option('--url', 'http://127.0.0.1:5197/');
const camera = {x:-202,z:-46,zoom:4,rotation:0};
mkdirSync(dir,{recursive:true});
const browser = await chromium.launch({
  executablePath:'/usr/bin/google-chrome',
  args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});

function writeImage(path, data) {
  writeFileSync(path, Buffer.from(data.split(',')[1], 'base64'));
}

try {
  const page=await browser.newPage({viewport:film?{width:960,height:640}:{width:1280,height:900}});
  // The capture drives the scene explicitly and keeps shader timings clear of RAF.
  await page.addInitScript(() => {window.requestAnimationFrame=()=>0;});
  const failures=[];
  page.on('pageerror', error=>failures.push(error.message));
  page.on('requestfailed', request=>{if(request.resourceType()==='media')failures.push(request.url());});
  const media=[];
  page.on('request', request=>{if(request.resourceType()==='media')media.push(request.url());});
  let loadedDay;
  async function load(day,hour) {
    if(day===loadedDay)return;
    const url=new URL(origin);
    url.search=new URLSearchParams({capture:'1',view:'fair',seed:'831',skin:'cel',weather:'clear',day:String(day),hour:String(hour)});
    url.hash='x=-202&y=-46&zoom=4&r=0';
    await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:180000});
    await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:180000,polling:250});
    assert.equal(await page.evaluate(()=>window.__astraError),undefined);
    loadedDay=day;
  }

  if(film){
    await load(5,18);
    const fps=12, frames=48, scratch=mkdtempSync(join(tmpdir(),'merrymead-'));
    try{
      await page.evaluate(()=>{
        const a=__astra;
        a.setHour(18);
        a.controls.view({x:-205,z:-44,zoom:4.45,rotation:0},true);
        a.step(0);
        a.renderer.shadowMap.autoUpdate=false;
      });
      for(let i=0;i<frames;i++){
        const data=await page.evaluate(({i,frames,fps})=>{
          const a=__astra,u=i/(frames-1),s=u*u*(3-2*u);
          a.controls.view({x:-205-s*1.2,z:-44-s*.5,zoom:4.45+s*.49,rotation:0},true);
          a.setHour(18);
          a.step(1/fps);
          return a.renderer.domElement.toDataURL('image/jpeg',.9);
        },{i,frames,fps});
        writeImage(join(scratch,`frame-${String(i).padStart(3,'0')}.jpg`),data);
        if((i+1)%12===0)console.log(`Rendered ${i+1}/${frames} frames`);
      }
      execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',String(fps),'-i',join(scratch,'frame-%03d.jpg'),'-an','-c:v','libx264','-threads','4','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',join(dir,'evening-set.mp4')]);
    }finally{rmSync(scratch,{recursive:true,force:true});}
  }else{
    const cases=benchmark
      ?[['benchmark',5,18]]
      :before
      ?[['before-bandshell',5,17],['before-reference',5,18]]
      :[['after-concert-evening',5,18],['after-concert-night',1,20.75],['after-off-hours',1,15],['after-closed',1,21.5]];
    const results={};
    for(const [name,day,hour] of cases){
      console.log('Loading',name);
      await load(day,hour);
      const urlState=await page.evaluate(()=>__astra.world.expansions.fair.audit().festival);
      const {image,...sample}=await page.evaluate(({camera,hour,before})=>{
        const a=__astra;
        a.controls.view(camera,true);
        // Roll the baseline build through midnight to Saturday.
        if(before&&a.residents.life.day===0){
          a.setHour(23.9999);
          a.step(.1,false);
        }
        a.setHour(hour);
        a.setPaused(true);
        a.step(0);
        const canvas=a.renderer.domElement, times=[];
        const gl=a.renderer.getContext();
        if(hour===18)for(let i=0;i<3;i++){
          gl.finish();
          const start=performance.now();
          a.step(.016);
          gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
          gl.finish();
          times.push(performance.now()-start);
        }
        const {calls:drawCalls,triangles}=a.renderer.info.render;
        if(!before){
          a.setPaused(false);
          for(let n=0;n<80;n++)a.step(.1,false);
          a.setHour(hour);
          a.setPaused(true);
          a.step(0);
        }
        const image=canvas.toDataURL('image/png');
        const fair=a.world.expansions.fair.audit().festival;
        return {image,drawCalls,triangles,
          ...(times.length?{medianFrameMs:times.sort((a,b)=>a-b)[1]}:{}),
          ...(before?{}:{fair,weekday:document.querySelector('.clock small').textContent})};
      },{camera,hour,before});
      if(!before){
        const expected=hour>=18&&hour<21.5;
        assert.equal(sample.fair.active, expected);
        if(name!=='after-off-hours'&&name!=='after-closed')assert.equal(urlState.active,expected);
        if(expected){
          assert.equal(sample.fair.band.length,5);
          assert(sample.fair.audience.filter(p=>p.watching).length>=8);
          assert([...sample.fair.band,...sample.fair.audience].every(p=>p.tPose===false&&p.clip));
          assert(sample.fair.notes>0&&sample.fair.stalls>=2);
          assert.deepEqual(festivalFindings([...sample.fair.band,...sample.fair.audience],{
            stage:STAGE_BOX,target:STAGE_TARGET,onRoad:p=>p[0]<-76.4||p[1]>-37.1,
          }),[]);
          const lights=await page.evaluate(()=>{
            const a=__astra;
            a.setPaused(false);
            for(let i=0;i<6;i++)a.step(.1,false);
            a.setPaused(true);
            return a.world.expansions.fair.audit().festival.lights;
          });
          assert.notDeepEqual(lights,sample.fair.lights);
        }else{
          assert.equal(sample.fair.band.length+sample.fair.audience.length+sample.fair.notes+sample.fair.stalls,0);
          assert(sample.fair.lights.every(value=>value===0));
        }
      }
      if(!benchmark)writeImage(join(dir,name+'.png'),image);
      results[name]=sample;
      console.log(name,sample.drawCalls,sample.medianFrameMs??'');
    }
    if(!before){
      results.clock=await page.evaluate(()=>{
        const a=__astra,button=document.querySelector('.light-toggle'),slider=document.querySelector('#astra-hour');
        button.click();
        slider.value=19*60;
        slider.dispatchEvent(new Event('input',{bubbles:true}));
        a.step(0,false);
        const state=a.world.expansions.fair.audit().festival,dropdown=state.active&&state.notes>0&&state.lights.some(x=>x>0);
        a.setHour(15);
        a.step(0,false);
        button.click();
        return {dropdown,apiOff:!a.world.expansions.fair.audit().festival.active};
      });
      assert.deepEqual(results.clock,{dropdown:true,apiOff:true});
      assert.deepEqual(media,[]);
    }
    writeFileSync(join(dir,benchmark?'benchmark.json':before?'baseline.json':'evidence.json'),JSON.stringify(results,null,2)+'\n');
  }
  assert.deepEqual(failures,[]);
}finally{await browser.close();}
