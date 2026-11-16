# Review package guide

Extract `FEEDBACK-001D-A-review.zip` and open `index.html` in a browser. Start with EXECUTIVE-SUMMARY, then inspect priority/category findings with their real screenshots and timing videos. Nine detailed reports are linked at the top. Videos are silent. All gallery resources are local; the gallery requires no network server or dependency installation.

`UX-AUDIT.md` and `findings.json` contain the complete ten-item inventory. `facts.json`, `live.json`, `matrix.json` and final `focused.json` retain test method and exact state/viewport receipts. `source/SELECTED-EXCERPTS.md` has numbered excerpts and canonical commit links. `source/design` and `source/ASSETS.md` are reference snapshots, retaining some original repository-relative links; this is intentionally not a full repository copy.

The original full browser run has 119 passing tests and two artifact-write errors. `audio-recheck` contains the two unchanged passing repeats after correcting the audit output directory. See TESTING before interpreting the receipts. Original sandbox denial and initial focused-capture receipts are retained; current screenshots correspond to final captures, not overwritten initial-session states.

Check the adjacent `.zip.sha256` against the archive. Inside the ZIP, `MANIFEST-SHA256.json` inventories every other payload file by size/SHA-256. The external `.zip.verification.json` records CRC and inventory verification and the audit documentation commit. Production remains at the specified baseline.

To reproduce from the repository with its existing locked dependencies and Chrome:

```powershell
npm run typecheck
npm test
npm run build
New-Item -ItemType Directory -Force .cache/review/FEEDBACK-001D-A/full-browser | Out-Null
$env:REVIEW_RESULT_DIR = '.cache/review/FEEDBACK-001D-A/full-browser'
npm run test:browser
node docs/review/FEEDBACK-001D-A/tooling/audit-browser.mjs live
node docs/review/FEEDBACK-001D-A/tooling/audit-browser.mjs matrix
node docs/review/FEEDBACK-001D-A/tooling/audit-browser.mjs focused
node docs/review/FEEDBACK-001D-A/tooling/analyze-evidence.mjs
```

Run modes sequentially because they use the same local preview port. Chrome/Vite need permission for localhost if the environment restricts network access. The captured native pilots choose actual keyboard inputs using state knowledge; reruns can differ due to native frame/planning cadence. They are evidence of coverage, not a guarantee of identical survival times or a human skill benchmark. Temporary observation lives only in the test browser. For package rebuilding, follow TESTING and the review-only tooling; generated artifacts remain in ignored `.cache` / `review-packages`, outside the production graph.
