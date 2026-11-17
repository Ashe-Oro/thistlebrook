// Geometry comes from the owned Character Model Basic + Wardrobe generator.
// Visual overrides only: roster, jobs, workplaces and schedule fields are stable.
const looks = {
 baker: {hairColor:'#78462d',skin:'#d5a078',pants:'#775848',outfit:{shoes:'dress-shoe'}},
 blacksmith: {height:1.86,hairColor:'#382c26',skin:'#a9704c',pants:'#414756',outfit:{hair:'buzz',facialHair:'beard-full',shoes:'work-boot',accessories:'gloves'}},
 innkeeper: {height:1.67,hairColor:'#a54e2c',skin:'#e4b590',pants:'#703d50',outfit:{hair:'ringlets',bottoms:'long-skirt',shoes:'dress-shoe',accessories:'necklace'}},
 shopkeeper: {height:1.76,hairColor:'#463322',skin:'#b8835d',pants:'#585a46',outfit:{hair:'side-part',headgear:'flat-cap',shoes:'boot'}},
 merchant: {height:1.60,hairColor:'#593c2c',skin:'#a76e4b',pants:'#476c72',outfit:{hair:'curly-bob',headgear:'beret',bottoms:'skirt',shoes:'boot'}},
 miller: {height:1.79,hairColor:'#c4b49a',skin:'#d5a078',pants:'#6b6355',outfit:{hair:'short-crop',facialHair:'moustache-handlebar',shoes:'work-boot'}},
 farmhand: {height:1.64,hairColor:'#c38d3f',skin:'#c48e67',pants:'#766144',outfit:{hair:'braids',bottoms:'overalls',shoes:'work-boot'}},
 carpenter: {height:1.81,hairColor:'#873e25',skin:'#d8a078',pants:'#4e635f',outfit:{hair:'messy',facialHair:'beard-short',shoes:'work-boot',accessories:'belt-pouch'}},
 child: {hairColor:'#653b25',skin:'#dbac84',pants:'#9a6a3c',outfit:{hair:'bowl',bottoms:'shorts',shoes:'boot'}},
 elder: {hairColor:'#d3cfc4',skin:'#d6aa8a',pants:'#6d596e',outfit:{bottoms:'long-skirt',shoes:'dress-shoe',outerwear:'scarf',accessories:'glasses'}},
 herbalist: {height:1.69,hairColor:'#302b25',skin:'#98633f',pants:'#596d4e',outfit:{hair:'dreadlocks',bottoms:'long-skirt',shoes:'boot',outerwear:'satchel'}},
 watch: {height:1.89,hairColor:'#777267',skin:'#c28d68',pants:'#414b61',outfit:{hair:'short-crop',headgear:'flat-cap',facialHair:'mutton-chops',shoes:'tall-boot',outerwear:'scarf'}},
};
export const TOWNSFOLK = [
 ['baker','Mabel · Baker','chunky','#e2bf8c','#fff0d0','bun','apron','cv-bakery'],
 ['blacksmith','Bram · Smith','hero','#536575','#714c35','bald','apron','cv-blacksmith'],
 ['innkeeper','Rose · Innkeeper','vanilla','#a74e56','#edc18b','bun','vest','cv-tavern'],
 ['shopkeeper','Finn · Shopkeeper','vanilla','#508d86','#d8bd78','ponytail-low','satchel','cv-store'],
 ['merchant','Hazel · Merchant','chunky','#bb793e','#476c72','ponytail-low','vest','cv-market-hall'],
 ['miller','Oswin · Miller','hero','#a8a17b','#614d39','bald','straw-hat','cv-windmill'],
 ['farmhand','Clover · Farmhand','vanilla','#658456','#d8b882','ponytail-low','straw-hat','farm-produce-stand'],
 ['carpenter','Rowan · Carpenter','hero','#94663f','#c9b494','bald','vest','cv-blacksmith'],
 ['child','Pip · Child','chunky','#d76d48','#e9cb6c','twintails','satchel','cv-market-hall'],
 ['elder','Ada · Elder','vanilla','#8c7899','#d2c7ad','bun','satchel','cv-tavern'],
 ['herbalist','Fern · Herbalist','vanilla','#6c906f','#e2d1a2','ponytail-low','apron','cv-chapel'],
 ['watch','Hugh · Lamplighter','hero','#3e526b','#c99751','bald','vest','cv-store'],
].map(([role,name,style,color,trim,hair,item,work])=>({id:`townsfolk-${role}`,role,name,style,color,trim,work,height:looks[role].height||(role==='child'?1.12:role==='elder'?1.58:1.72),hairColor:looks[role].hairColor,skin:looks[role].skin,pants:looks[role].pants,
 outfit:{hair,tops:item==='apron'?['tunic','apron']:item==='vest'?'vest':'tunic',bottoms:'breeches',shoes:'sandals',...(item==='satchel'?{outerwear:'satchel'}:{}),...(item==='straw-hat'?{headgear:item}:{}),...looks[role].outfit}}));
export const TOWNSFOLK_CATALOG=TOWNSFOLK.map(v=>({id:v.id,name:v.name,tags:{category:'prop',style:['cozy-townsfolk','villager']},source:'mesh',path:`licensed/characters/${v.id}.glb`,license:'tja-commercial',scale:1,groundY:.15,eaveY:null,door:null}));
