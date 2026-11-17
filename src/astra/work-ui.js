import { DISTRICT_OFFSETS } from '../compiler/astra-placement.js';
import './work.css';
import { workStatus } from './work-status.js';
export const WORK_VIEWS={works:{x:-80,z:-69,zoom:1.95},station:{x:-91,z:-86,zoom:3.6},gardens:{x:-96,z:-51,zoom:3.3},timber:{x:-61,z:-51,zoom:3.3},freight:{x:-60,z:-84,zoom:3.7}};
for(const view of Object.values(WORK_VIEWS)){view.x+=DISTRICT_OFFSETS.works[0];view.z+=DISTRICT_OFFSETS.works[1];}
export function mountWorkUI(root,actions){
 const tab=document.createElement('button');tab.dataset.view='works';tab.textContent='West Works';tab.onclick=()=>actions.view('works');root.querySelector('.view-tabs').append(tab);
 const panel=document.createElement('section');panel.className='work-panel glass';panel.setAttribute('aria-label','West Works activity');
 panel.innerHTML='<div class="work-kicker">THE WESTERN BRANCH</div><h2>A town at work.</h2><p>Session output · goods made since you arrived.</p><div class="work-stats"><div><strong data-stat="produce">0</strong><span>produce crates</span></div><div><strong data-stat="timber">0</strong><span>timber loads</span></div><div><strong data-stat="shipped">0</strong><span>sent by rail</span></div></div><div class="work-shift"></div><div class="work-train"></div><nav aria-label="Workplace views"><button data-work-view="station">Station ↗</button><button data-work-view="gardens">Gardens ↗</button><button data-work-view="timber">Timber yard ↗</button><button data-work-view="freight">Freight ↗</button></nav>';
 root.append(panel);panel.querySelectorAll('[data-work-view]').forEach(b=>b.onclick=()=>actions.view(b.dataset.workView));
 let previous='';
 return {update(works,controls,hour,zoom=2){
  const visible=controls.target.x>=-120&&controls.target.x<=-40&&controls.target.z>=-178&&controls.target.z<=-105&&zoom>1;panel.hidden=!visible;
  tab.classList.toggle('active',visible);if(visible&&innerWidth<600&&tab.parentElement&&tab.offsetLeft>tab.parentElement.scrollLeft+tab.parentElement.clientWidth-tab.offsetWidth)tab.parentElement.scrollLeft=tab.offsetLeft;if(!visible)return;
  const state=works.audit(),text=[Math.floor(state.produce),Math.floor(state.timber),state.shipped,state.workers,state.commuting,state.train.atPlatform,state.train.open,workStatus(state,hour)].join(':');if(previous===text)return;previous=text;
  for(const key of ['produce','timber','shipped'])panel.querySelector(`[data-stat="${key}"]`).textContent=Math.floor(state[key]);
  panel.querySelector('.work-shift').textContent=workStatus(state,hour);
  panel.querySelector('.work-train').textContent=!state.train.open?'● Last train gone · service resumes at 6am':state.train.atPlatform?'● Local at platform 01':'● Local on the branch line';
 }};
}
