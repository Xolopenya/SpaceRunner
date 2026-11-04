# GAMEPLAY-005A — Integrated Playable Loop

Baseline: `a16e0707fccdaee927db95826eef92f3d801992d`. Source of bounded homing research: `beba40856ae70fce58f06ec4f896912fdcaa1418`.
Branch: `feature/gameplay-005a-integrated-playable-loop`. This is an owner playtest experiment; production main was neither merged nor deployed.

Ordinary Launch run now creates `IntegratedModel`, including in the local static build. No experiment URL is required. It combines the release Mixed Flow source, shifting station openings, optional Energy Fragments, body/wing collision, occasional balanced adaptive mines, Hybrid Chase and visual arena edging. Existing HUD, audio context, damage, immunity, movement, forward speed, pause/resume and restart retain their rules. Phase 2 still starts at500m with the existing1.08 speed multiplier.

`IntegratedModel` reuses ReleaseModel's fragment lifecycle and speed, with an explicit composed encounter source. Historical ReleaseModel and old DEV experiment URLs remain available for regression comparisons. The ordinary mine loads the existing licensed local GLB once; no new dependency, download or external runtime service was added.

The secondary branch was not merged. Its AdaptiveSource/model, route policy, frame accounting and focused frozen-root tests were selectively imported. Runtime proposal preference and frame-budget hooks were applied without reverting the newer wing-profile bounds and publication checks. Additional integrated geometry validates and replays the same compound ship used by real collisions.

Review starts with OWNER_PLAYTEST_GUIDE.md. CAMERA_AND_BOUNDARIES.md describes presentation; MINE_INTEGRATION.md describes safety and remaining gaps. PLAYTEST_NOTES.md and PERFORMANCE.md distinguish measured automated evidence from the owner's pending assessment.
