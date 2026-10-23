# Production UI architecture

## Existing responsibilities retained

Game still owns lifecycle, event wiring, focus/visibility pause, graphics recovery and state synchronization. InputManager owns keyboard/pointer capture. Core model owns hull, cooldown, distance and seeded generation. World owns camera/models/VFX. AudioManager owns Web Audio and preferences; SoundPanel owns its native dialog events/status/values. None of these implementations changes for this task.

HUD receives the existing model and best-score data. It retains all required IDs and state focus targets, exposes live hull numerals and a separate paused metric view, and formats route information. Menu/final values update on state transitions; current/paused distance updates only on integer score changes. Hull pips, counts and meter attributes update on hull changes. Hint/damage visibility, hit style and rounded speed avoid redundant DOM writes. There is no layout measurement or DOM subtree construction in the frame path.

The visible HUD is exclusive to PLAYING. Pause gets its own model-backed distance/hull, so hiding active instruments never removes that information. Inactive sections use the real hidden attribute, excluding their buttons/meters from focus and accessibility navigation. HUD retains the existing nine-second steering hint and the actual damage/invulnerability conditions; UI does not advance or tune either clock.

## DOM and accessibility contracts

Original IDs and selectors consumed by Game, main loader, InputManager and SoundPanel are preserved, including `flight`, `retry`, `pause-reason`, `telemetry` and every sound input/output. Sound-open buttons retain plain text because SoundPanel intentionally replaces that text for muted status; their decorative arrow is CSS only. Native labels/for associations and outputs remain intact.

New `hull-count`, `paused-score`, `paused-hull` and `paused-hull-count` are presentation targets only. Hull meters retain 0–3 bounds and exact values plus spoken text; duplicate visual numerals are aria-hidden. Distance is not an incessant live announcement. The existing damage status remains separate from numeric meters.

Native dialog supplies top-layer modality, focus containment and restoration. Its existing Escape/P handling and real audio gestures are not reimplemented. There are no new global listeners, observers or disposal obligations in runtime UI; original abort/HMR cleanup remains sufficient. The joystick is still a rendering-only pointer indicator owned by InputManager.

## Assets, styles and ownership

CSS centralizes Concept A's palette, typography and edge/safe-area variables. Native viewport/grid/media rules adapt the composition without camera changes. Number-size attributes are based on the actual formatted string; they affect presentation alone. No score abbreviation or injected telemetry is used.

Two unchanged local TTFs are preloaded/shipped with original OFL notices. Unused Oxanium 700 remains design-only. The historical exploration stays outside public and the production entry graph. No framework, icon library, animation library or runtime CDN is introduced.

## Review boundaries

Current tooling compares all original non-UI runtime files, original tests and concept sources against baseline blobs; public font bytes/notices are checked against approved source hashes. Current screenshots, baseline references, actual build sizes and matched render samples are machine-described. Cached HUD profiling is labelled as a synchronous static-model microbenchmark, not whole-frame or device performance. Physical browsers/devices, long sessions and screen-reader user acceptance remain separate.
