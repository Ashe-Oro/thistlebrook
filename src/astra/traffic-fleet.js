// OWNER: vehicle-variety lane. Pure fleet plan (no THREE, no DOM): which owned
// pack model and body colour each town vehicle uses. Bounds, pivots and the
// body-colour hue window were measured from the individual pack GLBs
// (tools/inspect-glb.mjs); none of the files are committed (public/licensed).
//
// Conventions: every model faces +Z. City pack vehicles pivot at the rear axle
// (min z is negative), Vice Beach and Suburban ones sit roughly centre-origin,
// so seating always uses the measured box, never an assumed bottom-centre.

// Preserve the established 2.05-unit town car while using real length ratios.
export const WORLD_UNITS_PER_METRE = 2.05 / 4.5;
export const VEHICLE_LENGTH_METRES = Object.freeze({
 sedan:4.5, taxi:4.8, police:4.8, convertible:4.4, pickup:5.3, minivan:5,
 'delivery-van':5, 'box-van':6, ambulance:6, 'garbage-truck':8, 'fire-tender':8,
 'city-bus':11.5, 'school-bus':11, bicycle:1.65, 'pushback-tug':5, 'baggage-train':10, 'fuel-truck':8, 'follow-me':4.5,
 'heavy-tractor':7.5, 'rocket-trailer':13,
});

/** Owned pack vehicles. `retint` is the body hue window (degrees, measured on
 * the vertex colours); models without it keep their livery (taxi, police...). */
export const FLEET_MODELS = Object.freeze({
 'city-sedan':{name:'Sedan',class:'sedan',pack:'city',path:'licensed/city/car_sedan_01.glb',kind:'car',min:[-0.60157,0.00326,-0.7475],max:[0.60157,0.96525,2.30945],pivot:'rear-axle',retint:{hue:135,width:22}},
 'city-taxi':{name:'Taxi',class:'taxi',pack:'city',path:'licensed/city/taxi_01.glb',kind:'car',role:'taxi',min:[-0.60157,0.00326,-0.7475],max:[0.60157,1.17325,2.30945],pivot:'rear-axle'},
 'city-bus':{name:'City bus',class:'city-bus',pack:'city',path:'licensed/city/city_bus_01.glb',kind:'bus',min:[-0.9548,0,-1.1098],max:[0.9548,1.92182,3.59662],pivot:'rear-axle',retint:{hue:165,width:16}},
 'city-delivery-van':{name:'Delivery van',class:'box-van',pack:'city',path:'licensed/city/delivery_van_01.glb',kind:'van',min:[-0.91,0,-0.741],max:[0.91,1.78072,3.0914],pivot:'rear-axle'},
 'city-garbage-truck':{name:'Garbage truck',class:'garbage-truck',pack:'city',path:'licensed/city/garbage_truck_01.glb',kind:'van',role:'service',min:[-0.9114,0,-1.4136],max:[0.9114,1.66626,3.07582],pivot:'rear-axle'},
 'vb-pastel-sedan':{name:'Pastel sedan',class:'sedan',pack:'vice-beach',path:'licensed/vice-beach/pastel_sedan.glb',kind:'car',min:[-0.55575,0,-0.711],max:[0.55575,1.04533,2.1825],pivot:'rear-axle',retint:{hue:345,width:16}},
 'vb-police':{name:'Police cruiser',class:'police',pack:'vice-beach',path:'licensed/vice-beach/police_cruiser.glb',kind:'car',role:'police',min:[-0.61156,0.00609,-0.6912],max:[0.603,1.3023,2.2356],pivot:'rear-axle'},
 'vb-convertible':{name:'Convertible cruiser',class:'convertible',pack:'vice-beach',path:'licensed/vice-beach/convertible_cruiser.glb',kind:'car',min:[-0.546,-0.00336,-0.82236],max:[0.546,0.96852,2.25708],pivot:'rear-axle',retint:{hue:180,width:12}},
 'vb-sports-convertible':{name:'Sports convertible',class:'convertible',pack:'vice-beach',path:'licensed/vice-beach/white_sports_convertible.glb',kind:'car',min:[-0.5636,-0.01967,-0.63434],max:[0.5636,0.89746,2.09944],pivot:'rear-axle'},
 'sn-family-sedan':{name:'Family sedan',class:'sedan',pack:'suburban-neighborhood',path:'licensed/suburban-neighborhood/family_sedan.glb',kind:'car',min:[-0.69615,0,-1.5526],max:[0.69615,0.9576,1.56835],pivot:'centre',retint:{hue:210,width:10}},
 'sn-pickup':{name:'Family pickup',class:'pickup',pack:'suburban-neighborhood',path:'licensed/suburban-neighborhood/family_pickup.glb',kind:'car',min:[-0.74008,0,-1.76088],max:[0.74008,1.1165,1.7506],pivot:'centre',retint:{hue:0,width:14}},
 'sn-minivan':{name:'SUV minivan',class:'minivan',pack:'suburban-neighborhood',path:'licensed/suburban-neighborhood/suv_minivan.glb',kind:'car',min:[-0.7491,0,-1.5988],max:[0.7491,1.2573,1.612],pivot:'centre',retint:{hue:210,width:15,saturation:[.065,.20],value:[.20,.45]}},
 'cv-bicycle':{name:'Bicycle',class:'bicycle',pack:'cozy-village',path:'licensed/cozy-village/veh_bicycle_01.glb',kind:'cycle',min:[-0.21649,-0.00057,-0.66816],max:[0.18,0.88287,0.66816],pivot:'centre'},
 'sn-school-bus':{name:'School bus',class:'school-bus',pack:'suburban-neighborhood',path:'licensed/suburban-neighborhood/school_bus.glb',kind:'school-bus',min:[-1.15116,0,-4.02448],max:[1.15116,2.39282,4.0462],pivot:'centre'},
 'af-fire-tender':{name:'Fire tender',class:'fire-tender',pack:'airfield',path:'licensed/airfield/fuel_truck.glb',kind:'van',min:[-0.715,-0.695,-1.61799],max:[0.71505,0.69495,1.61799],pivot:'centre'},
 'rc-ambulance':{name:'Ambulance',class:'ambulance',pack:'realistic-city',path:'licensed/realistic-city/realistic_ambulance_01.glb',kind:'van',min:[-1.31109,-1.44601,-3.46421],max:[1.311,1.44596,3.46421],pivot:'centre'},
 'af-tug':{name:'Pushback tug',class:'pushback-tug',pack:'airfield',path:'licensed/airfield/pushback_tug.glb',kind:'tug',min:[-0.645,-0.725,-1.33223],max:[0.64503,0.72506,1.33223],pivot:'centre'},
 'af-fuel-truck':{name:'Fuel bowser',class:'fuel-truck',pack:'airfield',path:'licensed/airfield/fuel_truck.glb',kind:'van',role:'service',min:[-0.715,-0.695,-1.61799],max:[0.71505,0.69495,1.61799],pivot:'centre'},
 'af-follow-me':{name:'Follow-me car',class:'follow-me',pack:'airfield',path:'licensed/airfield/follow_me_car.glb',kind:'car',role:'service',min:[-0.66377,0,-1.388],max:[0.66381,1.50503,1.394],pivot:'bottom-centre'},
 'af-baggage':{name:'Baggage carts',class:'baggage-train',pack:'airfield',path:'licensed/airfield/baggage_cart_train.glb',kind:'cart',min:[-0.515,-0.545,-1.96],max:[0.51507,0.54489,1.96],pivot:'centre'},
 'farm-tractor':{name:'Heavy tractor',pack:'farm',class:'heavy-tractor',path:'licensed/farm/red_tractor.glb',kind:'tractor',min:[-.85311,-.82906,-1.425],max:[.85310,.82913,1.425],pivot:'centre'},
 'farm-rocket-trailer':{name:'Rocket trailer',pack:'farm',class:'rocket-trailer',path:'licensed/farm/tractor_trailer.glb',kind:'trailer',min:[-.92062,-.63943,-1.53277],max:[.92061,.63933,1.53277],pivot:'centre'},
});

/** Cel body colours (sRGB). Liveried models ignore them. */
export const BODY_COLOURS = Object.freeze(['#cd7358','#e9bd63','#82aa9d','#6e90a1','#e4dcc4','#b9474a','#3f6f8f','#9a7bb0']);
export const LIVERY = 'livery';

function modelFit(model, scale) {
 const {min, max} = FLEET_MODELS[model];
 return {
  scale,
  offset: [-(min[0] + max[0]) * scale / 2, -min[1] * scale, -(min[2] + max[2]) * scale / 2],
  size: max.map((value, axis) => (value - min[axis]) * scale),
 };
}

/** Model-derived dimensions and the identical scale and seating used to render it. */
export function vehicleModel(model, colour = LIVERY) {
 const entry = FLEET_MODELS[model];
 if (!entry) throw Error(`Unknown fleet model ${model}`);
 const metres = VEHICLE_LENGTH_METRES[entry.class];
 const fit = modelFit(model, metres * WORLD_UNITS_PER_METRE / (entry.max[2] - entry.min[2]));
 return {model, colour:entry.retint?colour:LIVERY, fit, width: fit.size[0], length: fit.size[2]};
}

// Moving fleet, in simulation vehicle order (see createTrafficSimulation):
// 0 town bus, 1-10 town cars, 11 florist van, 12 quay van, 13 west bus,
// 14-16 west cars, 17-20 cycles. Downtown routes (shops/west) get the most
// distinct models so the downtown still reads as a mixed fleet.
const MOVING = [
 ['city-bus',LIVERY],
 ['city-taxi',LIVERY],['vb-pastel-sedan','#e9bd63'],            // shops
 ['vb-police',LIVERY],                                            // west
 ['sn-pickup','#cd7358'],['city-sedan','#6e90a1'],                // north
 ['vb-convertible','#e4dcc4'],['sn-family-sedan','#82aa9d'],      // east
 ['city-sedan','#e9bd63'],                                        // north-reverse
 ['vb-sports-convertible',LIVERY],                                // shops-reverse
 ['sn-minivan',LIVERY],                                           // west-reverse
 ['city-delivery-van',LIVERY],['city-garbage-truck',LIVERY],
 ['city-bus','#e9bd63'],
 ['sn-family-sedan','#b9474a'],['vb-pastel-sedan','#82aa9d'],['sn-pickup','#3f6f8f'],
];
export const FLEET_ROLES = Object.freeze({
 'city-delivery-van':{name:'Thistlebrook Post',detail:'Local delivery round',story:'Parcels travel by road to the shops and quay. The van pulls up for a short unloading stop before continuing its round.'},
 'city-garbage-truck':{name:'Quayside recycling round',detail:'Bin collection along the quay',story:'The town’s recycling truck works the quay streets, pausing to empty the bins before it moves on.'},
 'city-taxi':{name:'Thistlebrook taxi',detail:'Waiting for a fare',story:'The town cab circles the shops and the town hall, ready for the next passenger.'},
 'vb-police':{name:'Community patrol',detail:'A slow loop of the high street',story:'The patrol car keeps an easy pace, waving to neighbours and stopping for people crossing.'},
});

export function assignFleet(vehicles){
 const motor=vehicles.filter(v=>v.kind!=='cycle'&&!v.civic);
 if(motor.length>MOVING.length)throw Error(`Fleet plan covers ${MOVING.length} motor vehicles, simulation has ${motor.length}`);
 let k=0;
 return vehicles.map(v=>{
  if(v.kind==='cycle')return {id:v.id,kind:'cycle',model:'cv-bicycle',colour:LIVERY};
  if(v.civic)return {id:v.id,kind:v.kind,model:v.model,colour:v.colour};
  const [model,colour]=MOVING[k++],m=FLEET_MODELS[model];
  if(m.kind!==v.kind)throw Error(`Fleet model ${model} (${m.kind}) assigned to a ${v.kind}`);
  return {id:v.id,kind:v.kind,model,colour:m.retint?colour:LIVERY,role:FLEET_ROLES[model]||null};
 });
}

export const MAPLE_VEHICLE_MODELS = {
 family_sedan: 'sn-family-sedan',
 family_pickup: 'sn-pickup',
 suv_minivan: 'sn-minivan',
};

/** Parked pack cars by bay id; neighbouring bays never repeat model+colour. */
export const PARKED_FLEET = Object.freeze({
 'high-street-west-1':['sn-family-sedan','#e4dcc4'],
 'high-street-west-2':['city-sedan','#cd7358'],
 'campus-lane':['vb-convertible','#cd7358'],
 'willowbank-west':['city-sedan','#82aa9d'],
 'market-south-1':['vb-pastel-sedan','#6e90a1'],
 'market-south-2':['sn-pickup','#82aa9d'],
 'market-south-3':['city-taxi',LIVERY],
});
export function parkedFleet(bays){
 return bays.map(b=>{
  const entry=b.type==='driveway'?[MAPLE_VEHICLE_MODELS[b.model],b.colour]:PARKED_FLEET[b.id];
  if(!entry)throw Error(`No parked car planned for bay ${b.id}`);
  const [model,colour]=entry;
  return {bay:b.id,model,colour:b.type==='driveway'||FLEET_MODELS[model].retint?colour:LIVERY};
 });
}
export const sameLook=(a,b)=>a.model===b.model&&a.colour===b.colour;
