# Target-Lock design

## Behavior and timeline

Acquisition → lock flash → stationary locked warning → straight attack → target hold/passage/contact → established retirement. Acquisition lasts 96 ticks/0.8 s. On publication the mine targets the actual current ship XY; lateral velocity and input are recorded but do not produce predictive lead.

Let P0 be the frozen initial XY, T the observed target, q the mine depth and tp the first 120 Hz forward-clock tick reaching q. For attack speed s=4 units/s:

- N=ceil(length(T−P0)/(s/120)); launchTick=tp−N.
- Locked velocity=(T−P0)/(N/120), so speed never exceeds 4.
- Reject if travel<2 units or launchTick−captureTick<120 ticks.
- Pose is P0 before launch, P0+velocity*(tick−launchTick)/120 during attack, then T after tp. The trajectory never reads later ship input.

This aligns arrival with the real accelerating forward clock rather than an assumed constant-speed ETA. The first seed 42 mine uses q=180 m. All timestamps are integer 120 Hz ticks. Target capture includes x/y/vx/vy/inputX/inputY/tick/elapsed/distance; the trajectory stores initial XY/depth, acquisition clock, frozen target, launch/pass/duration ticks, velocity, speed/warning settings, origin choice and version.

The default 120-tick minimum is 1 s. Actual stationary lock-to-launch time is longer because the mine is prepared at the existing lookahead distance: 2.133–8.2 s across 37 normal published targets in the reference corpus. The last 1 s uses a faster pulse. Early lock preserves the safe scheduling architecture; shortening the visible timeline or changing encounter depth/frequency requires separate evaluation. A long readable warning is not evidence of human recognition.

## Telegraph

Reuse the original mine model/red lamp: dim slow acquisition pulse, 0.2 s brighter lock flash, slow locked pulse, faster final warning and steady attack. One subtle red line (opacity 0.18) shows the currently observed XY only in acquisition, then the actual frozen path only while stationary. It disappears when attack starts. There is no global reticle, new product HUD, audio system or bloom.

DEV text reports phase, target XY, capture tick, launch countdown, expected plane time, frozen velocity, admission status and last rejection. Preview is explicitly labelled noncollidable. Acquisition is presentation only: certification begins with the fully frozen published course, whose complete dangerous lifetime is checked.

## Alternatives

Continuous homing and post-fire reacquisition are deferred because they would invalidate a committed trajectory as the user steers. Perfect intercept prediction and lethal-target optimization are excluded. Increasing radius/speed or reducing reaction reserve would change safety/balance rather than test relevance. Center-only crossings retain boundary bypasses. A fixed 0.8–1.2 s launch delay without depth alignment can reach the target too early; this implementation uses a minimum plus explicit plane timing instead.

The origin anti-overlap choice is made before preview, never chosen for maximum lethality. A later overlap rejects safely. No new tuning selector is exposed: the bounded 3/4/5 speed ×96/120/144 minimum-warning matrix is diagnostic.

Visual inspection: the early lock screenshot at16m shows a very small distant cue; the last-second warning and attack are visibly larger. Owner acceptance of acquisition/lock recognition remains open and is an additional limitation of this Partial experiment.
