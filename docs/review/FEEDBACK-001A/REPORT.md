# FEEDBACK-001A — Game Feel & Feedback Foundation

Branch: `feature/feedback-001a-event-foundation`.
Base: `8edfec076ef3860eea33058ce6da2a678e31dbf4`, the checked-out VISUAL-007B tip.
Its local tracking ref matched at task start; remote freshness is not claimed.
Unrelated untracked research/skill files are preserved and excluded from delivery.

## Preliminary audit and selected approach

`GameLoop` performs 120 Hz fixed steps, then presentation. `GameModel.step` owns
movement, distance score, accepted collision, one HP per hit, immunity and immediate
GAME_OVER. `RuntimeGameModel` supplies the certified field; `ReleaseModel` accepts
fragments after the base step; `IntegratedModel` supplies mines. The existing field
`events` array is a bounded planner diagnostic history, not a subscription system.

`FragmentRun` grants one energy per accepted swept pickup, without affecting distance
score. `lastPickup` supports the existing assisted attraction. ImpactVFX,
FragmentView and AudioManager independently polled damage/pickup counters.
Their existing fixed pools, shimmer, audio graph, voice limit, volumes, gesture
unlock and disposal are reusable. HUD polling remains appropriate for persistent
HP/cooldown/meters. ScoreStorage persists best distance only at GAME_OVER.
World already supplies scalar shake to FlightCamera; Hybrid reconstructs both
endpoints, while the historical DEV baseline uses an accumulating recurrence.

The selected solution adds typed observation hooks, a bounded mailbox delivered
after the complete outer model step, and one feedback coordinator. No planner,
collision, controls, health or reward algorithm is replaced.

## Implementation

All eight requested event families carry run ID and simulation elapsed time.
Damage/collision/destruction copy obstacle identity/kind, ship/obstacle positions and
steering velocity. The ship reference at the collision step is explicitly **not**
an exact surface point/normal. Pickup includes identity, position, reward and total;
multiple pickups in one step each produce a fact. Record crossing fires once per
run against the existing best supplied by Game, without changing persistence.

FeedbackOrchestrator selects Minor pickup, Medium damage or Major destruction from
each batch. HUD receives all facts even when decorative feedback is suppressed.
Fatal damage does not duplicate the normal hit sound/burst. Stronger contacts clear
weaker bursts/native voices; lower priority cannot interrupt stronger aftermath.
Delivery/channel failures are contained and counted; gameplay does not wait for them.

The demonstration reuses the existing pickup ring/chime, impact burst, ship shimmer,
impact/destruction SFX and results cue. The ring now begins at pickup acceptance
alongside its sound, instead of after the old 140 ms attraction. Attraction is
unchanged. Contact audio has no artificial delay. Only the existing secondary
game-over cue retains its configurable 550 ms delay; pause/restart/background stop
its native voice. SoundCue supports existing sound variants, gain and bounded rate
variation without consuming gameplay RNG. Current presets keep original gain/rate.

The new bounded camera envelope uses the existing scalar interface (damage 0.035,
destruction 0.045), freezes in pause and returns exactly to zero. Reduced motion
disables displacement. DEV baseline receives zero impulse to avoid its recurrent
offset accumulation. FlightCamera implementation and Hybrid geometry are unchanged.

New modules: events/game-events, feedback/settings, feedback/orchestrator,
feedback/camera-impulse. Local adapters: GameModel, RuntimeGameModel, ReleaseModel,
FragmentRun, Game, World, HUD, AudioManager/AudioGraph, ImpactVFX and FragmentView.
No dependencies, assets, physics, controls, collider math, generation or balance added.

Removed/replaced: independent damage/pickup detection in AudioManager, serial-based
emission in ImpactVFX, and count-based pickup-ring triggering in FragmentView.
Existing diagnostic counters, engine/music state mixing, quality tiers, attraction,
cooldown shimmer and persistent HUD meters remain.

Historical source-preservation tests remove only labelled additive GameModel event
hooks before checking the original approved digest. Every original executable line
remains pinned. New tests exercise the hooks. The preservation script verifies all
126 baseline runtime/asset/config inputs: 115 unchanged, 11 local adapters allowed.

## Limits and risks

No cinematic explosion, wreckage, damage materials, new mechanics/music or HUD
redesign. Contact/Aftermath/Recovery is a small duration envelope, not a universal
timeline. Visual channels retain their existing animation and fixed resource pools.
Minor pickup decoration can be suppressed during damage/death; rewards/HUD remain.

Phase events distinguish real progression 1→2 from the director's pacing change on
successful **publication**. Director payload includes intensity and scheduled start
distance; publication does not mean the ship has entered that section. No phases
are invented for the legacy field. Only accepted collisions are reported: immunity
still skips collision queries, so skipped contacts are not newly detected.

Subscribers receive facts, not authority to apply damage. Recursive publication is
rejected; overflow safely drops presentation and increments diagnostics. Future
effects must respect channel pool limits and own/dispose any new material resources.

Chrome automation plus visual inspection of actual renders is documented separately;
human owner acceptance and physical-phone tests remain outstanding. The existing
damage notice overlaps the phase label in the desktop contact screenshot; HUD layout
is outside this task. Vite retains its large-bundle advisory; no lint script exists.

See ARCHITECTURE.md, TESTING.md and NEXT-STEPS.md. Exact final commit/base, complete
diff, Git status/log and canonical source are in the review ZIP. No merge/deployment
or remote push is performed.
