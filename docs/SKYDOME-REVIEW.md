# Skydome review

Dates use America/New_York. Ashe asked (18 Nov 2026, 8:50 AM ET) to look at ThreeJS Assets domes as a way to set the scene. The account holds the Stylised Lifetime licence, so every pack below is already licensed. Preview stills are in `/workspace/shots/skydomes/` (CDN thumbnails, not committed binaries). Procedural gradient skies in `src/builders.js` and the lighting backdrop stay the default until a dome is wired as skin or weather data.

None of these GLBs should be committed. They load from the gitignored licensed mapping, the same way pack vehicles and railway cars already do.

## How they would wire in

Keep the procedural sky as the cel fallback (TOWN-08). Add optional dome fields as data, not new render stacks:

```js
// in a skin data file
sky: {
  dome: 'cv-sky-day-dome-01',     // clear day
  dusk: 'aut-autumn-harvest-dome',
  night: 'cv-sky-starry-night-dome-01',
}

// in src/astra/weather-plan.js
overcast: { dome: 'air-overcast-dome' },
rain:     { dome: 'tokyo-japan-sky-rainy-dome-01' },
fog:      { dome: 'air-overcast-dome', domeOpacity: .7 },
snow:     { dome: 'arctic-sky-arctic-day-dome' },
```

A small sky runtime would load the licensed GLB, place an unlit / emissive inverted dome, parent its XZ to the camera, and cast no shadows. Hour keys already in each skin choose day / dusk / night; weather plan chooses a weather override. One town-wide dome at a time is enough — districts can recommend a mood, but layering several domes would fight the cel look. Realistic City and Desert Kingdom domes are licensed but read as photographic or arid, so they stay off the default path.

## Top picks

These are the ones that fit Thistlebrook's cel look first:

| Use | Dome | Pack | Why |
| --- | --- | --- | --- |
| Default clear day | Cozy Village Day Dome (`sky-day-dome-01`) | cozy-village | Soft stylised village vault, already in our house style. |
| Autumn day | Autumn Day Dome | autumn | Warm haze, sunlit cumulus, matches the autumn skin. |
| Autumn golden hour | Autumn Harvest Dome | autumn | Low sun and amber clouds; use at late afternoon / harvest view. |
| Autumn dusk | Dusk Dome (autumn) | autumn | Coral-to-violet afterglow and a pale moon. |
| Overcast | Overcast Dome | airfield | Continuous stratus, no sun disc — the soft fill we want in grey weather. |
| Rain | Japan Sky Rainy Dome 01 | city-tokyo | Pewter crown, ragged horizon rolls. Fits rain without leaving cel. |
| Snow / winter day | Sky Arctic Day Dome | arctic-station | High-key pale horizon, low sun, clear blue crown. |
| Snow dusk | Sky Arctic Golden Dome | arctic-station | Peach-gold alpenglow, useful at winter dusk. |
| Night (cel / winter) | Cozy Village Starry Night, or Farm Night Dome | cozy-village / farm | Quiet star field and a modest moon, not a city-glow skyline. |
| Night (neon / cyberpunk skin) | Sky Acid Smog Dome, or Carnival Night Dome | cyberpunk / fairground | Pollution shelves or a violet fair glow with a milky-way band. |
| Fair / festival day | Festival Day Dome | fairground | Bright cyan, sculpted cumulus; good over Merrymead. |
| Woods / nature dusk | Nature Golden Sky, or Farm Harvest Dome | nature / farm | Warm horizon without city clutter. |
| Winter night (special) | Sky Arctic Aurora Night Dome, or Viking Aurora | arctic-station / viking-fjord | Only as a rare night, not the everyday winter sky. |

## Full catalogue (licensed sky / environment domes)

Style fit is relative to our cel village, not to the pack's own demo.

| Name | Pack | Slug | Day / night | Style fit | Best for |
| --- | --- | --- | --- | --- | --- |
| Autumn Day Dome | autumn | autumn-day-dome | day | excellent | Autumn skin, harvest and orchard districts, clear weather |
| Autumn Harvest Dome | autumn | autumn-harvest-dome | golden hour | excellent | Autumn dusk-leaning afternoons |
| Dusk Dome | autumn | dusk-dome | dusk / night | excellent | Autumn evening |
| Clear Day Dome | airfield | clear-day-dome | day | good | Airport district, default clear alternative |
| Golden Hour Dome | airfield | golden-hour-dome | golden hour | good | Airport and west-facing dusk |
| Overcast Dome | airfield | overcast-dome | overcast | excellent | Overcast and fog |
| Day Dome | farm | day-dome | day | good | Countryside and farm lots; very light geometry |
| Harvest Dome | farm | harvest-dome | golden hour | good | Farm / harvest views |
| Night Dome | farm | night-dome | night | good | Quiet rural night |
| Festival Day Dome | fairground | festival-day-dome | day | excellent | Merrymead, festival days |
| Carnival Sunset Dome | fairground | carnival-sunset-dome | sunset | excellent | Fair at golden hour |
| Carnival Night Dome | fairground | carnival-night-dome | night | good | Fair night; also a neon-skin option |
| Spring Day Sky Dome | edo-village | spring-day-sky-dome | day | good | Clear spring day, woods edge |
| Sky Sunset Dome (Edo) | edo-village | sky-sunset-dome | sunset | good | Warm evening |
| Festival Night Sky Dome | edo-village | festival-night-sky-dome | night | good | Lantern night, festival |
| Day Sky Dome 01 | cozy-village | sky-day-dome-01 | day | excellent | Default cel clear day |
| Sky Sunset Dome 01 | cozy-village | sky-sunset-dome-01 | sunset | excellent | Default cel dusk |
| Starry Night Dome 01 | cozy-village | sky-starry-night-dome-01 | night | excellent | Default cel night |
| Sky Day | nature | sky-day | day | good | Woods, river, camps |
| Sky Golden | nature | sky-golden | golden hour | good | Woods dusk |
| Sky Night Aurora | nature | sky-night-aurora | night | special | Rare winter or woods night |
| Japan Sky Day Dome 01 | city-tokyo | japan-sky-day-dome-01 | day | good | Clear day with stepped bands |
| Japan Sky Goldenhour Dome 01 | city-tokyo | japan-sky-goldenhour-dome-01 | golden hour | good | Amber / rose dusk |
| Japan Sky Night Dome 01 | city-tokyo | japan-sky-night-dome-01 | night | good | Night with city-glow horizon |
| Japan Sky Rainy Dome 01 | city-tokyo | japan-sky-rainy-dome-01 | rain / overcast | excellent | Rain weather |
| Sky Clear Day 01 | accessibility | sky-clear-day-01 | day | good | Clean high-key day |
| Sky Night 01 | accessibility | sky-night-01 | night | good | Simple night with a low moon |
| Metropolis Sky Day Dome 01 | metropolis | metropolis-sky-day-dome-01 | day | fair | Downtown if we want a city horizon |
| Paris Sky Day Dome 01 | city-paris | paris-sky-day-dome-01 | day | fair | Soft city day; less village |
| Paris Sky Night Dome 01 | city-paris | paris-sky-night-dome-01 | night | fair | City-glow night |
| Sky Day Dome 02 | city | sky-day-dome-02 | day | fair | Alternate city day |
| Sky Night Dome 01 | city | sky-night-dome-01 | night | fair | City night |
| Sky Overcast Dome 01 | city | sky-overcast-dome-01 | overcast | good | Alternate overcast |
| Sky Sunset Dome 02 | city | sky-sunset-dome-02 | sunset | fair | City sunset |
| Railway Sky Starry Night | railway | railway-sky-starry-night | night | good | Station and loop-line night |
| Sky Arctic Day Dome | arctic-station | sky-arctic-day-dome | day | excellent | Winter / snow weather |
| Sky Arctic Golden Dome | arctic-station | sky-arctic-golden-dome | golden hour | excellent | Winter dusk |
| Sky Arctic Aurora Night Dome | arctic-station | sky-arctic-aurora-night-dome | night | special | Rare winter night |
| Sky Aurora Night Dome | viking-fjord | sky-aurora-night-dome | night | special | Same idea, lighter mesh |
| Sky Bayou Day Dome | swamp-bayou | sky-bayou-day-dome | day | fair | Humid, pale-green horizon; maybe fog |
| Sky Bayou Night Dome | swamp-bayou | sky-bayou-night-dome | night | fair | Teal swamp night |
| Sky Acid Smog Dome | cyberpunk | sky-acid-smog-dome | day / smog | good (neon skin) | Cyberpunk / neon skin, overcast-acid |
| Day Sky Dome | desert-kingdom | day-sky-dome | day | poor | Hot desert bleach; not our village |
| Dusk Sky Dome | desert-kingdom | dusk-sky-dome | dusk | poor | Kingdom dusk, too arid |
| Night Sky Dome | desert-kingdom | night-sky-dome | night | fair | Star-heavy desert night |
| Realistic Sky Day / Night / Overcast / Sunset | realistic-city | realistic-sky-*-dome-* | all | poor for cel | Photographic city vaults; keep as a reference only |

Cake Dome, Pendant Dome and other interior “domes” are props, not skies, and are omitted.

## Local copies already on the box

Under `/workspace/threejs-assets` and `/workspace/threejs-packs` we already have the Autumn, Farm, Cozy Village, Edo Village, Nature and City pack domes as GLBs. Other packs (Airfield, Tokyo, Arctic, Cyberpunk, Fairground, Railway, and the rest) are licensed and can be copied into the gitignored `public/licensed/` map the same way vehicles were, when a later lane wires them.

## Recommendation

Do not switch the default cel sky yet. When a later lane wires this:

1. Ship Cozy Village day / sunset / starry night as the optional cel dome set.
2. Point the autumn skin at Autumn Day, Harvest and Dusk.
3. Point the winter skin at Arctic Day, Arctic Golden, and Cozy or Farm night (aurora only as a special).
4. Map weather to Overcast, Tokyo Rainy, and Arctic Day for snow.
5. Map the neon skin to Acid Smog by day and Carnival Night or Tokyo Night after dark.
6. Keep the procedural gradient behind a feature flag so a missing licensed file never blanks the sky.

Previews: `/workspace/shots/skydomes/<slug>.png`.
