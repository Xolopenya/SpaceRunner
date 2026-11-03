# GAMEPLAY-004 — Energy Fragment

Review feature only. Baseline: `bbfb48ccf390b8feceb82ada4f01e86b912b4779` (`origin/main`). No experimental mine branch was merged or copied. Normal Menu → Launch run uses `ReleaseModel` and includes fragments without parameters. No public deployment is authorized.

One optional run statistic creates a reason to steer toward existing debris or the edge of a usable station aperture. Ignoring it leaves the existing certified hazard route intact. There is no economy, persistence, hull repair, speed change, invulnerability, distance bonus or change to obstacle generation.

The original procedural visual is a turquoise octahedral crystal, white luminous octahedral core and thin circular energy halo. Crystal dimensions: .68 × .918 × .68 world units before a ±7% pulse; core diameter .28. Halo outer diameter 1.07, tube diameter .05, 16 radial segments. The complete rotating visual fits inside radius .54. Slow .65 rad/s rotation and a 3 rad/s pulse use simulation time. Reduced motion freezes rotation/pulse. No texture, external asset, shader or post-processing dependency was added.

The pickup volume is a separate sphere of radius .32. The existing .42 ship sphere gives a combined contact distance .74; the decorative halo is not the collider. The small pickup radius requires deliberate contact while allowing forgiving core/edge collection. HUD shows `ENERGY 00` below hull throughout flight, with an unobtrusive +1/white count cue lasting .42 simulation seconds. Game over adds ENERGY FRAGMENTS alongside the unchanged distance and best distance. Restart resets it; pause preserves it.

Feedback: one original .18-second synthesized ascending 660 Hz chirp with a quiet harmonic, routed through existing SFX/Master buses. Pickup never uses Music volume. One expanding, fading halo appears at the pickup position for .42 simulation seconds. Eight preallocated mesh groups share geometry/materials; one preallocated burst is reused. Multiple pickups within one render frame aggregate into one chime/burst; authoritative counts still include each object.

See PLACEMENT_POLICY.md, COLLISION_AND_LIFECYCLE.md, GAMEPLAY_EVIDENCE.md and PERFORMANCE.md for measured behavior and the limits of the heuristic. Automated pilots are not owner playtest approval.
