# PHASE-3-004B — Concept A production integration

Approved design baseline: `80f292347109e64c1c20d3b12b447048a89fc7bd`. Feature branch: `feature/phase-3-ui-implementation`. The owner's PHASE-3-004B brief approves Concept A and authorizes production integration, feature-only push and an architecture review ZIP. Main must not be merged or pushed.

## Result

The playable app now uses the approved angular two-line title, Oxanium display values, Plex Mono labels, cyan actions/hull, navy surfaces and warm damage/end-state feedback. The menu preserves a visible real ship. Active flight has no logo or build label; three hull segments, explicit count, distance/unit, pause, short-lived steering guidance and actual speed remain. Pause is a left-aligned Hold position composition with the real reason, frozen distance/hull, Resume and Sound settings. End of flight shows actual final/best distance, route and replay. Loading text and Retry still belong to the original async loader.

The existing SoundPanel/AudioManager are unchanged. The native dialog now follows A's instrument sheet, with three channels in one landscape row. Values, percentages, mute state, persistence, context unlock, unavailable/blocked/suspended messages and focus behavior remain real. No prototype controls, sample scores, screenshot backgrounds or review navigation enter the production interface.

## Focused source changes

- `index.html`: static production markup and original ID contracts; new explicit hull/pause-value slots; two local font preloads.
- `src/styles.css`: Concept A tokens and geometry, responsive grid/short-height rules, safe-area insets, focus, reduced motion and large-number sizing.
- `src/ui.ts`: adapts the existing HUD, formats real values and updates cached DOM only when those values change. No orchestration rewrite or additional game listeners.
- `public/assets/fonts/`: unchanged Oxanium 500 and IBM Plex Mono 400 plus complete OFL notices, copied from the approved local design files.
- New UI Playwright coverage and current-task evidence tooling; the existing regression files remain unchanged.

All other original runtime source, model bytes, camera transforms, input, game loop, core/collision/spawn logic and audio implementation are preserved. Package manifests are unchanged; no dependency installation was required.

## Deliberate adaptations from the approved screenshot

Production labels/instructions use 11–12px rather than the study's smallest 9–10px text. Real pause reasons and audio statuses can wrap. Portrait uses grid allocation instead of fixed demo gaps so actions remain usable on shorter displays. Six-digit and larger formatted values select compact number sizes without rounding or truncating model data. The dialog is opaque navy for legibility. Keyboard focus rings remain visible, including the initially focused launch action. The meaningless review caption/toolbars and permanent branding are omitted. Existing impact protection is described accurately without introducing a shield mechanic or countdown. Camera/ship transforms are not moved to make room.

## Evidence and reproduction

Run `npm run dev` and open the root game. Use `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:browser` or the configured `npm run review:verify`. Installed Chrome/local socket access are required for browser verification. `npm run review:pack` requires a clean committed tree and repeats verification before packaging sources, licenses, patch, reports, logs and screenshot hashes.

Before editing UI, `ui-production-baseline.mjs` captured the approved game at desktop/portrait/landscape and preserved four actual A renders from the reviewed PHASE-3-004A ZIP. Baseline capture is intentionally restricted to the approved commit. The review archive supplies these images and their provenance; it excludes the old ZIP itself. New screenshots show actual production DOM. A built-production route-42 image uses no debug seam; long-score/hit scenarios use documented real-model/collision fixtures. Comparison boards label before, approved study and current UI rather than implying synchronized gameplay frames.

The ordinary unit/browser workflow does not need the old review archive or baseline cache. Repackaging additionally needs the captured baseline metadata/images under `.cache/review/PHASE-3-004B/baseline/`, provided as `logs/baseline/` and `screenshots/` in the delivered ZIP. Restore those evidence files if reproducing review packaging elsewhere; do not regenerate historical images from the new UI.
