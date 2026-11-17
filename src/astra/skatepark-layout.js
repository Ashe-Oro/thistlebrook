// One reserved parcel, with its own south gate onto the existing campus lane.
// Keep this declaration dependency-free: the compiler runs in Node and browser.
export const SKATEPARK = {
 id: 'skatepark', type: 'skatepark', name: 'Switchyard Skate & Bike Park',
 district: 'common', height: 5, pos: [52, -51],
 box: { min: [40.5, -67], max: [63.5, -35.5] },
 entry: [46, -37], access: [46, -33],
};
export const SKATEPARK_VIEW = { x: 52, z: -51, zoom: 4.4 };

// Local ground reserved for pedestrian prop scenes, separate from riding lines.
export const SWITCHYARD_REST = {
 center: [-6.6, 10], bounds: {min: [-9.4, 8.7], max: [-3.8, 14.1]}, elevation: .2,
};
