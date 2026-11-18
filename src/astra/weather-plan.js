export const WEATHER_TYPES = Object.freeze(['clear', 'overcast', 'rain', 'fog', 'snow']);
const PLANS = {
  clear:    { key: 1, fill: 1, pace: 1, fairAttendance: 1, beachAttendance: 1 },
  overcast: { key: .8, fill: 1.03, sky: '#a6b3bc', skyMix: .35, pace: 1, fairAttendance: 1, beachAttendance: 1 },
  rain:     { key: .68, fill: .97, sky: '#7e93a7', skyMix: .48, cool: '#b5d2f3', coolMix: .36, pace: 1, fairAttendance: .45, beachAttendance: .2 },
  fog:      { key: .82, fill: 1.03, sky: '#c1cbcb', skyMix: .42, pace: 1, fairAttendance: 1, beachAttendance: 1 },
  snow:     { key: .91, fill: 1.02, sky: '#abbfd0', skyMix: .32, cool: '#bfdafb', coolMix: .27, bounce: '#c0d2df', pace: .8, fairAttendance: .65, beachAttendance: .3 },
};
Object.values(PLANS).forEach(Object.freeze);

export const isWeather = type => WEATHER_TYPES.includes(type);
export const weatherPlan = type => PLANS[isWeather(type) ? type : 'clear'];

export function outdoorLinger(place) {
  return ['sit', 'picnic', 'chess'].includes(place?.interaction?.activity);
}

export function allowsWeatherVisit(type, place, actorIndex) {
  if (!outdoorLinger(place)) return true;
  if (type === 'rain') return false;
  return type !== 'snow' || place.interaction.activity !== 'picnic' || actorIndex % 3 === 0;
}

export function weatherSlotOpen(type, place, slot) {
  return type !== 'snow' || place.interaction?.activity !== 'picnic' || !slot || place.interaction.slots[0] === slot;
}

export function weatherShelter(place) {
  return !!place && !place.interaction && ['home', 'shop', 'house', 'building', 'library', 'clinic', 'school'].includes(place.kind);
}

export function travelWeather(type, actorIndex, walking) {
  if (type !== 'rain' || !walking) return null;
  return actorIndex % 4 === 3 ? 'hurrying' : 'umbrella';
}
