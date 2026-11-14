# Verification and reproduction

Commands assume the repository with local base commit2eb9741, installed project
dependencies and Chrome. Baseline freeze/preservation need that Git history; the
review package also supplies the complete base-to-final diff and canonical source.

```powershell
node --experimental-strip-types scripts/damage-scenarios.mjs
node scripts/feedback-polish-capture.mjs freeze
node scripts/feedback-polish-capture.mjs baseline
npm run typecheck
npm test
npm run build
node scripts/feedback-polish-capture.mjs final
npx playwright test --project=damage
node scripts/feedback-polish-performance.mjs
node scripts/feedback-polish-passive.mjs
npx playwright test
node scripts/feedback-polish-preservation.mjs
python scripts/feedback-polish-package.py
```

Create REVIEW_RESULT_DIR first if using it; the existing audio tests write JSON
there. Run comparisons with other browser/unit work idle. Native Chrome/local-server
execution needs this host's approved native permission. No assets/dependencies are
downloaded. No lint configuration exists; use working-tree/staged whitespace checks.

Recorded:328/328 unit tests pass, including all325 baseline cases and three additional
tests for field/cooldown/bank/pause/reset, mine spatial layers/ownership and staged
failure/charred fragment material/reduced motion. Focused browser damage project5/5
passes: existing ten-death ownership, touch/keyboard skip, mute, reduced motion,
hidden-tab freeze and real WebGL loss/restoration, plus the new first-hit shader warmup
and authoritative protection lifetime test. No original assertion or timeout removed.

The first new field unit assertion compared Quaternion objects including Three's
different internal change callbacks. It was corrected to compare quaternion values;
the retained initial failure is a fixture error, not a relaxed orientation assertion.

The first full run passed113/114. Its existing native production audio smoke ended
the passive seed11 flight at366m before the expected510m. All subsequent sound/lifecycle
cases passed. The original unmodified smoke was then run twice on each exact built
version, same host/Chrome:001B baseline0/2 passed (same timeout),001B1 final2/2 passed.
Bundle names/hashes, raw reports and the initial trace/context are retained. This
demonstrates an inherited intermittent smoke expectation, not its precise cause.
Frame grouping/publication sensitivity is plausible but not conclusively isolated.
No test assertion, seed, timeout, health rule or production audio code was changed;
the final full suite is repeated on exactly the same runtime/test inputs.

Original production visual evidence contains38 baseline and38 final PNGs and12 silent
clips. Seeded input pilots use actual accepted collisions, not fixture contacts.
Controlled browser fixtures remain in tests and are clearly distinct from the primary
proof. The original325-case unit run also passed before targeted tests were added.

Full browser/build/performance/preservation receipts are finalized in the delivery
evidence and the final recorded-result section. Physical-phone testing and human
art/comfort/audio evaluation are not claimed. The owner supplied baseline001B
playtest context; that is not evidence of new001B1 artistic acceptance.

## Final recorded results

- Unit:328/328 passed,49.23s; all325 original cases retained.
- Full browser:114/114 actual passed statuses, one worker,786.91s (13.1min),
  on2026-11-14. Zero skipped, unexpected, flaky or global runner errors in this run.
  Initial113/114 and baseline/final diagnostic repeats remain separately labelled.
- Dedicated typecheck passes. Production build passes:114 modules, JS850.03kB
  (227.63kB gzip), CSS15.88kB (4.31kB gzip); Vite451ms. Existing >500kB advisory.
- Preservation:138 baseline runtime/asset/config paths,134 unchanged, exactly four
  presentation adapters changed. The entire model/cooldown/collision/generation/
  camera-follow/UI/audio/assets/dependencies remain unchanged.356 runtime/test/tool
  inputs are frozen for canonical committed-source matching during packaging.
- Matched capture:38/38 pairs have identical gameplay tick, HP, cooldown, ship pose,
  distance, collision IDs/payloads and scene time.76 PNGs /12 silent browser clips.
- Performance:20 cases /19,920 measured frames /120 natural death-reset replays;
  all10 paired gameplay endpoint hashes match. Extended flights reach1600m at3HP.
- New JavaScript/Python tools pass syntax checks; working/staged whitespace checks
  and independent archive/source integrity checks are delivery receipts.
