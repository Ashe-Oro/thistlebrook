import { deriveSeed, makeRng } from '../compiler/rng.js';
export const WEEKDAYS=['mon','tue','wed','thu','fri','sat','sun'];
export const WEATHER=['clear','overcast','rain','fog'];
export function createCalendar(seed,q=new URLSearchParams()){
 const rng=makeRng(deriveSeed(seed,8172));
 const weekday=rng.pick(WEEKDAYS),weather=rng.pick(WEATHER);
 return {weekday:WEEKDAYS.includes(q.get('weekday'))?q.get('weekday'):weekday,weather:WEATHER.includes(q.get('weather'))?q.get('weather'):weather};
}
