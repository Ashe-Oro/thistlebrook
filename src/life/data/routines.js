// Hour, destination, tool, activity: all destinations are symbolic.
export const DAILY = [
 [0,'home','rest','home'],[6.5,'home','eat','breakfast'],[7,'work','work','work'],
 [12,'tavern','eat','eat'],[13.5,'work','work','work'],[16,'plaza','visit','stroll'],
 [18,'tavern','eat','supper'],[19.5,'home','payBill','housekeeping'],[20,'home','rest','home'],
];
export const PROFILES = {
 baker: ['generous early bird','kneading tomorrow’s bread','blacksmith','friend','Saved you the crusty end.'],
 blacksmith: ['quiet perfectionist','shaping a gate hinge','baker','friend','And I fixed your oven latch.'],
 innkeeper: ['warm gossip','setting the supper tables','child','family','Pip, save room for supper!'],
 shopkeeper: ['careful optimist','counting jars on the shelf','merchant','rival','Your apples look almost as good as mine.'],
 merchant: ['competitive charmer','arranging the market display','shopkeeper','rival','Almost? Have a taste, Finn.'],
 miller: ['patient storyteller','checking the mill sails','elder','friend','The wind finally turned, Ada.'],
 farmhand: ['cheerful daydreamer','sorting the harvest','herbalist','crush','I picked these flowers for you.'],
 carpenter: ['practical and playful','smoothing a new stool','blacksmith','friend','Hold this while I mark the joint?'],
 child: ['restless and curious','practising sums','innkeeper','family','One more game before supper?'],
 elder: ['wry village historian','mending a neighbour’s shawl','miller','friend','That mill has outlasted three mayors.'],
 herbalist: ['gentle observer','bundling mint and thyme','farmhand','crush','They’ll brighten my windowsill.'],
 watch: ['dutiful night owl','checking lamp wicks','elder','friend','I’ll keep your lane bright tonight.'],
};
export const OVERRIDES = {
 baker:[[5.5,'work','work','first loaves'],[10,'work','sell','bread counter']],
 blacksmith:[[14,'work','work','forge repairs']],
 innkeeper:[[11,'work','work','prepare lunch'],[18,'work','sell','supper service'],[21,'home','rest','home']],
 shopkeeper:[[10,'work','sell','shop counter']], merchant:[[10,'work','sell','market counter']],
 miller:[[6,'work','work','mill inspection']], farmhand:[[6,'work','work','early harvest']],
 carpenter:[[10,'market','buy','shop']], child:[[11,'plaza','visit','play'],[14,'plaza','visit','play']],
 elder:[[8,'plaza','rest','morning air']], herbalist:[[10,'market','sell','herb stall']],
 watch:[[7,'home','rest','late sleep'],[16,'work','work','trim lamp wicks'],[19.5,'plaza','work','light the lamps'],[20,'plaza','work','lantern patrol'],[23,'home','rest','home']],
};
export const MEETINGS = [
 {hour:16.25,end:17.25,roles:['farmhand','herbalist'],type:'chat',place:'plaza'},
 {hour:17.3,end:18,roles:['shopkeeper','merchant'],type:'chat',place:'market'},
 {hour:18.5,end:19.25,roles:['innkeeper','child'],type:'chat',place:'tavern'},
];
export const VARIATIONS = [
 {weekdays:['sat','sun'],hour:14,place:'plaza',tool:'visit',activity:'weekend gathering'},
 {weather:['rain','fog'],hour:16,place:'tavern',tool:'visit',activity:'sheltering with neighbours'},
];
export const AMBIENT = {clear:['Lovely light on the roofs today.','A fine day for a walk.'],rain:['Come warm up at the inn.','The gardens needed this rain.'],fog:['Mind the lane in this mist.','Listen! The mill is turning.'],snow:['Snow on the roofs already.','Come inside and warm up.'],overcast:['Looks like a quiet afternoon.','Shall we meet after work?']};
// Canonical names from INTERFACES.md; aliases disappear with the registry fallback.
export const PLACE_ALIASES = [
 ['baker','bakery','cv-bakery','The Flour & Fern'],
 ['blacksmith','smithy','cv-blacksmith',"Bram's Workshop"],
 ['innkeeper','tavern','cv-tavern','The Copper Kettle'],
 ['shopkeeper','store','cv-store','Willowmere Provisions'],
 ['merchant','market-hall','cv-market-hall','Market Hall'],
 ['miller','windmill','cv-windmill','Windmill'],
 ['herbalist','chapel','cv-chapel','Chapel'],
 ['farmhand','farm','farm-produce-stand','Farm'],
];
export const ACTION_LINES = {
 eat:['Warm bread and a quiet moment.','Save me a bowl of soup!'],
 buy:['A loaf and some nails, please.','Just the supplies on my list.'],
 sell:['Fresh stock! Come have a look.','I saved the best for today.'],
 payBill:['That’s the household list done.','Must mend that latch tomorrow.'],
 rest:['Time to put my feet up.','Home at last.'],
};
