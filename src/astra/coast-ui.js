import {COAST_VIEWS} from './coast-plan.js';
export function mountCoastUI(root,actions){
  const tab=document.createElement('button');tab.dataset.view='coast';tab.textContent='Coral Coast';tab.onclick=()=>actions.view('coast');root.querySelector('.view-tabs').append(tab);
  const panel=document.createElement('nav');panel.className='coast-views glass';panel.setAttribute('aria-label','Coral Coast views');panel.hidden=true;
  for(const [view,name]of [['coast','Coral Coast'],['beach','Beach & surf'],['strip','Ocean Drive']]){const b=document.createElement('button');b.textContent=name;b.onclick=()=>actions.view(view);panel.append(b);}
  root.append(panel);
  const style=document.createElement('style');style.textContent='.coast-views{position:absolute;right:40px;top:114px;padding:5px;display:flex;gap:3px;pointer-events:auto}.coast-views[hidden]{display:none}.coast-views button{border:0;border-radius:10px;background:transparent;padding:10px 12px;font-size:11px}.coast-views button:hover{background:#e4eee5}@media(max-width:600px){.coast-views{top:103px;right:20px;left:20px;justify-content:center}.coast-views button{padding:8px 12px}}';document.head.append(style);
  return {update(controls,hour,ui){const active=controls.target.x>66;panel.hidden=!active;tab.classList.toggle('active',active);if(!active)return;root.classList.add('exploring');ui.moment(hour>=17?'Ocean Drive, after dark':'A long afternoon on Coral Beach',hour>=17?'Neon signs, rooftop tables, and one more walk along the sea.':'A rally in the sand. A swim in the shallows. Lunch under the palms.');}};
}
export {COAST_VIEWS};
