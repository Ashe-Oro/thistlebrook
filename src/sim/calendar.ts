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
