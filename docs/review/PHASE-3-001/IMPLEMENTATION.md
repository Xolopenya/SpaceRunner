# Implementation — PHASE-3-001

## Problem and resulting behavior

The player approved flight feel but mistook green rectangles for objectives and reported occasional debris collisions in visibly empty space. Normal flight now relies on obstacle distribution: safe-wave gates are removed, instructions say to read the gaps, and closed decorative blue frames become dim corner fragments. Logical reachable waves, seeds, density/spacing and difficulty are preserved.

Actual normalized GLB measurements and a developer wireframe inspection confirmed excess spherical volume on the half meteor, barrel and generator. Those variants now require simultaneous sphere/box contact across the step. The two round meteors and player sphere stay unchanged. A visible generator near miss that hit the old sphere is tested to pass, while a subsequent direct impact still removes one hull and activates the shield.

## Implemented files

- `world.ts`, `index.html`: remove all eight safe-gate visuals/update code, change only misleading control copy, preserve environmental motion with disconnected blue corner guides. Ship banking, camera formulas and other visual effects are unchanged.
- `core/hazard-profile.ts`: measured half-extents and the exact original orientation/variant mapping; asset catalog re-export preserves callers.
- `core/collision.ts`, `hazard-collision.ts`, `game-model.ts`: continuous sphere/rounded-box distance query, simultaneous outer interval, rotation bound and reusable vectors/breakpoints. Existing damage/state/score order remains.
- `debug/`, `main.ts`, `game.ts`: opt-in development wireframes/factory/lifecycle, throttled information overlay, restart-safe reuse and explicit disposal. No permanent HUD controls or production debugger.
- `scripts/collision-audit.mjs`, collision/browser tests: actual GLB measurements, numerical edge cases, rotation/fast crossing/fairness-envelope checks, developer visibility/resource checks and fresh screenshots.
- Review scripts/config, README/project/tasks/collision docs: current task metadata, authored reports, collision JSON, raw evidence and local ignored review ZIP. No build-system refactor or dependency install.

## Verified facts and testing boundaries

Read required guidance/source/tests and inspected Git branches/remotes. Fetched origin; main and origin/main both matched approved `08ceed4`; the pre-existing target feature branch matched that baseline and was switched to without resets. Baseline outputs were saved before implementation: typecheck, 25 unit tests, build and 8 Chrome tests passed.

New numerical coverage includes exact box faces/corners/tangencies, full-segment crossings, real model-bound drift, inverse Euler matching Three.js matrices, 10,000 subset sweeps, 600 rotating reference fixtures and max-speed hull/shield behavior. Existing 64-seed route/fairness and movement/storage/state tests remain. Exact final check names/counts/exit codes come from generated `VERIFICATION.md`, JSON manifest and raw logs.

Chrome tests cover normal/default dev with no gates/debug root, logical Wave retention, development collider alignment, an actual generator near miss/direct impact, repeated restarts/disposal, keyboard/touch/focus/context recovery and production with `?debug=colliders`. Production checks require no overlay and no unique private debugger marker in emitted JS. Real screenshots are captured at desktop/mobile sizes. Deterministic fixtures position hazards; collider scenes freeze simulation and hide the pause panel only for inspection. These are actual GLB/WebGL renders. Physical-device behavior is not inferred from emulation.

Existing flight parameters/config, Ship/Input/GameLoop/ObstacleField files remain unchanged. No GLB bytes changed or downloads were added. Model response counts remain six through restarts; debug wire resources are owned separately from imported assets and world scenery. The current review package collects no previous-task screenshots/logs as current evidence.

## Compromises and known issues

The sphere/box rule is an intersection after player-radius expansion, so it is conservative near seams; midpoint rotation padding is below 0.007 units at normal stepping. Collider wire boxes show end-pose bounds rather than the tiny swept padding. Original outer-sphere limits can clip box corners; both conditions are explained in the debug legend. Irregular surfaces and machinery gaps remain approximations. Decorative ship wings intentionally extend beyond its forgiving 0.42 sphere.

No known unresolved regression in verified Chrome flows. Physical phones, Safari/Firefox, sustained memory/performance and final manual feel acceptance remain. The pre-existing Vite advisory stays visible; actual before/after build measurements and current module attribution are retained. No visual effects, sound or Yandex work was begun.

## GitHub/review delivery

Commit verified changes on `feature/phase-3-readability`, push only that branch to configured origin, and leave main untouched. Create a PR if authenticated tooling is available; otherwise supply the exact compare URL. The ZIP stays local and ignored. It includes full tracked sources/assets/licenses, current reports, binary baseline patch, Git metadata, raw baseline/current/diagnostic logs, screenshots, measurements and a hash inventory. `review:pack` reruns checks after commit and validates each archive entry.

Recommended follow-up: independent architecture review plus player acceptance of the near-miss examples before any merge. Audio/effects/SDK require a separate task.
