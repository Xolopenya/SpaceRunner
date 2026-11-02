# Controller and depth decision

Version `adaptive-homing-v1` uses a bounded arrival-velocity controller. At each120Hz step, after Ship advances, compute desired XY velocity toward the current Ship endpoint: `(shipXY-mineXY)*responsiveness`, capped to maximum speed. Compute `(desiredVelocity-mineVelocity)*responsiveness`, cap its magnitude to maximum acceleration, apply the velocity kick, then drift by the resulting velocity for1/120s. Inputs, renderer time, witness controls and future Ship positions never enter the controller. It cannot instantly reverse or match Ship velocity.

| Preset | Maximum speed (units/s) | Maximum acceleration (units/s²) | Responsiveness (s⁻¹) |
| --- | ---: | ---: | ---: |
| Soft | 5 | 4 | 1.6 |
| Balanced (default) | 5.5 | 6 | 2.4 |
| Aggressive | 6 | 8 | 3.2 |

Initial XY is a seeded corner at±4.5,±2.4, velocity zero. Controller configuration and initial observation are immutable publication metadata; the observation is not a frozen target. Every update records the new actual steering target. Initial source signs are seed-dependent; seed43 is used for the continuous right-to-left demonstration, while the requested default remains seed42.

The exact fixed-step forward clock selects closest depth-plane tick. Pursuit begins360ticks (3s) before it; the existing red lamp warns120ticks (1s) earlier. During waiting/warning the body is stationary; waiting presentation is hidden. During pursuit it follows feedback; after480ticks (4s) it coasts without further steering. Classification uses the step's ending tick, so the first moving interval ends at startTick. Natural fixed-depth retirement normally precedes the4s pursuit cap. Initial state resolves at publication; activation remains in the future with a full warning or resolution is rejected.

**Chosen depth model: fixed world depth.** Ship still advances at the unchanged20→34units/s. This gives3s of approaching, visible XY pursuit and a short lethal depth interval. With sphere sum1.77 the maximum depth-only contact window is3.54/forwardSpeed =0.104–0.177s; a near radius3.77 gives0.222–0.377s before XY separation. These are geometric upper bounds, not3s of sustained contact pressure. Actual measured proximity, projected pixel/frustum/fog proxies and lifetime are in browser and probe logs.

A hypothetical bounded retreat at3units/s would expand the depth-only contact window only to3.54/(forwardSpeed-3) =0.114–0.208s, adding6units of world-depth displacement over2s. That small extension adds another coupled state and retirement/broad-phase contract without being necessary for the reproduced bait/reverse interaction. It was evaluated analytically, not implemented or represented as a measured playable alternative. Fixed depth keeps the original world contract and makes passing the encounter understandable. If the owner wants sustained near-plane chasing, that is a separate bounded Z design/review rather than a claim made here.

Matched histories from the same initial state diverge by0 for Target-Lock and approximately4.03/5.00/5.31units for Soft/Balanced/Aggressive after different steering. Bounded acceleration and the filmed opposite-velocity interval distinguish real feedback inertia from a prerecorded diagonal crossing. Full traces include tick, Ship/input, mine position, velocity, acceleration, phase and target. No new audio or ideal future-path overlay is used.
