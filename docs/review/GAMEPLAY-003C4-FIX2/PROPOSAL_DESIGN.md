# Bounded route proposal

Baseline `c51da9d2859c43765f83a29ca12c06aa54cf7284`; DEV-only. Original ZIP SHA and all eighteen immutable actual-root records are retained in `tests/fixtures/homing-route-counterexamples.json`. Fifteen are NO_WITNESS_FOUND; three fail the mandatory held-input prefix.

Two measured problems explain the rejected routes. First, `runtimeRootSearch` could override freshly chosen geometry steering with historical certificate inputs until the last committed obstacle passed. Those controls were valid at another root and could steer into a station even when the current aperture goal was reachable. Second, after preceding solids passed, fixed X=±4.8/Y=0 bait-and-reverse ignored the mine's coupled velocity and available vertical space.

Fresh adaptive candidates opt into `preferCurrentFieldGoals`. The existing runtime session then omits the old control hint for that candidate. General validator code is unchanged; historical producers omit the flag and retain their former behavior. In production the preference branch is compiled out. Resolution, actual-root binding, budgets, complete-field simulation, independent replay and atomic ownership remain authoritative.

The proposal has two stages:

1. While a known static obstacle precedes the mine, keep the existing current-field aperture/gap goals. The unchanged steering heuristic uses current velocity and neutral braking distance; the mandatory54ticks run before any goal steering.
2. After preceding solids pass, rank four fixed points `(±5.2,±2.8)` using the current coupled Ship/mine state. Project the Ship's neutral stopping position, clamp that scoring feature to the existing bounds, and subtract mine XY plus0.6seconds of current velocity. Rank escape alignment minus small travel-distance and reversal-time penalties. Ties use a stable array order. The unchanged input/braking heuristic steers toward the single best point.

The ranker performs scalar arithmetic only: no extra Ship.update, controller propagation, CCD, full rollout, search branch or retry. Scoring parameters live in `HOMING_ROUTE_PROPOSAL`; original live motion settings and all presets are byte/semantic guarded. Extrapolation is a ranking feature, never proof or a recorded future mine path. It reads no seed/history IDs or future player input.

Ownership limits applicability: the new four-point ranker is used when the complete field includes a hazard owned before this mine candidate's source span. Span origin follows the canonical mine depth offset84 and24-unit cells. The isolated reference retains the old fixed bait proposal. Earlier committed metadata remains relevant to how the coupled ship/mine state entered the pursuit segment, even after those colliders have passed in the shadow simulation.

This scope restriction was justified by a negative result, not hidden: unconditional four-point ranking raised the isolated972-case total781→899 but lost73 old accepts. That experiment is retained as `matrix-unscoped.json`. The scoped final version preserves all972 decisions and work counters while recovering the real neighboring-field counterexamples. A blanket hint removal alone recovered10/15 but lost two old accepts. Smaller-horizontal, vertical and simple inertia ablations are retained in `alternatives.json`; they are not gameplay imports.

No controller, collider, movement, margin, reaction window, producer frequency, deadline or attempt ceiling is relaxed. No second beam search, new planner, worker, collectible or encounter family is added. The accepted score choice still has to pass the exact existing simulation and independent replay.
