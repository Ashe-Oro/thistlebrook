import { deriveSeed, makeRng } from '../compiler/rng.js';
export const WEEKDAYS=['mon','tue','wed','thu','fri','sat','sun'];
import { isWeather, WEATHER_TYPES } from '../astra/weather-plan.js';
export const WEATHER=WEATHER_TYPES;
const WEATHER_CHANCES=[[.13,'overcast'],[.24,'rain'],[.30,'fog'],[.85,'clear'],[1,'snow']];
export function createCalendar(seed,q=new URLSearchParams()){
 const rng=makeRng(deriveSeed(seed,8172));
 const weekday=rng.pick(WEEKDAYS),roll=rng.float(),weather=WEATHER_CHANCES.find(([limit])=>roll<limit)[1];
 return {weekday:WEEKDAYS.includes(q.get('weekday'))?q.get('weekday'):weekday,weather:isWeather(q.get('weather'))?q.get('weather'):weather};
}
