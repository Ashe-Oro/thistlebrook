# Astra — design & game-feel review

Reviewer: Opus 5.5 · 2026-11-16 · build `30801f4` (`village/opus-review`), seed 831
Method: dev server on **port 5203** only, headless Chrome (SwiftShader), 38 stills across all 18 districts at
zooms 0.22×–5× and at dawn, day, golden hour, dusk and night. I also simulated a full Friday (06:00→01:00) and
sampled all 40 named residents every in-game hour. I did not edit any source code. All evidence is in
[`shots/opus-review/`](../shots/opus-review/):

- stills `01-…` to `47-…`;
- `evidence-*.json`: camera, hour, caption and a **motion %** for each still, i.e. the share of sampled pixels that
  change over 2 simulated seconds. It's a rough "how much is moving on screen" number. It is only comparable
  between shots at similar zoom.
- `resident-day-sample.json`: where each resident was and what they were doing, hour by hour;
- `capture-script.mjs.txt`: the capture script.

---

## Verdict

**Close up, yes. From the top, not yet.** At 2–5× zoom Astra is genuinely charming. The fountain square, Lantern
Quay on a Friday night, Ocean Drive, Pinecrest and the mountain pass are places I'd leave open on a second monitor.
The daily rhythm is real, too. Residents commute at 8–9, work 10–12, picnic at 13:00, drift to benches and fields
at 16–18, and **half the named town is at Lantern Quay by 21:00** before heading home after midnight. That's the
SimCity "the town has a pulse" feeling Ashe asked for. It's working.

What breaks the spell is the zoom where Tiny Las Vegas wins: the whole-world view. At 0.22× (`01-world-day.png`),
Astra reads as **about ten separate cardboard tiles floating in pale sky, joined by thin raised footpaths**. It
doesn't look like one town in a landscape. Motion at that zoom is 0.24–0.39% of the frame. Nothing invites you to
dive in, and the two biggest spectacles (rocket launches and the Roadster stunt) can't be seen from it. Ashe's
"mountains, trees and windy roads between districts" exists in exactly one place: the Pinecrest pass
(`29-mountainpass.png`), and it's the best-looking connection in the game. Everywhere else the gaps between
districts are empty sky.

The second issue is **population**. Forty named residents plus local loop actors are spread over 18 districts.
The core town is busy enough. The outer districts (airport, Roadster arena, Starbase, West Works, Clover Fields,
the baseball diamond) are often empty sets with props and no people.

## What's charming (keep and protect)

- **Rooftop shop signs downtown** (`41-fountain-closeup.png`): the coffee cup, bread loaf, open book and flower
  bouquet. They do what Tiny Las Vegas's signage does. The eye reads each shop at a glance, and the square looks
  dressed up. This is the strongest single art idea in the build.
- **Lantern Quay at night** (`19-quay-night.png`): string lights, a crowd at the riverside stage, terraces full.
  It's the one place where night clearly beats day.
- **Ocean Drive** (`26-strip-night.png`, `25-coast-day.png`): pastel stepped towers, rooftop tables, palms,
  umbrellas, volleyball. It's dense in the way the rest of the town should be.
- **Pinecrest + the mountain pass** (`28-themepark-day.png`, `29-mountainpass.png`): queues at the rides, two
  coasters, shuttles climbing a switchback road through pines. The connection itself is the attraction here.
- **Saltwind Harbor at dawn** (`24-harbor-dawn.png`): long shadows, a striped lighthouse, cutters at the pier, a
  bus on the coast road. Good composition and good use of time of day.
- **Stillwater countryside** (`22-outskirts-day.png`): the best "edge of town" in the build. Forest thickens, the
  lake, campground, red barn and fields read as a gradual transition.
- **Friday-night stadium** (`16-campus-evening-game.png`): full bleachers, a scoreboard, players on the field.
- **The daily rhythm.** At 07:00, 18 of 40 residents are at home. At 13:00 nine are "Enjoying a packed lunch".
  At 21:00, 21 are at the Quay. At 01:00, 27 are home. A patient watcher will notice the town change shape over a
  day, and that's the core of "alive".

## What's dead or repetitive

| Observation | Evidence |
| --- | --- |
| The world view has almost no visible motion (0.24–0.39%); people and cars are under a pixel | `01`–`05` |
| Districts are floating plinths with exposed earth sides; gaps are empty sky | `01`, `21`, `23`, `30`, `42` |
| Long links (to Merrymead, Roadster, Starbase, airport) are raised footpaths with no cars, trees or terrain | `42-world-midzoom-coastlink.png` |
| Every body of water is its own rectangle; the sea is cut off square at the edge of the coast and Starbase | `25`, `31`, `42` |
| Baseball diamond: no bases, dugouts, players or spectators at 16:00. It's a flat painted square (0.20% motion) | `44-baseball-afternoon.png` |
| Roadster arena between shows: a grey slab, parked cars and six spectators (0.28% motion) | `30-roadster-show.png` |
| Airport: one Cessna on a huge apron, no airliner at the terminal, no passengers, no ground vehicles | `27`, `45` |
| West Works at 10:24: counters at 0 / 0 / 0, "neighbours are on their way", fields empty | `18-works-day.png` |
| Market Square at 10:00: a well, two stalls, two people. Its view is nearly the same frame as Willowbank's | `12` vs `13` |
| Clover Fields: lawns and five trees; almost no one working the orchard at 15:00 | `20-orchard-day.png` |
| Night is a blue-grey tint more than true night: lamp pools are faint and the coaster and stadium barely glow | `03`, `11`, `33`, `46` |
| Ocean Drive windows at night are flat white rectangles, which read as blank paper, not lit rooms | `26-strip-night.png` |
| Downtown at 18:00 "rush hour" has about five cars; no visible traffic between districts | `43-downtown-rush-6pm.png` |
| The 07:00 herd: 22 of 40 residents are "Walking to The Washhouse" at the same time | `resident-day-sample.json` |

## Where the eye goes

- **World view:** first to the tallest, most saturated objects: the coasters and Ferris wheel, the pastel coast
  towers, then the Starbase high bays. The real heart of the town (the fountain square, the river and the
  stadium) is a small grey-green patch in the upper middle. The world view sells Astra's edges, not its centre.
- **Downtown:** the rooftop signs, then the fountain, then the stalls. That's exactly right.
- **Quay at night:** the stage glow, then the string lights. Right again: light leads the eye. This is the
  argument for making night the showpiece everywhere.
- **Problems:** the eye catches on the exposed tan-brown slab edges and the big lavender void beyond the edge of
  the island (`19`, lower right). In the airport and Roadster views, nothing holds the eye, because the largest
  shapes are empty asphalt.

## Districts: finished vs thin

Motion % comes from the district preset at the time listed. Higher means more of the frame is moving.

| District | Verdict | Notes |
| --- | --- | --- |
| Old Town Centre (downtown) | **Finished** · 3.1–3.9% | Signature district. Wants more cars and a little more infill |
| Lantern Quay | **Finished at night** | Best night scene; quiet by day |
| Coral Coast / Ocean Drive | **Finished** · 1.4–3.0% | Densest district. Fix the night windows and the square-cut sea |
| Pinecrest + pass | **Finished** · 2.7% | Needs night lighting to match its daytime |
| Saltwind Harbor | **Finished** · 4.1% | Lovely; boats could actually leave the harbour |
| Stillwater & Hinterlands | **Finished** · 0.5% | Beautiful but slow; that's acceptable for countryside |
| Astra High + stadium | Mostly finished | Stadium great; **baseball diamond unfinished** |
| Sunbeam Terrace | Mostly finished · 1.0% | Handsome terraces; the courtyard needs life (washing lines, kids, more neighbours) |
| Civic Green | Mostly finished · 1.8% | Good park layout; caption says "morning rounds" at 14:00 |
| Willowbank | Mostly finished · 2.5% | Cozy, but houses sit on oversized lawns; low density |
| Merrymead Park | Thin · 2.5% | Ferris wheel and carousel are nice; big empty lawns, few guests, floating slab |
| Switchyard Skate & Bike | Thin · 1.6% | Riders are fun; a floating plinth jammed against the mountains, no surroundings |
| Starbase Texas | Thin between events · 1.1–1.4% | Landing plumes are dramatic; the rest is flat sand, few people |
| West Works | Thin · 0.8% | Mostly empty fields and dirt lots at peak hours |
| Market Square | Thin · 1.7% | Not a square yet; it's a strip beside a well |
| Clover Fields | Thin · 0.8% | Lawn, a few trees, a mill |
| Municipal Airport | **Thin** · 0.6% | Scale is right; almost no activity on the ground |
| Roadster Proving Ground | **Thin** · 0.3% | Dead air for most of the 87-second loop; the lineup cars read as generic sedans |

## How the connections read

- **The mountain pass works.** It has curvature, height, trees, a fence, guard rails and buses on it. It's a
  journey, and it frames the theme park as "beyond the hills".
- **Every other connection is a schematic.** The links to Merrymead, West Works, the Roadster arena, the airport,
  Switchyard and Starbase are straight, raised, right-angled footpaths across empty sky, often with a zig-zag
  detour (`42`). They read as debug graph edges, not roads, and nothing travels on most of them. The Starbase
  link (Highway 4 in the copy) has no cars.
- **Water doesn't connect.** The harbour, the coast and the Starbase sea are three separate pools. A boat can't
  plausibly sail from the harbour to the drone ship.
- **The core island** (Willowbank, downtown, campus, civic, Sunbeam, Works, Stillwater) is one landmass and reads
  as a town. That's the template: the outer districts should sit in the same continuous land and sea, with
  terrain in between.

---

## Top 10 changes, ranked by impact on "a town I'd keep watching"

### 1. Fill the gaps between districts with real terrain and roads — **P0**
Replace the floating plinths and raised footpaths with one continuous ground mesh covering the full world bounds
(x −228…366, z −253…370). Districts become flat pads cut into it. Fill everything between them with the Pinecrest
pass recipe: rolling hills and low-poly mountains, pine and broadleaf clusters, meadows and the odd farm field.
Re-route every `world-link` as a curving two-lane road (Catmull-Rom like `APPROACH`), with guard rails, verges,
road signs and occasional lay-bys. Keep footpaths beside roads, not instead of them. Hide the exposed earth sides
of the slabs everywhere except the true world edge, and give that edge one consistent treatment: coastline or
distant mountain ring, not a lavender void. Done means: at 0.22×, no sky is visible between districts, and every
district pair connected in the graph is visibly linked by a road you can trace with your eye.

### 2. One ocean, one coastline — **P0**
Merge the harbour basin, the Coral Coast sea and the Starbase sea into a single animated water plane running along
the south and east edges. Give it a shaped shoreline (beach, rock, breakwater), not rectangle cuts. Then use it:
fishing cutters leave Saltwind at dawn and return at dusk; a ferry or tour boat runs harbour → coast pier; the
Starbase drone ship visibly sails out before a Falcon flight and back afterwards; sailboats drift off Ocean Drive.
This turns the three "edge" districts into one Miami-to-Boca-Chica coastline, which is exactly the kind of
continuous place Ashe described.

### 3. An ambient population layer, so no district is ever empty — **P0**
Keep the 40 named residents as the "followable" cast. Add a cheap, unnamed extras layer that walks the same graph
with the same yielding and uses the same props (instanced bodies, no cards). Drive headcounts per district from a
schedule table, for example airport 15–25 by day, Roadster 40–80 during shows, Starbase 20 + 60 at launch, fair
30–60 on weekend afternoons, baseball 18 players + 30 spectators 16–19h, Works 12 staff 08–17h, Market Square 15
by morning. Extras should spawn from bus stops, car parks and the station, not pop in. Done means: in every
district preset at any time between 08:00 and 22:00, motion is ≥ 1.0%, and at least one person is visibly doing
something specific at a prop.

### 4. Real vehicle traffic on the regional roads — **P1**
Once change 1 gives you roads, put traffic on them. The electric fleet (fastbacks, Cybercabs, the wedge truck)
should run between districts, not only on the downtown loop. Add airport shuttles, a Starbase transporter moving
a booster along Highway 4, delivery vans to the fish market and Works, and theme-park and beach traffic that
peaks on weekend afternoons. Scale density by hour: a visible rush at 08:00 and 17:30, near-empty at 03:00.
Cybercabs should pick up and drop off at real doors (bakery, terminal, Ocean Drive) and then drive away. That
"robotaxi doing its rounds" is the most Tesla-flavoured micro-story available. Done means: downtown shows ≥ 12
moving vehicles at 18:00, and every inter-district road has at least one vehicle on it at any daytime moment.

### 5. Make night the showpiece — **P1**
Night is where a miniature diorama earns its keep, and right now it's a cool tint. Darken the night grade
(lower ambient and hemisphere light, deeper sky) so emissive surfaces carry the image. Give windows warm,
per-building variation (some dark, some amber, a few TV-blue) instead of uniform white, especially the Ocean
Drive towers. Make lamp pools a clearly visible additive ground decal. Add floodlight cones at the stadium and
Switchyard, chase lights on the coasters and Ferris wheel, neon tubes on Ocean Drive signs, runway edge lights
and a rotating beacon at the airport, the harbour lighthouse sweep, and red obstruction lights on the Starbase
tower. Optional: fireworks over Pinecrest at 22:00 on Fridays. Done means: at 22:00 in the world view, you can
point to every district by its light signature alone.

### 6. Surface the spectacles, so the eye knows where to go — **P1**
Big moments (launches, booster catches, the Roadster jump, kickoff, the bandstand concert, the airliner landing)
are invisible unless you happen to be zoomed on them. Add a small "Coming up" strip to the Little Happenings card,
e.g. "Starship launch · T-2:00 · Starbase ▸" and "Roadster show in 40 s ▸", where one click flies the camera
there. Also make the effects themselves world-scale: launch plumes and the exhaust trail should climb high enough
to read at 0.22×, and the stadium should get a glow halo during games. Optionally offer an "auto-tour" idle mode
that drifts the camera to whichever event is next. That's what turns "nothing to do" into "something's about to
happen".

### 7. Finish the four thinnest districts — **P1**
- **Airport:** an airliner parked at the terminal stand with a jet bridge or air-stairs, baggage carts and a fuel
  truck that drive up after it lands, passengers walking from the car park into the terminal, a taxi rank, and
  helicopter rotor wash on the pad. Run a full taxi → takeoff → circuit → landing → taxi-in cycle on the ground
  every few minutes.
- **Roadster arena:** fill the dead time with idle beats (pit crew pushing the Roadster back, a marshal walking the
  ramp, the crowd standing and sitting), a bigger grandstand that fills before the show, and lineup vehicles with
  distinct silhouettes (Cybertruck wedge, Semi cab, Cybercab two-seat pod) so they don't read as generic sedans.
- **Baseball:** bases, a pitcher's mound, dugouts and bleachers, a full Owls practice 16:00–18:00 and a game on
  Saturday, using the existing `baseballFrame` drill with nine fielders.
- **West Works:** workers in the fields and timber yard from 08:00, a freight train that actually arrives and
  leaves, and crates that visibly stack up. Start the counters from a believable morning baseline so a fresh
  visit doesn't read "0 / 0 / 0".

### 8. Tighten the core town to "dense miniature" — **P2**
Tiny Las Vegas works because almost every tile carries a detail. Willowbank and Clover Fields have big empty
lawns and wide roads. Without moving buildings: narrow the residential street mesh by about 25%; add gardens,
hedges, sheds, washing lines, mailboxes, bins, parked cars in driveways, bikes and kids' toys around every house;
turn the Willowbank "market" strip into a proper paved square with 6–8 stalls, awnings and a market crowd on
mornings and Saturdays. Give it a distinct view from Willowbank's, because today the two presets are nearly the
same frame. Add orchard rows and pickers to Clover Fields. Done means: at 2.5× in any core-town view, under ~25%
of the frame is undressed flat lawn.

### 9. Activity text and schedule sanity — **P2**
The follow card is where a watcher bonds with a resident, and today it leaks implementation details. Labels like
"Walking to cv-bench", "Log_bench: sit", "Tea_table: eat", "Taiko_drum: play-music" and "Yatai_food_stall: browse"
come from asset IDs. Map every interaction to human copy ("Heading for a bench by the river", "Playing the taiko
drum"). `runtime.js:76` maps every `eat` to "Enjoying a packed lunch", which shows at 21:00. Make it meal-aware
(breakfast, lunch, supper, a late snack). Spread the 07:00 departure: 22 of 40 residents walking to the Washhouse
at once reads as a herd. Cap trips that can't finish before closing time, since one resident walks to the Roadster
arena from 22:00 to past midnight. Fix captions that contradict the clock, e.g. "The morning rounds" at 14:00.

### 10. UI polish that affects first impressions — **P3**
The world view opens at 0.22×, where Astra looks smallest and stillest. Open instead at about 0.6× centred on the
town (`40-world-midzoom-day.png` is a much better first frame), with "The whole world" one click away. At mid zoom,
the hero copy ("Nothing to do. So much to see.") overlaps Merrymead. Fade it once the user pans or zooms. The
sun / 3pm / moon buttons highlight the wrong preset (3pm lit at 11:00 and 17:00, sun lit at 21:30). Highlight only
an exact match, or none. Minor art: the Town Hall rooftop sign is an unreadable beige block, and "SUNRISE · BAKERY"
has a stray dash through it.

---

## Summary

Astra already has the hard part. The cel-shaded look is consistent, the town centre is lovely up close, and
residents follow a believable day that peaks at the Friday-night quay. It doesn't yet feel like a town you'd keep
watching from the top, because the world is a set of floating tiles joined by footpaths, the water is split into
pools, and the outer districts are often empty. Top three changes:

1. Continuous terrain and winding roads between every district. The mountain pass already shows how.
2. One shared ocean.
3. An ambient crowd and traffic layer so every district always has people.

Next come a real night grade and world-visible spectacles, then finishing the airport, Roadster arena, baseball
diamond and West Works.
