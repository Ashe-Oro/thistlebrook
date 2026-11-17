// Art-directed keys, sampled in linear colour space by lighting.js. Hours are
// cyclic; midnight is the same key at both ends, including the moon direction.
export const LIGHT_KEYS = [
 // hour, sky top / horizon, sky fill / ground bounce, key light, ink,
 // fill strength, key strength, practical lights, light direction (x,y,z)
 [0,   '#19253e','#526079','#9cbbef','#575574','#b1c9ff','#1d2639', .82,.82,1, 60,100,45],
 [4.5, '#292e50','#817388','#b0b3e1','#685871','#c0c8ef','#333047', .80,.72,1, 60,100,45],
 [5.4, '#787b9d','#dba69f','#c4bedf','#8b778c','#f8b798','#42384e', .94,1.1,.75, 95,48,35],
 [6.3, '#b4b4c9','#f3d1b3','#ddd3ed','#9c8a9d','#ffd2a4','#332d3e', 1.25,1.85,.30, 115,48,40],
 [8,   '#bfd4d6','#e9e9d3','#e6edf0','#a0b29e','#fff0d0','#343f42', 1.16,1.95,0, 85,90,40],
 [11,  '#c6dbda','#edf0df','#f0f3ec','#9caf99','#fff1d6','#303b3e', 1.2,1.95,0, 20,130,50],
 [14,  '#c8d9d6','#edf0df','#f0efdf','#a7b39a','#ffecc9','#333b40', 1.16,2.0,0, -50,115,45],
 [16,  '#c4c6cd','#efe0c5','#e1dcec','#a69a9e','#ffdda8','#342d3e', 1.24,2.1,0, -95,72,35],
 [17.4,'#b8adc3','#f2ceaa','#dcc8e7','#a088a2','#ffc784','#352c3e', 1.28,2.3,.08, -105,54,65],
 [18.4,'#908ba9','#e4b1a2','#c8b7e4','#886e91','#ffb592','#30283e', 1.15,1.75,.42, -115,42,55],
 [19.3,'#595e88','#b18fa4','#b5b8ed','#706483','#e9b4c4','#25273c', .88,.85,.86, -85,52,35],
 [20.5,'#293856','#72748f','#a1bcec','#5e5b7c','#b8ceff','#20283e', .82,.82,1, 30,90,45],
 [22,  '#19253e','#526079','#9cbbef','#575574','#b1c9ff','#1d2639', .82,.82,1, 60,100,45],
 [24,  '#19253e','#526079','#9cbbef','#575574','#b1c9ff','#1d2639', .82,.82,1, 60,100,45],
];

export const LIGHT_PRESETS = [
 { label: 'Dawn', hour: 6.3, color: '#e7b6b0' },
 { label: 'Daylight', hour: 10.4, color: '#cadbce' },
 { label: 'Golden hour', hour: 17.4, color: '#efbf7e' },
 { label: 'Dusk', hour: 19.3, color: '#ac9cbe' },
 { label: 'Moonlight', hour: 22, color: '#647fa7' },
];

export function normalizeHour(hour) {
 const value = Number(hour);
 return Number.isFinite(value) ? ((value % 24) + 24) % 24 : 10.4;
}

export function sampleLightCycle(hour, keys = LIGHT_KEYS) {
 hour = normalizeHour(hour);
 const index = keys.findIndex((key, i) => i < keys.length - 1 && hour < keys[i + 1][0]);
 const from = keys[index], to = keys[index + 1];
 const t = (hour - from[0]) / (to[0] - from[0]);
 return { hour, index, from, to, blend: t * t * (3 - 2 * t) };
}

export function lightPeriod(hour) {
 hour = normalizeHour(hour);
 if (hour < 5 || hour >= 20.5) return 'Moonlight';
 if (hour < 8) return 'Dawn';
 if (hour < 16) return 'Daylight';
 if (hour < 18.5) return 'Golden hour';
 return 'Dusk';
}
