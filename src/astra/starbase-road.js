// The stage convoy tows east toward the pad and backs west to the factory.
// It keeps the same orientation in both directions so the trailer stays hitched.
import {vehicleModel} from './traffic-fleet.js';
import {routeAt, STARBASE_ORIGIN} from './starbase-flight.js';

const tractor = vehicleModel('farm-tractor');
const trailer = vehicleModel('farm-rocket-trailer');
const hitchSpacing = (tractor.length + trailer.length) / 2 + .04;
// Leave the visitor crossing at x = -46 clear even while loading.
const transferRoad = [[-41.5,0],[4,0],[-41.5,0]];
const transferSpeed = 1.4;
const transferDwell = 6;
const heading = [1,0];
const gateX = -21;

// The trailer's level load surface is the inner platform, below the side rails.
// Measured in GLB space after the scene node transform.
const loadY = 1.100 - .58717261;
const loadZ = .600 - 1.04276967;
export const TRAILER_LOAD_POINT = [0, loadY * trailer.fit.scale + trailer.fit.offset[1],
  loadZ * trailer.fit.scale + trailer.fit.offset[2]];

// Positions use the district frame, as in the Starbase scene.
export function starbaseRoadVehicles(time) {
  const pose = routeAt(transferRoad,time,transferSpeed,transferDwell);
  const status = pose.walking ? (pose.heading > 0 ? 'Towing to the pad' : 'Backing to the factory') : 'At stop';
  const speed = pose.walking ? transferSpeed : 0;
  const [x,z] = STARBASE_ORIGIN;
  return [
    {...tractor,id:'starbase-tractor',kind:'tractor',position:[x+pose.x+hitchSpacing,z],direction:heading,y:.135,status,speed},
    {...trailer,id:'starbase-transporter',kind:'trailer',position:[x+pose.x,z],direction:heading,y:.135,status,speed},
    // Staged on the raised recovery apron. Its platform is centred under the booster.
    {...trailer,id:'starbase-recovery-dolly',kind:'trailer',position:[x+4,z-12-TRAILER_LOAD_POINT[2]],direction:[0,1],y:.355,status:'Parked',speed:0,parked:true},
  ];
}

export function convoyAtGate([tractor,trailer]) {
  const gate = STARBASE_ORIGIN[0] + gateX;
  return trailer.position[0] - trailer.length / 2 - 2 < gate && tractor.position[0] + tractor.length / 2 + 2 > gate;
}
