# Procedural fairness — implementation proposal

**Not implemented or proven by the research script.** This is the review contract for GAMEPLAY-001B. Constants described as proposed are starting engineering targets, not modifications to CONFIG or evidence of human fairness. [The audit](CURRENT_GENERATOR_AUDIT.md) contains measured current behavior.

## 1. State and actual movement

At simulation tick n, the planning state is `s_n=(x,y,vx,vy,t,D)` plus the committed obstacle set. Include normalized current input for the reaction prefix. Forward speed is the approved `v(t)=20+14*clamp(t/120,0,1)`. The real step first updates Ship, then increments elapsed, then advances distance/hazards using **end-of-step** forward speed. A predictor must reproduce that ordering, including the final step crossing the speed-ramp boundary.

For input a, let `u=a/max(1,||a||)`. For each component i, with h=1/120s:

$$
\tilde v_i=v_i+\operatorname{clamp}(8u_i-v_i,-c_i h,c_i h),\quad
c_i=\begin{cases}32&u_i\ne0\\25&u_i=0\end{cases}
$$
$$
v'=\tilde v/\max(1,\|\tilde v\|/8),\qquad p'=p+h v'.
$$

Clamp X to ±6 and Y to ±3.6; zero that component's velocity when it exceeds the boundary. These are componentwise approach/braking rules, **not exponential damping** or an isotropic constant-acceleration model. In particular, arbitrary diagonal acceleration cannot be inferred by substituting a Euclidean distance into a one-axis formula. Reuse the actual `Ship.update` on private reusable shadow state, or extract a common allocation-free transition with differential tests; never update the live ship while planning or maintain two approximately equivalent movement implementations. Banking/camera do not affect the logical sphere and remain unchanged.

Reaction prefix: proposed minimum 0.45s, inherited from the old corridor budget as an initial hypothesis. Hold the publication state's current normalized input during this prefix, including any existing velocity and boundary clamping; do not freeze/center the ship. This is one explicit delayed-response model, not a worst-case guarantee over every possible human input. Patterns need additional visual readability/playtest gates.

## 2. Collision times and geometry

For static-center hazard j with center-pass distance q_j:

$$
z_j(t_0+\tau)=D(t_0+\tau)-q_j.
$$

At constant speed, its broad collision opportunity is the interval where `|z_j| <= r_j+0.42+margin`. During the ramp, integrate the exact 120Hz end-speed steps to find interval endpoints. The analytic integral `v0*τ+(14/240)*τ²` before ramp completion, followed by linear travel, is useful for estimates only; it is not the replay integrator. Negative/past intervals must be clipped, not treated as future obstacles.

The broad interval is not the collision decision. Two round variants use swept spheres. Half meteor, barrel and generator require simultaneous intersection of the original outer sphere and an oriented rounded box, with the actual kind/phase mapping and absolute-time `hazardOrientation`. Unit box half-extents are respectively `(0.920546,0.390636,0.797216)`, `(0.624696,0.780869,0.541002)`, `(0.784773,0.448442,0.588580)`, multiplied by radius. Use the same sphere-overlap interval, inverse XYZ rotation, rounded-corner CCD and midpoint rotation allowance as `HazardCollision`. The orientation allowance is `||half||*|spin|*1.7*h/2`.

Proposed planner margin is **0.15 world units** of extra player clearance. In B, add an explicit margin to a shared pure query, preserving default zero behavior byte-for-result against old regression fixtures: outer radius becomes `r+0.42+m`, rounded-box radius becomes `0.42+m+rotationPad`. Box dimensions and spin are unchanged; retain the simultaneous AND rule. Do not inflate only a visual bounding sphere, test two independent overlap times, or reduce every shape to a circle in XY. Unknown profiles fail closed until a compatible predictor exists. Object-to-object broad separation may use outer spheres; player acceptance may not substitute that for the calibrated narrow phase.

For every 1/120s predicted transition, query relative endpoints `(p_prev.x−x_j,p_prev.y−y_j,−z_prev)` and `(p_next.x−x_j,p_next.y−y_j,−z_next)`. Collision checks cover the full linear sweep interpreted by GameModel, not just samples at macro endpoints. Rotation is bounded over each substep. No health removal, hit-induced obstacle removal or invulnerability is credited as safe traversal. A collision-free certificate must require zero hits.

## 3. Precise guarantee and chosen policy

For an exact publication state s and committed-plus-candidate environment O, acceptance means:

$$
\exists (u_0,\ldots,u_{N-1})\in U^{N}:\quad
s_{k+1}=F_h(s_k,u_k),\quad\neg Hit_m(s_k,s_{k+1},O),\quad s_N\in T(O).
$$

`U` is the finite control vocabulary below; the prefix is fixed by the response model. `T(O)` requires every included hazard's outer opportunity to have passed, then a neutral braking continuation in a reserved obstacle-free tail with bounded XY and zero residual lateral speed. A finite search's returned witness must be replayed and checked independently from s. This proves existence of **that control sequence under the specified runtime model**, not safety under all controls, completeness over continuous actions, a robust neighborhood of starting states, or indefinite human survival.

Choose **actual-state acceptance** rather than validating only from an ideal center. The seed/progression-only director proposes candidates, but actual position, velocity and held input can veto them. Seed-only layout reproducibility is consequently relaxed: deterministic replay requires seed/version + the same fixed-tick inputs/publication states. This tradeoff is explicit and needs architecture approval. A seed-only alternative is a pre-certified reference stream with guarantees only inside its reference viable set; that is simpler to replay but does not promise a path from a player outside that set. Do not claim both policies' guarantees at once.

Actual-state acceptance can be exploited if bad steering repeatedly causes omission. Proposals must stay independent of player position and maintain their difficulty schedule; safety does not secretly select easier patterns or grant rewards. Log veto/fallback rates and compare parked-edge, oscillating and normal controllers. If they collapse density or farm future risk bonuses, revise the policy before integration acceptance. The current permanent-stripe exploit is not solved merely by replacing it with a permanent player-following safe tube.

## 4. Bounded trajectory search

Recommended first implementation is a small deterministic beam search with exact continuous-valued states, followed by full witness replay. Alternatives: time-to-collision alone ignores steering; occupancy grids omit velocity unless expanded to costly phase-space grids; full reachable-set/viability computation is too large for this prototype; unconstrained stochastic planning complicates bounded reproducibility. Finite sampled controls sacrifice completeness but allow sound acceptance of returned witnesses.

Starting parameters (all subject to B-2 benchmarking):

| Item | Proposed value and meaning |
| --- | --- |
| Physical integration / collision substep | 1/120s, identical to production |
| Control macro | 0.2s = 24 substeps; 9 actions `(0,0), (±1,0), (0,±1), (±1,±1)` normalized by Ship |
| Search state | Exact x,y,vx,vy,t,D; never snap dynamics to lane centers |
| Hash pruning cells | 0.25-unit XY and 0.5-unit/s velocity bins; retain at most two exact representatives per cell before global beam pruning |
| Beam | 16 states per macro layer; deterministic lexicographic ranking and tie IDs |
| Horizon | Dynamic through last committed/candidate opportunity + neutral braking; hard cap 12s |
| Candidate cells | 24 units; planning frontier initially ≤192 units ahead; no committed center beyond root D+216 |
| Terminal reserve | 16 units after the furthest center; no other committed objects in this tail |
| Work | At most two beam searches and four direct witness replays per cell |
| Incremental chunk | ≤4096 state propagations and ≤8192 narrow queries per fixed tick; fixed operation counts, not wall-clock stopping |
| Publication deadline | Root tick +120; publish at this fixed tick even if search finishes early |

Cell bins are solely pruning keys, not legal positions or guaranteed reachable regions. Retained nodes store their exact predecessor/action chain. Prefer fewer control changes, conservative clearance, non-boundary positions and low terminal velocity; stable IDs break ties. A discarded exact state might have been the only solution: **false rejection is expected**. Never connect two representatives merely because they share a bin, interpolate a shortcut, or accept their averaged state. Pruning cannot establish a false collision-free witness if every returned sequence is replayed from the real root.

The 0.15 margin is extra clearance for readability/numerical reserve. It is **not** a proof that every state within 0.15 or every mistimed input is safe: velocity and coupled cap/boundary effects invalidate that shortcut. A future robust tube guarantee would require interval propagation/error bounds and is deliberately outside the first implementation.

## 5. Candidate, fallback and publication pseudocode

```text
beginCell(root, committed, cellId):
    snapshot := copy exact state, held input, absolute times and committed poses
    assert fixed slot/horizon bounds; reserve empty terminal tail
    base := search(snapshot, committed, reactionPrefix, terminalTail)
    if no replay-checked base:
        classify SEARCH_LIMIT or EXISTING_FIELD_UNCERTIFIED
        add no obstacles; preserve committed field; advance with explicit omission
        return  # never claim the existing field is mathematically impossible
    proposals := build bounded keyed ambient + pattern proposal
    unionWitness := search(snapshot, committed + proposals, prefix, tail)
    if unionWitness exists: chosen := proposals; witness := unionWitness
    else:
        # no additional beam retries
        for variant in at most 1 deterministic simplified proposal:
            if replay(base, committed + variant, snapshot):
                chosen := variant; witness := base; break
        if none: chosen := empty; witness := base
    wait until the fixed publication tick, processing only bounded work chunks
    if work deadline exceeded: add no candidate; record BUDGET_LIMIT; return
    current := exact current state, held input and live committed hazards
    check same generator version, cell ownership, slots and warning distance
    replay witness actions from current, REPLACING the old reaction prefix
    with the current held-input prefix (do not prepend a second delay)
    # Recompute forward distance, absolute rotation times and tail horizon.
    if replay fails:
        try the stored base witness once from current against the committed set
        choose no added obstacles regardless; record STALE_ROOT_REJECT
        # If even base fails, this publication is uncertified, not a rescue.
        return
    atomically reserve/admit every chosen object; store witness/hash/context
```

The four-replay budget includes independent verification of successful search outputs, the one optional simplified proposal and publication checks. Implement a shared explicit counter, reserving two replays for publication/base checks, so an apparently cheap fallback cannot become unbounded. A failed union search has no output to replay, leaving capacity for one simplification. Bounds/overlap/slot/continuity violations cause deterministic simplification or omission before search. Never reinterpret TIMEOUT as proof of no route.

If the base witness is blocked by new candidate objects, one deterministic simplification may remove those **unpublished** objects intersecting it. Replay the whole union afterward, not just the removed subset. Committed visible geometry must never move or disappear. Omitting every new object cannot worsen an already certified base continuation; it can still leave previously committed hazards unavoidable from a later mistaken player state.

Stale roots require a publication-state replay even when the path worked at the planning snapshot. Actions replay at the new absolute time; do not blindly splice old future endpoints or grant the player a teleport. Collision/terminal/warning checks apply again. A finite independent replay failure means no publication. The final replay is short, ≤1440 substeps per witness, but its main-thread cost still needs measurement.

## 6. Seams, warning distance and endless extension

Validation includes **all** committed hazards whose temporal collision interval intersects the planning horizon, including prior cells, candidate cells and overlapping depth intervals. A cell's exit includes velocity, not only position. Do not reset velocity at a seam or test patterns independently. Last-center distance ≤216 ahead plus 16-unit tail is ≤232 units; at the minimum forward speed 20, travel consumes ≤11.6s. A 12s horizon can cover this plus the real terminal check only if actual discrete prediction confirms it. At maximum forward speed, neutral braking lasts ≤0.325s on the discrete grid and travels ≤11.05 forward units; 16 units allow the maximum 1.67-unit outer exit plus braking and residual reserve. Reject a horizon overrun instead of truncating unsafe future hazards.

A 192-unit planning lead and a one-second logical deadline leave ≥158 units ahead at speed34. Publication still requires `first contact ETA >= response prefix + actual maneuver/settling witness requirement + readability reserve`. The lead is a bound for computation and continuity, not a demand that the first run wait 192 units. Bootstrap candidates are gentle and separately certified from the actual launch state; proposed first contact at 6–8s must exceed four seconds of warmup plus the derived small-maneuver budget. No Launch delay or empty initial 192-unit flight is acceptable.

At each successful extension there is a path through the entire committed field into an empty braking tail. Repeatedly extending without invalidating the current witness supports continued survival **in principle for a compatible sequence of inputs**, with omission as the safety fallback. It is not a computed invariant viable set for every future state. A player can abandon the witness, hesitate too long or steer into a committed hazard. “Always a gap” and finite endpoint reachability are weaker statements than this contract.

## 7. Cost, limitations and references

With K=9, B=16, N≤1440 integration steps and M≤32 hazards, brute worst-case work is `O(B*K*N*M)` collision candidates per search; two searches allow ≤414,720 state propagations before cheap replays. Temporal broad phase should remove most narrow queries. Store at most 16×61 retained nodes plus bounded scratch/parents, fixed 32-hazard context and four replay buffers; proposed planner memory target ≤512KiB, to be measured. Work-query limits may force a deadline omission even when propagation count fits. Fixed logical work/publication ticks preserve reproducibility; they do **not** establish a 2ms browser budget on unknown hardware. The B-2 performance gate must pass before integration, otherwise reduce approved workload or evaluate a worker without changing certificate semantics.

False positives remain possible if movement/query reuse, absolute time, phase/variant mapping, margin monotonicity or stale-root replay is wrong; those are critical implementation tests. Finite-control/pruning/horizon false negatives, excess conservatism, fallback-induced empty stretches and state-veto exploits are expected research risks. Human readability and reaction are not mathematical consequences of a successful witness. No measurements of this unimplemented validator are claimed.

Primary methodological references: [LaValle, Planning Algorithms, Chapter 14](https://lavalle.pl/planning/node713.html) treats planning with differential constraints and action trajectories; this proposal applies that distinction by retaining velocity and simulating actions. [OMPL state/motion validation documentation](https://ompl.kavrakilab.org/stateValidation.html) explains the missed-collision risk of coarse discrete validity checks and recommends continuous motion checking when available. These support the method choice; neither validates Space Runner's proposed implementation. No planning library is added.
