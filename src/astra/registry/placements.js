// Renderer-only kit placements now have one compiler-visible inventory.
// Keep random-call order in world.js intact: rock scales/yaws are sampled there.
export function supplementalPlacements(town) {
 const items=[];
 const add=(key,asset,pos,rot=0,scale=1,owner=null)=>items.push({key,asset,pos,rot,scale,owner});
 for(const b of town.buildings.filter(b=>b.pos[1]<0&&b.district==='willowbank')){
  const z=b.box.min[1]-1.15;
  for(const [i,x] of [-2.5,0,2.5].entries())add(`${b.key}/fence-${i}`,'cv-picket-fence',[b.pos[0]+x,z],0,.76,b.key);
  if(b.kind==='home')add(`${b.key}/laundry`,'cv-laundry-line',[b.pos[0],z-.65],0,.7,b.key);
 }
 for(const [i,x] of [-35,-31,-13,-5,5,13,31,35].entries())add(`bank-rock-${i}`,'cv-rock-stone-pile',[x,0]);
 for(let n=0;n<7;n++)add(`duck-${n}`,'farm-duck',[-13+n*.8,0],0,n===0?1.5:1);
 for(let n=0;n<5;n++)add(`chicken-${n}`,'farm-chicken',[18+n*.5,29],0,1.4,'parcel-14');
 for(const [i,x] of [-12,8].entries())add(`school-bench-${i}`,'cv-bench',[x,-56],0,.85,'school');
 for(const [i,[x,z,rot]] of [[-62,-9,Math.PI/2],[-52,-9,-Math.PI/2],[-62,-3,Math.PI/2],[-52,-3,-Math.PI/2]].entries())add(`fountain-bench-${i}`,'cv-bench',[x,z],rot,.9,'fountain');
 return items;
}

// Logical assemblies: each rendered primitive is a component of one assembly.
export function proceduralPlacements(town) {
 const out=[];
 const add=(id,name,pos,owner,kind='prop')=>out.push({key:`built:${id}`,name,pos,owner,kind,rendering:id.startsWith('terrace-')?'reservation':'geometry'});
 for(const [id,name,pos] of [
  ['island','Thistlebrook island',[-7,-34]],['river','Willow River',[0,15]],['market-paving','Market paving',[1,3.5]],
  ['market-bunting','Market bunting',[1,3]],['river-reeds','Riverbank reeds',[0,18]],['wildflowers','Wildflowers and pebbles',[0,-20]],
  ['mill-sails','Mill sails',town.buildings[0].pos]
 ])add(id,name,pos,id==='mill-sails'?'parcel-0':null,'landmark');
 for(const [i,x] of town.bridges.entries())add(`bridge-${i}`,'Willow River bridge '+(i+1),[x,15],null,'infrastructure');
 for(const b of (town.water?.bridges||[]).filter(b=>!b.existing))add(b.id,`${b.reach==='outflow'?'Stillwater Outflow':'Willow River'} footbridge`,b.pos,null,'infrastructure');
 for(const [i,r] of town.roads.entries())add(`road-${i}`,`${r.kind} path ${i+1}`,[(r.a[0]+r.b[0])/2,(r.a[1]+r.b[1])/2],r.owner,'infrastructure');
 for(const [i,g] of town.gardens.entries())add(`garden-${i}`,'Vegetable garden '+(i+1),[g.x,g.z],g.owner,'area');
 const groups={
  tennis:['Court surface and markings','Tennis net','Court fence and gate','Courtside bleachers','Tennis sign','Tennis rackets and ball'],
  basketball:['Court surface and markings','West basketball hoop','East basketball hoop','Court fence and gate','Courtside bleachers','Basketball sign','Basketball'],
  playground:['Playground lawn','Sandbox','Swing frame','First swing','Second swing','Slide and ladder','Playground sign'],
  school:['Classroom wings','Clock tower','School entrance and steps','School flag','School sign','School bus bay','School bus'],
  baseball:['Baseball outfield','Baseball diamond','Four bases','Pitching mound','Foul lines','Outfield fence','Backstop','Baseball sign','Baseball bleachers','Baseball bat and ball'],
  football:['Stadium field','Running track','North stands','South stands','West goalpost','East goalpost','Scoreboard','Floodlights','Football'],
  fountain:['Downtown plaza','Fountain basin and bowls','Fountain jets','Northwest planter','Northeast planter','Southwest planter','Southeast planter'],
  bandstand:['Audience court','Music stage and stairs','Music backdrop and sign','West speaker','East speaker','Musical instruments']
 };
 for(const [owner,names] of Object.entries(groups)){
  const venue=town.venues.find(v=>v.id===owner);
  names.forEach((name,i)=>add(`${owner}-${i}`,name,[...venue.pos],owner));
 }
 for(const [i,area] of town.courtyards.entries()){
  const pos=area.min.map((v,k)=>(v+area.max[k])/2);
  add(`terrace-${i}`,`Quay dining terrace ${i+1}`,pos,'quay','area');
  add(`table-${i}`,`Quay dining table ${i+1}`,pos,`built:terrace-${i}`);
  for(const side of [-1,1])add(`chair-${i}-${side}`,`Quay dining chair ${i+1} ${side===1?'south':'north'}`,[pos[0],pos[1]+side*1.05],`built:terrace-${i}`);
  add(`cup-${i}`,`Terrace cup ${i+1}`,pos,`built:table-${i}`);
 }
 for(const b of town.buildings.filter(b=>b.district==='downtown')){
  add(`${b.key}-sign`,`${b.name} sign`,b.pos,b.key);
  if(b.name!=='Thistlebrook Town Hall')add(`${b.key}-awning`,`${b.name} awning`,b.pos,b.key);
  if(['Sole & Stitch','Sunrise Bakehouse','The Post Office'].includes(b.name))add(`${b.key}-display`,`${b.name} display`,b.pos,b.key);
 }
 for(const b of town.buildings.filter((b,i)=>i%3===0&&b.pos[1]<0))add(`${b.key}-smoke`,`${b.name} chimney smoke`,b.pos,b.key,'effect');
 for(const [i,p] of town.props.entries()){
  if(p.id==='cv-streetlamp')add(`lamp-${i}`,`Streetlamp ${i+1} light and glow`,p.pos,`prop-${i}`,'effect');
  if(p.id==='cv-market-stall')add(`produce-${i}`,`Stall ${i+1} produce`,p.pos,`prop-${i}`);
 }
 for(const [i,z] of [-17,-1,28].entries())add(`quay-lights-${i}`,`Quay string lights ${i+1}`,[55,z],'quay');
 for(const b of town.buildings.filter(b=>b.district==='quay'))add(`${b.key}-sign`,`${b.name} sign`,b.pos,b.key);
 for(const s of town.catalogScenes)add(`${s.id}-pad`,`${s.name} paving`,s.center,s.id,'area');
 return out;
}
