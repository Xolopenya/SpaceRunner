# Owner comparison

Run `npm run dev`, then open [ordinary Play](http://127.0.0.1:5173/). Warp and seamless reveal are already the defaults on this feature branch. This does not change or publish production main.

Use [live comparison seed42](http://127.0.0.1:5173/?debug=visuals&boundaries=warp&reveal=seamless&seed=42). Two pairs of DEV buttons switch boundaries `legacy/warp` and reveal `legacy/seamless` without restarting or changing simulation. The same choices work directly in query parameters. Public ordinary Play has no comparison panel. Add `&colliders=1` for supplementary existing diagnostics.

Please compare all four combinations at the same paused state, then resume:

1. Center, left/right, upper/lower and corners: judge remaining maneuvering room and whether the edge becomes clearer smoothly. Return toward center; it should become quiet again.
2. Watch a newly arriving asteroid: it should emerge without an abrupt high-contrast jump or magical scaling. Look for objectionable grain or flicker.
3. Approach a station: the aperture must be identifiable early enough to align the whole wing profile. Stars should not be abruptly covered by an otherwise fog-colored invisible wall.
4. Watch a mine from its distant waiting silhouette through warning/pursuit. The red warning timing and threat should feel the same as approved005A.
5. Collect a cyan fragment with body or wing, ignore another, then continue past500m. Judge visibility and optional path choice in Phase2.
6. Pause during emergence, resume and restart. The corridor/reveal should freeze and reset cleanly. Try portrait and landscape; viewport captures are included but do not replace a real phone test.

Controls remain WASD/arrows or touch drag, P/Escape pause, M mute. Report seed, approximate distance, active visual combination and whether the concern is edge orientation, grain, reveal timing, station/mine/fragment readability or performance.

Evidence contains frozen exact005A videos, matched four-mode screenshots and silent native Chrome clips: corridor, asteroid emergence, station approach, mine warning, fragment appearance and one continuous integrated segment. Visible clips use recorded ordinary120Hz input axes and two ticks/native RAF after an accelerated prefix. No teleports, inserted hazards, hull edits or uncertified previews are used. Video is25fps capture of60Hz scene cadence and includes some navigation/loading prefix.

Reproduce diagnostics with `node scripts/visual-probe.mjs --baseline` and without `--baseline`, after extracting the exact baseline into the documented cache location. Capture with `node scripts/visual-capture.mjs --baseline` / without the flag. Video requires existing Playwright FFmpeg; this workstation uses `$env:PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/playwright"`. No tool binary or asset was downloaded for this task. Detailed commands/identities are in the package manifest and logs.

Owner playtest is required before final acceptance. Merge and deployment remain unauthorized.

From the original Git checkout, run `node scripts/visual-freeze.mjs` once to extract the exact approved commit into `.cache/review/GAMEPLAY-005B/baseline-project`; it does not copy working-tree sources. Then run the probe/capture scripts with `--baseline` and without the flag, `node scripts/visual-stills.mjs`, `node scripts/visual-analysis.mjs`, and `node scripts/visual-performance.mjs`. Create the review ZIP from a committed clean tracked tree with `node scripts/visual-pack.mjs`. The source-only ZIP snapshot can run the game directly; reproducing the historical baseline audits additionally requires the original Git commit objects or reconstruction using the included reverse patch.
