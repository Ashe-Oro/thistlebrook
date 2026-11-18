// OWNER: vehicle-variety lane. Pure fleet plan (no THREE, no DOM): which owned
// pack model and body colour each town vehicle uses. Bounds, pivots and the
// body-colour hue window were measured from the individual pack GLBs
// (tools/inspect-glb.mjs); none of the files are committed (public/licensed).
//
// Conventions: every model faces +Z. City pack vehicles pivot at the rear axle
// (min z is negative), Vice Beach and Suburban ones sit roughly centre-origin,
// so seating always uses the measured box, never an assumed bottom-centre.

import {MAPLE_HOLLOW_BAYS} from './maple-hollow-plan.js';

/** Owned pack vehicles. `retint` is the body hue window (degrees, measured on
 * the vertex colours); models without it keep their livery (taxi, police...). */
export const FLEET_MODELS = Object.freeze({
 'city-sedan':{name:'Sedan',pack:'city',path:'licensed/city/car_sedan_01.glb',kind:'car',min:[-.6,0,-.75],max:[.6,.97,2.31],pivot:'rear-axle',retint:{hue:135,width:22}},
 'city-taxi':{name:'Taxi',pack:'city',path:'licensed/city/taxi_01.glb',kind:'car',role:'taxi',min:[-.6,0,-.75],max:[.6,1.17,2.31],pivot:'rear-axle'},
 'city-bus':{name:'City bus',pack:'city',path:'licensed/city/city_bus_01.glb',kind:'bus',min:[-.95,0,-1.11],max:[.95,1.92,3.6],pivot:'rear-axle',retint:{hue:165,width:16}},
 'city-delivery-van':{name:'Delivery van',pack:'city',path:'licensed/city/delivery_van_01.glb',kind:'van',min:[-.91,0,-.74],max:[.91,1.78,3.09],pivot:'rear-axle'},
 'city-garbage-truck':{name:'Garbage truck',pack:'city',path:'licensed/city/garbage_truck_01.glb',kind:'van',role:'service',min:[-.91,0,-1.41],max:[.91,1.67,3.08],pivot:'rear-axle'},
 'vb-pastel-sedan':{name:'Pastel sedan',pack:'vice-beach',path:'licensed/vice-beach/pastel_sedan.glb',kind:'car',min:[-.56,0,-.71],max:[.56,1.05,2.18],pivot:'rear-axle',retint:{hue:345,width:16}},
 'vb-police':{name:'Police cruiser',pack:'vice-beach',path:'licensed/vice-beach/police_cruiser.glb',kind:'car',role:'police',min:[-.61,.01,-.69],max:[.6,1.3,2.24],pivot:'rear-axle'},
 'vb-convertible':{name:'Convertible cruiser',pack:'vice-beach',path:'licensed/vice-beach/convertible_cruiser.glb',kind:'car',min:[-.55,0,-.82],max:[.55,.97,2.26],pivot:'rear-axle',retint:{hue:180,width:12}},
 'vb-sports-convertible':{name:'Sports convertible',pack:'vice-beach',path:'licensed/vice-beach/white_sports_convertible.glb',kind:'car',min:[-.56,-.02,-.63],max:[.56,.9,2.1],pivot:'rear-axle'},
 'sn-family-sedan':{name:'Family sedan',pack:'suburban-neighborhood',path:'licensed/suburban-neighborhood/family_sedan.glb',kind:'car',min:[-.7,0,-1.55],max:[.7,.96,1.57],pivot:'centre',retint:{hue:210,width:10}},
 'sn-pickup':{name:'Family pickup',pack:'suburban-neighborhood',path:'licensed/suburban-neighborhood/family_pickup.glb',kind:'car',min:[-.74,0,-1.76],max:[.74,1.12,1.75],pivot:'centre',retint:{hue:0,width:14}},
 'sn-minivan':{name:'SUV minivan',pack:'suburban-neighborhood',path:'licensed/suburban-neighborhood/suv_minivan.glb',kind:'car',min:[-.75,0,-1.6],max:[.75,1.26,1.61],pivot:'centre'},
});

/** Cel body colours (sRGB). Liveried models ignore them. */
export const BODY_COLOURS = Object.freeze(['#cd7358','#e9bd63','#82aa9d','#6e90a1','#e4dcc4','#b9474a','#3f6f8f','#9a7bb0']);
export const LIVERY = 'livery';

/** Sim footprints (length along heading, width). Models are scaled to fit
 * inside these, so the oriented-footprint collision checks stay honest. */
export const FOOTPRINT = Object.freeze({car:{length:2.05,width:.9},van:{length:2.2,width:.92},bus:{length:3.2,width:1.1},cycle:{length:1.45,width:.45}});

/** Uniform scale and offset that seat a model inside a footprint: the model's
 * measured box is centred on the footprint and its lowest point on y = 0. */
export function fitModel(id,{length,width}){
 const m=FLEET_MODELS[id];if(!m)throw Error(`Unknown fleet model ${id}`);
 const L=m.max[2]-m.min[2],W=m.max[0]-m.min[0],H=m.max[1]-m.min[1],scale=Math.min(length/L,width/W);
 return {scale,offset:[-(m.min[0]+m.max[0])/2*scale,-m.min[1]*scale,-(m.min[2]+m.max[2])/2*scale],size:[W*scale,H*scale,L*scale]};
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
 const motor=vehicles.filter(v=>v.kind!=='cycle');
 if(motor.length>MOVING.length)throw Error(`Fleet plan covers ${MOVING.length} motor vehicles, simulation has ${motor.length}`);
 let k=0;
 return vehicles.map(v=>{
  if(v.kind==='cycle')return {id:v.id,kind:'cycle',model:'cv-bicycle',colour:LIVERY};
  const [model,colour]=MOVING[k++],m=FLEET_MODELS[model];
  if(m.kind!==v.kind)throw Error(`Fleet model ${model} (${m.kind}) assigned to a ${v.kind}`);
  return {id:v.id,kind:v.kind,model,colour:m.retint?colour:LIVERY,role:FLEET_ROLES[model]||null};
 });
}

const MAPLE_MODELS = {
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
 ...Object.fromEntries(MAPLE_HOLLOW_BAYS.map((b)=>[b.id,[MAPLE_MODELS[b.model],b.colour]])),
});
export function parkedFleet(bays){
 return bays.map(b=>{
  const entry=PARKED_FLEET[b.id];
  if(!entry)throw Error(`No parked car planned for bay ${b.id}`);
  const [model,colour]=entry;
  return {bay:b.id,model,colour:b.type==='driveway'||FLEET_MODELS[model].retint?colour:LIVERY};
 });
}
export const sameLook=(a,b)=>a.model===b.model&&a.colour===b.colour;
