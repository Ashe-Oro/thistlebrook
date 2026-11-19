// OWNER: streetlights lane. Lamp-post night brightness, import-free so any
// module (shaders, kits, the legacy life path) can read it without cycles.
/** Night brightness. The pre-streetlights values are kept alongside for the record. */
export const LAMP_LOOK = Object.freeze({
  // Ground pool opacity at full night (radial decal, centre alpha ~.8).
  pool: .84, poolBefore: .6,
  // Additive lantern halo alpha at full night (lighting.js billboard).
  halo: .38, haloBefore: .27,
  // Maple Hollow: emissive lamp glass and instanced pool opacity.
  suburbGlass: 2.2, suburbGlassBefore: 1.6,
  suburbPool: 1.12, suburbPoolBefore: .8,
  // District-kit pools when the decal belongs to a lamp post (midway, coast).
  kitLampPool: .67, kitLampPoolBefore: .48,
  // Existing per-fixture PointLights (harbour quay, Sunbeam court, legacy ?life=1 path).
  harbourLight: 3.5, harbourLightBefore: 2.5,
  sunbeamLight: 7, sunbeamLightBefore: 5,
  lifeLight: 22, lifeLightBefore: 16,
  lifePool: 1.12, lifePoolBefore: .8,
  // Fixture heads switch on at this night factor (matches world.js bulbs).
  headOn: .2,
});
