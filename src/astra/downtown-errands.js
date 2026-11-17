// OWNER: grok-roads lane. Downtown errand loops (pure, shared by render + tests).
// North walkers use the High Street north sidewalk; west walkers use the plaza
// edge beside the x=-66 avenue. Both stay off the carriageway.
export const ERRAND_WALKERS = 10;
export function errandPose(n, t) {
  const north = n < 5, u = (t * .018 + n * .18) % 2, v = u < 1 ? u : 2 - u, walk = Math.min(1, Math.max(0, (v - .12) / .76));
  return {x: north ? -73 + walk * 26 : -63.9, y: .2 + Math.abs(Math.sin(t * 6 + n)) * .035, z: north ? -18.1 - n % 2 * .5 : -13.4 + walk * 14.9, yaw: north ? (u < 1 ? Math.PI / 2 : -Math.PI / 2) : (u < 1 ? 0 : Math.PI)};
}
