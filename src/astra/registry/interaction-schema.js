// Version-1 contract copied from village/astra-life; keep in sync at merge.
export const TOOLS = Object.freeze(['walkTo','talkTo','work','buy','sell','payBill','rest','eat','visit']);
export const ACTIVITIES = Object.freeze(['sit','picnic','chess','baseball','browse','work','sleep','ride','queue','play','watch']);
export const ANIMATIONS = Object.freeze(['sit','eat','chess','pitch','bat','field','work','idle']);
export const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
export const isOpen = (hours,h) => hours[0]===0&&hours[1]===24 || (hours[0]<hours[1] ? h>=hours[0]&&h<hours[1] : h>=hours[0]||h<hours[1]);
const point = p => Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);

/** Fail closed: malformed metadata cannot reserve a seat or move a resident. */
export function interactionErrors(value,town) {
 const errors=[];
 if(!value||value.version!==1)return ['interaction.version must be 1'];
 if(!ACTIVITIES.includes(value.activity))errors.push('unknown activity');
 if(typeof value.label!=='string'||!value.label.trim())errors.push('missing label');
 if(!Array.isArray(value.tools)||!value.tools.length||value.tools.some(t=>!TOOLS.includes(t)||t==='talkTo'||t==='walkTo'))errors.push('invalid activity tools');
 if(!Number.isFinite(value.duration)||value.duration<2||value.duration>600)errors.push('duration must be 2..600 seconds');
 if(!Number.isInteger(value.entryNode)||!town.nodes[value.entryNode])errors.push('entryNode is missing from navigation');
 if(!Array.isArray(value.approach)||!value.approach.every(point))errors.push('invalid approach');
 if(!Array.isArray(value.hours)||value.hours.length!==2||!value.hours.every(Number.isFinite)||value.hours[0]<0||value.hours[0]>=24||value.hours[1]<0||value.hours[1]>24||value.hours[0]===value.hours[1])errors.push('invalid hours');
 if(!Array.isArray(value.slots)||!value.slots.length)return [...errors,'missing slots'];
 if(!Number.isInteger(value.minParticipants)||value.minParticipants<1||value.minParticipants>value.slots.length)errors.push('invalid minParticipants');
 const ids=new Set();
 for(const s of value.slots){
  if(!s||typeof s!=='object'){errors.push('invalid slot record');continue;}
  if(!s.id||ids.has(s.id))errors.push('slot IDs must be unique');ids.add(s.id);
  if(!['seat','standing','player'].includes(s.kind)||!point(s.position)||!Number.isFinite(s.facing)||!ANIMATIONS.includes(s.animation))errors.push('invalid slot pose');
  if(s.kind==='seat'&&(!Number.isFinite(s.seatHeight)||s.seatHeight<0||s.seatHeight>2))errors.push('seat needs seatHeight');
  if(!Array.isArray(s.approach)||!s.approach.every(point))errors.push('invalid slot approach');
 }
 for(let a=0;a<value.slots.length;a++)for(let b=a+1;b<value.slots.length;b++){const p=value.slots[a]?.position,q=value.slots[b]?.position;if(point(p)&&point(q)&&distance(p,q)<.5)errors.push('interaction slots overlap');}
 if(value.minParticipants>1&&!['chess','baseball'].includes(value.activity))errors.push('this activity supports independent participants only');
 if(value.activity==='chess'&&(value.slots.length!==2||value.minParticipants!==2||!['white','black'].every(role=>value.slots.some(s=>s?.role===role))))errors.push('chess needs white and black slots');
 if(value.activity==='baseball'&&(value.slots.length!==3||value.minParticipants!==3||!value.game||!Array.isArray(value.game.bases)||value.game.bases.length!==4||!value.game.bases.every(point)||!point(value.game.mound)||!point(value.game.field)||!['pitcher','batter','fielder'].every(role=>value.slots.some(s=>s?.role===role))||value.minParticipants<3))errors.push('baseball needs a diamond and three player roles');
 return errors;
}
