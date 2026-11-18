# Maple Hollow integration

2026-11-18 · America/New_York · seed 831

- Ran `npm ci` and linked `public/licensed` to the same ignored local model library used by the weather, railway and suburb worktrees. All models load from that library.
- Fixed the rain and snow regressions before merging Maple Hollow. Rail passengers use live crossing checks and appear in the vehicle simulations as pedestrians. Cyclist lookahead follows the lane through bends. After the merge, the rain simulation also caught the downtown bus sweeping the sidewalk at a short bend. Smoothing that turn and making Maple drivers yield across both lanes cleared the remaining contacts and unsafe crossings.
- Merged `village/opus-suburb` at `f1762e7` using the saved merge where it applied. Maple local routes turn before the Airport Road and cul-de-sac junctions. Airport through traffic still uses the shared gated crossing. Its deck spans the road, and the barriers lower across the approach lanes. The school bus still reaches both Maple stops and the high school.
- The driveway audit checks paved-bay containment and clearance from structures, props and walking routes. Driveway positions, model choices and paint match the fleet plan for all 22 bays. The integration tests cover all seven school-bus riders, the treehouse, hoop and pool poses, and the separation from nearby districts.

The clear, rain and snow collision runs each finished 5,400 samples with zero incidents. The school bus logged 14 boardings and 14 alightings in clear weather and rain, and 12 of each in snow.

`npm run test:ci` passed all 232 Node tests, the compiler checks and the weather simulations. `npm run build` passed, and `npm run audit:roads` reported zero open findings. The production preview reproduced all three captures byte for byte.

Browser captures are in [shots/maple-integration](../../../shots/maple-integration/). Reproduce them with `node tools/shots-maple-integration.mjs <local Vite URL>`.
