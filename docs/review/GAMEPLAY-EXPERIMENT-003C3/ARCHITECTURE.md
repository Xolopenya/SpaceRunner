# GAMEPLAY-EXPERIMENT-003C3 — Architecture

Status: **Partial**. The safely certified DEV implementation is available; H3 availability is not accepted (37/48 mines versus 43/48 for Fast/Diagonal). Owner playtesting and physical-device review remain pending. Reference measurements were collected on 2026-11-02; exact-HEAD verification and archive identity are generated in the review manifest.

Baseline: `bad0a5498e41a262da224308deefae5bee8bd28e`. Branch: `feature/gameplay-003c3-target-lock-mine`. No merge, main modification, production rollout, new asset, physics engine or dependency.

## Publication transaction

1. The existing Mixed Flow chooses the same encounter frequency/span. A target template reserves six cells including its tail. Its provisional native payload has no collidable mine and no safety certificate.
2. Acquisition is a 96-tick (0.8 s) noncollidable preview. Its seeded corner is selected once when the template is created. If the observed ship is within 2 units of that corner, choose the opposite corner then; it cannot change during preview. This prevents a visual teleport at lock. Moving into that corner afterward can still cause a safe rejection.
3. On planning call 97 (96 actual simulation ticks after acquisition), copy the actual root: x/y/vx/vy, input, elapsed, tick and distance. Resolve the final target to that exact observed XY, with no lead. Build the complete immutable trajectory and canonical stable ID.
4. Inspect source membership, metadata, ownership, separation, capacity and complete known field. Cancel and replace only the pending reservation. No active object is changed.
5. In the SAME synchronous call, perform a fresh actual-root constructive search plus independent clock/CCD replay against the full committed+candidate field. The entire warning/attack/hold timeline is specified first. An unfinished or rejected proof cannot be resumed later to publish this target.
6. Atomically finalize ownership and map the frozen accepted payload to the existing slots. Any failure uses the existing whole native fallback or explicit omission within the same deadline and attempt limits.

`RuntimeCandidate.publicationPolicy=resolve-at-publication-v1` is an opt-in extension. Old root-aware publication and old experiment sources retain their original paths. `field-motion.ts` centralizes nested capture freezing and exact identity comparisons. No generalized homing agent is introduced.

## Search proposals and authority

The latest committed certificate's controls may propose a path through already committed geometry, aligned by absolute simulation time. Proposal use ends after the complete committed exit. The actual current input is still held for 54 reaction ticks. Every proposed interval is checked against the NEW target and full known field, followed by independent replay. No old certificate, hash or assumed future user input authorizes publication. New target publication observations deliberately contain no prior witness.

The same-root unhinted counterfactual accepts 35/37 actual accepted targets; the proposal helps two additional cases. Ten primary failures in the remaining 11 omissions encounter already committed geometry; one resolver rejects a too-close origin. A one-path constructive miss is not a proof of impossibility. Budgets were not raised to hide these misses.

## Lifecycle and isolation

One known/active moving mine maximum; no wreck and mine in the same source transaction. Native full-span fallbacks retain ownership. Actual damage, scoring, invulnerability, controls, speed, pause/resume/restart, model, audio and production HUD use existing code. Preview has no collider or live slot. The red pulse/path controller is created only for Target-Lock and joins existing resource ownership. Restart resets capture clocks/IDs without new GLB loads.

The production selector and experimental asset remain stripped. `target-lock-preservation.json` checks116 approved-versus-current histories, protected source/assets and the exact15-file/931651-byte production output. Historical suites and moving/mixed audits remain required in review.config.json.
