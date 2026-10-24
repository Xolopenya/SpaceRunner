# GAMEPLAY-001B-3 architecture

Baseline: `4c82ad2dc30f4d309f085cbf3a16a41ffde1c30f`. This milestone adds an isolated logical encounter producer. The live wave generator and every module reachable from the production entry point remain unchanged.

## Ownership and schema

B-1 ambient identity addresses an anchor: owner cell plus local index0/1, with unique anchors across the field. That cannot describe several deliberately placed objects in a single24-unit cell. `encounter-v1` is an additive source schema; `ambient-v1` still emits exactly its approved bytes, including absent pattern metadata and the old anchor restrictions.

An encounter source contains family, first cell, cell count, variation0–65535, intensity[0,1], two center-mirror booleans and actual X/Y offsets. The transaction and each hazard carry this provenance. IDs retain the lossless source tuple, seed, settings key, owner cell and transaction-global ordinal. FNV hashes seed purpose-specific RNG streams only; they are never ownership addresses. `localIndex` means ordinal for encounter-v1 and retains its original meaning for ambient-v1. Encounter `anchorCell` equals actual owner cell and need not be unique. Unknown versions and mixed candidate provenance reject.

Every center still belongs to `floor(passDistance/24)`, with half-open cell intervals. Transactions own2–6 cells,48–144 units. Family-specific minimum spans reject explicitly. The full encounter source span is reserved even when some cells contain no objects. Any nearby committed encounter record reserves its whole source span; a second writer cannot reuse its empty cells. Candidate/committed spans cannot overlap. Committed records may be a surviving subset after eventual despawn, but a new candidate must contain every expected ordinal exactly once. Complete source count plus unique ordinals prevent partial submission. Metadata alone is not a trajectory certificate.

`FieldGenerator.inspect` handles both schemas in one normal path: finite positions, actual cell ownership, canonical IDs, unique ordinals/IDs, catalog profile/orientation agreement, legal radii/spins, configured bounds and genuine all-pair3D center separation of radiusA+radiusB+0.3. Candidate12, joint hard32, soft24 and live pool72 limits are unchanged. Capacity failure returns the complete rejected transaction; no object is dropped or clipped.

## Generation and validation

`PatternGenerator.propose` returns an immutable proposed transaction plus valid structure, or a structured request/span/transform/structural rejection. It owns only seed and a FieldGenerator. Independent geometry, transform and per-ordinal pose streams make request order/rejection/reset irrelevant to unrelated requests. All transform draws occur regardless of explicit overrides. Auto shifts fit the complete geometry within configured center bounds; explicit out-of-range transforms reject.

The four geometry rules live in `field-patterns.ts`; family/version/span/count contracts live in `field-pattern-source.ts`. They use existing catalog metadata and no Three.js, DOM, renderer, model loads or world mutation. Radius/spin distribution does not automatically harden with intensity. Mirrors reflect obstacle centers, not the chirality of rotating imported meshes; each transformed layout requires fresh real collision validation.

The only B-2 adaptations are nested provenance copying/freezing and an empty ambient header for its committed-only base analysis. Full encounter structure is admitted first. The committed geometry is still checked normally; a partial encounter is never disguised as an empty source. Prediction, margin collision queries, search, independent replay, publication checks and all work limits retain approved algorithm sections. Normal `beginValidation` and `beginTrajectoryReplay` use generator policy; no pattern calls synthetic-fixture mode.

## Boundaries

No scheduler, retry/fallback selector, director, field publisher, worker, live flag or runtime integration exists. A later coordinator must preserve ownership through despawn, include complete nearby geometry, honor the empty terminal reservation, and revalidate the actual publication state. Search success certifies a particular input trace from the supplied state. It does not certify arbitrary controls, all later delays, infinite survival or human discoverability. See FAIRNESS_EVIDENCE and INTEGRATION_NOTES.
