import { FAIR_DAYS, fairSchedule } from '../compiler/astra-fair.js';
import './fair.css';
export function installFairUI(ui,actions){
  const tab=document.createElement('button');tab.dataset.view='fair';tab.textContent='Merrymead Park';tab.addEventListener('click',()=>actions.view('fair'));ui.root.querySelector('.view-tabs').append(tab);
  const dayButton=document.createElement('button');dayButton.id='fair-day';dayButton.textContent='Fri';dayButton.title='Advance the day of the week';dayButton.setAttribute('aria-label','Advance day of week');
  dayButton.addEventListener('click',()=>actions.day());ui.root.querySelector('.control-bar').insertBefore(dayButton,ui.root.querySelector('#resident'));
  const dayLabel=ui.root.querySelector('.clock small');
  return {update(day,hour){
    dayButton.textContent=FAIR_DAYS[day].slice(0,3);dayLabel.textContent=FAIR_DAYS[day].toUpperCase()+' · EARLY SUMMER';
    if(ui.root.querySelector('[data-view="fair"].active')){
      const status=fairSchedule(day,hour);
      ui.moment(status.concert?'A set on the listening lawn':status.peak?'A whole afternoon at the fair':status.open?'One more turn above the trees':'A quiet walk by Willow Pond',status.concert?'The bandshell is playing. There is room for another picnic.':status.open?'Skywheel, painted ponies, lemonade. Open until 10pm.':'Rides open at 11am on weekends and 3pm on weekdays.');
    }
  }};
}
