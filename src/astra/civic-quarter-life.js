// Deterministic authored vignettes share the town clock and pause/speed controls.
// They are not a city-wide emergency or healthcare simulation.
export const FIRE_ROUTE = [[-88,-84],[-88,-77],[-80,-77],[-80,-52],[-89,-52]];
export const DELIVERY_ROUTE = [[-71,-79],[-71,-77],[-80,-77],[-80,-33],[-78,-33],[-78,-18]];
export const STORY_ROUTE = [[-52,-82],[-52,-77],[-80,-77],[-80,-54],[-70,-54],[-70,-42],[-60,-42],[-60,-46]];
export function sampleRoute(points, fraction) {
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  let distance=Math.max(0,Math.min(1,fraction))*lengths.reduce((a,b)=>a+b,0);
  for(let i=0;i<lengths.length;i++) {
    if(distance<=lengths[i]||i===lengths.length-1) {
      const a=points[i],b=points[i+1],u=distance/(lengths[i]||1);
      return {x:a[0]+(b[0]-a[0])*u,z:a[1]+(b[1]-a[1])*u,heading:Math.atan2(b[0]-a[0],b[1]-a[1])};
    }
    distance-=lengths[i];
  }
  return {x:points[0][0],z:points[0][1],heading:0};
}
export function civicLifeState(t,hour) {
  const cycle=((t%110)+110)%110;
  const phase=cycle<16?'ready':cycle<40?'responding':cycle<56?'assisting':cycle<80?'returning':'ready';
  const fireProgress=phase==='responding'?(cycle-16)/24:phase==='assisting'?1:phase==='returning'?1-(cycle-56)/24:0;
  return {cycle,phase,fireProgress,fireVisible:cycle>=16&&cycle<49,waterVisible:cycle>=40&&cycle<54,
    libraryOpen:hour>=8&&hour<19,storyTime:hour>=15&&hour<18,parkOpen:hour>=6&&hour<21,deliveryActive:hour>=8&&hour<16};
}
