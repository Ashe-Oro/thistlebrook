// Stable IDs used by the road audit and the tests. Ashe's wording and dates
// live in docs/TOWN-RULES.md.
export const TOWN_RULE = Object.freeze({
  walking: 'TOWN-01',
  crosswalks: 'TOWN-02',
  sidewalks: 'TOWN-03',
  surface: 'TOWN-04',
  access: 'TOWN-05',
  roads: 'TOWN-06',
  homes: 'TOWN-07',
  skins: 'TOWN-08',
});

export const ROAD_RULE = Object.freeze({
  'walk-on-road': TOWN_RULE.walking,
  'diagonal-crosswalk': TOWN_RULE.crosswalks,
  'unconnected-crosswalk': TOWN_RULE.crosswalks,
  'junction-crosswalk': TOWN_RULE.crosswalks,
  'triangle-crosswalk': TOWN_RULE.crosswalks,
  'sidewalk-dead-end': TOWN_RULE.sidewalks,
  'disconnected-sidewalk': TOWN_RULE.sidewalks,
  'off-surface': TOWN_RULE.surface,
  'orphan-structure': TOWN_RULE.access,
  'dead-end': TOWN_RULE.roads,
  stub: TOWN_RULE.roads,
  'home-spacing': TOWN_RULE.homes,
  'home-pad': TOWN_RULE.homes,
  'home-variety': TOWN_RULE.homes,
});
