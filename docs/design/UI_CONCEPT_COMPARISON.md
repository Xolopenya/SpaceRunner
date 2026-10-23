# Concept comparison and visual review

Recommendation: **A — Flight Instrumentation**, pending owner approval. Open `http://127.0.0.1:5173/design/ui-concepts/` after `npm run dev` for real browser comparisons. Full-size links and a review state selector are provided. No production UI has been replaced.

| Criterion | A / Flight Instrumentation | B / Arcade Racing | C / Isolation Minimalism |
| --- | --- | --- | --- |
| Identity | Two-line geometric title, small cut, restrained cyan | Heavy slant, offset title, lime launch | Tracked single-line title, pale open type |
| Priority | Ship → launch / hull & distance | Title/score → replay | Scene → title → quiet actions |
| Controls | Filled primary surface, open secondary | Assertive angled primary | Ruled text actions require more attention |
| Negative space | Clear middle, useful left column | Clear active middle; menu title heavier | Most open space, quieter hull |
| Existing art relationship | Matches cyan engines and navy background | Lime introduces a competing accent | Preserves atmosphere but darkens menu ship |
| Readability risk | Small labels still need moving-scene checks | Distance may draw excessive attention | Small hull and subtle start affordance |
| Responsive work | Desktop + portrait + landscape + audio | Desktop explored | Desktop explored |
| Decision | Best balance for the current game | Keep as energy alternative | Keep as mood alternative |

## Render inventory

`node scripts/ui-concepts-verify.mjs` renders **29 PNGs** in ignored `test-results/`, then review packaging includes them in `screenshots/`. The JSON diagnostics records actual browser, viewport, image hashes and checks.

- 12 desktop concepts: `ui-{a,b,c}-{menu,playing,paused,over}-desktop.png`, each 1440×900.
- Eight A mobile states: `ui-a-{menu,playing,paused,over}-{portrait,landscape}.png`, at 390×844 and 844×390.
- Three A audio settings images: `ui-a-audio-{desktop,portrait,landscape}.png`.
- Three supplemental A states: `ui-a-{hit,loading,error}-desktop.png`.
- Three comparison boards: `ui-comparison-desktop.png`, `ui-comparison-hud.png`, `ui-comparison-mobile.png`. Boards capture the complete page; individual frames retain their declared native viewport before scaling.

The six background PNGs are separately tracked with capture provenance. They show the real approved game: menu or unsteered route 42, frozen after 150 m, hull 3, speed rounded to 21 m/s and seven active hazards. The hit screen is an explicitly illustrative 2/3 hull scenario; the results screen uses the recorded distance as a completed first-run example. There is no live score progression or new game system in these prototypes.

## Visual review findings

The title, primary action and ship remain separate in A's desktop menu. A/B/C use distinct title scale, weight, alignment and action treatment rather than exchanging only colors. Active HUDs remove all permanent branding. The center stays free of HUD elements in all reviewed desktop concepts and A's mobile sizes; this is checked geometrically, then inspected against the real scene. Pause/results use shared edge alignment instead of a centered rounded panel.

Portrait A retains a visible ship between title and lower action; the pause screen keeps distance/hull beside the world and resume below it. Landscape compresses menu type without shrinking primary targets. Audio uses a vertical sheet on desktop/portrait and three channels in one row in landscape, with internal scrolling available at smaller heights. Native focus rings remain deliberately visible.

The first background capture accidentally included overlapping production DOM; the capture routine now temporarily hides only UI siblings, restores them and records that method. The first geometric check found the landscape hint inside the reserved flight area; it moved below that area. The initial landscape audio column required unnecessary scrolling; the final three-column composition exposes sliders and mute together at the reviewed size. Comparison boards use full-page captures to avoid clipping the final row.

## What the studies do not establish

Static screenshots cannot establish readability across a moving run, player preference, thumb reach, physical display/safe-area performance, or accessibility conformance. Browser checks cover preview state navigation, keyboard/touch controls, native dialog focus/return, slider values, mute and layout fit; audio remains silent and preview-only. Existing production regression tests cover the playable application's current behavior separately. No design has owner approval yet.
