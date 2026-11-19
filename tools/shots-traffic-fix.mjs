// Usage: node tools/shots-traffic-fix.mjs http://localhost:5297 [before|after|scale]
// Run against the corresponding source tree. Capture with the town's real renderer.
import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';

const [url,mode='after']=process.argv.slice(2);
if(!url)throw Error('Pass the local Vite URL');
const out=new URL('../shots/traffic-fix/',import.meta.url).pathname;
const temp=mkdtempSync(join(tmpdir(),'cel-traffic-frames-'));
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});

try {
  const page=await browser.newPage({viewport:{width:1152,height:648}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const assetRequest=url=>/\.glb(?:\?|$)|\/draco\//.test(url);
  page.on('response',r=>{if(r.status()>=400&&assetRequest(r.url()))errors.push(r.url()+' '+r.status());});
  page.on('requestfailed',request=>{if(assetRequest(request.url()))errors.push(request.url()+' '+request.failure()?.errorText);});
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  await page.goto(url+'/?capture=1&seed=831&weather=clear', {timeout:90000});
  await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:300});
  const startupError=await page.evaluate(()=>window.__astraError);
  if(startupError)throw Error([startupError,...errors].join('\n'));
  await page.evaluate(()=>{
    __astra.renderer.shadowMap.enabled=false;
    __astra.setHour(10.4);
    __astra.step(0,false);
  });
  const view=async(x,z,zoom,rotation=0)=>page.evaluate(({x,z,zoom,rotation})=>{
    __astra.controls.view({x,z,zoom,rotation},true);
    __astra.step(0,false);
  },{x,z,zoom,rotation});
  const frame=async()=>Buffer.from(await page.evaluate(()=>{
    const app=__astra;
    app.renderer.render(app.scene,app.camera);
    return app.renderer.domElement.toDataURL('image/png').split(',')[1];
  }),'base64');

  async function captureLineup() {
    const lineup=await page.evaluate(async()=>{
      const {renderFleetLineup}=await import('/tools/render-traffic-scale.js');
      return renderFleetLineup(__astra);
    });
    const {width,height,labels}=lineup;
    const text=(x,y,content,attrs)=>`<text x="${x}" y="${y}" ${attrs}>${content.replaceAll('&','&amp;')}</text>`;
    const marks=labels.map(({x,name,detail})=>
      text(x,294,name,'font-size="16" font-weight="600"')+text(x,318,detail,'font-size="14" fill="#526664"')).join('');
    const title=text(width/2,43,'Thistlebrook vehicle fleet','font-size="25" font-weight="700"');
    const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g font-family="sans-serif" fill="#294340" text-anchor="middle">${title}${marks}</g></svg>`);
    const lineupFile=join(out,'fleet-lineup.png');
    await sharp(Buffer.from(lineup.image,'base64')).composite([{input:svg}]).png().toFile(lineupFile);
    return lineupFile;
  }

  if(mode==='scale'){
    await captureLineup();
    const starbase=await page.evaluate(async()=>{
      const {renderStarbaseTransporter}=await import('/tools/render-traffic-scale.js');
      return renderStarbaseTransporter(__astra);
    });
    writeFileSync(join(out,'starbase-transporter.png'),Buffer.from(starbase,'base64'));
  } else {
    await view(67,33,7,1);
    const end=await page.evaluate(mode=>{
      const app=__astra, landscape=app.world.landscape;
      let time=0;
      window.trafficEndStep=dt=>{
        time+=dt;
        landscape.update(time,10.4,[]);
      };
      for(let n=0;n<2400;n++){
        window.trafficEndStep(.2);
        const near=landscape.traffic.vehicles.filter(v=>v.line.id===2&&Math.hypot(v.position[0]-66,v.position[1]-34)<18);
        if(mode==='before'? time>85&&near.length>=3&&near.every(v=>v.speed<.03)
          : near.some(v=>v.turning>.3&&v.turning<1.5))return {time,cars:near.map(v=>({id:v.id,status:v.status}))};
      }
      throw Error('Could not find the road-end pose');
    },mode);
    writeFileSync(join(out,`road-end-${mode}.png`),await frame());
    console.log('Road end',end);
    if(mode!=='before') {
      const clips=[];
      const addClip=async(name,count,advance)=>{
        const paths=[];
        for(let i=0;i<count;i++){
          if(i)await advance();
          const path=join(temp,name+'-'+String(i).padStart(3,'0')+'.png');
          writeFileSync(path,await frame());paths.push(path);
        }
        clips.push([name,paths]);
        return paths;
      };
      await addClip('turn',36,()=>page.evaluate(()=>window.trafficEndStep(.25)));

      await page.reload({timeout:90000});
      await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:300});
      const intersection=await page.evaluate(async()=>{
        if(window.__astraError)throw Error(window.__astraError);
        const app=__astra;
        const {sampleLane}=await import('/src/astra/traffic-simulation.js');
        const {footprint,footprintsOverlap}=await import('/src/roads/collisions.js');
        app.renderer.shadowMap.enabled=false;app.setHour(10.5);
        const fleet=app.traffic.simulation.vehicles;
        const bus=fleet.find(v=>v.kind==='bus'&&v.route==='station'),fire=fleet.find(v=>v.id==='civic-engine'),delivery=fleet.find(v=>v.id==='civic-delivery');
        const stage=(v,origin,heading)=>{
          let nearest=Infinity;
          for(let s=0;s<v.path.length;s+=.025){
            const pose=sampleLane(v.path,s),d=Math.hypot(pose.position[0]-origin[0],pose.position[1]-origin[1]);
            if(d>=nearest||heading[0]*pose.direction[0]+heading[1]*pose.direction[1]<.9)continue;
            nearest=d;Object.assign(v,pose,{distance:s,speed:0,wait:0,stoppedAt:null,lastStop:null,status:'Cruising'});
          }
        };
        stage(bus,[-95,-76.3],[1,0]);
        stage(fire,[-88.7,-82],[0,1]);
        stage(delivery,[-79.3,-69],[0,-1]);
        window.intersectionStep=dt=>{
          app.traffic.update(dt,10.5);
          for(let i=0;i<fleet.length;i++)for(let j=i+1;j<fleet.length;j++){
            if(footprintsOverlap(footprint(fleet[i]),footprint(fleet[j])))throw Error('Vehicle overlap in intersection clip');
          }
          return [bus,fire,delivery].map(v=>({id:v.id,position:v.position,status:v.status}));
        };
        return intersectionStep(.04);
      });
      console.log('Intersection start',intersection);
      await view(-84,-76,6,1);
      const strip=await addClip('junction',54,()=>page.evaluate(()=>window.intersectionStep(.24)));
      const stills=[13,26,42].map(i=>strip[i]);
      const panels=await Promise.all(stills.map(path=>sharp(path).resize(576).png().toBuffer()));
      await sharp({create:{width:1728,height:324,channels:3,background:'#ede9d9'}})
        .composite(panels.map((input,i)=>({input,left:i*576,top:0}))).png().toFile(join(out,'intersection-yield-strip.png'));
      writeFileSync(join(out,'intersection-yield.png'),await sharp(stills[1]).png().toBuffer());

      const lineupFile=await captureLineup();
      // Six seconds of turn and nine of junction footage at 6 fps, plus paced
      // comparison and lineup stills. Output is a standard 24 fps H.264 file.
      const entries=[];
      const clip=(name,args)=>{
        const path=join(temp,name+'.mp4');
        execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-threads','2',...args,
          '-an','-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-r','24',path]);
        entries.push("file '"+path+"'");
      };
      clip('before',['-loop','1','-i',join(out,'road-end-before.png'),'-t','5']);
      for(const [name] of clips)clip(name,['-framerate','6','-i',join(temp,name+'-%03d.png')]);
      clip('fleet',['-loop','1','-i',lineupFile,'-vf','scale=1152:-2,pad=1152:648:0:(oh-ih)/2:color=0xe8e3d0','-t','12']);
      const list=join(temp,'clips.txt');writeFileSync(list,entries.join('\n'));
      execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',list,
        '-c','copy','-movflags','faststart',join(out,'traffic-fix.mp4')]);
    }
  }
  if(errors.length)throw Error(errors.join('\n'));
} finally {
  await browser.close();
  rmSync(temp,{recursive:true,force:true});
}
