// Authoring choices only; owned geometry is generated into gitignored licensed/.
export const VILLAGERS = [
  { role:'merchant', name:'Indigo Merchant', style:'vanilla', color:'#283e70', trim:'#cbb57b', outfit:{hair:'ponytail-low',tops:'robe',bottoms:'breeches',shoes:'sandals',outerwear:'satchel'} },
  { role:'samurai', name:'Takeda Samurai', style:'hero', color:'#202b40', trim:'#8799ac', outfit:{hair:'topknot',tops:'tunic',bottoms:'long-skirt',shoes:'sandals'} },
  { role:'monk', name:'Saffron Monk', style:'vanilla', color:'#b97c29', trim:'#51392c', outfit:{hair:'bald',tops:'robe',bottoms:'long-skirt',shoes:'sandals'} },
  { role:'hostess', name:'Tea-house Hostess', style:'vanilla', color:'#b95c83', trim:'#f2d8a4', outfit:{hair:'bun',tops:'robe',bottoms:'long-skirt',shoes:'sandals'} },
  { role:'farmer', name:'Rice Farmer', style:'chunky', color:'#706d46', trim:'#bca477', outfit:{hair:'bald',headgear:'straw-hat',tops:'tunic',bottoms:'breeches',shoes:'sandals'} },
  { role:'fisherman', name:'Pond Fisherman', style:'vanilla', color:'#385f68', trim:'#a6926d', outfit:{hair:'bald',headgear:'bucket-hat',tops:'tunic',bottoms:'breeches',shoes:'sandals'} },
  { role:'child', name:'Pinwheel Child', style:'chunky', height:1.12, color:'#de6746', trim:'#f3c34b', outfit:{hair:'twintails',tops:'tunic',bottoms:'skirt',shoes:'sandals'} },
  { role:'elder', name:'Village Elder', style:'vanilla', color:'#786c7b', trim:'#b9b3aa', outfit:{hair:'bun',facialHair:'beard-long',tops:'robe',bottoms:'long-skirt',shoes:'sandals'} },
  { role:'lantern-maker', name:'Paper Lantern Maker', style:'chunky', color:'#a75b36', trim:'#dcc28e', outfit:{hair:'ponytail-high',headgear:'headband',tops:['tunic','apron'],bottoms:'breeches',shoes:'sandals'} },
  { role:'miko', name:'Shrine Maiden', style:'vanilla', color:'#f4efdf', trim:'#bc3343', outfit:{hair:'ponytail-low',tops:'tunic',bottoms:'long-skirt',shoes:'sandals'} },
  { role:'porter', name:'Shoulder-yoke Porter', style:'hero', color:'#526c77', trim:'#d3bb91', outfit:{hair:'bald',headgear:'headband',tops:'vest',bottoms:'breeches',shoes:'sandals'} },
  { role:'ronin', name:'Wandering Ronin', style:'hero', color:'#747a63', trim:'#4b423b', outfit:{hair:'topknot',facialHair:'stubble',tops:'robe',bottoms:'breeches',shoes:'sandals'} },
].map(v => ({ ...v, id:`edo-villager-${v.role}` }));
export const VILLAGER_CATALOG = VILLAGERS.map(v => ({
  id:v.id, name:v.name, tags:{category:'prop',style:['edo','villager']},
  source:'mesh',path:`licensed/characters/${v.id}.glb`,license:'tja-commercial',
  scale:1,groundY:0.15,eaveY:null,door:null,
}));
