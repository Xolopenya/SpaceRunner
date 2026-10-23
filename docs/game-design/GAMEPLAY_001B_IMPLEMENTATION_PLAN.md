# GAMEPLAY-001B implementation roadmap

**This is the GAMEPLAY-001A research delivery, not authorization to implement B.** First obtain independent architecture review of the eight documents, especially actual-state replay semantics, conditional safety, finite-search budgets and fallback behavior. Production remains at approved `f1a651e5d2a6079aadf51a31e6ca929e25bf0d31`.

Recommendation: a distance-indexed hybrid stream plus four small encounter intents, with bounded stateful trajectory validation and existing pooled rendering. Preserve continuous XY controls and all movement/camera/collision response/health/UI/audio/VFX. See [architecture](CONTINUOUS_FIELD_ARCHITECTURE.md), [fairness](PROCEDURAL_FAIRNESS.md) and [test plan](GENERATOR_TEST_PLAN.md) for contracts and acceptance targets.

## B-1 — Data contracts and isolated stream foundation

Expected files: new `src/core/field-generator.ts` and focused tests, a small future field-settings module, existing `obstacles.ts` facade. Introduce stable IDs, pass-distance coordinates, half-open 24-unit ownership cells, bounded candidate storage and atomic pool reservation. Seed keyed local RNG streams; record version/replay inputs. Build full-XY, varying-depth ambient candidates in tests only.

Acceptance: real candidate determinism/range/overlap/cell/pool/reset tests pass; existing production default remains old generator. No UI switch, new asset or movement tuning. Explicitly check that no fixed X-band bypass follows from the new placement constraints. Source remains pure core with no renderer/DOM dependency. This milestone depends on approved replay/capacity contracts, not on a speculative generalized content framework.

## B-2 — Shared prediction and fairness certificates

Expected files: `core/field-validator.ts`, focused pure collision-margin/shared-step extraction only if needed, `tests/field-validator.test.ts`, local stress diagnostics. Reuse exact Ship and actual calibrated collision semantics; default-margin behavior must remain equivalent. Implement root position/velocity/input, temporal broad phase, bounded exact-state beam, independently replayed witness, terminal empty braking tail, work limits and current-root publication recheck.

Acceptance: all explicit R fixtures get their required witness/layout result; composability, rotating non-spherical proxies, reaction, stale roots, limits and no-hit-with-immunity tests pass. Profile real candidate contexts and named devices against budgets **before** exposing the new path to regular play. If budget/deadline or bootstrap assumptions fail, stop this milestone and revise the reviewed design; a beam-search result is not a continuous-state proof. No unbounded retry or silent all-input claim.

## B-3 — Minimal multi-depth encounters

Expected files: `core/field-patterns.ts`, catalog metadata adjacent to existing pure profiles and pattern tests. Add scattered, gradual narrowing, alternating avoidance and vertical weave intents. Keep current five assets and radius range; visual/profile identity must agree. Candidate ambient and full multi-cell pattern geometry share one admission/validation pass.

Acceptance: joint transition and budget tests pass across the fixed corpus; coplanarity/overlap screens work; small pattern count and mirrored/translated variants are distinct. Do not claim a pattern forces vertical motion solely because it was named a weave. Future larger objects, profiles and moving centers remain separate tasks.

## B-4 — Director, pacing and long runs

Expected files: `core/field-director.ts`, field-settings, director tests. Add bounded/asymptotic density progression, seeded variable section lengths, forced recovery after demanding sections and pattern cooldowns. Keep the current forward-speed formula initially. Quotas cover the combined field and obey atomic slot/work admission.

Acceptance: 256-seed structural/stress suite and four long-run director checks have no certified collision/seam failure, overflow or allocation growth. Actual rejection/fallback/clearance/reaction/diversity distributions are recorded. Density must not be hidden behind frequent omissions. Near-miss scoring and progression are still absent.

## B-5 — Development comparison, integration and acceptance

Expected files: a small explicit generator selection seam in GameModel/bootstrap, migrated old wave-specific fixtures, new browser checks and reproduction docs. Temporarily expose new generation only under a **development-only** flag such as `?field=continuous`, stripped from production while it is experimental. Preserve the stable build for matched old/new comparisons. Use seed/version/input replay and common aggregate windows rather than claiming different steering yields identical accepted layouts.

Acceptance: real natural runs on desktop/portrait/landscape, controls, focus, restart, actual collisions/health/best, audio, renderer resources, boot/retry and built-production tests pass. Inspect real screenshots; capture new continuous output only after it exists. Run the local metrics and human checklist; address performance, late visibility and state-veto exploitability. Confirm native pool/World slot assumptions before increasing active cap. Approve default selection only after numerical **and** player review.

At final B acceptance, retire the old production scheduling path and wave/safeX dependencies, including tests that assumed all hazards share a plane. Replace those assertions with equal-or-stronger deterministic reachability/continuity guarantees, retain historical audit evidence, and remove the temporary feature flag. Do not indefinitely ship redundant live generators. If the new design fails acceptance, retain the old default and report B partial instead of declaring the experiment shipped.

## Dependencies, risks and rollback

No backend, AI service, planning package or heavyweight dependency is expected. Existing TypeScript/Node/Playwright and pure dynamics/collision modules suffice initially. A worker is a profiled contingency, not part of the initial architecture by default. Main risks are unsound collision extraction, finite-search false rejection, stale roots, computational lead, bootstrap empty space, capacity/draw growth, state-dependent world exploits and unvalidated human reaction assumptions.

Each B milestone should be its own tested feature commit with actual commands/results. Keep reviewed baseline and default selection until final acceptance. Rollback uses a normal reviewed revert or a new follow-up commit restoring the old selection; never reset published history, force-push or rewrite main. Data-only settings do not justify changing player dynamics to make a difficult pattern pass. External review/merge remains a human decision.

## Research reproduction and package contents

For 001A: `npm run review:verify` runs existing typecheck/unit/build/browser/whitespace/static/build attribution plus real-model collision audit and `node --experimental-strip-types scripts/generator-research.mjs`. `npm run review:pack` repeats those checks from a clean committed tree and captures the eight research documents, complete tracked snapshot, binary-capable patch, exact Git metadata, raw logs, generator JSON/protected hashes and four labelled diagrams. No historical baseline cache or old ZIP is required.

Top-level package aliases `ARCHITECTURE.md` and `IMPLEMENTATION.md` point to the continuous-field design and this roadmap; all eight original filenames remain in `project_snapshot/docs/game-design/`. `logs/generator-baseline.json` is the measured existing field; future parameters/metrics are expressly proposals. No new generator, near-miss reward, obstacle model or production integration occurs in 001A.
