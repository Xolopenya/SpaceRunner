---
name: space-runner-ui-design
description: Art-direct and review Space Runner game HUD, menus and responsive interfaces using real game screenshots and browser prototypes. Use for UI concepts, screenshot comparison and visual quality review; gameplay, rendering and audio engineering remain separate.
---

# Space Runner UI design

Read the current repository guidance and the status in [art direction](../../../docs/design/UI_ART_DIRECTION.md), [comparison](../../../docs/design/UI_CONCEPT_COMPARISON.md), [tokens](../../../docs/design/UI_DESIGN_TOKENS.md) and [reference research](../../../docs/design/UI_REFERENCE_RESEARCH.md), resolving these links from this skill directory. PHASE-3-004A recommends A; it does not record owner approval. Confirm approval from the conversation or current docs before production integration. Existing user authorization takes precedence; do not request it twice.

The thesis is minimalist flight instrumentation for a fast, atmospheric, low-poly arcade. Use the real Kenney ship/current scene. Inspect index.html, src/ui.ts, src/styles.css and src/audio/sound-panel.ts before implementation work. Keep title/start, three hull points, distance/best, pause/resume, damage protection, restart, steering hints, loading/retry and audio controls represented. Use only implemented game values; label static scenarios and review-only navigation clearly.

Prefer A's sparse cyan, open center, angular title and strong numeric hierarchy. Reference the documents for exact values rather than repeating them here. Reserve warm color for damage, combine missing hull color with explicit counts, and keep the 3D approach visible. Avoid marketing hero copy, glass cards, permanent branding during flight, fake gauges, decorative telemetry and copied proprietary layouts.

Keep concepts in design/ui-concepts/, outside public/ and the production entry graph. No framework is needed. For production work that has been approved, wire the chosen design to existing state/audio ownership; do not silently replace lifecycle messages, key bindings, controls or model behavior.

Render full-size menu, active HUD, pause and game-over states against real captures. Compare alternatives side by side. Review the recommended direction in portrait, landscape and audio settings, including visible focus, >=44px targets, native dialog Escape/focus return, safe insets, reduced motion and real labels/units. Inspect images and fix clipping, collisions between elements, unreadable text and ship/hazard obstruction. Static shots do not verify moving hazard readability or physical phones.

Use node scripts/ui-concepts-verify.mjs for current concept renders/checks; it expects npm run build first. Deliberately refresh tracked backgrounds only when a new approved baseline is intended; ui-capture-backgrounds.mjs changes reference images. Preserve existing playable regressions and run appropriate typecheck/tests/build/browser checks for changes. Record actual commands, defects fixed and untested limits in docs/TASKS.md. Consult docs/ASSETS.md before bundling fonts/images; retain notices and provenance. Do not imply design approval, listening approval or deployment from passing browser checks.
