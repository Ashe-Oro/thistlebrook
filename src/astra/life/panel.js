import './panel.css';
const time=h=>`${Math.floor(h)%12||12}${h<12?'am':'pm'}`;
/** Small live extension to the existing resident card; no new global HUD. */
export function createLifePanel(ui,residents){
 const card=ui.root.querySelector('.card'),panel=document.createElement('div');panel.className='life-panel';card.querySelector('.follow').before(panel);
 let stamp='',last=-1;
 return {update(selected,elapsed){
  const visible=selected?.context&&card.classList.contains('open')&&card.querySelector('h2').textContent===selected.name;
  panel.hidden=!visible;card.classList.toggle('life-card',!!visible);if(!visible)return;
  if(stamp===selected.name&&elapsed-last<.5)return;stamp=selected.name;last=elapsed;
  const c=selected.context,life=residents.life;
  card.querySelector('p').textContent=selected.story;
  panel.replaceChildren();
  const label=document.createElement('div');label.className='life-label';label.textContent='TODAY, AT THEIR PACE';panel.append(label);
  const needs=document.createElement('div');needs.className='life-needs';panel.append(needs);
  for(const [key,title,invert]of [['energy','Energy',false],['hunger','Fed',true],['recreation','Leisure',false]]){
   const wrap=document.createElement('div'),text=document.createElement('span'),meter=document.createElement('meter');text.textContent=title;meter.min=0;meter.max=100;meter.value=invert?100-c.needs[key]:c.needs[key];meter.setAttribute('aria-label',title);wrap.append(text,meter);needs.append(wrap);
  }
  const next=c.schedule.filter(s=>s.end>life.hour&&s.start>=8).sort((a,b)=>a.start-b.start).slice(0,3);
  const timeline=document.createElement('ol');timeline.className='life-itinerary';
  for(const s of next){const li=document.createElement('li'),when=document.createElement('span'),what=document.createElement('div');when.textContent=time(s.start);what.textContent=s.label;li.append(when,what);timeline.append(li);}panel.append(timeline);
  const history=selected.actor.history.filter(e=>e.status==='completed'&&e.tool!=='walkTo').slice(-1)[0];
  if(history){const note=document.createElement('div');note.className='life-note';note.textContent='Earlier · '+history.detail;panel.append(note);}
 }};
}
