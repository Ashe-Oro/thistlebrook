// Shared by registry records and follow cards; asset keys stay in metadata.
export const readableAssetName=asset=>String(asset).split('/').at(-1).replace(/^(cv|farm|nat)-/,'').replaceAll('_',' ').replaceAll('-',' ').toLowerCase();
export function activityCopy(activity,asset){
 const name=readableAssetName(asset);
 return ({sit:'Taking a seat on the '+name,eat:'Sharing tea at the '+name,browse:'Browsing the '+name,sort:'Sorting the harvest','warm-hands':'Warming hands at the campfire','play-music':'Playing the taiko drum',water:'Tending the garden',inspect:'Taking a closer look',work:'Tending the '+name})[activity]||'A moment by the '+name;
}
export const mealCopy=hour=>hour>=5&&hour<11?'Enjoying breakfast':hour>=11&&hour<16?'Enjoying lunch':hour>=16&&hour<22?'Enjoying supper':'Enjoying a late snack';
export function walkingCopy(place){
 if(place.interaction)return 'Heading over · '+place.interaction.label;
 if(place.asset&&place.kind==='prop')return 'Walking to the '+readableAssetName(place.asset);
 return 'Walking to '+place.name;
}
