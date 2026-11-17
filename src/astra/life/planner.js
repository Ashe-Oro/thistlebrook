// @ts-check
import { isOpen } from './registry.js';
import { variation } from './profiles.js';
/** @param {import('./types').ToolName} tool @param {string|undefined} target
 * @param {string} reason @param {import('./types').Action['args']} [extra]
 * @returns {import('./types').Action} */
const call=(tool,target,reason,extra={})=>({tool,args:{...(target?{target}:{}),...extra},reason});

/** Scripted brain: only returns tool-shaped requests. All state changes, paths,
 * reservations and money effects belong to the executor.
 * @type {import('./types').Brain} */
export function scriptedPlanner({self,clock,places,passing}){
 const {hour,elapsed,day}=clock;
 const here=places.find(p=>p.id===self.location.place);
 /** @param {import('./types').PlaceView} p */
 const available=p=>isOpen(p.hours,hour)&&(!p.interaction||p.freeSlots.length>0||p.id===here?.id&&!!self.location.slot);
 /** @param {(p:import('./types').PlaceView)=>boolean} predicate */
 const nearest=predicate=>places.filter(p=>available(p)&&predicate(p)).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id))[0];
 /** @param {import('./types').PlaceView|undefined} p
  * @param {import('./types').ToolName} tool @param {string} reason */
 const go=(p,tool,reason)=>p&&available(p)&&p.capabilities.includes(tool) ? call(self.location.place===p.id?tool:'walkTo',p.id,reason) : null;
 const home=places.find(p=>p.id===self.assets.home),work=places.find(p=>p.id===self.job.workplace);
 const breakDue=elapsed-self.memory.lastBreak>85;
 // Only interrupt journeys at real graph nodes, near an accessible prop.
 if(passing){
  if(hour<6||hour>=22||!breakDue)return null;
  const seat=nearest(p=>!!p.interaction&&['sit','picnic'].includes(p.interaction.activity)&&p.distance<5+self.personality.curiosity*3);
  return seat&&(self.needs.energy<60||self.needs.hunger>45)?go(seat,self.needs.hunger>45&&self.assets.inventory.meal&&seat.capabilities.includes('eat')?'eat':'rest','A useful place to pause along the route'):null;
 }
 if(self.job.title==='Night-shift nurse'&&hour<6&&self.memory.worked<(self.job.workplace.startsWith('workspot:')?720:360))return go(work,'work','Overnight cover at the clinic');
 if(hour>=22||hour<6)return go(home,'rest','Home for the night');
 if(here?.interaction&&self.location.slot&&isOpen(here.hours,hour)){
  const a=here.interaction.activity;
  if(['sit','picnic'].includes(a)&&breakDue)return call(self.needs.hunger>35&&self.assets.inventory.meal&&here.capabilities.includes('eat')?'eat':'rest',here.id,'Use the seat before continuing');
  if(['chess','baseball','browse'].includes(a)&&elapsed-self.memory.lastLeisure>90)return call('visit',here.id,'Take the reserved place in the activity');
 }
 if(self.needs.energy<25&&breakDue){const seat=nearest(p=>p.interaction?.activity==='sit'||p.interaction?.activity==='picnic');return go(seat||home,'rest','Rest before the next errand');}
 if(self.needs.hunger>57||hour>=12&&hour<13.5&&elapsed-self.memory.lastMeal>200){
  if(self.assets.inventory.meal>0){const seat=nearest(p=>p.interaction?.tools.includes('eat')===true);return go(seat||home,'eat','Make time for a packed lunch');}
  const shop=nearest(p=>p.capabilities.includes('buy'));if(shop&&self.money>=300)return go(shop,'buy','Pick up lunch');
  // A modest home pantry prevents starvation after an unaffordable errand.
  return go(home,'eat','A meal from the household pantry');
 }
 const bill=self.bills.find(b=>b.dueDay<=day&&b.paidDay!==day&&b.amount<=self.money);
 const billHour=9+variation(day+731,self.id)*3;
 if(bill&&(here?.name==='Thistlebrook Town Hall'||hour>=billHour&&hour<billHour+.2)){const hall=places.find(p=>p.name==='Thistlebrook Town Hall')||work;if(hall&&self.location.place===hall.id)return call('payBill',hall.id,'Take care of the household contribution',{bill:bill.id});return go(hall,'payBill','A morning errand at town hall');}
 if(hour>=self.job.shift[0]&&hour<self.job.shift[1]&&self.memory.worked<(self.job.workplace.startsWith('workspot:')?720:360)&&work&&available(work))return go(work,'work',self.job.title==='Student'?'Attend class':'Keep the day’s work moving');
 if(self.job.product&&(self.assets.inventory[self.job.product]||0)>2&&elapsed-self.memory.lastSale>400){const shop=nearest(p=>p.capabilities.includes('sell'));if(shop)return self.location.place===shop.id?call('sell',shop.id,'Deliver something made at work',{item:self.job.product}):go(shop,'sell','Deliver today’s work');}
 const restockHour=8+variation(day+193,self.id)*3;
 if(hour>=restockHour&&(self.assets.inventory.meal||0)<2&&self.money>=300&&elapsed-self.memory.lastPurchase>180){const shop=nearest(p=>p.capabilities.includes('buy'));if(shop)return go(shop,'buy','Restock the lunch bag');}
 const afternoon=self.schedule.find(s=>s.start>=15&&s.start<16);
 if(afternoon&&hour>=afternoon.start&&hour<afternoon.end&&elapsed-self.memory.lastLeisure>90){
  const preferred=places.find(p=>p.id===afternoon.target);
  // Joining an existing game gets priority over starting another empty table.
  const games=places.filter(p=>available(p)&&p.interaction?.activity===self.personality.favourite&&p.participants.length>0);
  /** @param {import('./types').PlaceView} p */
  const affinity=p=>self.relationships.filter(r=>p.participants.includes(r.id)).reduce((sum,r)=>sum+r.familiarity,0)*self.personality.sociability;
  games.sort((a,b)=>(a.distance-affinity(a))-(b.distance-affinity(b))||a.id.localeCompare(b.id));
  const game=games[0];
  if(game||preferred&&available(preferred))return go(game||preferred,'visit',afternoon.label);
  const alternate=nearest(p=>!!p.interaction&&['sit','picnic'].includes(p.interaction.activity));
  if(alternate&&breakDue)return go(alternate,'rest','The game is full; take a nearby seat');
 }
 const evening=self.schedule.find(s=>s.start===19);
 if(evening&&hour>=19&&hour<21.5){const planned=places.find(p=>p.id===evening.target),target=planned&&available(planned)?planned:nearest(p=>p.district==='quay'&&!p.interaction);return go(target,evening.tool,evening.label);}
 if(hour<8)return go(home,self.needs.hunger>30?'eat':'rest','An unhurried start');
 if(breakDue){const nearby=nearest(p=>!!p.interaction&&['sit','picnic'].includes(p.interaction.activity)&&p.distance<18);if(nearby)return go(nearby,'rest','A quiet pause between errands');}
 const outings=places.filter(p=>available(p)&&p.kind!=='workplace'&&p.id!==here?.id&&isOpen(p.hours,hour)&&!self.memory.visited.slice(-3).includes(p.id));
 const offset=Math.floor(variation(day+Math.floor(elapsed/70),self.id)*outings.length);
 return go(outings[offset]||home,'visit','Take a different route around town');
}
