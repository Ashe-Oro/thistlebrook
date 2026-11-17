// Semantic defaults live beside the catalog; placement never mutates catalog entries.
export const CIVIC_NAMES = Object.freeze({
  'cv-bakery': 'The Flour & Fern',
  'cv-tavern': 'The Copper Kettle',
  'cv-store': 'Willowmere Provisions',
  'cv-blacksmith': "Bram's Workshop",
});

export const TYPE_DEFAULTS = {
  home: { hours: [0, 24], capabilities: ['sleep', 'rest', 'visit'], points: ['bed', 'seat'] },
  bakery: { hours: [6, 18], capabilities: ['buy', 'sell', 'eat', 'work'], points: ['counter', 'workstation'] },
  tavern: { hours: [7, 24], capabilities: ['buy', 'eat', 'rest', 'talk', 'work'], points: ['counter', 'seat'] },
  store: { hours: [8, 20], capabilities: ['buy', 'sell', 'work'], points: ['counter', 'workstation'] },
  smithy: { hours: [7, 18], capabilities: ['buy', 'sell', 'work'], points: ['counter', 'workstation'] },
  market: { hours: [7, 19], capabilities: ['buy', 'sell', 'work', 'talk'], points: ['counter', 'stall'] },
  farm: { hours: [5, 20], capabilities: ['work', 'buy', 'sell'], points: ['workstation'] },
  windmill: { hours: [6, 18], capabilities: ['work', 'visit'], points: ['workstation'] },
  chapel: { hours: [6, 22], capabilities: ['visit', 'rest'], points: ['seat'] },
  well: { hours: [0, 24], capabilities: ['visit', 'rest'], points: [] },
  plaza: { hours: [0, 24], capabilities: ['visit', 'rest', 'talk'], points: [] },
  seat: { hours: [0, 24], capabilities: ['rest', 'talk'], points: ['seat'] },
  light: { hours: [0, 24], capabilities: ['light'], points: [] },
  building: { hours: [0, 24], capabilities: ['visit', 'work'], points: ['workstation'] },
  zone: { hours: [0, 24], capabilities: ['visit'], points: [] },
  prop: { hours: [0, 24], capabilities: ['visit'], points: [] },
};

// Rules also cover future catalog entries by semantic tags / category / asset name.
export function placeDefaults(instance, entry) {
  const words = [entry?.id ?? instance.id, ...(entry?.tags?.style || [])].join(' ').toLowerCase();
  const building = ['house', 'landmark'].includes(instance.kind) || !!entry?.door
    || /\b(barn|stable|greenhouse|coop|cellar|outhouse|shed|silo)\b/.test(words);
  let type = entry?.place?.type;
  if (!type) {
    if (instance.kind === 'house' || entry?.tags?.category === 'house') type = 'home';
    else if (/bakery/.test(words)) type = 'bakery';
    else if (/tavern|inn\b|noodle/.test(words)) type = 'tavern';
    else if (/blacksmith|smithy/.test(words)) type = 'smithy';
    else if (/market|produce-stand|pumpkin-stall/.test(words)) type = 'market';
    else if (/store|merchant-shop/.test(words)) type = 'store';
    else if (/chapel|worship/.test(words)) type = 'chapel';
    else if (/windmill/.test(words)) type = 'windmill';
    else if (instance.kind === 'well' || entry?.tags?.category === 'well') type = 'well';
    else if (instance.kind === 'plaza') type = 'plaza';
    else if (/bench|chair/.test(words)) type = 'seat';
    else if (/lamp|lantern|lights/.test(words)) type = 'light';
    else if (/farm|crop|field|orchard|garden-plot/.test(words)) type = 'farm';
    else type = building ? 'building' : ['path', 'ring', 'paving'].includes(instance.kind) ? 'zone' : 'prop';
  }
  return { building, type, ...(TYPE_DEFAULTS[type] || TYPE_DEFAULTS.prop), ...entry?.place };
}
