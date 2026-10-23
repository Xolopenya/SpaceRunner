# PHASE-3-004A interface studies

Run `npm run dev`, then open http://127.0.0.1:5173/design/ui-concepts/.
The default comparison shows A/B/C across menu, HUD, pause and game over.
`?view=hud` compares only active HUDs; `?view=mobile` shows A in portrait and landscape.
Open a frame's **Inspect** link for real-size interaction. The bottom review toolbar switches concept/state. Launch, pause, resume and replay navigate between **frozen screen previews**; ESC/P, M, native audio-dialog focus/close and sliders are interactive. They do not run a simulation, generate sound, save preferences, or alter the playable game. The toolbar and UI STUDY caption are not proposed production chrome.

`prototype.html?concept=a&state=paused&audio` opens the audio study. Other states: `menu`, `playing`, `paused`, `over`, `hit`, `loading`, `error`. Only A has a fully reviewed mobile/audio direction; B/C mobile is outside this comparison.

## Evidence

- `assets/*-menu.png` and `*-flight.png` are actual approved-game canvas captures. `capture-provenance.json` records baseline, viewport, route, score, hull, browser and hashes.
- `node scripts/ui-capture-backgrounds.mjs` deliberately refreshes those **tracked** references from the current checkout. Do not run it casually or during packaging; a changed baseline requires a new review.
- `node scripts/ui-concepts-verify.mjs` renders all required desktop/mobile screens and comparison boards into ignored `test-results/ui-*.png`; it also checks navigation, fit, dialog keyboard behavior, local requests and unchanged production sources/build. It starts its own Vite server and uses installed Chrome.
- Design research, decisions, tokens and visual findings: `docs/design/` at repository root; see [art direction](../../docs/design/UI_ART_DIRECTION.md).
- Fonts are local, unchanged Google Fonts files with complete OFL notices. No third-party game artwork is bundled here.

These files are outside `public/` and the production entry graph, so normal `npm run build` continues to produce only the approved playable application. Approval of a concept and a separate implementation task are required before production integration.
