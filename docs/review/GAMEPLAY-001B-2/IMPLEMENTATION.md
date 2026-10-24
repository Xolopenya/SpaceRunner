# GAMEPLAY-001B-2 implementation

Implemented isolated incremental validation, exact ship prediction, conservative calibrated collision clearance, finite beam search, independent witness replay and current-state publication checks. New code is accessible through tests/research only. Live waves remain unchanged and continuous gameplay is not enabled.

Read [ARCHITECTURE.md](ARCHITECTURE.md), [FAIRNESS_EVIDENCE.md](FAIRNESS_EVIDENCE.md) and [PERFORMANCE.md](PERFORMANCE.md). The original B-1 and eight research reports remain historical and unmodified.

Important corrections during implementation: the local occupancy ranking failed the known R05 route and was revised to a bounded goal heuristic without weakening the fixture. A proposed shared margin change violated an original source-pinning assertion; it was replaced with an isolated adapter and the original assertion remains. Terminal review tightened braking to finish within the reservation with future-object clearance. Search clock reuse and removal of per-step object/iterator overhead preserve exact motion; replay recomputes clocks independently. Initial failures are recorded as development findings, not hidden passing results.

## Reproduce

```sh
npm run typecheck
npm run test
npm run build
npm run test:browser
git diff --check
node scripts/review-static.mjs
node scripts/build-analysis.mjs
node --experimental-strip-types scripts/collision-audit.mjs
node --experimental-strip-types scripts/trajectory-benchmark.mjs
npm run review:verify
# From clean committed feature HEAD:
npm run review:pack
```

The trajectory benchmark also reconstructs the approved B-1 source in an ignored local directory, builds it with the same installed toolchain and checkout HTML newline convention, and runs the unchanged B-1 generator diagnostic there. This preserves historical import/source guards rather than weakening them for B-2. It uses read-only Git metadata with an explicit child work tree. Fresh full production file hashes are compared with this approved build. Actual B-1 output also supplies all new validation contexts.

No dependency, model, external source download or worker was needed. Node24.11.1, TypeScript, Vite and installed Chrome suffice. The unlinked HTML harness loads planning modules only and asserts no main/World/GLB request. It is neither normal development gameplay nor a production page.

Review configuration packages complete tracked source, original and new tests, four current reports, baseline-to-HEAD patch, raw corpus/witness/failure/performance examples, baseline reproduction and verification logs plus inventory. Packaging infrastructure is reused unchanged. The archive excludes dependencies, caches, old ZIPs, Git internals and production output; curated actual evidence is copied to logs. No fabricated live-field screenshots are included.

Actual commands/results and Git preparation are maintained in TASKS; exact final commit, feature-only push and independently verified ZIP identity are reported at delivery. The brief permits that feature push. No main push/merge, force operation or history rewrite occurs. B-3 requires external review, especially finite-search completeness limits, reservations, CPU budget and future integration.
