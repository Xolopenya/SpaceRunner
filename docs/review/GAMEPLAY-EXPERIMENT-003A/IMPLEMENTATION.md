# GAMEPLAY-EXPERIMENT-003A — Pressure First

Approved baseline: `928b88a2cc266f5086711da5b4e9f3424b01620d`. Branch: `feature/gameplay-003a-pressure-experiment`. This is a reversible development experiment; B is not approved for production or declared more enjoyable.

## Selection and exact changes

- A: `http://127.0.0.1:5173/?debug=field&policy=baseline&seed=42` — `director-v1`.
- B: `http://127.0.0.1:5173/?debug=field&policy=pressure&seed=42` — `pressure-v1`.
- Omitting `policy` preserves A. Unknown policy names fail explicitly during DEV boot instead of silently substituting a variant. `policy` without `debug=field` does not select the field. Production strips both policies and the inspection global.

The existing DifficultyDirector accepts one optional policy argument. Its baseline path retains the original keys, decisions, spans, intensities, placements and golden. No second director, new sampler or procedural framework exists. The pressure branch uses the same cursor, pacing transitions, cooldowns, four families, PatternGenerator, ambient sampler and corner bag.

| Parameter | A | B |
| --- | --- | --- |
| RNG namespace / result version | director-v1 | pressure-v1 |
| First section at cell4 | Regular ambient, original duration | Scattered,3 cells |
| Non-recovery selection | Original probabilistic ambient/encounter mixture | Always an existing encounter |
| Regular family pool | Original scattered selection | Scattered/narrowing; if both on cooldown, remaining existing families |
| Rising/high family pool | Original pools | All four, excluding last two families |
| Non-recovery intensity base | regular .15+.4p; rising .4+.3p; high .7+.2p | regular .62+.16p; rising .66+.16p; high .74+.16p |
| Intensity jitter / bounds | ±.02;[.05,.92] | Unchanged |
| Encounter span | Family minimum plus original bounded increment | Existing family minimum:scattered2,narrowing3,alternating/weave4 cells |
| Recovery | Ambient,2–4 cells | Ambient,2 cells |
| Paired placement | Existing corner-pressure-v1 bag/transforms | Unchanged algorithm; more frequent opportunities |

Here p is the original bounded distance progression. One cell is24 units. Shortening an ambient span alone would not increase its sampler density; B changes actual pattern selection/count/spacing. `densityTarget` remains descriptive and never enforces admission. Actual output is measured in AB_COMPARISON.

## Integration and preservation

Only the DEV dynamic import passes the selected policy into RuntimeGameModel/RuntimeObstacleField. Live diagnostics expose `field.policy={name,version}` and include both on every bounded publication event. Section IDs/version identify the policy; individual hazards retain unchanged canonical B-1/B-3 provenance. Restart retains the selected policy and seed.

Actual Ship, acceleration/braking, bounds, forward speed, camera, GameModel damage/score/state ordering, collision proxies/CCD, VFX, audio, UI, assets, production waves and dependencies are unchanged. Safety and ownership modules are not edited. No new asset, shape, mover, collectible, reward, HUD or worker is introduced.

`pressure-preservation.mjs` reconstructs approved tracked blobs in ignored storage, compares12 real baseline-model histories and checks23 protected sources. Its fresh production build equals the current build byte for byte:15 files,931651 bytes. Existing director/ambient/trajectory goldens remain unchanged.

## Evidence and reproduction

`pressure-benchmark.mjs` writes complete per-run inputs, timestamps, actual proposals/commits/omissions, publication roots/controls/certificate hashes and geometry. Its four independent Node processes are benchmark workers, not game workers. Early prefixes are compared with real GameModel until death. Independent unpruned replay audits all accepted certificates. Full methodology and limitations are in AB_COMPARISON and FAIRNESS.

`pressure-browser.mjs` captures actual Three.js/audio gameplay, silent native canvas WebM, decoded differing frames and finite restart/resource checks. Exact12s seed42/neutral screenshots come from browser tests. No screenshot is an illustrative replacement for gameplay.

Review packaging allows only the four explicitly listed pre-existing untracked user roots. It hashes them before/after verification and packaging, rejects every other untracked path or tracked change, and excludes their contents from HEAD/snapshot/patch. This preserves the installed skill, lock and research files without committing them. Historical reproduction now exports command logs into the current review evidence directory; original historical assertions remain intact.

The review manifest records the final HEAD, approved baseline, all command exit codes, source snapshot, full binary patch, screenshots/videos, SHA256 inventory and exclusions. The ZIP is ignored. No merge or main push is part of this task.
