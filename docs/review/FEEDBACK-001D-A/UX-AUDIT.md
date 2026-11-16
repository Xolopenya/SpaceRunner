# Complete UX issue inventory

Baseline and evidence methods: see [TESTING](TESTING.md). Priorities reflect this vertical slice; hypotheses are not proven player frustration. There are no observed P0 blockers.

| ID | Priority | Category | Classification | Finding |
|---|---|---|---|---|
| [UX-01](#ux-01) | P1 | HUD | Confirmed defect | Damage and phase text collide |
| [UX-02](#ux-02) | P2 | HUD | Likely usability problem | Phase transition reads like developer telemetry |
| [UX-03](#ux-03) | P2 | Input and responsive UI | Confirmed defect | Short desktop windows show touch-only steering instructions |
| [UX-04](#ux-04) | P2 | First run | Likely usability problem | Collectible role is absent from first-run guidance |
| [UX-05](#ux-05) | P2 | 3D readability | Design improvement opportunity | Existing boundary field has no explicit limit confirmation |
| [UX-06](#ux-06) | P2 | Results | Design improvement opportunity | Results do not distinguish a new personal record |
| [UX-07](#ux-07) | P2 | Navigation | Design improvement opportunity | A completed run has no route back to menu or audio settings |
| [UX-08](#ux-08) | P3 | Feedback | Likely usability problem | Pickup recognition depends on a brief peripheral pulse |
| [UX-09](#ux-09) | P3 | Accessibility | Design improvement opportunity | Reduced-motion support is not discoverable in game |
| [UX-10](#ux-10) | P3 | Settings copy | Confirmed defect | Audio footer no longer describes the shipped sounds accurately |

## UX-01 — Damage and phase text collide

**Priority:** P1 · **Category:** HUD · **Class:** Confirmed defect

**Observed:** Hull hit is drawn through PHASE 2 / DANGEROUS SECTOR. Both messages are simultaneously visible after an ordinary accepted collision.

**Expected:** Damage, protection and phase information have separate readable space.

**Reproduction:** Production /?seed=42, 1280x720; launch and leave controls neutral. At about 24.37s the first hit overlaps the phase label. Also reproduce by natural idle first-hit continuation at 390x844.

**Relevant state:** PLAYING, hull 2/3, immunity >0, phase 2

**Supported cause:** .phase-label is absolute at top:100px inside .hud (itself top:30px), while .damage is independently absolute at top:118px. Their horizontal ranges overlap. Portrait uses the same inconsistent coordinate ownership.

**Affected subsystem:** DOM HUD positioning and notification ownership

**Source references:** src/styles.css; src/ui.ts; index.html

**Recommendation:** Give hull, phase and damage one layout owner and a reserved event row. Damage takes priority; keep phase changes brief. Preserve the peripheral Flight Instrumentation layout.

**Implementation complexity:** S: 0.5–1 implementation day including responsive checks

**Confidence:** High; natural runtime screenshot, video and source agree

**Human playtesting:** No for overlap correction; yes for glance readability

**Evidence:** [native-42-idle-hull-2.png](evidence/native-42-idle-hull-2.png), [390x844-hull-hit.png](evidence/390x844-hull-hit.png); [timing video](evidence/native-42-idle.webm).


## UX-02 — Phase transition reads like developer telemetry

**Priority:** P2 · **Category:** HUD · **Class:** Likely usability problem

**Observed:** The three-second phase notice repeats DANGEROUS SECTOR and adds SPEED +8% / RECOVERY GAP -48 without a unit or explanation of recovery gap. Portrait wraps this into multiple lines beside the damage cluster.

**Expected:** A short phase transition tells the player what changes and whether to act.

**Reproduction:** Reach 500m; inspect 1280x720 or 390x844 during the next three seconds, especially with a first collision.

**Relevant state:** PLAYING, newly entered phase 2

**Supported cause:** HUD.update constructs copy directly from RELEASE.phase2SpeedMultiplier, phase1ExtraCells and cellSize; the raw product-facing string lacks a distance unit.

**Affected subsystem:** Phase UI copy and information hierarchy

**Source references:** src/ui.ts; src/release/settings.ts; src/styles.css

**Recommendation:** Use brief factual copy such as Dangerous sector · Faster flight. Keep exact scheduling parameters in diagnostics; avoid implying a new mechanic. Fold this into UX-01's event row.

**Implementation complexity:** XS: a few hours, dependent on UX-01's layout contract

**Confidence:** High for displayed facts; medium for comprehension impact

**Human playtesting:** Yes, check whether new players understand the change

**Evidence:** [native-42-idle-hull-2.png](evidence/native-42-idle-hull-2.png), [390x844-hull-hit.png](evidence/390x844-hull-hit.png); [timing video](evidence/native-42-idle.webm).


## UX-03 — Short desktop windows show touch-only steering instructions

**Priority:** P2 · **Category:** Input and responsive UI · **Class:** Confirmed defect

**Observed:** At 800x450 with a fine mouse pointer and keyboard, the main menu and flight hint say Drag anywhere to steer / Drag to steer. The CSS chooses touch wording by window shape. Coarse-pointer tablet menus also retain ESC/P and M instructions without touch equivalents.

**Expected:** Control hints reflect the available input method and remain correct when resizing a desktop window.

**Reproduction:** Open production at 800x450 with isMobile=false, hasTouch=false. Inspect menu and launch. Compare coarse-pointer 768x1024 menu.

**Relevant state:** MENU and PLAYING, fine-pointer small desktop; coarse-pointer tablet

**Supported cause:** The max-height:520px/min-width:601px rule hides .desktop-control and displays .touch-control unconditionally; max-width:600px does the same. Pointer capability is not the only input into wording.

**Affected subsystem:** Responsive control disclosure

**Source references:** src/styles.css; index.html; src/input.ts

**Recommendation:** Select hints by pointer capability or recent input, independently of compact layout. Keep working mouse drag available. Hide keyboard-only auxiliary hints where touch is the only indicated path.

**Implementation complexity:** S: 0.5 day; no movement changes

**Confidence:** High

**Human playtesting:** No for wording correction; yes for hybrid-device preference

**Evidence:** [keyboard-small-window-menu.png](evidence/keyboard-small-window-menu.png), [keyboard-small-window-flight.png](evidence/keyboard-small-window-flight.png), [768x1024-menu.png](evidence/768x1024-menu.png); [timing video](evidence/keyboard-small-window.webm).


## UX-04 — Collectible role is absent from first-run guidance

**Priority:** P2 · **Category:** First run · **Class:** Likely usability problem

**Observed:** Menu and nine-second flight hint explain steering and avoiding debris. ENERGY appears as 00, but neither surface explains that cyan fragments are optional collections counted for this run. The collector attempt's first success was at 12.56s, after the steering hint had expired.

**Expected:** A new player can distinguish collect from avoid and understand the implemented reward without reading repository documents.

**Reproduction:** Fresh browser context, launch, inspect the first 15s and results. Compare the menu's Avoid debris. Fly further. with the energy counter and result count.

**Relevant state:** First launch / PLAYING / first pickup

**Supported cause:** index.html's mission and hint only describe avoidance. HUD reports a count, with no contextual introduction.

**Affected subsystem:** Onboarding copy and collectible feedback

**Source references:** index.html; src/ui.ts; src/collectibles/settings.ts

**Recommendation:** Add one short contextual introduction around the first visible fragment, for example Collect cyan fragments · Optional run count. Explain only current behavior; do not promise fuel, purchases, upgrades or bonus distance. Make repeat-run exposure dismissible or infrequent.

**Implementation complexity:** S–M: 0.5–1.5 days depending on event timing

**Confidence:** High for missing explanation; medium for player effect

**Human playtesting:** Yes, first-time-player comprehension test required

**Evidence:** [1280x720-menu.png](evidence/1280x720-menu.png), [native-0-collector-pickup.png](evidence/native-0-collector-pickup.png); [timing video](evidence/native-0-collector.webm).


## UX-05 — Existing boundary field has no explicit limit confirmation

**Priority:** P2 · **Category:** 3D readability · **Class:** Design improvement opportunity

**Observed:** The current Combined C fragmented field is already present and responds near edges. At held x=6 the ship stops while the hybrid camera keeps it relatively central; there is no distinct brief limit cue. Sparse field fragments do not form a continuous perimeter.

**Expected:** Players can infer the flight volume and understand a movement clamp without additional playfield clutter.

**Reproduction:** 1280x720, hold D to the right bound, continue holding, then move to top/left. Compare boundary-right and boundary-right-held states and video.

**Relevant state:** PLAYING at x=6 or y=3.6

**Supported cause:** CONFIG clamps ship center to ±6/±3.6; approved Hybrid follows 80%. ArenaBoundaries already supplies a proximity-brightened fragmented shader, but no explicit clamp-state event is presented.

**Affected subsystem:** Boundary presentation only

**Source references:** src/config.ts; src/camera/flight-camera.ts; src/visuals/arena-boundaries.ts; src/visuals/fragmented-warp.ts; src/world.ts

**Recommendation:** Validate whether players notice the existing field before adding anything. Compare three small presentation refinements in DESIGN-DIRECTIONS; keep Hybrid, collision bounds and owner-approved Combined C.

**Implementation complexity:** M: 1–3 days for isolated prototypes and comparison, after HUD fixes

**Confidence:** High for existing behavior; medium/low for comprehension impact

**Human playtesting:** Yes, essential before choosing a boundary treatment

**Evidence:** [boundary-right.png](evidence/boundary-right.png), [boundary-right-held.png](evidence/boundary-right-held.png), [boundary-top.png](evidence/boundary-top.png); [timing video](evidence/focused-boundaries-settings.webm).


## UX-06 — Results do not distinguish a new personal record

**Priority:** P2 · **Category:** Results · **Class:** Design improvement opportunity

**Observed:** The first natural 868m result shows 868m both as distance and personal best with no record acknowledgement or previous-best comparison. The record-broken event reaches a data attribute, but no visible UI consumes it.

**Expected:** A player can immediately recognize an improvement and understand their result.

**Reproduction:** Use a fresh context, complete a run above zero. Inspect results and compare final distance / personal best; repeat below the saved best.

**Relevant state:** GAME_OVER after first new record

**Supported cause:** HUD.feedback sets data-record-broken; CSS and results markup do not show a corresponding acknowledgement. ScoreStorage updates best before results.

**Affected subsystem:** Results messaging and best-score presentation

**Source references:** src/ui.ts; src/game.ts; src/services/storage.ts; index.html

**Recommendation:** Reuse the existing record fact for a compact New personal best label. Retain the large distance and primary replay action. A delta needs a truthful captured previous baseline; avoid fabricated medals or economy.

**Implementation complexity:** S: 0.5–1 day

**Confidence:** High for missing acknowledgement; medium for replay motivation

**Human playtesting:** Yes for motivational effect; no for correct record distinction

**Evidence:** [native-42-idle-results.png](evidence/native-42-idle-results.png), [390x844-results.png](evidence/390x844-results.png); [timing video](evidence/native-42-idle.webm).


## UX-07 — A completed run has no route back to menu or audio settings

**Priority:** P2 · **Category:** Navigation · **Class:** Design improvement opportunity

**Observed:** Results expose Fly again as the only action. Pause offers resume/restart/sound but no menu. From results, changing volume requires launching another run and pausing it. Browser reload is the available path to the original menu.

**Expected:** A player can finish reviewing a run and choose replay or return to the menu/settings.

**Reproduction:** Complete any natural run; inspect results buttons and keyboard navigation. Try to return to main menu without reloading.

**Relevant state:** GAME_OVER; PAUSED

**Supported cause:** Results markup has only #replay; Game has no UI transition back to MENU from these states.

**Affected subsystem:** State navigation and audio access

**Source references:** index.html; src/game.ts; src/core/game-model.ts

**Recommendation:** Add one subdued Back to menu action on results, with explicit lifecycle cleanup and focus ownership. Consider the same route from pause only if loss of the current run is clearly communicated. Keep replay primary.

**Implementation complexity:** M: 1–2 days; lifecycle work, not just a new link

**Confidence:** High for available actions; medium for frequency/impact

**Human playtesting:** Yes to check action hierarchy

**Evidence:** [1280x720-results.png](evidence/1280x720-results.png), [390x844-pause.png](evidence/390x844-pause.png); [timing video](evidence/native-42-idle.webm).


## UX-08 — Pickup recognition depends on a brief peripheral pulse

**Priority:** P3 · **Category:** Feedback · **Class:** Likely usability problem

**Observed:** Pickup gives a visible local ring, counter increment, +1 and sound. The +1 lasts about 0.42s in the far upper-left cluster, while the pilot attends to the next obstacle. The native collector run verified three accepted pickups; this is a discoverability/glance-risk hypothesis, not a pickup failure.

**Expected:** The existing pickup effect and count are enough to identify a success while avoiding hazards, including muted flight.

**Reproduction:** Watch native-0-collector at the first pickup (~12.56 gameplay seconds), then the next approach; compare counter and local ring. Repeat muted in a human test.

**Relevant state:** PLAYING, accepted collectible.collected event

**Supported cause:** HUD pulse lifetime follows FEEDBACK.pickup.duration; event association is brief and peripheral. Existing ring and sound are positive redundant cues.

**Affected subsystem:** Pickup UI feedback, not pickup geometry

**Source references:** src/ui.ts; src/feedback/settings.ts; src/collectibles/settings.ts

**Recommendation:** First measure recognition with new players. If needed, slightly extend the counter emphasis or add a short nearby text response using the existing event, without beams, extra persistent markers, increased pickup assistance or spawn changes.

**Implementation complexity:** XS–S if validated; a few hours plus muted-play verification

**Confidence:** High that the effect works; low/medium that more persistence is needed

**Human playtesting:** Yes; do not implement from screenshots alone

**Evidence:** [native-0-collector-pickup.png](evidence/native-0-collector-pickup.png), [silent-flight.png](evidence/silent-flight.png); [timing video](evidence/native-0-collector.webm).


## UX-09 — Reduced-motion support is not discoverable in game

**Priority:** P3 · **Category:** Accessibility · **Class:** Design improvement opportunity

**Observed:** OS prefers-reduced-motion is respected by renderer and CSS, including reduced streaks/shake and a shorter death sequence. The only settings surface is Audio, with no indication of this existing comfort mode.

**Expected:** A motion-sensitive player can discover how to enable the supported comfort behavior.

**Reproduction:** Open Sound settings; compare with a context emulating reducedMotion:reduce. Inspect reduced-motion-flight and TESTING facts.

**Relevant state:** MENU/PAUSED settings; PLAYING with OS reduced motion

**Supported cause:** World reads matchMedia('(prefers-reduced-motion: reduce)'); settings UI only owns audio.

**Affected subsystem:** Comfort setting disclosure

**Source references:** src/world.ts; src/visuals/settings.ts; src/styles.css; src/audio/sound-panel.ts

**Recommendation:** A small note describing system preference support is the lowest-risk option. Consider an in-game override only if users need it; default to system and reuse the current quality path.

**Implementation complexity:** XS for note; M for persisted system/on/off override

**Confidence:** High for discovery gap; medium for priority

**Human playtesting:** Yes, motion-sensitive participants; no clinical comfort claim

**Evidence:** [390x844-settings.png](evidence/390x844-settings.png), [reduced-motion-flight.png](evidence/reduced-motion-flight.png); [timing video](evidence/reduced-motion-rotation.webm).


## UX-10 — Audio footer no longer describes the shipped sounds accurately

**Priority:** P3 · **Category:** Settings copy · **Class:** Confirmed defect

**Observed:** Audio settings say Original synthesized sounds and ambient music even though accepted collision audio now uses licensed sampled derivatives as well.

**Expected:** User-facing audio copy remains accurate and useful.

**Reproduction:** Open Audio from menu or pause and read the footer; compare current sample-settings and docs/ASSETS.

**Relevant state:** Audio dialog open

**Supported cause:** Historical index.html footer predates FEEDBACK-001C1 sampled collision audio.

**Affected subsystem:** Settings copy

**Source references:** index.html; src/audio/sample-settings.ts; docs/ASSETS.md

**Recommendation:** Remove the obsolete production-method sentence or replace it with useful comfort/control guidance. Keep attribution in ASSETS and license notices.

**Implementation complexity:** XS: minutes

**Confidence:** High

**Human playtesting:** No

**Evidence:** [1280x720-settings.png](evidence/1280x720-settings.png).

## Excluded future features

Complex obstacle patterns, major procedural generation work, a full economy, final difficulty balancing, upgrades/progression and major collectible-system changes are intentionally postponed. Their absence is not a defect. No speculative feature backlog is included.

## Positive coverage and uncertainty

See HUD-AND-MENUS, GAMEPLAY-READABILITY and RESPONSIVE-ACCESSIBILITY for working behaviors. User frustration, higher retention, better comfort and improved comprehension have not been demonstrated by this automated audit. Boundary and feedback opportunities require human testing. Source excerpts are in source/SELECTED-EXCERPTS.md.
