# Focused effect changes

The001A FIFO/coordinator and001B death sequence are unchanged. No gameplay event,
collider, invulnerability rule, new state or timer is introduced. World passes only
the existing incoming obstacle reference offset and current visual ship quaternion
to ImpactVFX. All other systems retain their original interfaces.

## Protection

ImpactVFX shares one32×20 smooth sphere geometry between a field and fatal-contact
surface, with separate shader uniforms. Their ellipsoid scale fits the original
ship envelope. Front-face rendering, normal depth testing and depthWrite=false
avoid a wireframe, double-sided transparency and solid painted shell. Shader alpha
is concentrated at the Fresnel edge, sparse flowing bands and a decaying directional
geodesic ripple. The incoming reference direction is projected onto the visible rear
hemisphere for readability; it is explicitly not a swept contact normal.

The first roughly240ms use a stronger contact response; a smooth exponential blend
settles into low-intensity protection. The existing1.6s model invulnerability is the
sole visibility gate. Its last260ms attenuate the field, and zero hides it exactly.
Hull scars/materials are separate. Game over suppresses protection and keeps only
the short fatal-contact surface. Pause/hidden-tab deltas, restart and cancellation
use the existing World lifetime. Reduced motion removes field flow and lowers alpha.

## Mine

Each existing burst slot adds two local shader surfaces sharing one sphere geometry:
a fast cyan plasma release and a sparse, anisotropic spatial wave. Original accepted
mine ID/pose remain the anchor. Existing fragments and streaks retain varied seeded
velocities; streak lengths vary, and sparks use tapered circular sprites with stable
per-particle size/lifetime variation. A weak residual core dissipates through1.2s.
The old flat ring/glow are hidden only for mines. Rock/metal/station routing stays.

## Ship

DestructionSequence retains2.05/.65s and.50/.12s breakup. Before breakup,24 bounded
line segments cross critical hull regions; immediately afterward the same buffer
becomes short fragment-linked electrical jets. The amber primary plasma, cyan broken
wave, heat-tinted fragments and sparse haze have different decay envelopes. Three
small component failures start at breakup+.10/.25/.42s. They follow original fragment
centres; desktop uses up to3, mobile2, reduced1. They are local flares, not full-screen
strobing. All six recognizable hull partitions remain visible around the release.

One shared fragment material replaces six identical ones. Its reverse faces are dark
scorched metal; boundaries remain open, not physically capped. A brief emissive heat
fade improves separation without editing cached GLB materials or triangles. Existing
fragment drift gains component-dependent vertical/longitudinal trajectories.

## Ownership and quality

`energy-materials.ts` contains procedural shader factories, not a second effect
manager. The existing classes own all buffers/materials and explicit instance-buffer
disposal. New resources are constructed once, reused on trigger/reset, and disposed
through ResourceOwner sets. The existing two loading passes also upload the mine
spark shader variant; the first real hit creates no new program in the browser test.

Particle/debris caps remain001B values. Mobile/reduced tiers keep structural breakup
and all main stages while reducing particles, secondary flares and motion. Sphere
topology remains shared and bounded across tiers. There is no new quality framework,
texture, light, postprocessing pass, dependency, audio system or simulation RNG use.
