// Broad-phase index for planar placement checks. The exact test still uses
// the authored bounds, including each caller's clearance tolerance.
export function indexBoxes(boxes, bounds = box => box, cellSize = 16) {
 const cells = new Map();
 const cell = value => Math.floor(value / cellSize);
 for (const item of boxes) {
  const {min, max} = bounds(item);
  for (let x = cell(min[0]); x <= cell(max[0]); x++) {
   for (let z = cell(min[1]); z <= cell(max[1]); z++) {
    const key = x + ',' + z;
    let items = cells.get(key);
    if (!items) cells.set(key, items = []);
    items.push(item);
   }
  }
 }
 return (box, pad, matches) => {
  const {min, max} = box;
  for (let x = cell(min[0] - pad); x <= cell(max[0] + pad); x++) {
   for (let z = cell(min[1] - pad); z <= cell(max[1] + pad); z++) {
    const items = cells.get(x + ',' + z);
    if (items?.some(matches)) return true;
   }
  }
  return false;
 };
}

export const indexSegments=(segments,ends=segment=>segment)=>indexBoxes(segments,segment=>{
 const [a,b]=ends(segment);
 return {min:[Math.min(a[0],b[0]),Math.min(a[1],b[1])],max:[Math.max(a[0],b[0]),Math.max(a[1],b[1])]};
});
