# Testing and reproducibility

`npm run test`:347/347 pass. Nine new trail tests cover three templates, spacing,
determinism/budget, real bounded steering at36.72m/s, continuous obstacle/moving
hazard rejection, body/wing forgiveness and blocked pickup, capacity/reset and
exact integrated hazard/witness/mine/movement/damage preservation across four seeds.
Four rejected-guidance unit tests are removed with their implementation.

The focused Chrome suite passes7/7: desktop and portrait reduced-motion3/3 and2/3
natural curve collection, normal production keyboard input, both wing pickups,
magnet/pause/restart. The new tests assert no guidance object/scene root, original
fixed pool size, per-member reward1, lower mobile quality and complete reset.
Existing obstacle generation/collision and approved audio regressions are retained.

The final full Chrome run passes121/121 in9.7min with two workers,0 skipped/flaky/
unexpected. Typecheck and production build pass. All runtime, test, asset and build-config
inputs are frozen during the complete browser run;244 hashes are compared before/
after and against canonical packaged Git blobs. Source-derived review scripts/docs
are completed afterwards. Final full results are in `evidence/full-browser/run.log`
and browser-results.json; no skipped/flaky result is accepted by packaging.

## Retained failures and corrections

The first unit run had343/347. Two historical tests contained old assistance edge
values; they now check the exact new envelope while keeping tangent-in/out and
single-event assertions. A deterministic replay expected one pickup rather than
the new triple; the exact replay/count assertion is now3. A trail tail can outlive
its anchor hazard by22m; its admission is checked against successful publication
receipts, and full-profile clearance is checked, while singles keep the original
live-anchor check. No damage or obstacle test was removed.

Initial focused trail observers read an event envelope instead of its payload;
corrected observers preserve strict3/3 and2/3 expectations. Early QA seed search
stopped immediately at publication before observing new active slots, and then
needed the normal event-bus flush to record pickups. Those capture-only mistakes
are corrected; no runtime tuning was made to satisfy them. Logs are retained.

The first complete browser run passes120/121. A historical wing-clearance test
greedily followed current collectibles, so its route changed with new trails and
hit a real hazard. Its original assertions remain (old shadow left-wing contact,
live3HP/zero hits), now against1167 exact C1 input steps frozen from the approved
baseline rather than regenerated from current collectible layouts. The focused
historical replay passes. The full suite is repeated with two workers and unchanged
assertions/timeouts. All benchmark/media browsers run sequentially after the suite.

## Additional evidence

Matched180s certificate tapes on four seeds preserve exact input/hazard hashes,
distance and3HP. Separate pursuit and passive runs are explicitly simulated and
include deaths/censoring. Natural bounded-input examples show all three templates,
full/partial collection and normal obstacles. Secondary independent geometry QA
uses the real collision kernel at65 poses per leg, all three parts plus.28m margin;
19500 queries over four admitted trails find0 intersections. It is finite geometry
evidence, not a certified global route or a human result.

`shard-trails-*` scripts reproduce baseline freeze, balance, seed search, safety,
full browser snapshots, performance, media, preservation and packaging. They need
installed Chrome; normal build/test uses the existing dependencies only. Restore
the supplied `scenario-inputs.json`/`collision-inputs.json` into the task-local
`.cache/review/FEEDBACK-001C2` folder to reuse tapes. Captures use the actual production
model/camera and native-RAF approaches after accelerated prefixes, without pose/
HP/hazard edits. Historical and controlled fixtures are labeled separately.

Packaging gates complete passing tests, frozen source,160-input preservation,
matched protected states, media, safety and gallery checks. It verifies every
canonical Git blob SHA1, internal file size/SHA256, complete forward/reverse patch
trees using an isolated index, gallery references and ZIP CRC. No physical phone,
external human satisfaction/readability session or remote deployment is claimed.
