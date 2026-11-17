import { SUNBEAM_RESIDENTS } from '../sunbeam-layout.js';
// @ts-check
/** @type {[string,string,string,string|null,import('./types').ActivityType][]} */
const roster=[
 ['Mabel','Baker','Flour & Fern','bread','chess'],['Bram','Blacksmith','Bram’s Workshop','repairs','chess'],
 ['Rose','Innkeeper','The Copper Kettle','bread','picnic'],['Finn','Shopkeeper','Astra Provisions',null,'sit'],
 ['Hazel','Market trader','Astra Provisions','apples','picnic'],['Oswin','Miller','The Little Mill','flour','sit'],
 ['Clover','Farmer','Clover Farm','apples','picnic'],['Rowan','Carpenter','Bram’s Workshop','repairs','sit'],
 ['Pip','Student','Astra High School',null,'baseball'],['Ada','Story collector','The Reading Room',null,'chess'],
 ['Fern','Herbalist','Saint Willow’s','herbs','picnic'],['Hugh','Lamplighter','Astra Town Hall',null,'sit'],
 ['Wren','Beekeeper','Clover Farm','honey','chess'],['Tilly','Gardener','Petal & Stem','flowers','picnic'],
 ['Jasper','Postman','The Post Office',null,'sit'],['Olive','Flower seller','Petal & Stem','flowers','picnic'],
 ['Nico','Tennis coach','Common Tennis Club',null,'baseball'],['Bea','Barista','Corner Cup Café','bread','picnic'],
 ['Theo','Music lover','The Lantern Room',null,'sit'],['Iris','Gardener','Petal & Stem','flowers','chess'],
 ['Kit','Student','Astra High School',null,'baseball'],['Luca','Bartender','The Nightjar',null,'sit'],
 ['Alma','Librarian','The Reading Room',null,'chess'],['Jules','Basketball regular','The Neighbourhood Court',null,'baseball'],
 ['Elsie','Teacher','Astra High School',null,'chess'],['June','Principal','Astra High School',null,'picnic'],
 ['Arthur','Coach','Owls Memorial Stadium',null,'baseball'],['Blythe','Bookseller','The Reading Room',null,'chess'],
 ['Milo','Cobbler','Sole & Stitch','repairs','sit'],['Daisy','Baker','Sunrise Bakehouse','bread','picnic'],
 ['Lily','Florist','Petal & Stem','flowers','picnic'],['Seth','Postal clerk','The Post Office',null,'sit']
];
roster.push(...SUNBEAM_RESIDENTS.map(p=>[p.name,p.role,p.name==='Otis'?'Willow Community Clinic':p.name==='Rafi'?'Astra High School':p.name==='Emil'?'Civic Library & Story Garden':null,null,p.name==='Rafi'?'baseball':p.name==='Mae'?'chess':'sit']));
export const RESIDENT_NAMES=roster.map(r=>r[0]);
/** @param {number} seed @param {string} id @param {number} [day] */
export function variation(seed,id,day=0){let h=(seed+day*7919)>>>0;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h/4294967296;}

/** @param {{seed:number,nodes:import('./types').Vec2[]}} town
 * @param {{places:import('./types').Place[]}} registry
 * @returns {import('./types').ResidentContext[]} */
export function createContexts(town,registry){
 const homes=registry.places.filter(p=>p.kind==='home');
 return roster.map(([name,title,work,product,favourite],n)=>{
  const id='resident:'+name.toLowerCase(),v=variation(town.seed,id),terrace=SUNBEAM_RESIDENTS.find(p=>p.name===name),originalHomes=homes.filter(p=>p.district!=='sunbeam'),home=(terrace?homes.find(p=>p.id===`sunbeam-${terrace.home}`):originalHomes[n%originalHomes.length])||registry.places[0];
  const workName=name==='Alma'?'Civic Library & Story Garden':name==='Fern'?'Willow Community Clinic':work;
  const workplace=registry.places.find(p=>p.id==='workspot:'+name)||registry.places.find(p=>p.name===workName)||home;
  const school=['Student','School student','Teacher','Principal','Music teacher'].includes(title),late=['Bartender','Lamplighter'].includes(title);
  /** @type {[number,number]} */
  const shift=workplace.id.startsWith('workspot:')?[7,17]:name==='Otis'?[0,6]:late?[16,22]:school?[8,15]:title==='Baker'?[6,12]:[8+Math.floor(v*2),14+Math.floor(v*2)];
  return {id,name,job:{title,workplace:workplace.id,wage:school&&['Student','School student'].includes(title)?0:280+Math.floor(v*5)*30,product,shift},personality:{pace:1.3+v*.35,curiosity:.35+v*.6,sociability:.4+(1-v)*.5,favourite},money:4200+n*115,bills:[{id:'household',label:'Household contribution',amount:650+n%3*100,dueDay:0,paidDay:null}],assets:{home:home.id,inventory:{meal:2,...(product?{[product]:2}:{})}},relationships:[{id:'resident:'+roster[n^1][0].toLowerCase(),familiarity:25,sharedActivities:0}],needs:{energy:72+v*25,hunger:20+v*28,recreation:35+v*30},schedule:[],memory:{day:0,worked:0,lastMeal:-200,lastBreak:-200,lastLeisure:-200,lastPurchase:-200,lastSale:-200,visited:[]},location:{node:home.node,position:[...town.nodes[home.node]],place:home.id,slot:null}};
 });
}
/** @param {import('./types').ResidentContext} self
 * @param {{places:import('./types').Place[]}} registry
 * @param {number} day @param {number} seed
 * @returns {import('./types').ScheduleBlock[]} */
export function dailySchedule(self,registry,day,seed){
 /** @param {import('./types').ActivityType} activity */
 const choose=(activity)=>registry.places.filter(p=>p.interaction?.activity===activity);
 const v=variation(seed,self.id,day),fav=self.personality.favourite;
 const leisure=choose(fav),fallback=registry.places.find(p=>p.kind==='fountain')||registry.places[0];
 const target=leisure[Math.floor(v*leisure.length)]||fallback;
 const lunch=choose('picnic')[0]||registry.places.find(p=>p.name==='The Copper Kettle')||fallback;
 const evening=registry.places.filter(p=>p.district==='quay');
 const outing=evening[Math.floor(v*evening.length)]||fallback;
 return [
  {start:0,end:6,label:'Home & sleep',target:self.assets.home,tool:'rest'},
  {start:6,end:8,label:'Breakfast at home',target:self.assets.home,tool:'eat'},
  {start:self.job.shift[0],end:self.job.shift[1],label:self.job.title==='Student'?'At school':'At work',target:self.job.workplace,tool:'work'},
  {start:12,end:13.5,label:'Lunch outdoors',target:lunch.id,tool:'eat'},
  {start:15+v*.45,end:18.5,label:fav==='baseball'?'Batting practice':fav==='chess'?'Chess on the square':'A slower afternoon',target:target.id,tool:'visit'},
  {start:19,end:21.5,label:day%3===1?'An evening at home':'Evening by the river',target:day%3===1?self.assets.home:outing.id,tool:day%3===1?'rest':'visit'},
  {start:22,end:24,label:'Home for the night',target:self.assets.home,tool:'rest'}
 ];
}
