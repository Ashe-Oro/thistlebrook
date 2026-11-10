// Thistlebrook calendar: a 7-day week and 4 short seasons (7 days each, so a 28-day year), starting on Moonday of Spring.
// Pure function of the day number: deterministic, no RNG, safe for sim and render code alike.
export const WEEKDAYS = ['Moonday', 'Tewsday', 'Wodensday', 'Thornsday', 'Fryday', 'Satterday', 'Sunday'] as const;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export type Season = typeof SEASONS[number];
export interface CalendarDay { day: number; weekday: string; weekdayIndex: number; week: number; season: Season; seasonIndex: number; dayOfSeason: number; year: number; label: string; tags: string[] }
export const DAYS_PER_SEASON = 7;
// Fixed weekly fixtures (day-of-week index -> tag). Systems may read these tags; they never change at runtime.
export const WEEKLY: Record<number, string> = { 0: 'market', 2: 'town-meeting', 5: 'festival-eve', 6: 'rest' };
export function calendarFor(day: number): CalendarDay {
  const d = Math.max(1, Math.floor(day)), i = d - 1, weekdayIndex = i % 7, seasonIndex = Math.floor(i / DAYS_PER_SEASON) % 4;
  const dayOfSeason = (i % DAYS_PER_SEASON) + 1, year = Math.floor(i / (DAYS_PER_SEASON * 4)) + 1, week = Math.floor(i / 7) + 1;
  const tags = WEEKLY[weekdayIndex] ? [WEEKLY[weekdayIndex]] : [];
  return { day: d, weekday: WEEKDAYS[weekdayIndex], weekdayIndex, week, season: SEASONS[seasonIndex], seasonIndex, dayOfSeason, year, label: `${WEEKDAYS[weekdayIndex]}, ${dayOfSeason} ${SEASONS[seasonIndex]}`, tags };
}

// --- Seasonal looks (render-side palette; pure data, no THREE so this stays sim-safe) ---------------
// Cosmetic tints consumed by world.ts (shared-material colours) and sky.ts (sky/fog wash, golden hour).
// Never read by sim logic.
export interface SeasonLook {
  grass: string;      // ground tint: multiplies the grass vertex colours (near-white = subtle)
  foliage: string;    // tree-leaf tint target (leaves lerp toward this)
  foliageMix: number; // how far leaves lerp toward `foliage` (0..1)
  sky: string;        // subtle wash over the lower sky + fog
  skyMix: number;     // strength of that wash (0..1)
  warmth: number;     // extra golden-hour warmth / length (0..1)
  snow: number;       // snowfall amount when it would otherwise rain (0..1)
}
export const SEASON_LOOKS: Record<Season, SeasonLook> = {
  Spring: { grass: '#ecf8e2', foliage: '#86c753', foliageMix: .15, sky: '#dff0ff', skyMix: .05, warmth: .12, snow: 0 },
  Summer: { grass: '#f4f0cf', foliage: '#a6d24e', foliageMix: .12, sky: '#fff4d8', skyMix: .06, warmth: .45, snow: 0 },
  Autumn: { grass: '#e8d3a2', foliage: '#d6701f', foliageMix: .55, sky: '#ffe9c8', skyMix: .08, warmth: .30, snow: 0 },
  Winter: { grass: '#c6d0d8', foliage: '#b9c4cc', foliageMix: .50, sky: '#dce8f5', skyMix: .12, warmth: 0, snow: 1 },
};
