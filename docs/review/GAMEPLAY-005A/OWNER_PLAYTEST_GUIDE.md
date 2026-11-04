# Owner playtest

Use Node22.12+ and installed Chrome. In the repository run `npm ci --ignore-scripts` if dependencies are absent, then `npm run dev`. Open [ordinary Play](http://127.0.0.1:5173/) and press Launch run. The integrated behavior is already the default. For the local static feature build, run `npm run build` then `npm run preview`; this is not a public deployment.

Reproducible [integrated seed42](http://127.0.0.1:5173/?debug=integrated&seed=42) exposes read-only development inspection. Add `&colliders=1` for the existing compound overlay. No `mine=1` flag is needed. Debug seed42 and clean `/?seed=42` use the same simulation. Keyboard: WASD/arrows; P/Escape pauses; M mutes. Touch uses the existing drag control. Pause menu provides resume/restart.

Please test ordinary random runs as well as seed42:

1. Steer laterally and vertically. Judge whether Hybrid helps read the wing footprint while preserving the pleasant motion.
2. Approach each arena edge, then return to center. The nearer edge should become clearer without distracting from incoming debris. The cue does not add a wall or damage rule.
3. Collect a cyan fragment with the body or a wing, then deliberately ignore another. Check the optional ENERGY counter, pickup chime and attraction feedback.
4. Read a station's offset opening early and traverse it. Pay particular attention to the outer wing near a side opening.
5. Continue past500m into Phase 2. Speed increases by the existing amount; check station, fragment, boundary and mine readability together.
6. During a red/orange mine encounter, use a deliberate change of route. Check warning visibility, evasion space and whether encounters feel occasional. Skipped mine proposals are possible on a different input history.
7. Pause during an encounter, resume, then restart several times. Hull, distance, energy and mine state should reset cleanly.

The automated witness clip's seed42 first mine is published around520m and approaches the ship around730m. Human inputs can change publication, route and timing. Do not treat the clip's control path as a required solution. Please report seed, approximate distance, movement direction and whether the problem was visibility, collision, density or control feel.

Owner playtest is required. This package does not approve merge or deployment. Screenshots, silent video excerpts, raw measurements and reproducible commands are included in the review ZIP.

Capture reproduction: `node --experimental-strip-types scripts/integrated-audit.mjs`, then `node scripts/integrated-browser.mjs`. The capture script owns local port5185. Native video requires Playwright FFmpeg; on this workstation the existing repository-local copy is selected with PowerShell `$env:PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/playwright"`. No binary was downloaded or installed for this task. The review ZIP is created from the committed tree with `node scripts/integrated-pack.mjs` after the final receipts exist.
