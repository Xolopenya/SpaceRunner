# Motion variants and timing

All policies use `p = p0 + v * clamp(round(elapsed*120)-startTick,0,durationTicks)/120`. Both coordinates share the phase. Depth remains `distance-passDistance`. There is no second engine, render clock, acceleration, reversal, oscillation, homing or target prediction. Pause freezes elapsed; restart reconstructs seed/history and absolute ticks.

| Policy | Configurations | Velocity units/s | Start XY | Full crossing |
| --- | --- | --- | --- | --- |
| A baseline | slow-ltr/rtl | ±1.5,0 | ∓6,0 |960ticks /8s |
| A baseline | moderate-ltr/rtl | ±2,0 | ∓6,0 |720ticks /6s |
| B fast | fast-ltr/rtl | ±3.5,0 | ∓6,0 |411ticks /3.425s |
| C diagonal | diagonal-ltr/rtl-up/down | ±3,±1.5 | ∓6,∓3 |480ticks /4s |

Diagonal magnitude is3.3541units/s, below the unchanged ship maximum8. The centered3-unit vertical half-range fits the3.6 center bounds; the enclosing1.35-radius mesh may extend beyond them, as the original X-edge mine already does. Directions cover all four XY sign combinations. Settings and allowed vectors are centralized in moving-mine/settings.ts.

The chosen values are the midpoints of the requested initial ranges. They retain about1.72/2s of moving approach before the depth plane, well above the54tick/.45s held reaction prefix, without increasing placement frequency or shrinking the collider. They passed the complete source/trajectory/admission tests; they are experimental values, not a claimed optimum. With a1.77combined contact radius and20–34forward speed, the center-depth collision window is only about.177–.104s. Fast lateral travel during that window is roughly.62–.36units; this explains why doubling speed need not create a radically different avoidance requirement.

`passTick` integrates the real end-step forward progression (20→34units/s over120s) from the proposal root, independent of steering. Start is that tick minus round(6/abs(vx)*120). Once proposed, it never shifts during validation or publication. Center error at the discrete ship-plane tick is at most one velocity step; fast is about.00833units off center. Fast's quantized endpoint is±5.9875 rather than±6. Both coordinates remain continuous across clamped start/end ticks.

First-mine seed42 has passDistance180 and ship-plane time about8.78s. Baseline activates roughly4/3s before the plane; fast1.7167s before; diagonal2s before. The mine is published and rendered holding its initial endpoint before activation. That visible approach is preserved; speed does not make it cross the whole field before arrival. Normal seed42 first plane remains468m/about21.99s. Exact publication roots, activation, pose at plane and available warning are recorded per accepted encounter in mine-motion-witnesses.json.

Logical depth retirement usually occurs before a full end-to-end crossing finishes. Reported geometry probes count both total time with center inside playable bounds and the moving portion until plane+3units. Browser RAF traces additionally record projected position, diameter and fog distance. Four-/twelve-pixel first-presence proxies describe rendering, not human recognition. The red warning remains unchanged; no evidence currently justifies a pulse or camera change.

In the first-mine live captures, the original right-to-left mine renders fromX6 until about−.73(A),−1.29(B), or−1.1(C) before depth retirement around9.15s. C simultaneously movesY3→about−.55. The visible pre-plane range is therefore meaningful but shorter than the full contract duration. These are measured trace ranges, not completed twelve-unit travel claims.
