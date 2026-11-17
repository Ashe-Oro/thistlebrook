// District authors work in local coordinates. These placements are shared by
// compilation, rendering and camera presets so relocating a district is atomic.
export const DISTRICT_OFFSETS = { works: [0, -70], sunbeam: [-65, 0] };
export const movePoint = (p, offset) => [p[0] + offset[0], p[1] + offset[1]];
export const moveBox = (box, offset) => ({min:movePoint(box.min,offset),max:movePoint(box.max,offset)});
export function moveParcel(parcel, offset) {
 const result={...parcel,box:moveBox(parcel.box,offset)};
 for(const key of ['pos','entry','access','door','approach','join'])if(parcel[key])result[key]=movePoint(parcel[key],offset);
 return result;
}
export function placeDistrict(town, district, roadStart) {
 const offset=DISTRICT_OFFSETS[district];
 for(const key of ['buildings','venues'])town[key]=town[key].map(p=>p.district===district?moveParcel(p,offset):p);
 // Keep the roads array identity: the compiler's road helper closes over it.
 for(const r of town.roads.slice(roadStart)){r.a=movePoint(r.a,offset);r.b=movePoint(r.b,offset);}
 const d=town.districts.find(d=>d.id===district);d.center=movePoint(d.center,offset);
 if(district==='works'){
  town.workRail={minX:town.workRail.minX+offset[0],maxX:town.workRail.maxX+offset[0],z:town.workRail.z+offset[1]};
  town.workstations.forEach(s=>s.entry=movePoint(s.entry,offset));
 }
}
