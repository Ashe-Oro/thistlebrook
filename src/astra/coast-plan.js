// Coral Coast is an eastern addition. All authored district coordinates live here.
export const COAST_VIEWS = {
  coast: {x:112,z:-52,zoom:1.18},
  beach: {x:124,z:-49,zoom:2.85},
  strip: {x:92,z:-47,zoom:2.75},
};
export const COAST_BLOCKS = [
  ['PALM HOUSE','Palm House · rooftop supper club','#ef9caa','#67d7cb',15],
  ['SOL MAR','Sol Mar · seafood & sunset tables','#9ed9cf','#f9b861',10],
  ['THE FLAMINGO','The Flamingo · cocktail garden','#edb1c6','#ff75ba',18],
  ['CAFÉ CUBANO','Café Cubano · coffee & dominoes','#f1cd87','#66d5c8',11],
  ['BLUE HOUR','Blue Hour · listening bar','#a0c9dc','#ffa0ce',14],
  ['MANGO CLUB','Mango Club · dance terrace','#d7b8e5','#f8bd66',12],
  ['SALT & LIME','Salt & Lime · beachside cantina','#a9d2a5','#78e4df',9],
].map(([sign,name,color,neon,height],i)=>({id:`coast-front-${i}`,sign,name,color,neon,height,x:87,z:-94+i*14,index:i}));
export const COAST_REAR = ['BISCAYNE','GELATO','CASA ROSA','VINYL','LA PERLA','NIGHT SWIM','ORANGE BLOSSOM'].map((sign,i)=>({id:`coast-rear-${i}`,sign,name:sign+' · Ocean Lane',color:['#e7bb98','#a7c7d3','#dba5b2'][i%3],neon:'#ffd29a',height:16+(i%3)*3,x:74,z:-94+i*14,index:i}));
export const shoreX = z => 135 + Math.sin((z+100)*.045)*2 + Math.sin(z*.13)*.6;
export const COAST_COURTS = [-54,-12];
export const COAST_UMBRELLAS = [-94,-82,-70,-35,-23,0].flatMap((z,i)=>[118,126].map((x,j)=>({x,z:z+(j?1:0),color:['#ef8e88','#70c9c3','#f4c66b'][i%3],index:i*2+j})));
export const COAST_VENUE_COUNT = COAST_BLOCKS.length+COAST_REAR.length+3;
export function addCoastLayout(town) {
  town.districts.push({id:'coral-coast',name:'Coral Coast',type:'beach-nightlife',center:[108,-49]});
  const corner=town.outline.findIndex(p=>p[0]===65&&p[1]===-104);
  const edge=[];for(let z=-108;z<=0;z+=9)edge.push([shoreX(z),z]);
  town.outline.splice(corner,1,[65,-104],[65,-112],[130,-112],...edge,[127,8],[65,8]);
  town.bounds.maxX=Math.max(town.bounds.maxX,190);
  const road=(a,b,width=2.4,kind='lane',owner=null)=>town.roads.push({a,b,width,kind,owner});
  road([56,-33],[65,-33],2.4);road([65,-33],[65,-31],2.4);road([65,-31],[110,-31],2.4);
  road([60,-69],[65,-69],1.5);road([65,-69],[65,-73],1.5);road([65,-73],[110,-73],2.4);
  road([80,-103],[80,2],1.8);road([101,-103],[101,2],4.2);road([110,-103],[110,2],2.5);
  for(const z of [-103,-87,-59,-45,-17,2])road([67,z],[110,z],2.2);
  road([67,-103],[67,2],2);
  for(const b of [...COAST_BLOCKS,...COAST_REAR]) {
    const front=b.x===87;
    town.venues.push({...b,type:front?'coast-restaurant':'coast-bar',district:'coral-coast',pos:[b.x,b.z],box:{min:[front?82:70,b.z-5.2],max:[front?98:78,b.z+5.2]},entry:[front?91.5:78,b.z],access:[front?101:80,b.z],story:front?'An Art Deco address on Ocean Drive. Guests arrive along the promenade, stop for a meal on the patio, or climb the outside stairs to the roof. The neon comes on at dusk.':'A narrow Ocean Lane favourite, with apartments upstairs, a busy counter downstairs, and a late-night crowd on the walk to the beach.'});
  }
  town.venues.push({id:'coast-beach',name:'Coral Beach · sand, shade & surf',type:'coast-beach',district:'coral-coast',pos:[123,-82],height:4,box:{min:[114,-89],max:[132,-76]},entry:[114,-82],access:[110,-82],story:'Follow the sand paths to striped umbrellas and the gentle shallows. Swimmers turn inside the buoy line; sunbathers stretch out on their towels. Lifeguards watch from the pastel towers.'});
  for(const [i,z]of COAST_COURTS.entries())town.venues.push({id:`coast-volley-${i}`,name:`Coral Beach · volleyball ${i+1}`,type:'coast-volleyball',district:'coral-coast',pos:[123,z],height:3.2,box:{min:[116,z-9],max:[130,z+9]},entry:[116,z],access:[110,z],story:'Two teams keep a rally moving across the sand. Players track the ball, ready their arms, and jump at the net. The court lights stay on for an evening game.'});
}
