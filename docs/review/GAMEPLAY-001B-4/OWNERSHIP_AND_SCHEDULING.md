# Ownership and scheduling — implemented B-4

The isolated scheduler never writes GameModel, World or live obstacle slots. It returns complete logical transactions and independently checked witnesses, or explicit non-publication outcomes. All B-1/B-2/B-3 code remains unchanged.

## Ledger lifecycle

`OwnershipLedger.reserve(writer,firstCell,cellCount,ids,hazards)` reserves the entire2–6-cell source. A pending source excludes every other pending writer. Source overlap, wrong frontier, duplicate IDs and the16-record cap reject atomically. Copies retain complete immutable geometry and nested provenance independently of the caller's visible array. The source retains empty cells and IDs until legitimate retirement.

`finalize(token,'committed'|'omitted')` advances the frontier by the full span. An omission owns empty space explicitly; it is not a dense encounter. `cancel(token)` releases only a pending record without advancing. Committed/omitted records retire only when D>endDistance+1.1+8. Individual known hazards cease being relevant after D>passDistance+radius+8. Source records therefore outlive their last active object when necessary. No retained record grows with total run length:16 source records are a hard bound. A monotonic high-water frontier prevents reusing past world cells even after their history records retire.

`reset(firstCell)` clears records and advances a local token epoch. Content IDs remain seed/version reproducible; epoch tokens deliberately prevent a pending old-run job from touching a new-run reservation. `PlanningSession.cancel()` releases its unpublished reservation, returns CANCELLED and leaves committed geometry/frontier unchanged. A caller must cancel or reset abandoned work; pausing simply advances no simulation ticks.

## One pending transaction

The director selects the section without reading player position. Generation uses the actual B-1 or B-3 producer and the actual normal structural inspector. A PlanningSession snapshots the supplied root and reserves the complete chosen source. Still-relevant ledger geometry must be present with identical metadata in the supplied known field. Contexts above32 reject before an unbounded snapshot; no array truncation is used.

The session runs one work job per advance call. Validation, independent replay, fallback and publication all share the same144 fixed-tick deadline and default3072/6144 propagation/query budget. A smaller budget can be supplied; the coordinator rejects larger-than-default requests, while the underlying approved hard4096/8192 ceilings remain unchanged. Whole-session searches≤2 and replays≤4. Preparation and clock-table/forecast costs are bounded and measured separately, not hidden inside propagation counters.

A first successful normal B-2 validation consumes two searches/two replays. Its additional fresh replay consumes the third replay; publication check consumes the fourth. If primary trajectory validation fails, there is no second pair of beam searches. The optional empty fallback uses direct neutral-control replay and must pass normal structure/replay. Fallback geometry is separately identified and reported; committed objects are never edited or dropped.

## Fixed publication gate

The publication tick is root tick+144. Work may finish early, but ready does not publish. Publication replays a forecast of the state at that exact tick. Default forecast holds current input; research can supply bounded known-policy controls using real Ship integration. The forecast must have the exact144-step forward clock.

At tick144, actual position, velocity, held input, elapsed time, distance and known geometry must match the verified forecast. A missed tick, changed input/root, stale token, changed/missing field or incomplete job rejects. This prevents an incremental publication replay captured at one tick from being silently accepted several ticks later. Forecasting future human input is not solved by this mechanism; known-policy simulations and held-forecast failure probes are labeled separately.

An old witness's empty terminal reservation is protected until an atomic replacement. Pending geometry is not active. A new union may replace that future reservation only after normal joint validation and independent publication replay into a new empty tail from the matched actual root. Separate local witnesses are never concatenated. Rejection preserves the old geometry/certificate, although a player who abandons its controls can still collide.

## Outcomes and fallbacks

| Outcome | Actual meaning |
| --- | --- |
| committed | Complete nonempty candidate plus current-root witness; all objects admitted atomically |
| omitted-certified | Explicit empty fallback with a replay-checked continuation; zero encounter hazards |
| omitted-uncertified | No new geometry; current continuation is not newly certified; reason retained |
| blocked | Ownership, capacity, incomplete known field, cancellation or stale epoch prevents completion |

One primary plus at most one fallback candidate is attempted. Generation/structure failures may select a full ambient fallback; capacity or failed trajectory may select empty recovery. Publication failure or exhausted deadline/replay capacity cannot trigger unbounded retries. An uncertified omission does not claim to rescue an already unsafe existing field. The normal research driver retains previous verified controls through omissions, without resetting velocity or teleporting endpoints.

Measured attempt/outcome, ownership, retirement, memory and queue results are in FAIRNESS_EVIDENCE and PERFORMANCE. Runtime pool adaptation and publication timing remain B-5 review work.
