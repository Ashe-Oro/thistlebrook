// Appearance only: the life cast keeps its twelve original ids and roles.
export const TOWNSFOLK_VARIANTS = [
 ['baker','chunky','curly-bob','chef-hat','apron','long-skirt','#c48c60','#eee0bb','#754632'],
 ['blacksmith','hero','short-crop',null,'vest','breeches','#596f78','#b28e65','#382c29'],
 ['innkeeper','vanilla','braids',null,'vest','long-skirt','#a85768','#e2bd83','#613b2a'],
 ['shopkeeper','vanilla','side-part','flat-cap','tunic','trousers','#4f8c80','#d8b87b','#2d2522'],
 ['merchant','chunky','ringlets','beret','vest','long-skirt','#ac7745','#546b75','#6a3d27'],
 ['miller','hero','short-crop','flat-cap','tunic','breeches','#b4ad8b','#76583b','#95704b'],
 ['farmhand','vanilla','braids','straw-hat','tunic','overalls','#6f8c59','#d4b181','#9e632d'],
 ['carpenter','hero','messy',null,'vest','trousers','#9a6845','#c5ac7b','#513329'],
 ['child','chunky','curly-bob',null,'tunic','shorts','#cc754d','#edcd78','#754b2f'],
 ['elder','vanilla','bun',null,'tunic','long-skirt','#8b7396','#d6c6ad','#beb6a7'],
 ['herbalist','vanilla','long-straight',null,'apron','long-skirt','#718e70','#dacb9e','#4b3026'],
 ['watch','hero','side-part','flat-cap','vest','breeches','#465e78','#bd9558','#47352d'],
].map(([role,style,hair,headgear,top,bottoms,color,trim,hairColor])=>({
 id:`townsfolk-${role}`, variantId:`variety-${role}`, role, style,color,trim,hairColor,
 height:role==='child'?1.12:role==='elder'?1.58:1.72,
 outfit:{hair,...(headgear?{headgear}:{}),tops:top==='apron'?['tunic','apron']:top,bottoms,shoes:'boot',...(role==='elder'?{accessories:'glasses'}:{})},
 path:`licensed/characters/variety/${role}.glb`,
}));
