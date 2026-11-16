# Energy shard alignment investigation

## What the rules actually accept

The ship stays near Z0 while shards move toward it: shard world Z equals current
distance minus proposal.passDistance. Hybrid Chase looks forward/down from behind,
with partial lateral follow. Therefore a shard at the same world X/Y as the ship
does not appear on the ship's rendered center until near contact. Camera lag and
perspective also make a screen-space gap depend on depth. Directly chasing the
rendered ship center is an unreliable transverse alignment reference.

`src/collectibles/run.ts` sweeps the actual three-part profile with separate assist
values. Body effective transverse radius is .42+.32+.36=1.10m. Each wing is
.18+.32+.36+.10=.96m at X±1.08/Y−.30, giving an outer extent±2.04m. The wings also
have a .7m Z offset in the true sweep. Rendered centers need not touch. The existing
blocking-geometry check, pickup timing and140ms magnet presentation remain intact.

The contour extrudes the transverse union at the shard plane. It shows current
X/Y overlap, not an exact three-dimensional future sweep at predicted arrival.
The actual final pickup continues to use the unchanged swept model and obstruction
check. Short guide connectors track banked visible wing surfaces; the forward paths
remain aligned with the fixed gameplay axes.

## Diagnostic evidence and limits

`evidence/pickup-analysis.json` contains eight bounded-input model replays using
unchanged rules: four seeds, two explicitly artificial diagnostic pilots. The
world-body pilot knows coordinates; the screen-centre pilot follows projected
ship/shard separation. Neither is a human, and neither measures guidance ON/OFF.

| Seed | First target lead | World-body result / HP | Screen-centre result / HP |
|---|---:|---|---|
| 0 | 7.98s | collected /3 | missed /3 |
| 42 | 7.98s | collected /3 | collected /3 |
| 11 | 8.69s | collected /3 | missed /2 |
| 7 | 6.05s | collected /2 | missed /3 |

At target depths30–70m the same-X/Y corridor can project roughly80–130 desktop
pixels above the rendered ship in the coordinate-aware replays. This demonstrates
an optical mismatch; it does not establish the dominant cause of actual players'
misses. Seeds0/11/7 show reproducible diagnostic misses. Seed7 also shows that a
coordinate-aware pursuit can cost hull, so geometric overlap alone is insufficient.

Placement inspects local approach clearance around a proposed collectible and an
estimated reaction lead. It is not a certified end-to-end route from every current
player state through all future geometry. Existing real tapes include nearby
debris, a wing pickup costing1HP, and a Phase2 aperture pickup. No demonstrated
globally unreachable shard or collection-rule defect was established. A failed
heuristic is not proof of impossibility. No generator/assist/radius change was made.

Potential causes are separated as follows:

| Cause | Finding |
|---|---|
| Perspective misunderstanding | Reproduced projected-center versus world-alignment mismatch |
| Actual body/wing volume misunderstanding | Rules accept all three parts; contour exposes their union |
| Reaction time | First sampled targets have6.05–8.69s lead; later/current-state difficulty not ruled out |
| Nearby obstacles | Natural wing tape costs hull; local clearance is not a global route certificate |
| Occlusion | Camera/ship rays tested; hidden target gets no marker, blocked eligible rays get no positive cue |
| Rule defect | Not confirmed; actual collection states match baseline and ON/OFF |

## Smallest useful guide combination

Two72m translucent cyan wing paths establish direction and lateral reference. One
dashed cross-section at the nearest visible target's real depth describes body
and wing acceptance. Its X/Y follows the ship; its Z follows the shard. It does not
move toward target X/Y or steer the player. A small opacity change communicates
present unobstructed alignment; no additional highlight, HUD arrows, autopilot,
weapon effect or future pickup promise is added. Marker selection ends inside2.5m.

`GUIDANCE.enabled` in the dedicated config or `world.guidance.enabled` provides the
isolated ON/OFF comparison. No production settings menu is required. Static paths
have no pulsing/extra motion; pause freezes geometry and resize updates only line
width. Cost is constant across quality settings, with no quality or reduced-motion
settings overwritten.

## Owner usability session

Use the gallery's identical body, left-wing, right-wing, Phase2 and screen-miss
input tapes at desktop/portrait; body also has landscape. ON/OFF screenshots share
one held state. Videos replay the same controls on fresh pages with a native-RAF
final approach. They demonstrate the visual explanation and preserved outcomes,
not a player learning benefit. Ask new players to explain the contour and choose
an approach, then alternate ON/OFF order and record attempts, misses, hull cost and
perceived clutter. A measured collection-rate claim requires those human attempts.
