# GAMEPLAY-001B-4 architecture

Approved baseline: `60ca6fcd64885e7fb8d10fda3a4410b3da39dbf9`. The live game remains on its original wave generator. All B-1/B-2/B-3 source, tests, goldens, assets, dependencies, movement and presentation are unchanged. New modules are imported by tests/research only.

## Implemented responsibilities

| Module | Contract |
| --- | --- |
| field-director-settings.ts | Separate bounded policy constants; no competing speed curve |
| field-director.ts | Pure seeded decisions from explicit bounded cursor/history and distance |
| field-ownership.ts | One writer frontier, one pending reservation, full source-span records and retirement |
| field-section.ts | Bounded B-3 mirror/translation placement for seeded corner-pressure coverage |
| field-scheduler.ts | One pending planning session, actual normal admission/replay, fixed publication root gate and explicit outcomes |
| tests/fixtures/director-simulation.ts | Research input tapes/policies and real120Hz consecutive-world simulation; never a runtime autopilot |

The director does not read player state or planner outcomes. Every decision has lossless provenance including seed, index, cell span, family, pacing and intensity. The next cursor advances by the complete scheduled span regardless of admission outcome. Accepted worlds additionally depend on exact input/root history and safety vetoes; seed alone reproduces proposals, not accepted geometry under differing controls.

The first measured policy left44/48 short reference worlds passable by parking in one corner, with almost no reference-controller reversals. That profile, its raw data and actual source are preserved as pre-coverage evidence. The final policy assigns paired encounters to seeded four-corner bags, without immediate corner repeats. It uses only existing B-3 center mirrors/translations, preserving depths, counts, radii and poses; no player-position input or wall is introduced. A template-bound pass and a final complete producer pass are bounded generation work, not safety retries. The final candidate still receives normal inspection and joint trajectory/replay checks. Placement has explicit corner-pressure-v1 provenance in the director decision.

## Ownership

Cells remain half-open24-unit intervals and transactions2–6 cells. Ambient uses its original anchor identity; encounters retain encounter-v1 transaction ordinals and complete provenance. The ledger reserves the complete span, including empty cells, and copies all IDs and generated geometry independently of a visible hazard array. Pending geometry is never an active field. A second pending writer or overlapping source rejects. Frontier order is monotonic; retired cells are not revisited during a run.

A committed/omitted record retires only after distance exceeds its full source end plus maximum radius1.1 and despawn distance8. Individual known hazards can retire earlier only after their own center+radius+8. Empty cells and early disappearance therefore cannot erase ownership or required known geometry. Records are capped at16, IDs per source at12, and actual validation context at32. Reset clears records/frontier and changes local token epoch, preventing an old job from finalizing a new run reservation. World hazard IDs remain seed/version reproducible; local reservation tokens identify lifecycle epochs, not content.

## Planning and exact publication

The implemented path is generation → actual FieldGenerator.inspect → reservation → B-2 validation → extra independent replay → publication replay → ready/pending → fixed-tick commit or explicit omission. There is one work job per advance across all phases, sharing default3072 propagations/6144 queries and a single144-tick transaction deadline. No extra per-phase144-tick allowance exists. Whole-session maxima remain two searches/four replays; a failed primary cannot start another pair of beam searches.

An incremental publication job's starting state is historical by the time its work finishes. This coordinator addresses that explicitly: it verifies a forecast for the fixed publication tick144, then compares actual x/y/vx/vy/input/time/distance and the complete known field at that exact tick. Only a matching root with completed normal replay commits. A changed input, unknown/missing field, stale ownership, incomplete work or missed tick rejects without publishing geometry. Finishing work early merely enters ready state.

Default forecast holds the current input for144 real Ship steps. Research can provide a policy forecast with the exact same input-independent clock; it is still compared with the actual state and field at commit. Offline reference controllers can forecast their existing input tape. This is not knowledge of future human input. Held-forecast mismatch probes are measured separately, and B5_INTEGRATION_PLAN treats runtime final-gate scheduling as unresolved.

## Reservations and certificate replacement

Every accepted B-2 witness includes its independently checked empty braking tail. No candidate is appended using isolated witnesses or an old terminal position. A pending candidate may extend into the old certificate's future reservation only as a proposed replacement: the entire known union is validated and replayed from the matched new publication root into a new empty tail. Commit atomically replaces the certificate. Before commit, the old geometry/certificate remain unchanged. A rejected replacement leaves the old continuation intact; it does not rescue a player who abandoned it.

The coordinator requires every still-relevant ledger hazard in the supplied field, including records removed early from a caller's array. It also checks the actual commit field against the replayed snapshot. As in B-2, any external bootstrap geometry must be supplied completely; the API is an in-process contract, not a network/security decoder.

## Failure semantics

At most one fallback candidate is tried. A generation/structural failure can request a separately identified full ambient transaction; capacity pressure or an unsuccessful trajectory can request an explicitly empty transaction checked by neutral-control replay. Empty recovery is never counted as a dense encounter. Publication failure or exhausted time/replay budget yields an uncertified omission with no new obstacles and no safe-witness claim. All source spans, reasons, attempts and realized counts remain in metrics; committed geometry never moves or disappears to make a retry pass.

No GameModel/World integration, live selector, new model, worker, reward, score, health, camera, UI, audio or VFX change exists. Technical evidence and game-design hypotheses are reported separately. Review before B-5.
