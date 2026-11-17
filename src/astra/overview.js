// Fit the irregular island at any viewport or quarter-turn heading. Use its
// actual silhouette plus building headroom, leaving room for the town controls.
export function overview(town,width,height,heading) {
 const sin=Math.sin(heading),cos=Math.cos(heading),rise=1/Math.sqrt(3),level=Math.sqrt(2/3);
 const points=(town.worldOutline||town.outline).flatMap(([x,z])=>[0,13].map(y=>[cos*x-sin*z,-rise*(sin*x+cos*z)+level*y]));
 const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
 const minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2,half=Math.max(70,108/(width/height));
 return {x:cos*cx-sin*cy/rise,z:-sin*cx-cos*cy/rise,zoom:Math.min(2*half*(width/height)*.88/(maxX-minX),2*half*((height-240)/height)/(maxY-minY))};
}
