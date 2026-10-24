# Difficulty director — implemented policy

The director is a pure seed/distance/cursor decision function. Cursor contains a section index, next ownership cell, previous pacing state, regular-state streak, the last two encounter families and a four-bit corner coverage bag/last corner. There is no frame clock, Date.now, Math.random or advancing global RNG. Separate purpose keys seed the existing Random implementation; IDs retain full provenance rather than using RNG hashes as ownership addresses.

## Progression and bounds

With D equal to the section start distance:

`p(D) = -expm1(-max(0,D-144)/6000)`.

Progress, encounter probability and intensity are deliberately normalized to12 decimal places as part of director-v1 policy generation. The initial experiment found one-ULP Math.expm1 differences between Node and Chrome; exact raw differences are retained. This is a policy contract, not reporting-only rounding. Actual ship states, obstacle coordinates and collision queries are never rounded. Exact cross-engine replay remains tested evidence for the named corpus, not a theorem for every engine/version.

Thus0≤p≤1, p is monotonic, and numerical saturation is allowed without a final stage. Desired encounter probability is0.25+0.40p, before pacing rules and cooldown eligibility; realized encounter fraction is measured separately. Intensity bases are regular0.15+0.40p, rising0.40+0.30p, high0.70+0.20p, recovery0.05+0.10p, with keyed±0.02 variation and final[0.05,0.92] bounds.

The existing speed function remains `20+14*clamp(t/120,0,1)` in CONFIG. The director does not output or apply a second speed curve. Radius/spin distributions and calibrated profiles remain those of B-1/B-3. Increasing progression changes encounter selection, bounded geometry intensity and span compression; it does not harden every parameter together. Intensity is a geometric policy input, not a proof of human difficulty.

## Pacing and duration

Initial selection is regular ambient. High always transitions to recovery. Recovery selects regular80%/rising20%; rising selects high60%/regular40%. Regular can repeat, rise or become high with seeded variation; after two regular sections a change is required. This provides a bounded stochastic rhythm rather than a fixed timed script. A cursor is explicit replay state, not a large state-machine framework.

Regular ambient spans4–6 cells; rising ambient3–5. Recovery spans2–4 cells early and2–3 near the progression cap, retaining seeded length variation. Patterns use their existing family minimum plus a keyed bounded increment that generally contracts with progression, never exceeding6 cells. These are48–144-unit transactions; sections are not visible obstacle planes. Recovery chooses ambient geometry with no demanding authored pattern. Its B-1 mean density remains about4.16/100, so lower recovery pressure is a geometry/selection hypothesis rather than an assertion that every recovery has fewer objects than every neighbor.

High selects narrowing, alternating or vertical weave. Regular/rising can select scattered/narrowing when eligible. The last two encountered families are excluded; ambient sections do not erase cooldown history. Cooldowns can lower realized pattern frequency below the desired probability. Repeated coarse motifs and actual family/span distributions are measured rather than treating changed RNG numbers as gameplay variety.

Paired encounters additionally use corner-pressure-v1 placement. Each seeded bag of four pressure assignments covers all quadrants, and the next assignment never repeats the previous corner. Bag order is seeded, not a fixed clockwise cycle. The choice is independent of the player's actual position and of safety rejection. Existing B-3 mirrors orient the first round variant toward the selected quadrant; a real template supplies bounds, then a complete producer request translates the arrangement toward that corner with0.03 center inset. Nothing is clipped or removed. All actual collider/trajectory checks remain authoritative; this is not a proof every shape/seed forces a maneuver.

This policy revision follows measured failure of the initial free-offset schedule: corner parking survived44/48 short accepted worlds and reference reversals were rare. Source and raw results before coverage are preserved. Family choices, spans, depth/radius/pose draws remain the same; explicit director placement metadata and final B-3 transform identities change. New B-4 goldens pin the final contract; historical goldens are unchanged.

## Determinism and numerical domain

Full decisions have a pinned16-section seed42 SHA256 golden. Tests cover JSON cursor replay, independent call order, all states/families, cooldowns, variable recovery lengths, bounded progression and large indices/distances. Variation derives from(index mod32768)×2, remaining within the existing16-bit pattern contract without unsafe multiplication of huge indices. Cell keys retain B-1's uint32 domain; exhaustion rejects instead of wrapping. This is a numeric/rebasing boundary, not a designed finish or claim of mathematical infinity in JavaScript.

Source decisions do not change when validation rejects. Fallback has its own writer identity and raw record; it does not alter unrelated future RNG. Restart creates the same director cursor/decisions for the same seed. Reservation token epochs intentionally differ to reject stale work.

The implementation is isolated. Technical correctness, measured policy pressure and human enjoyment are distinct results. See PACING_AND_DENSITY and FAIRNESS_EVIDENCE for actual experiments; B5_INTEGRATION_PLAN is a proposal, not completed integration.
