import { DAY_SLEEP, NIGHT_SHIFT_SLEEP } from './needs.js';
import { SCHOOL_SHIFT, weekdayOf } from '../school-plan.js';
import { SUNBEAM_RESIDENTS } from '../sunbeam-layout.js';
import { MAPLE_HOLLOW_RESIDENTS, BBQ_HOSTS } from '../maple-hollow-plan.js';
// @ts-check
/** @type {[string,string,string,string|null,import('./types').ActivityType][]} */
const roster=[
 ['Mabel','Baker','Flour & Fern','bread','chess'],['Bram','Blacksmith','Bram’s Workshop','repairs','chess'],
 ['Rose','Innkeeper','The Copper Kettle','bread','picnic'],['Finn','Shopkeeper','Thistlebrook Provisions',null,'sit'],
 ['Hazel','Market trader','Thistlebrook Provisions','apples','picnic'],['Oswin','Miller','The Little Mill','flour','sit'],
 ['Clover','Farmer','Clover Farm','apples','picnic'],['Rowan','Carpenter','Bram’s Workshop','repairs','sit'],
 ['Pip','Student','Thistlebrook High School',null,'baseball'],['Ada','Story collector','The Reading Room',null,'chess'],
 ['Fern','Herbalist','Saint Willow’s','herbs','picnic'],['Hugh','Lamplighter','Thistlebrook Town Hall',null,'sit'],
 ['Wren','Beekeeper','Clover Farm','honey','chess'],['Tilly','Gardener','Petal & Stem','flowers','picnic'],
 ['Jasper','Postman','The Post Office',null,'sit'],['Olive','Flower seller','Petal & Stem','flowers','picnic'],
 ['Nico','Tennis coach','Common Tennis Club',null,'baseball'],['Bea','Barista','Corner Cup Café','bread','picnic'],
 ['Theo','Music lover','The Lantern Room',null,'sit'],['Iris','Gardener','Petal & Stem','flowers','chess'],
 ['Kit','Student','Thistlebrook High School',null,'baseball'],['Luca','Bartender','The Nightjar',null,'sit'],
 ['Alma','Librarian','The Reading Room',null,'chess'],['Jules','Basketball regular','The Neighbourhood Court',null,'baseball'],
 ['Elsie','Teacher','Thistlebrook High School',null,'chess'],['June','Principal','Thistlebrook High School',null,'picnic'],
 ['Arthur','Coach','Owls Memorial Stadium',null,'baseball'],['Blythe','Bookseller','The Reading Room',null,'chess'],
 ['Milo','Cobbler','Sole & Stitch','repairs','sit'],['Daisy','Baker','Sunrise Bakehouse','bread','picnic'],
 ['Lily','Florist','Petal & Stem','flowers','picnic'],['Seth','Postal clerk','The Post Office',null,'sit']
];
roster.push(...SUNBEAM_RESIDENTS.map(p=>[p.name,p.role,p.name==='Otis'?'Willow Community Clinic':p.name==='Rafi'?'Thistlebrook High School':p.name==='Emil'?'Civic Library & Story Garden':null,null,p.name==='Rafi'?'baseball':p.name==='Mae'?'chess':'sit']));
// Maple Hollow households (opus-suburb): kids ride the school bus, adults work in town.
roster.push(...MAPLE_HOLLOW_RESIDENTS.map(p=>[p.name,p.kid?'School student':p.role,p.kid?'Thistlebrook High School':p.work,null,p.favourite]));
export const RESIDENT_NAMES=roster.map(r=>r[0]);
/** @param {number} seed @param {string} id @param {number} [day] */
export function variation(seed,id,day=0){let h=(seed+day*7919)>>>0;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h/4294967296;}

/** @param {{seed:number,nodes:import('./types').Vec2[]}} town
 * @param {{places:import('./types').Place[]}} registry
 * @returns {import('./types').ResidentContext[]} */
export function createContexts(town,registry){
 const homes=registry.places.filter(p=>p.kind==='home');
 // Maple Hollow households join only when the compiled world has the district.
 const hasMaple=homes.some(p=>p.district==='maple-hollow');
 return roster.filter(([name])=>hasMaple||!MAPLE_HOLLOW_RESIDENTS.some(p=>p.name===name)).map(([name,title,work,product,favourite],n)=>{
  const id='resident:'+name.toLowerCase(),v=variation(town.seed,id),terrace=SUNBEAM_RESIDENTS.find(p=>p.name===name),maple=MAPLE_HOLLOW_RESIDENTS.find(p=>p.name===name),originalHomes=homes.filter(p=>p.district!=='sunbeam'&&p.district!=='maple-hollow'),home=(terrace?homes.find(p=>p.id===`sunbeam-${terrace.home}`):maple?homes.find(p=>p.id===`maple-lot-${maple.lot}`):originalHomes[n%originalHomes.length])||registry.places[0];
  const workName=name==='Alma'?'Civic Library & Story Garden':name==='Fern'?'Willow Community Clinic':work;
  const workplace=registry.places.find(p=>p.id==='workspot:'+name)||registry.places.find(p=>p.name===workName)||home;
  const pupil=['Student','School student'].includes(title);
  const school=workplace.id==='school'||pupil||['Teacher','Principal','Music teacher'].includes(title);
  const late=['Bartender','Lamplighter','Music lover'].includes(title);
  /** @type {[number,number]} */
  const shift=workplace.id.startsWith('workspot:')?[7,17]:name==='Otis'?[0,6]:name==='Mae'?[0,0]:late?[17,22]:school?(pupil?[...SCHOOL_SHIFT.pupil]:[...SCHOOL_SHIFT.staff]):title==='Baker'?[6,12]:[8+Math.floor(v*2),14+Math.floor(v*2)];
  const sleep=name==='Otis'?NIGHT_SHIFT_SLEEP:DAY_SLEEP;
  const commute=maple?.kid?{stop:maple.stop,school:'mh-stop-school',leave:6.95,missed:8.4,afternoon:14.8,missedPm:16.6}:null;
  return {id,name,job:{title,workplace:workplace.id,wage:pupil?0:280+Math.floor(v*5)*30,product,shift,commute:0},personality:{pace:1.3+v*.35,curiosity:.35+v*.6,sociability:.4+(1-v)*.5,favourite},money:4200+n*115,bills:[{id:'household',label:'Household contribution',amount:650+n%3*100,dueDay:0,paidDay:null}],assets:{home:home.id,inventory:{meal:2,...(product?{[product]:2}:{})}},relationships:[{id:'resident:'+roster[n^1][0].toLowerCase(),familiarity:25,sharedActivities:0}],needs:{energy:72+v*25,hunger:80-v*28,recreation:35+v*30},sleep:[...sleep],schedule:[],memory:{day:0,worked:0,lastMeal:-200,lastBreak:-200,lastLeisure:-200,lastPurchase:-200,lastSale:-200,visited:[],blocked:{}},location:{node:home.node,position:[...town.nodes[home.node]],place:home.id,slot:null},...(maple?{district:'maple-hollow'}:{}),...(commute?{kid:true,commute}:{})};
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
 const target=(fav==='chess'?leisure.find(p=>p.id==='life:chess'):fav==='baseball'?leisure.find(p=>p.id==='baseball'):null)||leisure[Math.floor(v*leisure.length)]||fallback;
 const lunch=choose('picnic')[0]||registry.places.find(p=>p.name==='The Copper Kettle')||fallback;
 const evening=registry.places.filter(p=>p.district==='quay');
 const outing=evening[Math.floor(v*evening.length)]||fallback;
 const [bedtime,wake]=self.sleep;
 const sleep=bedtime>wake?[[0,wake],[bedtime,24]]:[[bedtime,wake]];
 // Maple Hollow: kids play in the yards after school; some evenings bring a
 // neighbourhood BBQ on a host's deck (Friday, Saturday and Sunday).
 if(self.district==='maple-hollow'){
  const yard=registry.places.find(p=>p.id==='mh-yard:'+self.assets.home)||choose('play')[Math.floor(v*choose('play').length)];
  const bbq=weekdayOf(day)>=4?registry.places.find(p=>p.id==='mh-bbq:maple-lot-'+BBQ_HOSTS[day%BBQ_HOSTS.length]):null; // Friday to Sunday evenings
  return [
   ...sleep.map(([start,end])=>({start,end,label:'Home & sleep',target:self.assets.home,tool:'rest'})),
   {start:6,end:8,label:'Breakfast at home',target:self.assets.home,tool:'eat'},
   {start:self.job.shift[0],end:self.job.shift[1],label:self.kid?'At school':'At work',target:self.job.workplace,tool:'work'},
   {start:12,end:13.5,label:'Lunch outdoors',target:lunch.id,tool:'eat'},
   self.kid&&yard?{start:15+v*.3,end:19.2,label:'Playing in the yard',target:yard.id,tool:'visit'}:{start:15.2+v*.6,end:18.8,label:'Home from work',target:self.assets.home,tool:'visit'},
   bbq?{start:19,end:21.5,label:'BBQ with the neighbours',target:bbq.id,tool:'visit'}:{start:19,end:21.5,label:'An evening at home',target:self.assets.home,tool:'rest'},
  ];
 }
 return [
  ...sleep.map(([start,end])=>({start,end,label:'Home & sleep',target:self.assets.home,tool:'rest'})),
  {start:6,end:8,label:'Breakfast at home',target:self.assets.home,tool:'eat'},
  ...(self.job.shift[0]===self.job.shift[1]?[]:[{start:self.job.shift[0],end:self.job.shift[1],label:self.job.title==='Student'?'At school':'At work',target:self.job.workplace,tool:'work'}]),
  {start:12,end:13.5,label:'Lunch outdoors',target:lunch.id,tool:'eat'},
  {start:15+v*.45,end:18.5,label:fav==='baseball'?'Batting practice':fav==='chess'?'Chess on the square':'A slower afternoon',target:target.id,tool:'visit'},
  {start:19,end:21.5,label:day%3===1?'An evening at home':'Evening by the river',target:day%3===1?self.assets.home:outing.id,tool:day%3===1?'rest':'visit'},
 ];
}
