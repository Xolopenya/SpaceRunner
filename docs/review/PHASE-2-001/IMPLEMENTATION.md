# Implementation review — PHASE-2-001

## Completed scope

- Verified clean stable baseline `e926a72`; read repository guidance/master brief/tasks/provenance and inspected architecture/dependencies. Recorded original typecheck, 16 unit tests, build and 6 browser checks before implementation.
- Created `feature/phase-2-assets` from that baseline. No merge, push, deployment or Phase 3 work.
- Acquired the official Kenney Space Kit ZIP with approved access, read its CC0 notice, inspected GLB metadata and source previews, and selected only six native GLBs plus the license.
- Integrated Speeder A, meteor, detailed meteor, half meteor, cargo barrel and generator debris. No ship or obstacle primitive fallback remains.
- Added async loading/progress/retry, cached templates and shared resource ownership, safe rigid clones and idempotent teardown. Model bytes remain unchanged; normalization and lighting-related material adjustments happen at runtime.
- Preserved simulation, controls, hull/shield, generation, colliders, scoring/storage, pause/resume, death/replay and focus/context handling.
- Added model/resource/review ZIP tests, actual browser model/retry/download/restart checks, module attribution tooling, and a committed-state review packager.

## Significant file changes

| Files | Purpose |
| --- | --- |
| `public/assets/kenney-space/*.glb`, `LICENSE.txt` | Six used CC0 model binaries and original package notice |
| `src/assets/{catalog,asset-manager,resources}.ts` | Paths/variant selection, loading/normalization/cache/cloning, resource ownership |
| `src/{main,game,world,ui}.ts`, `index.html` | Async startup/error/retry; model visuals; lifetime cleanup; accurate Phase 2 labels |
| `tests/assets.test.ts`, browser tests | Verify real GLBs, preserved behavior, retry and bounded shared resources/downloads |
| `tests/review.test.ts`, `scripts/zip.mjs`, `review-safety.mjs` | Binary ZIP fidelity, integrity/path protection, known-secret checks |
| `scripts/review-{verify,pack,static}.mjs`, `build-analysis.mjs`, `review.config.json` | Capture command outputs/measurements and package HEAD snapshot/diff/reports/logs/screenshots |
| `package.json`, `playwright.config.ts`, `.gitignore` | Review commands, JSON browser evidence, ignore generated review output |
| README and project/task/asset/review docs | Actual provenance, contracts, verification boundaries and next steps |

## Decisions and deviations

No conversion, new dependency, physics or gameplay redesign was needed. Three asteroid GLBs and two solid debris assets satisfy the required set; no large hollow structures were used because their visual holes would conflict with existing sphere proxies. Model rotation remains +Y up / −Z forward for this ship; the original offset/floor pivot is centered. Five visual variants are derived from existing kind/phase, avoiding seeded-sequence changes.

Keeping five rigid clones per slot is a bounded node-memory tradeoff in exchange for zero spawn-time cloning or downloads. Geometry/materials remain shared, not duplicated per slot. Original metallic colors were too dark without an environment map; metallic/roughness are adjusted once in memory, with no heavy effects or file edits.

The Vite advisory remains: the renderer and loader form most of mandatory startup JS. Measured attribution is in `logs/build-analysis.log`; exact final chunk/whole-build measurements are in `reports/VERIFICATION.md` and `manifest.json`. A vendor split alone would not reduce total startup bytes. The build system is unchanged.

## Evidence and limitations

Facts: unit tests parse and normalize every shipped GLB, browser fixtures render all variants, and desktop/touch/production flows are executed with installed Chrome. Test fixtures deliberately position hazards for model screenshots; `desktop-models.png` freezes the simulation with the pause overlay hidden. This is actual rendering, not an illustration. Other screenshots cover ordinary generated hazards, touch interaction, death, menus and paused landscape layout.

The first new restart test failed because the impact buffer was uploaded lazily, then a follow-up exposed a full-hull assumption in the death helper. Both fixture problems were corrected; failed diagnostic logs are included without rewriting them. Current results, command exit codes and test names are generated from actual final runs in the archive rather than copied from these prose reports.

No known unresolved bug in verified flows. Limits: sphere proxies approximate irregular silhouettes; no real-phone/Safari/Firefox or sustained heap/GPU profiling; no audio/mute or Yandex SDK; caching/clone support is scoped to current rigid GLBs. Resource counts over five restarts do not prove absence of every possible browser/driver leak. Network-level cancellation of partially failed loader parses remains a future concern.

## Reproducing and reviewing

Read `reports/ARCHITECTURE.md`, `ASSETS.md`, `VERIFICATION.md`, and `manifest.json`. `project_snapshot/` contains relevant tracked HEAD sources and complete binaries. `changes/` contains a binary-capable full baseline patch, file-status list, history and final identifiers. `logs/` preserves actual command outputs, machine-readable browser results, baseline results and diagnostic attempts; `screenshots/` contains final browser evidence. Production bundles, .git internals, node_modules, caches, source ZIP and personal files are excluded.

Run `npm run review:verify` for pre-commit evidence. After committing, `npm run review:pack` requires a clean tree, verifies the baseline ancestor, reruns checks, generates the archive from HEAD blobs, scans for known credential patterns, reopens/CRC-checks every ZIP entry, and confirms the tree remains clean. The inventory includes SHA256 values for all prior entries. The original archive itself stays ignored.

Recommended next task after independent review: review/merge decision, then a separately scoped Phase 3 flight-feel/audio task. Do not merge automatically.
