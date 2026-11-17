// OWNER: grok-skins lane (Grok). Skin registry. A skin is one data file in this
// folder (see docs/SKINS.md). Add yours to SKINS; the first entry is the default.
import cel from './cel.js';
import neon from './neon.js';
import autumn from './autumn.js';
import winter from './winter.js';

export const SKINS = [cel, neon, autumn, winter];
export const DEFAULT_SKIN = SKINS[0].id;
const ALIASES = { default: 'cel', cyberpunk: 'neon', v2: 'neon', storybook: 'autumn', snow: 'winter' };

export function getSkin(id) {
 const key = ALIASES[id] || id;
 return SKINS.find(s => s.id === key) || SKINS[0];
}

// ?skin=<id>; the old ?look=v2 flag keeps working as an alias for neon.
export function skinFromQuery(q = new URLSearchParams(globalThis.location?.search || '')) {
 if (q.get('skin')) return getSkin(q.get('skin')).id;
 if (q.get('look') === 'v2') return 'neon';
 return DEFAULT_SKIN;
}
