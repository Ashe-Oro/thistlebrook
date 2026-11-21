import {Box3, Matrix4, Vector3, DynamicDrawUsage} from 'three';

/** Keep one draw per model part while submitting only visible placements.
 * Cells preserve the original placement order within each occupied area. */
export function sceneryVisibility() {
 const batches = [];
 const matrix = new Matrix4(), bounds = new Box3(), margin = new Vector3(.4,.4,.4);

 function add(mesh, members) {
  const source = mesh.instanceMatrix.array.slice(), cells = new Map();
  for (let i=0;i<members.length;i++) {
   const [x,z]=members[i].pos;
   const key=Math.floor(x/12)+','+Math.floor(z/12);
   let cell=cells.get(key);
   if (!cell) cells.set(key,cell={slots:[],box:new Box3(),visible:true});
   cell.slots.push(i);
  }
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled=false;
  batches.push({mesh,source,cells:[...cells.values()],geometry:null,ids:null});
 }

 function update(view, shadow) {
  for (const batch of batches) {
   const {mesh,source,cells}=batch;
   // Some assemblies tag their meshes after the culling cells are created.
   const ids=batch.ids??=mesh.userData.registryIds.slice();
   let changed=batch.geometry!==mesh.geometry;
   if (changed) {
    const geometry=batch.geometry=mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    for (const cell of cells) {
     cell.box.makeEmpty();
     for (const index of cell.slots) {
      matrix.fromArray(source,index*16);
      cell.box.union(bounds.copy(geometry.boundingBox).applyMatrix4(matrix));
     }
     cell.box.expandByVector(margin);
    }
   }
   let count=0;
   for (const cell of cells) {
    const visible=view.intersectsBox(cell.box)||Boolean(shadow&&mesh.castShadow&&shadow.intersectsBox(cell.box));
    changed ||= visible!==cell.visible;
    cell.visible=visible;
    if (visible) count+=cell.slots.length;
   }
   if (!changed) continue;
   const target=mesh.instanceMatrix.array, targetIds=mesh.userData.registryIds;
   let write=0,hidden=count;
   if(count===ids.length){
    target.set(source);
    for(let i=0;i<count;i++)targetIds[i]=ids[i];
    write=target.length;
   }else{
    for(const cell of cells)for(const index of cell.slots){
     if(!cell.visible){
      targetIds[hidden++]=ids[index];
      continue;
     }
     targetIds[write/16]=ids[index];
     const start=index*16;
     for(let i=0;i<16;i++)target[write++]=source[start+i];
    }
   }
   mesh.count=count;
   mesh.visible=count>0;
   mesh.instanceMatrix.clearUpdateRanges();
   if (write) {
    mesh.instanceMatrix.addUpdateRange(0,write);
    mesh.instanceMatrix.needsUpdate=true;
   }
  }
 }
 return {add,update};
}
