import { STARBASE_VIEWS, CYCLE } from './starbase-flight.js';
import './starbase.css';
export function mountStarbaseUI(root,actions){
 const tab=document.createElement('button');tab.dataset.view='starbase';tab.textContent='Starbase Texas';tab.onclick=()=>actions.view('starbase');root.querySelector('.view-tabs').append(tab);
 const panel=document.createElement('section');panel.className='starbase-panel glass';panel.setAttribute('aria-label','Starbase flight operations');panel.hidden=true;
 panel.innerHTML='<div class="starbase-kicker"><span></span> GULF COAST · FLIGHT OPERATIONS</div><h2>From Texas, to the stars.</h2><p class="starbase-phase"></p><div class="starbase-detail"></div><div class="starbase-track"><i></i></div><nav aria-label="Starbase views"><button data-sb="launch">Launch tower</button><button data-sb="recovery">Landing zones</button><button data-sb="offshore">Drone ship</button><button data-sb="starfactory">Starfactory</button><button data-sb="starbase">Whole coast</button></nav><small>2 launch pads · 2 landing zones · 1 drone ship</small>';
 root.append(panel);panel.querySelectorAll('[data-sb]').forEach(b=>b.onclick=()=>actions.view(b.dataset.sb));
 return {update(starbase,controls){const visible=controls.target.x>85;panel.hidden=!visible;root.classList.toggle('at-starbase',visible);tab.classList.toggle('active',visible);if(!visible)return;const s=starbase.audit();panel.querySelector('.starbase-phase').textContent=s.title;panel.querySelector('.starbase-detail').textContent=s.detail;panel.querySelector('.starbase-track i').style.width=(s.t/CYCLE*100)+'%';}};
}
export { STARBASE_VIEWS };
