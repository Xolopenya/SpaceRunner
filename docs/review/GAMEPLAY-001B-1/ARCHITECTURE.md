# Continuous field foundation — implemented B-1

Approved research baseline: `c447ee52d3fcc891c6c9e633eb604905c5a99443`. Branch: `feature/gameplay-001b-field-foundation`. The eight original research documents remain historical proposals. This report describes the actual foundation authorized by the subsequent B-1 brief.

**Not safe for production gameplay.** This implementation builds proposals and checks structure. It has no trajectory validator or runtime publication and never enters GameModel, World, bootstrap, UI or a feature flag.

## Modules and contracts

| File | Actual responsibility |
| --- | --- |
| `src/core/field-settings.ts` | Separate experimental constants, validated immutable settings and lossless settings identity |
| `src/core/field-types.ts` | Readonly planned hazards/transactions, structural result and B-2 interface only |
| `src/core/field-generator.ts` | Keyed random-access sampling and bounded structural inspection |
| `tests/field-generator.test.ts` | Twelve focused tests, full-precision goldens and256×1024-cell structural sweep |
| `scripts/field-foundation-benchmark.mjs` | Real old/new sampling, source/build boundary, timing, memory and actual plots |

Only tests and diagnostics import the generator. Its existing dependencies are pure `Random` and `hazardVariant`; no Three.js, scene, DOM, asset manager or platform dependency enters it. No existing production source edit was needed.

`PlannedHazard` contains ID, actual owner/local index, sampling anchor cell, center-pass distance, continuous XY, radius, kind, explicit variant/profile, spin/phase, orientation convention and version/seed/settings provenance. `z = currentDistance - passDistance` is a documented future adapter formula, not integrated now. Orientation names the unchanged absolute-time `hazardOrientation` Euler XYZ contract. Explicit variant agrees with existing kind/phase mapping. Profiles identify two round variants and three current calibrated box variants; they do not replace narrow-phase queries.

## Sampling and ownership

For anchor key k≥0, generate `q_k = 24k + jitter_k`, with independently keyed uniform jitter in[-6,6). Each anchor emits one point. Adjacent keys therefore have ordered gaps in[12,36], subject to floating precision at large distances. Anchors are sampling strata, not ownership boundaries or visible spawn batches. Ownership is `floor(q_k/24)`, using half-open intervals[24c,24(c+1)). An owner examines anchors c and c+1 and admits only points actually belonging to it. Negative q is outside the nonnegative stream and omitted before a transaction exists.

This gives0–2 hazards per ownership cell rather than forcing one each. Every admitted anchor samples continuous X[-5.4,5.4), Y[-3.15,3.15), radius[0.65,1.1), kind/spin/phase. Depth and pose use separate streams. A 2–6-cell transaction owns48–144 units; normal count is c−1 through c+1, at most7. Candidate ceiling12 leaves explicit headroom without implementing encounters. **The24-unit anchor cadence remains a distribution limitation**, not a completed director. This bounded stratified foundation differs from jittering the old multi-object lane walls.

Cell keys range0..0xfffffffe; the neighboring anchor fits uint32. Oversized ranges fail before loops. This domain reaches about103 billion units (roughly96 years at speed34); it is a numeric API bound, not a designed run ending. Large-key ownership/finite arithmetic are tested. Future integration should review precision/rebasing rather than silently wrapping keys. Radius-aware usable boundary clearance is not proven: partial outward protrusion is permitted by this candidate box and must enter B-2 validation.

## Reproducibility and lifecycle

Seeds are strictly uint32 integers; invalid values throw rather than alias. The explicit two-multiply uint32 avalanche mixer uses version tag0x41b10001 and purpose tags0xd3e17(depth)/0x905e(pose). It mixes seed and anchor then seeds the unchanged LCG. Every anchor is independent of call order or rejected transactions. There is no shared advancing RNG, pending queue, frontier, retry counter or cell cache.

IDs are lossless strings `(ambient-v1,seed,settingsKey,ownerCell,localIndex)`. Settings identity includes all five settings without a lossy hash; localIndex0 denotes the owner's anchor and1 its next anchor. Duplicate IDs AND anchor identity are checked across context. Goldens pin three complete unrounded transaction hashes and an explicit seed42 ID/pose. Reporting rounding never enters generation.

`reset(seed)` replaces frozen provenance; existing immutable snapshots remain unchanged. Callers own snapshot lifetimes. Rejection returns an explicit invalid reason; proposing the same range again yields identical data. No simplification/retry policy or future acceptance algorithm exists. Capacity exhaustion throws before returning a proposal, or returns invalid for over-capacity inspection data; it cannot return truncated success. Settings are copied/frozen.

## Structural checks and future publication

`inspect` validates span/endpoints, provenance, finite metadata, catalog/pose identity, bounds/radii, canonical ID, half-open owner/local/anchor identity, duplicates, committed-cell exclusivity, 3D sphere separation `r_i+r_j+0.3`, candidate ceiling and total context hard32. It checks the whole committed-plus-candidate context, including neighbors, without mutation. It reports total count and exceeding soft24; soft24 is advisory, hard32 rejects. Arrays/sets are allocated only after count bounds, at most32 records. Production remains72 allocated hazards with unchanged rendering ownership.

Inputs are typed in-process data, not a JSON/security decoder. Inspection permits structurally legal edited poses for future simplification; it is not an authenticity check for exact sampler output. Cells are exclusive within a transaction. A future publisher must track ownership even across empty/omitted cells; stateless inspection does not reserve cells across separate calls.

The future `FieldValidator` carries actual position AND velocity, held input, time/distance, committed hazards and the entire candidate, with explicit accept/reject. No implementation or default acceptance exists. The test double rejects a structurally valid transaction. B-2 must implement reviewed exact dynamics, rotating colliders, response, finite work, witness replay, terminal tail and publication-state recheck. Seed/version/settings reproduce proposals; future accepted worlds can also depend on input history.

No slots are reserved or published here. Future publication must validate the whole candidate against current state, reserve **every** needed record including concurrent reservations, and commit all objects atomically or none. Structural `valid` is neither fairness nor publication approval. Original health, collision, score, controls, camera, audio, VFX, UI, pool and assets remain under the old generator.
