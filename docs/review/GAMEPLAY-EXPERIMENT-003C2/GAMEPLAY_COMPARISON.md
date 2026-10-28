# A/B/C challenge comparison

Faster movement and diagonal trajectories are implemented and visibly distinct. The measured gameplay proxies **do not establish increased maneuver demand** with the preserved centered crossing and encounter frequency. This is a useful negative result; none of the variants is selected for normal production.

Main comparison: seeds0/11/42, identical tick-indexed neutral/horizontal/boundary/analog-touch tapes and a separately labeled causal certificate actor. Each policy has15 actual three-hull runs; witness runs stop at3000m and blind tapes at actual death or1200m. Different input histories can admit different worlds; witness-following controls can also differ across policies. No immortal continuation is included.

| Measured across15 runs/policy | Baseline | Fast | Diagonal |
| --- | ---: | ---: | ---: |
| Mine proposals / published / omitted |48/43/5|48/43/5|48/43/5|
| Omission rate |10.42%|10.42%|10.42%|
| Mine within3.77units on release-input continuation |16|16|16|
| Release-input mine contacts |7/43|7/43|7/43|
| Integrated ship X travel, whole runs |1804.4202|1804.3535|1804.4202|
| Integrated ship Y travel, whole runs |619.5381|619.5381|619.5381|

Release-input contact means starting at the actual publication position/velocity and releasing steering, then using real braking/forward motion until this mine passes. It checks this mine alone, not survival through all asteroids. A published visible mine, a near pass and a threat to that continuation are three different observations. The7contacts (16.28%) are **not** seven proven forced decisions: other unchanged trajectories may avoid the mine. Whole-run travel measures the prescribed driver, not the minimum steering a human needs.

A common-clock isolated grid tests25 fixed XY positions (X−6,−3,0,3,6;Y−3.2,−1.6,0,1.6,3.2). Every configuration contacts3/25positions, including center, and contacts0tested perimeter positions. Thus22/25constant locations bypass this mine. This geometry-only experiment excludes ordinary asteroid survival and publication. Because forward travel crosses a narrow depth interval, the mine's XY displacement during actual contact opportunity is much smaller than its total visible crossing. Increasing lateral speed alone changes that footprint only modestly.

Four signed response directions and eight departure leads (0,.1,.2,.3,.45,.6,.8,1s before the depth tick) preserve real ship acceleration/braking. Exact contacts, movement demand and traces are in mine-motion-benchmark/witnesses.json. Correctly early steering avoids; late neutral approach hits. Response probes do not grant throttle or let the player wait at a depth. The decision is where to steer before automatic depth intersection.

The source schedule test compares120consecutive decisions for each of three seeds across A/B/C: encounter/cell spans and every ordinary section match. Realized frequency stays comparable and all four spatial families, ordinary objects, stations and automatic apertures remain. Additional publication/pose traces report activation, warning, center at depth and actual movement range/time inside bounds.

Recommendation: owner A/B/C selection first. The current controlled experiment has isolated the effect of speed/vector; a future separately approved placement/phase experiment could address off-center escape coverage if the owner still finds every variant trivial. Homing or ship-aware targeting is not implemented or implied by that recommendation.
