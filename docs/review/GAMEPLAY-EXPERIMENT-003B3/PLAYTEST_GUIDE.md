# Owner A/B playtest

Start `npm run dev`. Normal automatic mode:

- [Mixed flow,seed42](http://127.0.0.1:5173/?debug=field&experiment=mixed-flow&seed=42)
- [Mixed flow,seed11](http://127.0.0.1:5173/?debug=field&experiment=mixed-flow&seed=11)
- [Mixed flow,seed0](http://127.0.0.1:5173/?debug=field&experiment=mixed-flow&seed=0)
- [Approved B2mixed/right,A](http://127.0.0.1:5173/?debug=field&experiment=large-structure&mode=mixed&aperture=right&seed=42)
- [Baseline field](http://127.0.0.1:5173/?debug=field&policy=baseline&seed=42), [pressure](http://127.0.0.1:5173/?debug=field&policy=pressure&seed=42)

Use ordinary WASD/arrows/touch, release to brake, P/Escape or the existing pause buttons. No aperture is needed in normal mixed flow. `&aperture=center|left|right|upper|lower` is a labeled **TEST OVERRIDE**; remove it for automatic variation. `&colliders=1` is a separate proxy inspection. Old isolated/mixed demonstrations retain their original explicit selectors/defaults.

Play three attempts per A/B mode, alternating order, with seeds42/11/0. Observe90s or until natural three-hit death; continue beyond650m and toward3000m when possible. The game has no observation-window limit. Do not use a certificate controller for human acceptance. Seed alone does not reproduce admitted worlds after different input.

1. Compare empty stretches, regular asteroids/mechanical debris and small multi-depth clusters. Note the first clear reason to steer and the longest perceived idle interval.
2. Identify each wreck aperture before steering. Check that subsequent wrecks change sides/height, that ordinary hazards bridge them, and that recovery feels sufficient. They should be notable encounters rather than identical periodic doors.
3. Try horizontal/vertical reversals, irregular steering, each edge/corner and analog touch. Some blind test tapes die early; assess readable alternatives rather than expecting arbitrary inputs to survive.
4. Inspect entry/exit, wing tolerance, explainable solid hits and lower-exit camera masking. Test pause/resume during approach and a real Replay after death. Repeat portrait/landscape on physical hardware.
5. Read scheduled/committed/omitted totals separately from **current active** ordinary/large counts. Last encounter/aperture describe published content; rejection can remain visible after a successful ambient replacement. Fault should be none.
6. Press **Export recent trace** after an omission-heavy or unclear encounter. It downloads local JSON with policy/seed/epoch, exact recent roots, input runs, known/proposed geometry, failed witnesses, collision reasons, alternatives, budgets and ledger. Only16decisions/128input runs are retained. The equivalent console API is `window.spaceRunner.model.field.exportDiagnosticTrace()`.

Record device/browser/orientation, seed, mode/order, actual distance/hits/death, observed gaps, source/family/aperture, input/video and trace. Report adverse runs as well as successes. The previous owner observation5/23commits and eight consecutive omissions remains the historical reference; do not replace it with a witness success.

Owner checklist:[ ] substantially fewer empty stretches;[ ] ordinary debris regular;[ ] wrecks occasional and varied;[ ] both axes readable;[ ] one coherent flow;[ ] no easy permanent boundary strategy;[ ] fair/explainable collisions;[ ] acceptable CPU stalls;[ ] touch usable;[ ] more enjoyable. No new human feedback is claimed. Review this mixed field and its residual gaps/performance before authorizing moving hazards; a separate dynamic-geometry contract would still be needed.
