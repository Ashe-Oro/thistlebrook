# Fix the white bubble overlays on phones (Ashe, Nov 20 2026)

Ashe looked at https://thistlebrook.vercel.app on his iPhone (Brave, ~390x844 CSS px) and said: "just fix the white bubble overlays". His screenshot: /workspace/scratch/bubbles/ashe-phone.png (look at it first).

On a phone, three big cream/white rounded cards stack over the top of the map: the masthead (leaf emblem + "thistlebrook / A little place to linger"), the clock card ("10:30 am / FRIDAY · EARLY SUMMER" with a chevron), and a full-width "EXPLORE · Your own little corner" dropdown. Together they eat the top ~30% of the screen and cover the island. The zoom/rotate/home tool bubble sits bottom-right. There are also odd pale white triangles in the top-right and bottom-right screen corners — find what those are and remove them if they're an artifact.

Goal: on narrow screens (≤ 600 px wide) the overlays should be small and unobtrusive so the island is the hero:
- Merge masthead, clock and explore into one compact top bar (single row, ≤ 56 px tall, safe-area aware), or otherwise shrink them hard. Keep the wordmark, time and the explore menu usable by touch (tap targets ≥ 40 px).
- More translucent / lighter-weight glass is fine; keep the existing cel/cream style and fonts.
- The tool bubble can be a slimmer vertical pill.
- Desktop layout must not change (compare desktop before/after at 1440x900).
- UI code: src/astra/ui.js, src/astra/style.css, src/astra/navigation.js, src/astra/place-info.js. Don't touch the favicon, the 3D scene content, or anything on hold (minimap, villager inspector, interiors).

Rules: work only in this worktree (/workspace/cel-town-wt/mobile-overlays, branch village/mobile-overlays). `npm install` if needed. `npm run test:ci` must pass; add a small test that the narrow-screen layout keeps the top overlays within 56 px (Playwright at 390x844 is fine). Shots with Playwright + /usr/bin/google-chrome (swiftshader), free dev port: before/after at 390x844 and desktop 1440x900, into /workspace/scratch/bubbles/. CHANGELOG entry, local commit only. No push, no deploy, no secrets printed.

Finish with: commit hash, test result, shot paths, what the corner triangles were.

What I'll check: the after phone shot shows the island with only a slim top bar and slim tool pill; desktop shot unchanged; test:ci green.
