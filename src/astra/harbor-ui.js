import './harbor.css';

export function installHarborUI(ui,actions,town) {
  const nav=ui.root.querySelector('.view-tabs'),tab=document.createElement('button');
  tab.dataset.view='harbor';tab.textContent='Saltwind Harbor';tab.onclick=()=>actions.view('harbor');nav.append(tab);
  const view=ui.view;
  ui.view=name=>{view(name);const active=nav.querySelector('.active');if(active)nav.scrollLeft=Math.max(0,active.offsetLeft-nav.clientWidth/2+active.offsetWidth/2);};
  const dawn=document.createElement('button');dawn.id='harbor-dawn';dawn.textContent='6am';
  dawn.title='Dawn fishing';dawn.setAttribute('aria-label','Dawn fishing');dawn.onclick=()=>actions.hour(6.2);
  ui.root.querySelector('#day').before(dawn);
  ui.root.querySelector('.live span:last-child').textContent=`${town.districts.length} districts. One town coming to life.`;
  // The clock already updates every frame; local happenings follow the camera,
  // so the new district needs no changes to the shared town event list.
  const clock=ui.clock;
  ui.clock=hour=>{
    clock(hour);dawn.classList.toggle('active',hour>=5&&hour<7);
    if(window.__astra?.controls.target.z>34){
      const [title,detail]=hour>=5&&hour<9?['First light, first catch','Fishing lines out. A quiet start on Gullwatch Pier.']
        :hour>=9&&hour<12?['The catch is coming ashore','Wooden crates make their way to the fish market.']
        :hour>=12&&hour<18?['A long afternoon by the sea','A swim in Shell Cove, then a walk along the boardwalk.']
        :['Saltwind Light is turning','The boats settle at their moorings. The keeper makes a round.'];
      ui.moment(title,detail);
    }
  };
}
