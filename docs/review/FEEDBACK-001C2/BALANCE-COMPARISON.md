# Balance comparison

These are deterministic simulations, not human playtest or satisfaction results.
Baseline is exact10cc436; final uses the same120Hz/two-step planning cadence.
Raw input tapes, proposals, events and metrics are delivered in evidence.

## Matched reference routes

Four seeds0/7/11/42, each180s, follow the existing hazard-certificate pilot. Every
input and hazard-publication hash matches across versions. All four runs retain
3HP. This pilot steers to avoid hazards; it does not pursue rewards or stand still.

| Metric, total over12min | C1 | C2 |
|---|---:|---:|
| Eligible opportunity checks | 51 | 52 |
| Successful placement groups | 50 | 52 |
| Individual shards | 50 | 56 |
| Groups/minute | 4.17 | 4.33 |
| Shards/minute | 4.17 | 4.67 |
| Pickups / energy | 9 | 15 |
| Retired misses | 38 | 39 |
| Still active at endpoints | 3 | 2 |
| Three-shard trails | 0 | 2 |
| Peak active shards | 2 | 3 |
| Individual shards/1000m | 2.21 | 2.47 |

Observed opportunities+2.0%, groups+4.0%, individual density+12.0%. Aperture
replacement, retries and discrete sections make these differ from nominal cadence
ratios. This conservative result is below the suggested15–20% opportunity starting
target; avoiding excessive reward inflation was prioritized. The configuration can
be revisited after human sessions rather than increasing density automatically.

Average incidental energy rises .75→1.25/min in this small reference-policy sample.
The relative increase is66.7%, but the absolute difference is.5/min; it combines new
positions/trails, cadence and pickup assistance. It is not an isolated estimate of
assistance or a predicted human collection rate. Pursuit still requires steering.

## Pursuit and passive controls

An additional coordinate-aware bounded-input pursuit pilot reacts to each version's
own placements. Routes therefore differ; these runs are not matched-input causal
comparisons. A run ends at death or180s, so totals and rates are censored by survival.

| Seed | C1 seconds / energy / final HP | C2 seconds / energy / final HP |
|---|---|---|
| 0 | 180.00 /13 /2 | 150.66 /12 /0 |
| 7 | 180.00 /10 /1 | 180.00 /12 /1 |
| 11 | 102.66 /7 /0 | 70.43 /5 /0 |
| 42 | 166.86 /10 /0 | 67.54 /5 /0 |

The pursuit pilot earns40 energy in629.52 live seconds before versus34 in468.63
after. It abandons certified encounter routes to chase rewards and can pay for
that decision. Earlier deaths in three seeds are retained, not interpreted as
improved difficulty or user satisfaction. Locally feasible trails do not make
this simple pilot's entire approach globally safe.

A zero-input control on all four seeds collects0 in both versions. Death times
match22.77/14.19/24.92/37.89s. No stationary automatic reward corridor is introduced.
The minimum naturalRouteOffset1.55 remains; offset trails require2.6m from the
publication-time braking endpoint. Pickup reward remains1, distance scoring unchanged.

## Spacing, lead and safety interpretation

Trails have3 members22m apart; average trail size is exactly3. The max-speed
interval is.60s. Published proposals record initial correction distance and both
instantaneous-speed and conservative36.72m/s lead estimates. Local path clearance
and actual bounded-input natural examples supplement these estimates; they do not
certify all possible player trajectories or every later moving obstacle.
For the matched reference sample, conservative publication lead min/mean is
3.07/4.31s before and3.33/4.34s after. Mean initial correction to a proposal's
approach pose is5.34→5.55m (max9.21→10.03m). These are publication-time geometric
estimates, not measured visible/human reaction windows: existing reveal, perspective
and occlusion can delay recognition. Two optional upgrades were rejected in this
sample and stayed single shards. No safety threshold was relaxed.

Straight seed28, curve42 and offset291 are natural admitted examples with complete
3/3 pickup and3HP. Deliberately stopping steering after the first curve pickup gives
2/3 with3HP. This demonstrates optional partial success and preserved need to choose
a line. No fake crystal placement, teleported ship or altered HP is used for media.

Hard bounds remain8 active slots and at most one triple per12 successful groups.
Invalid upgrades fall back to a valid singleton and do not accrue future bonuses.
Potentially unsafe local segments are rejected conservatively. Entry risk, human
readability and comfort still need real players; no improved satisfaction claim is
made from simulations or screenshots.
