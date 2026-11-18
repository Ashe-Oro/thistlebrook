// @ts-check
import { distance as distanceBetween, isOpen } from './registry.js';
import { variation } from './profiles.js';
import { isSchoolDay, weekdayOf } from '../school-plan.js';
import { weatherShelter } from '../weather-plan.js';
import { commuting, hoursUntil, HUNGRY, inWindow, LOW_RECREATION, MEAL_COST, MEAL_INTERVAL, SECONDS_PER_HOUR, TIRED } from './needs.js';

/** @param {import('./types').ToolName} tool @param {string} target
 * @param {string} reason @param {import('./types').Action['args']} [extra]
 * @returns {import('./types').Action} */
const call=(tool,target,reason,extra={})=>({tool,args:{target,...extra},reason});

/** Scripted brain: requests actions. The executor owns paths and state changes.
 * @type {import('./types').Brain} */
export function scriptedPlanner({self,clock,places,passing,greetingTarget,transit,weather = 'clear'}){
 const {hour,elapsed,day}=clock;
 if(greetingTarget)return hour>=7&&hour<20?call('talkTo',greetingTarget,'Catch up with a neighbour'):null;
 if(passing)return null;

 const {job,location,memory,needs}=self;
 const here=places.find(p=>p.id===location.place);
 const home=places.find(p=>p.id===self.assets.home);
 const work=places.find(p=>p.id===job.workplace);
 // school-day: Thistlebrook High keeps the weekday timetable; weekends are free.
 const schoolOff=job.workplace==='school'&&!isSchoolDay(weekdayOf(day));
 const staffAccess=!schoolOff&&commuting(job,hour);
 const shiftLead=hoursUntil(job.shift[0],hour)-job.commute;
 const bedtime=hoursUntil(self.sleep[0],hour);
 /** @param {import('./types').PlaceView} p */
 const available=p=>!(memory.blocked[p.id]>elapsed)&&p.weatherAllowsVisit!==false&&
  (!p.interaction?.residents||p.interaction.residents.includes(self.id))&&
  (isOpen(p.hours,hour)||p.id===job.workplace&&staffAccess)&&
  (!p.interaction||(p.id===here?.id&&location.slot?p.weatherSlotOpen!==false:p.freeSlots.length>0));
 const wet=weather==='rain'||weather==='snow',breakDue=elapsed-memory.lastBreak>85;
 /** @param {(p:import('./types').PlaceView)=>boolean} predicate */
 const nearest=predicate=>places.filter(p=>available(p)&&predicate(p)).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id))[0];
 /** @param {import('./types').PlaceView|undefined} p
  * @param {import('./types').ToolName} tool @param {string} reason
  * @param {import('./types').Action['args']} [extra] */
 const go=(p,tool,reason,extra)=>p&&available(p)&&p.capabilities.includes(tool)
  ?call(location.place===p.id?tool:'walkTo',p.id,reason,location.place===p.id?extra:undefined):null;

 /** Check that an outing leaves time to reach the next scheduled commitment.
  * @param {import('./types').PlaceView} p */
 const fits=p=>{
  const travel=(distanceBetween(p.pos,home.pos)+p.distance)/(self.personality.pace*SECONDS_PER_HOUR);
  if(bedtime<4&&travel*1.4+.4>=bedtime)return false;
  if(work&&job.shift[0]!==job.shift[1]&&shiftLead<3){
   const commute=(distanceBetween(p.pos,work.pos)+p.distance)/(self.personality.pace*SECONDS_PER_HOUR);
   return commute*1.4+.4<shiftLead+job.commute;
  }
  return true;
 };

 const packed=self.assets.inventory.meal>0;
 const mealDue=elapsed-memory.lastMeal>=MEAL_INTERVAL&&
  (needs.hunger<=HUNGRY||hour>=11.5&&hour<13.5&&needs.hunger<=75);
 if(inWindow(self.sleep,hour))return go(home,'rest','Home for the sleep block');
 const bus=!schoolOff&&transit?self.commute:null,rode=memory.rode;
 if(bus){
  if(hour<bus.missed&&rode?.morning!==day&&here!==work){
   if(hour<bus.leave)return here===home?null:go(home,'rest','Wait at home before the school bus');
   const stop=places.find(p=>p.id===bus.stop);
   if(stop&&available(stop))return here===stop?null:go(stop,'visit','Wait for the school bus');
  }
  if(rode?.morning===day&&hour>=job.shift[1]&&hour<bus.afternoon)return null;
  if(hour>=bus.afternoon&&hour<bus.missedPm&&memory.worked>0&&rode?.afternoon!==day){
   const stop=places.find(p=>p.id===bus.school);
   if(stop&&available(stop))return here===stop?null:go(stop,'visit','Wait for the bus home');
  }
  if(rode?.afternoon===day&&hour<19.5&&mealDue)return go(home,'eat','A snack at home after school');
 }
 if(staffAccess&&work&&available(work)){
  if(inWindow(job.shift,hour)){
   if(mealDue&&packed&&here===work){const lunch=go(work,'eat','A packed meal on break');if(lunch)return lunch;}
   return go(work,'work',job.title==='Student'?'Attend class':'Attend the scheduled shift');
  }
  return here===work?(mealDue&&packed?go(work,'eat','Eat before the shift'):null):go(work,'work','Leave in time for the shift');
 }
 if(bedtime<1.25){
  if(here!==home)return go(home,'rest','Head home before bedtime');
  return mealDue?go(home,'eat','Supper from the household pantry'):null;
 }

 // Preserve the authored activity choices and the shared game reservations.
 const afternoon=self.schedule.find(s=>s.start>=15&&s.start<16);
 if(needs.hunger>25&&afternoon&&hour>=afternoon.start&&hour<afternoon.end&&elapsed-memory.lastLeisure>90){
  const preferred=places.find(p=>p.id===afternoon.target);
  const games=places.filter(p=>available(p)&&p.interaction?.activity===self.personality.favourite&&p.participants.length>0);
  /** @param {import('./types').PlaceView} p */
  const affinity=p=>self.relationships.filter(r=>p.participants.includes(r.id)).reduce((sum,r)=>sum+r.familiarity,0)*self.personality.sociability;
  games.sort((a,b)=>(a.distance-affinity(a))-(b.distance-affinity(b))||a.id.localeCompare(b.id));
  const target=games.find(fits)||preferred;
  const activity=go(target&&fits(target)?target:undefined,'visit',afternoon.label);
  if(activity)return activity;
 }
 if(mealDue){
  if(here===home&&hour<8)return go(home,'eat','Breakfast from the household pantry');
  if(here?.sellsMeals&&isOpen(here.hours,hour))return packed
   ?go(here,'eat','Have the meal at the shop'):self.money>=MEAL_COST?go(here,'buy','Pick up a meal'):go(home,'eat','A meal from the household pantry');
  if(packed){
   const lunch=wet?undefined:nearest(p=>p.interaction?.activity==='picnic'&&p.capabilities.includes('eat')&&p.distance<=32&&fits(p));
   if(lunch)return go(lunch,'eat','Make time for a packed meal');
  }
  const shop=nearest(p=>p.sellsMeals&&isOpen(p.hours,hour)&&fits(p));
  if(shop&&self.money>=MEAL_COST)return go(shop,'buy','Pick up a meal');
  return go(home,'eat','Food shops unavailable; use the household pantry');
 }
 const bill=self.bills.find(b=>b.dueDay<=day&&b.paidDay!==day&&b.amount<=self.money);
 const billHour=9+variation(day+731,self.id)*3;
 if(bill&&(here?.name==='Thistlebrook Town Hall'||hour>=billHour&&hour<billHour+.2)){
  const hall=places.find(p=>p.name==='Thistlebrook Town Hall');
  const errand=go(hall&&fits(hall)?hall:undefined,'payBill','Take care of the household contribution',{bill:bill.id});
  if(errand)return errand;
 }
 if(job.product&&(self.assets.inventory[job.product]||0)>2&&elapsed-memory.lastSale>400){
  const shop=nearest(p=>p.capabilities.includes('sell')&&p.distance<=35&&fits(p));
  if(shop)return go(shop,'sell','Deliver today’s work',{item:job.product});
 }

 // Weather: rain sends breaks under cover; snow does so in the evening or when restless.
 if(wet){
  const indoors=weatherShelter(here)?here:nearest(p=>p.kind!=='home'&&weatherShelter(p)&&p.capabilities.includes('visit')&&fits(p));
  if(weather==='rain'||hour>=18||needs.recreation<55){
   if(breakDue&&needs.energy<60)return go(indoors?.capabilities.includes('rest')?indoors:home,'rest','Warm up under cover');
   const shelter=go(indoors||home,indoors?'visit':'rest',weather==='rain'?'Spend the break under cover':'Warm up indoors');
   if(shelter||here===home)return shelter;
  }
 }
 const evening=self.schedule.find(s=>s.start===19);
 if(evening&&hour>=19&&hour<20.75&&elapsed-memory.lastLeisure>90){
  const planned=places.find(p=>p.id===evening.target&&fits(p));
  const outing=go(planned,evening.tool,evening.label);
  if(outing)return outing;
 }
 const restockHour=8+variation(day+193,self.id)*3;
 if(!(bus&&hour>=bus.afternoon)&&hour>=restockHour&&(self.assets.inventory.meal||0)<2&&self.money>=MEAL_COST&&elapsed-memory.lastPurchase>180){
  const shop=nearest(p=>p.sellsMeals&&isOpen(p.hours,hour)&&fits(p));
  if(shop)return go(shop,'buy','Restock the lunch bag');
 }
 if(hour<8||hour>=20.75)return here===home?null:go(home,'rest','A quiet moment at home');
 if(needs.energy<TIRED&&elapsed-memory.lastBreak>85){
  const seat=weather==='snow'?nearest(p=>weatherShelter(p)&&p.capabilities.includes('rest')&&fits(p)):nearest(p=>p.interaction?.activity==='sit'&&p.distance<18&&fits(p));
  return go(seat||home,'rest','Rest before the next errand');
 }
 if(needs.recreation<LOW_RECREATION&&elapsed-memory.lastLeisure>90){
  const social=nearest(p=>p.interaction?.activity==='sit'&&p.participants.length>0&&p.distance<25&&fits(p));
  const activity=social||nearest(p=>p.interaction?.activity===self.personality.favourite&&
   p.interaction.minParticipants===1&&p.distance<35&&fits(p));
  if(activity)return go(activity,'visit','Spend time at a favourite place');
 }
 return here===home?null:go(home,'rest','Return home between plans');
}
