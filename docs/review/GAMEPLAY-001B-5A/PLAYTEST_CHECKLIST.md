# Playtest checklist — observed versus remaining

## Executed developer checks

- [x] Launch `?debug=field&seed=42`; complete validated geometry appears using the existing Kenney models.
- [x] Keyboard and real Chromium touch/pointer capture steer the original Ship; portrait/landscape layouts remain usable.
- [x] All four encounter families occur in an accelerated *actual-model* causal reference run and render through the original World.
- [x] Natural neutral-input collisions drain the real three hull points, honor the existing protection period and reach GAME_OVER; Replay resets the run.
- [x] Pause and focus loss stop model/planning ticks; deliberate resume is required.
- [x] Restart while pending cancels the old session; source epochs, slots and compact history reset.
- [x] Teardown cancels pending work; retired objects and consumed render records do not erase source ownership.
- [x] Native Web Audio remains running during real-time measurements; existing audio/VFX/resource regressions remain required.
- [x] Default development mode and production with the experimental query retain ordinary wave behavior; no production inspection global/runtime code is exposed.
- [x] Desktop1280×800 and emulated portrait390×844 screenshots were visually inspected against actual scene/HUD captures.

The final generated VERIFICATION report is authoritative for command/test counts and exact-HEAD results. Accelerated coverage and deterministic memory stress are explicitly separate from real-time frame measurements.

## Visual observations

The existing pale asteroid silhouettes contrast with the navy scene, and unequal depths produce different apparent scales rather than repeated flat walls. The active HUD keeps hull, distance and pause at the edges without adding experimental telemetry. The center remains available for the scene; actual desktop and portrait images preserve real values and the approved interface.

Far objects can be small/low-contrast under the unchanged fog. Overlapping depth cues need observation in motion rather than approval from a still image. At an extreme X boundary in portrait, part of the ship wing/exhaust can clip the edge. The camera/bounds were intentionally preserved; this is an unresolved visibility gate, not a claim that every pose fits. It is more evident when a reference route parks at a corner.

Actual screenshots include early/established old/new desktop/portrait, keyboard/touch flight, pause, game over and encounter-depth coverage. The short WebM is a native silent canvas capture; HUD is represented in screenshots. Two decoded video frames are checked to differ. No synthetic gameplay imagery is used.

## Required external/human follow-up

- [ ] A human plays several seeds with ordinary keyboard and analog touch, including deliberate late reversals and abandoning a previously viable route.
- [ ] Record first *meaningful* avoidance and perceived warning, rather than equating a beam action or an axial opportunity with a human decision.
- [ ] Evaluate whether vetoes create idle stretches or preferentially remove corner pressure. Test longer passive boundary runs and source-conditioned counterfactuals.
- [ ] Inspect sudden appearance, large overlapping silhouettes, fog, incoming velocity and portrait edge clipping under continuous movement.
- [ ] Compare perceived consistency, clutter, variety and fairness with the old generator. No preference/enjoyment result has been claimed.
- [ ] Test named physical phones, sustained thermal behavior, background/resume and real notch/thumb reach; viewport emulation is insufficient.
- [ ] Review cold Launch audio/context work and long-session allocation separately from generator work.

No production rollout or B-5B implementation is authorized by these checkmarks.
