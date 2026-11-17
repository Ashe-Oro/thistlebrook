export const lifeEnabled=q=>q.get('life')==='1'||q.get('village')==='1';
export async function createLife(stage,town,q){
 if(!town.life)return null;
 // Atmosphere, routines, interiors, and props hooks live in iso-life.js.
 return (await import('./iso-life.js')).createIsoLife(stage,town,q); // WORKTREE-HOOK iso — life is orthographic only
}
