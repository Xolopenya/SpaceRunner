# Review guide

Extract FEEDBACK-001D-B-review.zip and open index.html. The gallery contains actual before/after production captures with viewport and state labels. Main normal/phase/hit pairs use the same seed, neutral controls and fixed simulation ticks; coarse/hybrid pictures compare UI capabilities rather than identical moving scenery. Timing videos have accelerated prefixes and a two-second native post-contact segment. They are silent.

Read REPORT, HUD-ARCHITECTURE, INPUT-HINTS, VISUAL-REVIEW, TESTING and PERFORMANCE. Raw captures, counters, test receipts and logs are included. Failed-artifacts retains original unsuccessful-run evidence; final acceptance uses the complete acceptance receipt. Source files, complete.patch and metadata.json identify the exact implementation. MANIFEST.json contains payload hashes; the archive SHA-256 is beside the ZIP.

The implementation branch starts directly from gameplay baseline 54d581958bdde8c5a4d7f9cbdf3ee7a4a7c4f054. Audit fbfde04 was consulted without merging its documentation into that baseline. Unrelated owner files were preserved. No push, merge or publication.

For reproduction, use the repository's existing locked dependencies and installed Chrome. Run scripts from the repository root, with local Chrome/Vite permission if sandboxed:

```powershell
npm run typecheck
npm test
npm run build
New-Item -ItemType Directory -Force .cache/review/FEEDBACK-001D-B/acceptance | Out-Null
$env:REVIEW_RESULT_DIR = '.cache/review/FEEDBACK-001D-B/acceptance'
npm run test:browser -- --workers=2 --retries=1 --output=.cache/review/FEEDBACK-001D-B/acceptance-artifacts
```

For before captures, extract a Git archive of the baseline into `.cache/review/FEEDBACK-001D-B/baseline`, then run the installed root `node_modules/vite/bin/vite.js build --base /` with that directory as cwd. It resolves the existing ancestor dependencies; do not install a second set. The final production build stays at root dist.

Run `capture.mjs` and `input-capture.mjs` after build, sequentially. Run `performance.mjs` only after browser tests/captures/builds finish. All are under docs/review/FEEDBACK-001D-B and use task-owned local preview ports. `package.py prepare`, `verify-gallery.mjs`, then `package.py pack` construct and verify the review artifact. Packaging requires a complete passing serial receipt and a performance receipt newer than that report. Do not run competing Playwright invocations against servers owned by another invocation; preserve original failure logs if a run is interrupted.

Physical devices, browser zoom, other engines and human readability/comfort acceptance remain outside the automated evidence. Source protected by preservation.json includes input, camera, physics, audio, procedural generation, collection, VFX and boundaries. No deferred C/D/E feature is implemented here.
