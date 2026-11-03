# Actual Chrome evidence

Normal local feature: `http://127.0.0.1:5173/` → Launch run. Production preview: `http://127.0.0.1:4173/`. No DEV option is required for the new mechanics. Overlay: `http://127.0.0.1:5173/?debug=collectibles&colliders=1&seed=42`. Pink=body, green=left wing, blue=right wing, yellow=fragment .32+.26 assist, amber=asteroid sphere, mint=calibrated boxes / actual station solids. Overlay is removed from production.

All videos are actual Chrome captures of the normal ReleaseModel simulation. Automated inputs use unchanged Ship motion and actual accepted geometry. Unrendered prefixes are simulated first, then recording shows real-time flight. Wing recordings stop shortly after the real hit to permit a readable screenshot. DEV holds a borrowed visual clone of the recorded impact asteroid for .6 simulation seconds, explicitly labeled as a ghost; it is not active geometry or a new hazard. No inserted obstacles, teleport, hull override or synthesized frames. Playwright WebM is silent; existing audio tests cover the chime. Human approval is not claimed.

| Scenario | Actual result | Media |
| --- | --- | --- |
| Before, .90 vertical near miss | Baseline005, seed42, first fragment pass285.6627569999546. Fly at fragment.y−.90, same X. Hull3, ENERGY00 after passing |004b-before.webm; before-near/after PNGs|
| After, same .90 approach | Body assist collects at285.3152395833335m, hull3, ENERGY01; visible attraction/pulse |004b-after.webm; after-near/after PNGs|
| Left wing ONLY hits accepted asteroid | Seed42, first genuine hit at144.77046527777784m. Collider body clear; left wing intersects ordinary kind1 asteroid; hull3→2 |004b-wing-left.webm; wing-left-contact.png|
| Right wing ONLY hits accepted asteroid | Seed1, genuine hit at1056.1794497685144m. Body clear; right wing intersects ordinary kind0 asteroid; hull3→2 |004b-wing-right.webm; wing-right-contact.png|
| Wing pickup beside station passage | Seed42 lower opening, fragment(1.55,−1.9), body approach(.53,−1.55). Right-wing pickup at563.9830060185179m; hull3, ENERGY02, Phase2 |004b-station.webm; station-near/after PNGs|

For exact replay inputs, contact records (including accepted hazard IDs), frame intervals and errors see ship-browser.json. The wing pilot deliberately chases a reward immediately and holds neutral when no reward is active; it is an adversarial driver, not recommended navigation. The pickup/station pilot follows certified controls until within max(55 units,2.4s forward travel), then steers toward the locally checked approach pose. These are input policies, not geometry modifications.

Before baseline uses a separate real Vite tree archived from05d0754 at port5273. To regenerate, extract `git archive 05d075415a6e813c28134d37d8f74afdb50af7bb` into `.cache/review/GAMEPLAY-004B/baseline-project`, run its Vite at5273, and start current dev/preview at5173/4173. Then run `node --experimental-strip-types scripts/ship-collider-audit.mjs` and `node scripts/ship-collider-browser.mjs` with Chrome and Playwright ffmpeg installed (PLAYWRIGHT_BROWSERS_PATH may point at the local cache).

Browser tests separately freeze attraction partway through its140ms interval, verify pause, restart and production isolation. Twenty collection/restart cycles retain GPU counts and clear all fragment meshes. Raw initial diagnostic failures are retained: early greedy chase hit an intervening wing obstacle; a right-wing evidence prefix initially used the wrong no-reward input policy and was corrected, without changing hazards or damage.
