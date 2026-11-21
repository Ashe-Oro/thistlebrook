// Fit the irregular island at any viewport or quarter-turn heading. Use its
// actual silhouette plus building headroom, leaving room for the town controls.
export function overview(town,width,height,heading) {
 const sin=Math.sin(heading),cos=Math.cos(heading),rise=1/Math.sqrt(3),level=Math.sqrt(2/3);
 const points=(town.worldOutline||town.outline).flatMap(([x,z])=>[0,13].map(y=>[cos*x-sin*z,-rise*(sin*x+cos*z)+level*y]));
 const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
 const minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2,half=mapHalfHeight(width/height);
 return {x:cos*cx-sin*cy/rise,z:-sin*cx-cos*cy/rise,zoom:Math.min(2*half*(width/height)*.88/(maxX-minX),2*half*((height-240)/height)/(maxY-minY))};
}
export function mapHalfHeight(aspect) {
 return Math.max(70,108/aspect);
}

export function townOpening(town,width,height) {
 const [x,z]=town.districts.find(district=>district.id==='market').center;
 const aspect=width/height;
 // Frame the square with the houses and streets behind it. Wider screens
 // take in the adjoining blocks from the same focal point.
 const span=Math.max(45,Math.min(96,width/10));
 return {x:x-19,z:z-19,zoom:Math.min(4.8,2*mapHalfHeight(aspect)*aspect/span)};
}

export function isTownOpening(view,home) {
 return view.x===home.x&&view.z===home.z&&Math.abs(view.zoom-home.zoom)<.0001;
}

// Test scenery centres against the camera, with room for large trees and shadows.
export function openingSceneryWindow(view,aspect) {
 const heading=Math.PI/4+(view.rotation??0)*Math.PI/2;
 const sin=Math.sin(heading),cos=Math.cos(heading);
 const half=mapHalfHeight(aspect)/view.zoom;
 return ({pos:[x,z],y=0})=>{
  const dx=x-view.x,dz=z-view.z;
  return Math.abs(cos*dx-sin*dz)<=half*aspect+12 &&
   Math.abs(Math.sqrt(2/3)*y-(sin*dx+cos*dz)/Math.sqrt(3))<=half+12;
 };
}
