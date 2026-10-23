# Endless difficulty and pacing — proposal

The current curve reaches speed34/density0.97/spacing60 at 120s and stays there. GAMEPLAY-001A changes none of it. This document proposes B's pacing; values are hypotheses requiring architecture approval and playtesting, not measured outcomes.

## Progression with safe limits

Retain the approved forward-speed formula in the first integration: `v(t)=20+14*clamp(t/120,0,1)`. Do not raise speed beyond34 to hide a weak distribution. Density and geometry carry the main change. Use a new proposed content progression `p(t)=1−exp(−max(0,t−4)/180)`; its asymptotic behavior never requests unbounded physical difficulty.

| Parameter | Proposed progression / cap |
| --- | --- |
| Normal total density | `6+4p` hazards/100 traveled units |
| Ambient portion | `min(total,4+2p)`; encounters consume the remainder |
| Increased-intensity multiplier | 1.2; absolute total cap12/100 |
| Recovery multiplier | 0.45; total floor2.8/100 and no authored demanding encounter |
| Advanced section | ≤1.1× normal total; prioritize geometry rather than object count |
| Radius and forward speed | Existing 0.65–1.1 and 20–34; no late unbounded growth |
| Active slots | Soft24/hard32 within the existing 72 allocated records |
| Decision complexity | Initially ≤3 major direction/target changes per encounter |
| Effective clearance | Never below the proposed 0.15 planner margin, with readable wider alternatives |

These rates can be lower than the current 9.71/100 steady-state and still yield more regular navigation because depths and XY coverage change. Do not promise that a density number alone measures fun. Total quotas cover ambient **and** pattern objects; admission/validation may reduce counts. Smooth desired rate changes by ≤0.5 hazards/100 per 24-unit cell instead of creating a dense wall at a state transition. Realized rate and omission must be reported separately.

## Structured stochastic pacing

Use a seeded semi-Markov director indexed by simulation distance; sample section duration once at entry, not every render frame. Proposed section lengths are regular180–300 units, increased intensity72–120, recovery48–84 and advanced108–180. At speed34 these correspond to about 5.3–8.8s, 2.1–3.5s, 1.4–2.5s and 3.2–5.3s. Speeds earlier in a run naturally lengthen their time durations.

Start with warmup (four seconds without collision opportunities), then regular/scattered. From regular choose increased intensity, another regular variation, or an eligible advanced section with seeded weights initially 0.35/0.45/0.20; advanced eligibility begins after60s. Renormalize ineligible weights. After increased intensity or advanced, require a recovery section and then regular. After two repeated regular sections, force a different legal selection. Do not make a fixed repeating script or a purely independent random draw that can chain arbitrary intensity spikes.

Recovery contains a few scattered objects: proposed depth gaps24–48 units. Normal ambient gaps begin at12–36, with cross-cell continuity checks; pattern objects may interleave. Avoid a sudden empty runway at every recovery boundary. Warmup/bootstrap is special: first gentle contact should occur around6–8s, derived from response plus a small initial maneuver, rather than waiting a full planning-horizon distance. This timing still needs human readability validation.

Track the last two encounter intents, first-move direction and local density, all reset by seed/run. Apply a no-immediate-repeat rule and forbid more than two successive demanding sequences favoring the same axis. Seeded section lengths, translations, mirrored patterns and continuously varied parameters provide late-game variety after numerical caps stabilize. They are intensity states, not levels or a fixed victory schedule.

## Reaction and warning distance

Actual movement is the componentwise capped recurrence in [the fairness document](PROCEDURAL_FAIRNESS.md). For an isolated one-axis rest-to-rest move, a useful continuous estimate is:

$$
d_c=8^2/(2\cdot32)+8^2/(2\cdot25)=2.28,
$$
$$
T(d)=\begin{cases}
\sqrt{2d(1/32+1/25)}&d<2.28\\
8/32+(d-2.28)/8+8/25&d\ge2.28.
\end{cases}
$$

| Representative rest-to-rest displacement | Estimate | +0.45s response +0.2s readability +0.0894s maximum-speed collision slab |
| --- | ---: | ---: |
| X4 | 0.785s | 1.5244s, about51.83 forward units at34 |
| X8 | 1.285s | 2.0244s, about68.83 units |
| Full X span12 | 1.785s | 2.5244s, about85.83 units |
| Full Y span7.2 | 1.185s | 1.9244s, about65.43 units |

These are **design estimates**, not exact discrete minima or universal warning thresholds. They assume rest, one axis and no intervening hazards; boundary clamping, diagonal controls, existing velocity and rotated proxies require exact simulation. The research script measures first crossing under continuous full thrust: X4 from rest0.625s versus X4 with initial vx=−8 at0.9917s; these arrivals still have vx=+8 and are not settled exits. Resetting velocity between encounters would conceal that difference.

The proposed publication check uses actual time-to-first-contact and the full witness's response, maneuver/settling and clearance requirements. Retain at least the proposed readable reserve; do not assign a universal spawn distance by visually guessing. Continuous placement must not put the next collision window before the previous maneuver can settle. A successful mathematical witness can contain switches that people cannot perceive or execute; playtest maximum control-switch frequency and screen occlusion separately.

## Long-run behavior and risks

No parameter rises without limit and no encounter is scheduled to guarantee eventual death. Repeated jointly certified extension plus empty-tail fallback makes continued survival possible under the stated conditional policy, without a maximum designed run length. This is not a theorem of infinite survival in JavaScript or arbitrary human play. Test long simulated durations and precision at large accumulated distances; local pass-depth rebasing may eventually be needed, with stable IDs/RNG keys preserved. Do not add a run cutoff to avoid numeric testing.

Risks: capped values becoming stale, repeated easy edge routes, excessive omission from conservative validation, dense visual overlap, awkward short recoveries, and state-veto players suppressing difficulty. Test rate/clearance/steering distributions and human preferences before increasing caps. Proposed acceptance includes a fallback-rate ceiling and a nearby-depth-gap improvement; failing those means revise the architecture or reduce scope, not weaken collision safety. Near-miss scores, upgrades, rewards and moving centers remain deferred.
