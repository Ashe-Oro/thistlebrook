// Build the resolved (world-unit) catalog Map from CATALOG + a bounds object.
// Pure JS (no three.js, no DOM): shared by loader.js (browser, bounds via Vite
// JSON import) and the node CLI (bounds read with fs). Entries with no computed
// bounds are skipped with a warning rather than half-resolved.
import { CATALOG } from './catalog.js';
import { resolveEntry } from './schema.js';

export function resolveAll(bounds) {
  const map = new Map();
  for (const e of CATALOG) {
    if (!bounds[e.id]) { console.warn(`[catalog] ${e.id}: no bounds, skipped`); continue; }
    map.set(e.id, resolveEntry(e, bounds[e.id]));
  }
  return map;
}
