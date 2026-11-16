# FEEDBACK-001D implementation roadmap

No phase below is implemented or authorized for production by this audit. Estimates are implementation days for one developer including focused checks, excluding recruitment and owner review. Preserve approved Hybrid, shield, destruction, audio, shard assistance/trails, procedural fairness and balance. Do not bundle all findings into one redesign.

## FEEDBACK-001D-B — HUD ownership and input disclosure (first)

- **Problem / value:** UX-01/02/03: confirmed survival-text overlap and wrong short-desktop controls; phase copy repeats diagnostics. Highest confidence and small scope.
- **Likely files:** `src/styles.css`, `src/ui.ts`, `index.html`; extend the existing UI/readability browser assertions only where they expose the actual overlap/input mismatch.
- **Visible improvement:** damage and phase remain separate; phase changes communicate faster flight; compact desktop says keyboard/mouse-appropriate controls.
- **Scope / dependency:** 1–2 days. Reuse state events and layout tokens; no gameplay timing, movement, camera, VFX or physics changes. Optionally fix UX-10's stale one-line audio footer in this UI-copy milestone.
- **Risk:** a new message slot can push energy/hull into another element at short heights. Input hints must handle hybrid devices without disabling working controls.
- **Verify:** natural collision at seed 42 and all eight matrix sizes; require no text-box intersection for hull/damage/phase/energy, including phase 2. Inspect 800×450 fine pointer, portrait coarse pointer and tablet. Check focus, pause, mute, restart, reduced motion and current score-fit tests; run typecheck/unit/build and relevant existing browser checks. Human glance test confirms meaning after geometry is fixed.

## FEEDBACK-001D-C — Results meaning and navigation

- **Problem / value:** UX-06/07: first record is visually indistinguishable from an equal saved best; results have no menu/audio path.
- **Likely files:** `src/ui.ts`, `src/game.ts`, `index.html`, minimal existing styles; storage/model only if needed to retain a truthful previous-best baseline.
- **Visible improvement:** concise record acknowledgement; quieter Back to menu beside the dominant replay action.
- **Scope / dependency:** 1–2 days after B's layout contract. Explicitly decide pause-to-menu run-loss behavior before implementing that optional route. Results-to-menu is the required narrow slice.
- **Risk:** stale cinematic/audio tails, retained input, double-recorded results, wrong focus or a resumed old simulation. This is state lifecycle work, not just a button.
- **Verify:** natural death, skip, reduced death, equal/below/new best, audio persistence and ten mixed replay/menu/restart cycles. Check one accepted end event and correct saved best per run, input cleared, camera/hull/count reset, resource counts stable; human review checks retry hierarchy.

## FEEDBACK-001D-D — First fragment teaching

- **Problem / value:** UX-04: the current menu/hint never introduces optional collection; UX-08 is an associated recognition hypothesis.
- **Likely files:** `src/ui.ts`, `index.html`, small CSS; existing collectible publication/events for a truthful trigger. Avoid changing placement or pickup state.
- **Visible improvement:** one short first-encounter explanation and a clear existing-success response.
- **Scope / dependency:** 0.5–1.5 days plus first-time-player sessions. Depends on B's alert priority; defer/suppress teaching during damage and phase notices. Repeated known-player runs stay immediate.
- **Risk:** prompt appears when shard is occluded/not readable, implies fuel/economy, or becomes repetitive. Extra pickup decoration could hide hazards.
- **Verify:** five fresh-player qualitative sessions and known-player regression; muted recognition, first pickup/miss, full/partial trail, collision interruption, pause/resume/restart. Do not extend pulses from screenshot preference alone.

## FEEDBACK-001D-E — Boundary comprehension experiment

- **Problem / value:** UX-05: existing Combined C may not sufficiently explain a world-space clamp under Hybrid; impact remains unproven.
- **Likely files:** isolated comparison tooling plus `src/visuals/arena-boundaries.ts` / `fragmented-warp.ts` only if a selected treatment is later approved. Optional minimal presentation input in `world.ts`; no collider/camera/generator edits.
- **Visible improvement:** approached side/limit is easier to infer while normal flight remains quiet.
- **Scope / dependency:** 1–3 days for current-versus-A comparison from DESIGN-DIRECTIONS. Do not ship B and C pre-emptively. Fix HUD first to avoid confounding alert clutter with spatial problems.
- **Risk:** station masking, fake walls/rails, changed GPU cost or discomfort. Recreating rejected wing beams is out of scope.
- **Verify:** matched native edge/corner/aperture/mine/phase2 routes at desktop/portrait/landscape and reduced motion; independent human boundary identification. Preserve exact gameplay trace and bound constants, pause/reset/disposal; isolated frame measurements and physical-phone acceptance before any performance claim.

## FEEDBACK-001D-F — Comfort disclosure and acceptance polish (conditional)

- **Problem / value:** UX-09: existing OS reduced motion is undisclosed. Remaining issues require human/device evidence rather than more speculative controls.
- **Likely files:** settings copy first; a future override would use existing visual-quality ownership and a small storage preference, not another rendering pipeline.
- **Visible improvement:** understandable comfort guidance. Add system/on/off only if users need an override.
- **Scope / dependency:** a few hours for disclosure; 1–2 days for a verified persisted override if justified. No dependency on the boundary prototype.
- **Risk:** contradictory OS/manual preferences or claiming comfort/conformance without testing.
- **Verify:** system preference live change, saved override/default, no shake/streak regression, readable focus/contrast, 125%/200% browser zoom, physical notches/rotation/thumb reach and motion-sensitive participant feedback.

## Explicit exclusions

Complex obstacle patterns, major procedural changes, full economy, final difficulty tuning, upgrades/progression and major collectible redesign remain intentionally postponed. No absent feature in that list is classified as an implementation defect. Additional menu features, minimaps, targeting lasers, full-screen gauges, postprocessing and framework/physics migrations have no evidence-based priority here.
