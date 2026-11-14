# Baseline audit and visual decisions

Base: `2eb974199bfa58ae120dbf9f12e8bf53a6b5da2a`. The requested branch was
created from that local commit. Four unrelated user research/skill paths remain
untracked and untouched. The owner's successful001B playtest is supplied context;
it is not a new owner acceptance of001B1.

Before changing runtime files, the original production source was frozen and built.
38 original Hybrid-camera frames and six silent native recordings cover desktop and
portrait: real accepted rock contact, subsequent protection, accepted adaptive mine,
fatal contact, breakup, aftermath, results and restart. No hazard/HP/cooldown edits.
Inputs are the001B seed42 tapes; captured identities/times are in the receipts.

| Original effect | Actual implementation and observed issue |
| --- | --- |
| Protection | Detail1 wireframe icosahedron, scale1.6/.72/1.5; cyan opacity about.11±.025, final.2s fade. It follows position but not banking. Visible triangles form a cap above the ship. |
| Immediate ship hit | Flat amber ring, radius.55–.61, expanding for.25s. No directional surface ripple. |
| Mine | Unit-sized licensed technical shell is scaled by the existing1.35m radius. Accepted slot pose/ID are copied correctly. The1.2s burst is dominated by one uniformly expanding flat ring (up to3.4m), cyan plates and square points. |
| Death | Authoritative GAME_OVER is immediate; results wait2.05s (.65 reduced). Breakup at.50s reuses six original GLB triangle partitions. A faceted bright core lasts.36s after breakup, followed by a large flat ring. Secondary component failures are absent. |

Normal-camera images show protection approximately matching the ship width, while
mine/death rings grow well beyond it; exact screenshots are the evidence rather
than a claim of calibrated pixel luminance. The flat circles and triangular cap
are clearly readable, but their geometry dominates their intended energy meaning.

Retain the existing coordinator, event payloads, pools, death clock and gameplay.
Use a banked smooth field with Fresnel/flow and a localized, camera-readable
projection of the incoming reference direction. Use sparse curved energy contours,
lobed plasma, varied circular sparks, component arcs and staged small failures.
Treat exposed hull reverse faces as charred metal instead of costly sealed fracture.

Ownership audit: material/geometry instances are local to ImpactVFX, CollisionVFX
and ShipDestruction; borrowed GLBs remain unchanged. Existing instanced buffer
disposal is retained. New shaders are warmed with the existing loading-time pass.
Only clear redundant work is optimized: hidden legacy impact particle updates,
unused mobile particle elements, and six identical fragment materials.
