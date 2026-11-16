# Targeted design directions

These are proposals, not implemented screens. No production CSS, tokens, camera, mesh, particles, gameplay or audio was changed. No generated art or mock screenshots are presented as game evidence.

## Preserve Flight Instrumentation

Current authority is `docs/design/UI_ART_DIRECTION.md`: Concept A was owner-approved and integrated in PHASE-3-004B. `UI_CONCEPT_COMPARISON`, `UI_DESIGN_TOKENS` and `UI_REFERENCE_RESEARCH` explain the preceding study. The older `IMPLEMENTATION.md` is a prototype-era document; its historical approval-pending wording does not supersede the current approval record.

Retain navy/graphite, restrained cyan and amber, angular title/buttons, Oxanium numerals, compact Plex labels and the clear real 3D viewport. Avoid a full-width dashboard, opaque panel expansion, fake telemetry, glass cards or new permanent center elements.

For HUD ownership, place persistent hull/distance/pause first; optional energy stays subordinate. Reserve a measured peripheral row for damage/protection and a short phase change. Avoid changing approved protection geometry. Keep current units and numbers truthful. The essential improvement is eliminating overlap and prioritizing information.

For results, retain large metres and the cyan Fly again action. A small New personal best line can use the existing fact. Back to menu should be a quieter secondary action with verified cleanup/focus; it should not compete visually with replay. Do not add medals, progression or fabricated statistics.

For onboarding, teach one existing distinction at a time: avoid solid hazards, collect cyan fragments optionally. Introduce collection at a meaningful encounter and suppress teaching behind damage/phase messages. No mandatory tutorial, economy story or wing-mounted navigation lines.

## Boundary concepts based on existing Combined C

The current build already has a fragmented, proximity-aware warp field. All alternatives below are small comparison prototypes over that implementation, with the owner's approved Hybrid camera and exact ±6/±3.6 center limits unchanged.

| Direction | Visible proposal | Advantages | Disadvantages / risks | Complexity |
|---|---|---|---|---|
| A — Refine current proximity field | Keep Combined C. Slightly tighten/localize its existing near-edge contrast response; briefly emphasize the approached side while sustained input meets the clamp | Reuses approved language, lowest asset/resource cost; quiet center; easiest before/after comparison | Needs a clear hysteresis rule to avoid flicker; shader exclusions must still respect stations; more glow alone may not explain the limit | Small–medium, about 1–2 days with captures; preferred first experiment |
| B — Sparse environmental cross-sections | A few short broken wall/corner marks appear in world space only near a limit and ahead of the ship; no continuous grid or ship-origin rays | Gives X/Y volume a common spatial reference; could improve vertical limit reading | May look like collidable rails or clutter station apertures; geometry/depth/occlusion needs care; must not form a bright tunnel | Medium, about 2–3 days for one isolated variant |
| C — Local edge particles | Brief sparse motion aligned to the approached environmental edge during sustained limit contact, fading after release; leave normal flight unchanged | Communicates a local event rather than permanent chrome; can work with existing fragmented field | Could be mistaken for damage or energy; extra pool/update work; needs reduced-motion fallback and stronger human testing | Medium, about 2–3 days for one bounded prototype |

These estimates are comparative implementation days for a single developer, including small verification, not commitments. Avoid implementing all three in production. Compare A with current behavior first; only build B or C if A fails the observed need. None emits a line from a wing or projects a collectible targeting path.

## Comparison protocol and acceptance

Use matched production seed/input histories at center, each edge and corner, normal/phase 2 flight, approaching mine, station aperture and an active protection event. Capture native motion at 1280×720, 390×844 and 844×390, plus reduced motion. A static wall beauty shot is insufficient.

Ask players to identify available movement space before hitting a clamp and explain why movement stopped. Count edge discovery errors, avoidable obstacle misses and mistaken interpretations as damage/pickup. Reject a variant that increases obstacle masking or misidentifies station solids/apertures, even if the boundary is more obvious.

Implementation success also requires unchanged collision bounds, camera settings, accepted field/pickup/damage traces and planner budgets; paused field time must stay frozen and reset/resource counts bounded. Device performance/comfort must be verified independently. None of these concepts has demonstrated improved player outcomes yet.
