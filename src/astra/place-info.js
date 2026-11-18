const stories={
 'Flour & Fern':'Mabel opens the shutters early. Warm loaves leave the bakery throughout the morning.',
 'The Copper Kettle':'Rose keeps a warm table at the village inn. A place to eat, rest and begin the walk home.',
 'The Little Mill':'Grain from the surrounding farms becomes tomorrow’s bread. The sails turn above the lane.',
 'Bram’s Workshop':'Tools, repairs and careful metalwork beside Willowbank’s main lane.',
 'Thistlebrook Provisions':'Everyday supplies, packed lunches and a stop between errands.',
 'Sunrise Bakehouse':'Warm rolls in the morning, something sweet after school. The counter faces Main Street.',
 'Sole & Stitch':'Shoes for every walk around town, with repairs done at the back.',
 'The Reading Room':'An independent bookshop with a shelf for local stories.',
 'Corner Cup Café':'A favourite table overlooking the fountain.',
 'Petal & Stem':'Flowers for ordinary Tuesdays and very important Saturdays.',
 'Thistlebrook Town Hall':'Where this growing town makes its plans.',
 'The Post Office':'Letters, parcels and postcards from somewhere else.',
 'The Nightjar':'A little bar with a long playlist. The outside tables fill up as the lamps come on.',
 'The Lantern Room':'Dinner with friends, then a walk down to the riverside music.',
 'Moonrise Gelateria':'Scoops of strawberry, pistachio and a place to linger by the quay.',
};
const venues={school:'Classrooms, a clock tower and paths to every playing field. Students gather before lessons and practice.',baseball:'Bases, a pitching mound, outfield fence and a backstop. Neighbours arrive along the paths for batting practice.',football:'Home of the Thistlebrook Owls. Marked end zones, a scoreboard, bleachers and evening floodlights.',fountain:'People stop at the fountain between the bakery, shops and town hall.',tennis:'A rally on the common, with courtside seats for a slower afternoon.',basketball:'A pickup game on the neighbourhood court.',playground:'Swings, a slide and a busy little sandpit.',music:'The riverside stage comes alive after five.'};
export function placeInfo(record,town){
 const district=town.districts.find(d=>d.id===record.district)?.name||'Thistlebrook';
 return {name:record.name||'Around Thistlebrook',badge:district,story:record.description||record.story||stories[record.name]||venues[record.type]||(record.kind==='home'?'A home beside the lane, with neighbours heading out for work and returning after their errands.':`A place to visit in ${district}. Follow the paths to explore this part of town.`)};
}
