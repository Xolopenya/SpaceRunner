# Interface reference research — PHASE-3-004A

Studied 2026-10-23. References inform hierarchy and restraint; none are game assets. Links below retain the original host or identify the reference copy. No proprietary image, logo, font or layout was downloaded into the repository or review ZIP.

## Race the Sun / Flippfly

Sources: [official media gallery](https://flippfly.com/racethesun/media/), [clean flight image](https://flippfly.com/wp-content/uploads/2013/07/ScreenShot4.png), [developer's 2013 gameplay announcement](https://www.moddb.com/games/race-the-sun/news/flippfly-releases-new-gameplay-video-poster-design), [HUD screenshot from that announcement](https://media.moddb.com/images/articles/1/123/122051/MurderCube.png).

The early HUD image puts score and multiplier in a left corner and pause in the opposite corner. Narrow, high-contrast numerals have immediate priority. Angled panels distinguish the interface from the low-poly scenery without surrounding the ship. Repeated triangles have game meaning there; Space Runner should not import them as decorative telemetry. The clean gallery image demonstrates how much the ship silhouette and horizon benefit from empty space. Warm scenery and pale HUD remain separate through value contrast, not neon saturation.

Transfer: perimeter-only active HUD, one primary number, a plain pause target and short onboarding. Do not copy the panel silhouette, multiplier or collection system. The 2013 HUD is explicitly an early-build reference, not evidence of the current release's interface.

## Hyperburner / Bad Potion

Sources: [developer-published page and screenshot gallery](https://badpotion.itch.io/hyperburner), [Flight Basics screenshot](https://img.itch.zone/aW1hZ2UvNjgyODkvNjE3OTY3LnBuZw==/original/51BdZ7.png), [second gallery screenshot](https://img.itch.zone/aW1hZ2UvNjgyODkvNjE3OTk0LnBuZw==/original/Y%2F7ehL.png).

The inspected Flight Basics image has tightly grouped navigation/location text at upper left and a numerical readout at upper right. Thin directional marks share the geometry's angular language; they occupy little area. White text stays subordinate to the bright tunnel exit. Cool blue and warm industrial accents come mainly from the world, allowing the interface to stay restrained. The title treatment uses geometric letters with a strong silhouette rather than a descriptive headline.

Transfer: align small labels to useful information, maintain a calm flight viewport, and let the existing cyan exhaust supply most of the color. Space Runner has no stage completion percentage, targeting, or navigational instrumentation; none is added.

## WipEout Omega Collection / Sony Interactive Entertainment

Sources: [official product gallery](https://www.playstation.com/ja-jp/games/wipeout-omega-collection/), [official launch presentation](https://blog.playstation.com/2017/06/06/wipeout-omega-collection-launches-today/), [HUD-bearing reference copy and attribution](https://en.wikipedia.org/wiki/File:Wipeout_Omega_Collection_gameplay.jpg).

The official screenshot gallery contains clean promotional scenes, so HUD analysis uses the separately identified low-resolution gameplay reference. Its corner numbers are larger than their labels, with angular framing and grouped peripheral instruments. Opposing upper anchors leave the ship and approaching track readable. A restrained palette within each cluster prevents multiple equally loud accents. Letter shapes and strong numeric scale make the presentation recognizable beyond a generic science-fiction font choice.

Transfer: tabular values, deliberate size contrast and a limited forward-slant experiment in B. Space Runner has no laps, position, weapons or energy system. Do not borrow racing-team marks, proprietary lettering or the original instrument arrangement. The reference copy remains linked only, with Sony's rights retained.

## Transitions and evidence limits

These are still-image studies viewed in a real browser. No reference transition durations or interaction behavior were measured. Proposed Space Runner behavior is our own: immediate input response, 120 ms hover treatment, no delay before flight/replay, no continuous HUD decoration, and reduced-motion support. A future implementation can use a short opacity change for pause; never blur the active hazard field or animate score digits so they become harder to read.

## Type investigation and licenses

[Oxanium](https://github.com/google/fonts/tree/main/ofl/oxanium) offers angular but open letterforms; 500 suits A/C and 700 gives B more mass. [IBM Plex Mono](https://github.com/IBM/plex) separates labels, units and controls from display type. Keep labels compact, with explicit units and tabular scores. Small mobile labels need a conservative contrast and spacing budget; thin decorative microcopy is excluded from game content.

Both families use [SIL OFL 1.1](https://openfontlicense.org/). Verified the [Oxanium notice](https://raw.githubusercontent.com/google/fonts/main/ofl/oxanium/OFL.txt) and [Plex notice](https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/OFL.txt) before approved download. Three unchanged local TTFs total **185,564 bytes**. Complete notices, official download URLs and hashes are in `design/ui-concepts/assets/fonts/` and `docs/ASSETS.md`. They are design-only, outside the production entry graph.
