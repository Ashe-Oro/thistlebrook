import * as THREE from 'three';
import { RESOLVED, place } from '../catalog/loader.js';
import { toonMaterial } from '../toon.js';
import { districtKit, districtCrowd } from './downtown-kit.js';
import { ERRAND_WALKERS, errandPose } from './downtown-errands.js';

const SHOPS = {
  'Sunrise Bakehouse': {title:'SUNRISE • BAKERY',color:'#b56a40',icon:'bread'},
  'Sole & Stitch': {title:'SOLE & STITCH',color:'#356f80',icon:'boot'},
  'The Reading Room': {title:'THE READING ROOM',color:'#7b526c',icon:'book'},
  'Corner Cup Café': {title:'CORNER CUP • CAFÉ',color:'#356c62',icon:'cup'},
  'Petal & Stem': {title:'PETAL & STEM',color:'#a55574',icon:'flower'},
  'The Post Office': {title:'ASTRA POST',color:'#3e6c94',icon:'mail'},
  'Thistlebrook Town Hall': {title:'TOWN HALL',color:'#6c7967',icon:'civic'},
};
const roles=['merchant','herbalist','shopkeeper','carpenter','farmhand','elder'];

/** Additive district layer: no changes to parcels, graph, camera, or residents. */
export async function buildDowntown(scene,town) {
  const kit=districtKit(scene),{root,box,orb,drum,ring,wire,sign,pool}=kit;
  const people=[],errands=[],jobs=[],flags=[],steam=[],rooftops=[],landmarkRecords=[];
  const addPerson=(role,period,motion,scale=.9)=>{const person={role,period,motion,scale};people.push(person);return person;};
  const still=(x,y,z,yaw=0,phase=0)=>t=>({x,y:y+Math.sin(t*1.8+phase)*.025,z,yaw:yaw+Math.sin(t*.4+phase)*.1});
  const asset=(id,x,z,scale=1,rotY=0,parent=root)=>jobs.push(place(id,{x,z,scale,rotY}).then(o=>parent.add(o)));
  const group=(x,y,z,rot=0,parent=root)=>{const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);return g;};

  const landmark=(b,g)=>{
    g.updateWorldMatrix(true,true);
    landmarkRecords.push({type:'building',data:b,bounds:new THREE.Box3().setFromObject(g)});
  };

  // Large sculpted trade signs, readable from the isometric town camera.
  // They follow the measured roof height, not a guessed height shared by kits.
  function emblem(kind,g,color) {
    if(kind==='bread') {
      const loaf=orb(0,.65,0,1,'#dc9e4e',g);loaf.scale.set(1.7,.75,.85);
      for(let n=-1;n<=1;n++){const cut=box(n*.65,1.27,0,.15,.07,1,'#fce0a1',g);cut.rotation.y=-.32;}
      drum(0,.05,0,1.9,.12,'#f0d6a0',g);
    } else if(kind==='boot') {
      box(0,.12,0,2.9,.24,1.05,'#e9d9b5',g);
      box(.25,.45,0,2.4,.5,.92,'#905f43',g);box(-.65,1,0,.95,1.25,.95,'#b37c4e',g);
      for(let n=0;n<4;n++)box(-.3,.7+n*.2,.49,.55,.07,.06,'#f5d6a1',g);
      box(-.65,1.65,0,1.04,.18,1.04,color,g);
    } else if(kind==='book') {
      for(const side of [-1,1]) {
        const half=group(side*.65,.35,0,0,g);half.rotation.z=side*.14;
        box(0,0,0,1.3,.15,1.9,color,half);box(0,.15,0,1.17,.2,1.75,'#fff0ca',half);
        for(let n=0;n<5;n++)box(0,.26,-.55+n*.28,.86,.02,.035,'#baa47e',half);
      }
      box(0,.2,0,.12,.4,1.95,'#dbb26d',g);
    } else if(kind==='cup') {
      drum(0,.15,0,1.4,.13,'#e4d3aa',g);drum(0,.82,0,.88,1.15,'#fff0ca',g);
      drum(0,1.41,0,.74,.025,'#795540',g);ring(1,.89,0,.45,.13,'#fff0ca',g);
      for(let n=0;n<3;n++){const puff=orb(0,0,0,.18,'#f0ead8',scene);puff.material=puff.material.clone();puff.material.transparent=true;puff.material.depthWrite=false;steam.push({m:puff,g,n});}
    } else if(kind==='flower') {
      drum(0,.35,0,.46,.7,'#d9a378',g);
      for(let n=0;n<5;n++) {
        const a=n/5*Math.PI*2,x=Math.sin(a)*.78,z=Math.cos(a)*.6;
        box(x/2,.9,z/2,.09,1.3,.09,'#54865a',g);
        for(let k=0;k<5;k++){const b=k/5*Math.PI*2;orb(x+Math.cos(b)*.3,1.65,z+Math.sin(b)*.3,.28,n%2?'#e896a8':'#f0bd71',g);}
        orb(x,1.78,z,.22,'#ffe1a0',g);
      }
    } else if(kind==='mail') {
      box(0,.7,0,2.6,1.5,.28,'#f7e5bb',g);
      wire([[-1.25,1.4,.16],[0,.6,.16],[1.25,1.4,.16]],color,g);
      wire([[-1.25,0,.16],[-.35,.65,.16]],color,g);wire([[1.25,0,.16],[.35,.65,.16]],color,g);
      box(.9,1.15,.18,.34,.34,.04,'#bb725c',g);
    } else {
      box(0,.1,0,2.7,.2,1.6,'#e8d8af',g);
      for(const x of [-.95,0,.95])drum(x,.7,0,.15,1.2,'#fff0cb',g);
      box(0,1.4,0,2.8,.25,1.7,'#e8d8af',g);
      const pediment=new THREE.Mesh(new THREE.ConeGeometry(1.6,.8,4),toonMaterial(color));
      pediment.position.y=1.9;pediment.rotation.y=Math.PI/4;pediment.scale.z=.58;g.add(pediment);
    }
  }

  for(const b of town.buildings.filter(b=>SHOPS[b.name])) {
    const data=SHOPS[b.name],height=RESOLVED.get(b.id).bounds.max[1];
    const roof=group(b.pos[0],height+.12,b.pos[1],Math.PI/4);
    box(0,.05,0,3.6,.18,2.6,data.color,roof);emblem(data.icon,group(0,.15,0,0,roof),data.color);
    sign(data.title,0,.15,1.85,6,.86,data.color,roof,-.55);
    rooftops.push({name:b.name,icon:data.icon,height});landmark(b,roof);
    const front=group(b.pos[0],0,b.pos[1],b.rot),f=RESOLVED.get(b.id).door?.pos?.[2]||3;
    // Leave the centre of every shop entrance open for the navigation graph.
    for(const side of [-1,1]) {
      box(side*2.4,1.6,f+.1,.12,2.8,.12,'#b59063',front);
      orb(side*2.4,2.9,f+.1,.2,'#ffe0a0',front,true);
    }
    const local=(x,z)=>({x:b.pos[0]+x*Math.cos(b.rot)+z*Math.sin(b.rot),z:b.pos[1]-x*Math.sin(b.rot)+z*Math.cos(b.rot)});
    if(data.icon==='book') {
      for(const x of [-1.9,1.9]) {
        box(x,.65,f+.45,1.15,1.3,.45,'#816349',front);
        for(let row=0;row<2;row++)for(let k=0;k<5;k++)box(x-.42+k*.21,.34+row*.58,f+.72,.14,.43,.25,['#ad685e','#68938a','#d1b46e'][k%3],front);
      }
    }
    if(data.icon==='flower') {
      for(let n=0;n<5;n++) {
        const x=-2.1+n*.35;drum(x,.45,f+.5,.24,.55,'#ae7b59',front);
        for(let k=0;k<3;k++)orb(x+Math.sin(k*2)*.17,1+k*.12,f+.5+Math.cos(k*2)*.17,.2,['#e6a0b6','#ecc076','#e8d9bc'][n%3],front);
      }
    }
    if(data.icon==='mail') {
      sign('LETTERS & PARCELS',-1.65,1.65,f+.55,1.9,.55,data.color,front);
      for(let n=0;n<3;n++){box(-1.8+n*.35,.25,f+.6,.32,.45,.4,'#bfa476',front);box(-1.8+n*.35,.49,f+.6,.07,.025,.4,'#efdfb9',front);}
    }
    if(data.icon==='civic') {
      for(const side of [-1,1]) {
        box(side*3,2.2,f,.09,4.4,.09,'#a38b63',front);
        box(side*3+.5,3.65,f,.95,1.1,.08,'#54877c',front);
        sign('A',side*3+.5,3.65,f+.06,.65,.7,'#54877c',front);
      }
      const p=local(-2.1,f+1);asset('cv-notice-board',p.x,p.z,.7,b.rot);
    }
    if(data.icon==='cup') {
      for(const x of [-1.9]) {
        drum(x,.8,f+.75,.65,.13,'#dfc394',front);drum(x,.4,f+.75,.1,.8,'#7c7057',front);
        drum(x,.95,f+.75,.12,.18,'#fff0cd',front);
        const p=local(x,f+1.5);addPerson(x<0?'elder':'merchant','day',still(p.x,.2,p.z,b.rot+Math.PI,x),.88);
      }
    }
    if(data.icon!=='cup'){
      const p=local(1.5,f+1.05);addPerson(roles[rooftops.length%roles.length],'day',still(p.x,.2,p.z,b.rot+Math.PI,rooftops.length));
    }
    pool(b.door[0],b.door[1],2.3,'#ffd19b');
  }
  // Errands happen on the existing sidewalks. A loop pauses at each shop.
  let weather='clear',weatherTime=0,lastTime=0;
  for(let n=0;n<ERRAND_WALKERS;n++)errands.push(addPerson(roles[n%roles.length],'day',()=>errandPose(n,weatherTime,weather==='rain')));

  // Lantern Quay is one continuous pedestrian bar street, with lit entries,
  // terrace rooms and venue-specific rooftop silhouettes.
  for(const [z,title,sub,color] of [[-23,'THE NIGHTJAR','TAPROOM • OPEN LATE','#365d62'],[-7,'LANTERN ROOM','COCKTAILS & RECORDS','#8d526f'],[4,'MOONRISE','GELATO • AFTER DARK','#8877a1']]) {
    const b=town.buildings.find(b=>b.district==='quay'&&Math.abs(b.pos[1]-z)<1),h=RESOLVED.get(b.id).bounds.max[1];
    const g=group(b.pos[0],h+.2,b.pos[1],Math.PI/4);
    sign(title,0,.8,0,7,1.2,color,g,-.25);sign(sub,0,-.2,.5,6,.65,color,g,-.45);
    for(const x of [-3.7,3.7])box(x,.6,0,.13,1.8,.13,'#ffcf8b',g,true);
    if(z===-23) {
      drum(0,2.5,0,.67,1.3,'#e5ae53',g);drum(0,3.2,0,.72,.25,'#fff0cf',g);ring(.8,2.55,0,.44,.12,'#e7c083',g);
    } else if(z===-7) {
      const disc=drum(0,2.5,0,1.15,.18,'#344e54',g);disc.rotation.x=Math.PI/2;
      const center=drum(0,2.5,.12,.4,.06,'#eab391',g);center.rotation.x=Math.PI/2;
    } else {
      const cone=new THREE.Mesh(new THREE.ConeGeometry(.65,1.6,12),toonMaterial('#c89661'));cone.rotation.z=Math.PI;cone.position.y=2.2;g.add(cone);
      orb(0,3.2,0,.78,'#e9a8b6',g);orb(.38,3.55,0,.5,'#b9c999',g);
    }
    landmark(b,g);pool(55,z+5,5,color);
  }
  // The market-hall kit becomes an open cocktail bar on its east side.
  // Furnish within its parcel, keeping the central door approach open.
  const lantern=town.buildings.find(b=>b.name==='The Lantern Room');
  const bar=group(lantern.pos[0],0,lantern.pos[1]);
  box(2.2,.85,0,.85,1.3,3.4,'#567b73',bar);
  box(2.2,1.55,0,1.15,.18,3.6,'#d0ab78',bar);
  box(1.9,1.7,-1.9,2.2,2.3,.2,'#3d5e5c',bar);
  for(const y of [1.1,1.9,2.65]) {
    box(1.9,y,-1.7,2.2,.1,.55,'#b99b71',bar);
    for(let n=0;n<6;n++) {
      drum(1+n*.35,y+.22,-1.7,.08,.3,n%2?'#d3a266':'#71957c',bar);
      drum(1+n*.35,y+.43,-1.7,.035,.14,'#ede0b1',bar);
    }
  }
  for(const z of [-.8,.7]){drum(3.1,.75,z,.27,.12,'#a87e61',bar);drum(3.1,.37,z,.07,.7,'#5e6c5e',bar);}
  sign('ON THE ROCKS',1.9,3,-1.56,2.6,.5,'#8d526f',bar);
  addPerson('innkeeper','night',still(lantern.pos[0]+1.3,.18,lantern.pos[1],Math.PI/2,4),.85);
  pool(lantern.pos[0]+2,lantern.pos[1],2.5,'#e9b6c9');
  // Small gateways sit over the existing lane; their posts leave its full width.
  for(const [z,title] of [[-29,'LANTERN QUAY'],[10,'ONE MORE SONG']]) {
    for(const x of [44.1,48])box(x,2.75,z,.16,5.5,.16,'#846e59');
    sign(title,46,5.2,z,6.7,.95,'#345d63',root,-.18);
    box(46,4.55,z,4.3,.12,.12,'#c69d6a');
  }
  for(let n=0;n<9;n++) {
    const z=-27+n*4.1;
    box(48,2.35,z,.1,4.7,.1,'#7c715c');box(48.4,4.55,z,.85,.1,.1,'#7c715c');
    box(48.75,4.1,z,.45,.65,.45,n%2?'#ffc27c':'#f6a89f',root,true);
    for(const y of [3.75,4.45])box(48.75,y,z,.6,.09,.6,'#73594b');
    pool(48,z,2.7,'#ffd495');
    if(n<8)wire(Array.from({length:17},(_,k)=>[48,4.65-Math.sin(k/16*Math.PI)*.4,z+k/16*4.1]));
  }
  for(const z of [-16,-.7,9]) {
    wire(Array.from({length:25},(_,n)=>[48+n/24*14,5.8-Math.sin(n/24*Math.PI)*.9,z]));
    for(let n=0;n<14;n++)orb(48.5+n,5.75-Math.sin((n+.5)/14*Math.PI)*.9,z,.13,n%3?'#ffe4a0':'#eea8ad',root,true);
  }
  for(const z of [-17,-12.5,-3,2])for(const x of [49.5,60.5]) {
    box(x,.12,z,2.7,.08,3.5,'#b69b76');
    // Bottles, tiny menus and planters turn isolated tables into terraces.
    drum(x+.25,1.1,z,.07,.32,'#527e68');drum(x-.25,1.05,z,.12,.21,'#e8b776');
    box(x,1.22,z-.15,.27,.4,.04,'#ebd8b2');
    for(const dz of [-1.65,1.65]){box(x,.4,z+dz,2.4,.55,.28,'#8b745b');for(let n=0;n<5;n++)orb(x-1+n*.5,.82,z+dz,.3,'#7d9b74');}
  }
  for(let n=0;n<20;n++) {
    const x=n%2?60.5:49.5,z=[-17,-12.5,-3,2][Math.floor(n/2)%4],side=n<8?-1:1;
    // Existing six terrace visitors occupy the first left seats.
    const px=x+(n>=16?(n%2?-.95:.95):0),pz=z+side*(n>=16?.1:1.06);
    addPerson(roles[n%6],'night',still(px,.2,pz,side>0?Math.PI:0,n),.83);
  }
  // A queue for the bar and strolling couples keep the lane busy after five.
  for(let n=0;n<5;n++)addPerson(roles[n%6],'night',still(53.4-n*.72,.2,-18.5+n*.1,Math.PI,n),.9);
  for(let n=0;n<14;n++)addPerson(roles[n%6],'night',t=>{
    const u=(t*.012+n/7)%2,v=u<1?u:2-u;
    return {x:45.4+(n%2)*.85,y:.2+Math.abs(Math.sin(t*6+n))*.045,z:-26+v*36,yaw:u<1?0:Math.PI};
  });
  for(let n=0;n<8;n++)addPerson(roles[n%6],'night',still(50+n%4*2.8,.2,31.5+Math.floor(n/4)*.6,Math.PI,n),.9);

  // Friday at the Owls: full bleachers, team colours, a ticket concourse,
  // concession counters and four illuminated towers. Keep the playing field clear.
  for(const side of [-1,1]) {
    for(let row=0;row<4;row++) {
      const z=-84+side*(11.7+row*.5),y=.45+row*.38;
      for(const x of [10.5,49.5])box(x,y,z,9,.18,.47,'#b6ae99');
      for(let seat=0;seat<28;seat++) {
        const x=9.5+seat*1.52;
        // Respect the twelve original spectators on the north stand.
        if(side===-1&&row>=2&&[18,22,26,30,34,38].some(old=>Math.abs(x-old)<.7))continue;
        const phase=seat*.35+row*.8;
        addPerson(roles[(seat+row)%6],'game',t=>({x,y:y+.1+Math.max(0,Math.sin(t*2.2-phase))*.15,z,yaw:side<0?0:Math.PI,lean:Math.sin(t*2.2-phase)*.045}),.76);

      }
    }
    box(30,2.4,-84+side*13.7,43,.13,.12,'#687c70');
    for(const x of [8.5,20,40,51.5])box(x,1.25,-84+side*13.7,.1,2.5,.1,'#687c70');
    sign(side<0?'HOME OF THE OWLS':'FRIDAY NIGHT • GO ASTRA',30,1.4,-84+side*13.78,22,1,'#366b62',root,side<0?-.2:.15);
  }
  // Entrance stays open at x=30. Ticket and snack queues are to either side.
  for(const x of [27,33])box(x,2.4,-69.8,.2,4.8,.2,'#a28a65');
  sign('FRIDAY NIGHT LIGHTS',30,4.5,-69.8,10.5,1.15,'#316b63',root,-.2);
  for(let n=0;n<14;n++)orb(25.2+n*.74,5.2,-69.8,.11,'#ffe19b',root,true);
  for(const [x,title,color] of [[4.6,'HOT DOGS','#b66b4e'],[55.4,'POPCORN','#c18b4e']]) {
    box(x,.7,-70.8,4.3,1.4,1.45,'#c2a079');
    for(let n=0;n<8;n++)box(x-1.9+n*.54,2.25,-70.8,.54,.13,2.1,n%2?'#f6dfac':color);
    sign(title,x,2.65,-70.1,4,.7,color,root,-.18);
    addPerson('shopkeeper','game',still(x,.2,-71.5,0,x),.85);
    for(let n=0;n<3;n++)addPerson(roles[n],'game',still(x-1+n*.85,.2,-69.8,Math.PI,x+n),.85);
    pool(x,-70,3,'#ffdc97');
  }
  for(const x of [3,57])for(const z of [-96,-72]) {
    for(let n=0;n<4;n++)box(x-1.2+n*.8,8,z+.27,.62,.42,.1,'#fff1c7',root,true);
    pool(x+(x<30?5:-5),z+(z< -84?4:-4),9,'#fbe3ab');
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),transparent:true,depthWrite:false,opacity:0,color:'#fff0c7'}));
    glow.position.set(x,8,z);glow.scale.set(5,3,1);scene.add(glow);flags.push({glow});
  }
  // Keep the existing score; this frame makes it legible as a lit event board.
  for(const x of [23.2,36.8])box(x,5,-99.35,.1,3.4,.1,'#ffd18b',root,true);
  for(const y of [3.25,6.75])box(30,y,-99.35,13.7,.1,.1,'#ffd18b',root,true);
  sign('FRIDAY  /  7:30 KICKOFF',30,7.35,-99.4,12,.8,'#395f5e',root,-.15);
  for(const x of [5,55]) {
    box(x,4,-98.5,.12,8,.12,'#87927a');
    const flag=group(x,7.1,-98.5,0,scene);box(1,0,0,2,1.2,.07,'#428274',flag);sign('OWLS',1,0,.05,1.8,.65,'#428274',flag);flags.push({flag,x});
  }
  await Promise.all(jobs);kit.bake();
  const crowd=await districtCrowd(scene,people);
  const stats={shopLandmarks:rooftops.length,downtownVisitors:people.filter(p=>p.period==='day').length,quayNightVisitors:people.filter(p=>p.period==='night').length,fridaySupporters:people.filter(p=>p.period==='game').length};
  return {stats,landmarkRecords,errands,update(t,hour,night,type='clear'){
    weather=type;weatherTime+=(t-lastTime)*(type==='snow'?.8:1);lastTime=t;
    kit.update(night);crowd.update(t,hour,p=>type==='rain'&&p.period!=='game'&&!errands.includes(p));
    flags.forEach(({flag,glow,x})=>{if(flag)flag.rotation.y=Math.sin(t*1.3+x)*.2;if(glow)glow.material.opacity=night*.65;});
    steam.forEach(({m,g,n})=>{const u=(t*.2+n/3)%1,p=g.getWorldPosition(new THREE.Vector3());m.position.set(p.x+u*.4,p.y+1.8+u*1.5,p.z);m.scale.setScalar(.12+u*.22);m.material.opacity=(1-u)*.4;});
  },audit(){return {stats,rooftops,visible:{day:people.filter(p=>p.period==='day'&&p.visible).length,night:people.filter(p=>p.period==='night'&&p.visible).length,game:people.filter(p=>p.period==='game'&&p.visible).length},sample:people.filter((p,i)=>i%20===0).map(p=>p.position)};}};
}

let glow;
function glowTexture() {
  if(glow)return glow;
  const c=document.createElement('canvas');c.width=c.height=64;
  const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,1,32,32,32);
  g.addColorStop(0,'white');g.addColorStop(.15,'#fff5d3');g.addColorStop(.3,'#ffe7ad66');g.addColorStop(1,'#ffe7ad00');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);glow=new THREE.CanvasTexture(c);return glow;
}
