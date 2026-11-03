# Placement policy

`ReleaseModel` supplies the existing `RuntimeEncounterSource.published(transaction, root)` hook. It runs only after the complete transaction has passed structural validation, search, actual-root replay and ledger commit. Fragment placement reads that transaction and `ledger.knownHazards(root.distance)`, including its newly committed hazards. No section candidate, rejected section, ambient fallback proposal or pending search publishes a fragment. The hazard planner, director, passive-pressure transform and budgets are unchanged.

The single run owner counts admitted ordinary sections. Initially two are needed; subsequent successful placements select a deterministic threshold of 2–4 from the fragment ID. A station with at least one intervening ordinary section can replace the upcoming ordinary opportunity. An unsuitable opportunity is skipped and retried on a later accepted section. At most one reward is admitted per section. There is no independent random spawn stream or coin trail.

IDs use `energy-fragment-v1/<seed>/<firstCell>`; the anchor ID and section identity remain in the proposal. FNV-1a selects a bounded candidate order without consuming any obstacle RNG. Ordinary anchors are sorted by explicit code-point comparison, independent of host locale. Up to eight candidate locations around at most two existing hazards are tried. Offsets put rewards just outside the hazard's full spherical envelope plus ship/pickup radii, .28 clearance and .18 extra spacing. These full envelopes conservatively include rotating debris proxies.

For stations, candidates use the actual selected aperture center plus an elliptical offset (1.55 horizontally / 1.08 vertically). The four asymmetric solid boxes are tested individually; there is no fictitious plane or sphere across the opening. The reward never occupies a solid station wall. Existing two native station neighbors participate in the checks.

Each candidate must satisfy:

- Ship-center limits inset 1.1 from the playable X/Y bounds: |x| ≤4.9, |y| ≤2.5. This avoids rewards for boundary camping.
- At least 1.55 lateral units from the current neutral braking/coasting projection. No rewards placed directly on that natural trajectory.
- Lead time computed at maximum Phase 2 forward speed (36.72), reserving .65s reaction, cancellation of current velocity, full acceleration, lateral travel and braking allowances. No teleport assumption. This is a conservative timing estimate, not an exact lateral route solver.
- A constant-X/Y approach capsule extending ±8 forward units is clear of EVERY known hazard, with ship .42 + pickup .32 + clearance .28 =1.02 radius. Ordinary spheres include all rotation; station checks use exact sphere-box CCD. The visual's .54 radius also fits inside this clearance.
- At least 12 units in 3D from every active fragment and an available slot in the eight-slot pool.

Existing whole-section ownership and empty tails keep these local approach intervals away from unknown future sections. No geometry, hazard margin, family, movement parameter or witness is modified. Pickups are not inserted into the fairness witness: a valid local capsule and time allowance do **not** certify the route from the current ship to it. Other hazards on the approach can still make a greedy pilot lose hull. Conservative rejection is intentional.

Finite six-run sample (0/11/42, ignore/collect, each 1500m): 63 admitted ordinary sections, 28 fragments, 30 opportunities, two skipped opportunities (6.67%), 49 rejected candidate points. Actual ratio: 2.25 ordinary sections per reward including station substitutions; 3.11 rewards/1000m. Peak active: one. Publication lead estimates at the then-current speed: 4.94–9.10s. This is lead time, not a measured visibility or guaranteed reaction interval; fog, perspective and occlusion affect recognition. No uniform maximum gap is claimed.
