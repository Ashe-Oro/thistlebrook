// All three meters measure reserves: a lower number means a more urgent need.
export const SECONDS_PER_HOUR = 90;
export const MEAL_COST = 300;
export const MEAL_RECOVERY = 65;
export const HUNGRY = 55;
export const TIRED = 30;
export const LOW_RECREATION = 55;
export const MEAL_INTERVAL = 150;
export const RETRY_DESTINATION = 90;

export const DAY_SLEEP = [22, 6];
export const NIGHT_SHIFT_SLEEP = [7.5, 15.5];

export function inWindow([start, end], hour) {
  return start < end ? hour >= start && hour < end : start > end && (hour >= start || hour < end);
}

export const hoursUntil = (start, hour) => (start - hour + 24) % 24;

export function commuting(job, hour) {
  const [start, end] = job.shift;
  return start !== end && (inWindow(job.shift, hour) || hoursUntil(start, hour) <= job.commute);
}

export const reserve = value => Math.max(0, Math.min(100, value));

export function tickNeeds(needs, action, dt) {
  const tool = action?.tool;
  needs.hunger = reserve(needs.hunger - dt * (action?.sleeping ? .055 : .12));
  needs.energy = reserve(needs.energy + dt * (action?.sleeping ? .22 : tool === 'work' ? -.055 : tool === 'walkTo' ? -.045 : -.015));
  needs.recreation = reserve(needs.recreation - dt * .032);
}
