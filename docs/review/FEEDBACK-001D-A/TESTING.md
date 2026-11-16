# Testing and evidence methods

Task FEEDBACK-001D-A; 16 November 2026, Asia/Vladivostok. Source `54d581958bdde8c5a4d7f9cbdf3ee7a4a7c4f054`; branch `feature/feedback-001d-a-ux-audit`. Browser: installed Chrome 157.0.8103.78, headless on desktop Windows. Existing @playwright/test 1.64.1, Three.js 0.186.1, TypeScript and Vite from the locked repository. No dependency installation or external asset download.

## Command results

| Command | Result |
|---|---|
| `git status --short`, branch and HEAD inspection | Exact requested baseline; four unrelated untracked paths preserved |
| `git switch -c feature/feedback-001d-a-ux-audit` | Success after a narrow .git-write sandbox escalation; initial permission failure retained in conversation/tool record |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 347/347 passing, none skipped; 61.30s reported unit duration |
| `npm run build` | Exit 0; standard >500kB chunk advisory (863.45kB JS / 232.27kB gzip), not a measured loading defect |
| `npm run test:browser` with REVIEW_RESULT_DIR | 119 passed / 2 failed / 0 skipped; 1070.1s; full original receipt retained |
| `npm run test:browser` selecting the two affected `audio` cases | 2 passed / 0 failed; 34.3s after creating the output directory; exact command in logs, assertions/tests unchanged |
| `node docs/review/FEEDBACK-001D-A/tooling/audit-browser.mjs live` | Three real-time production sessions, no capture errors, page/console errors or failed requests |
| same tool, `matrix` | Eight primary sizes; pause/dialog/resume, pointer/touch, first hit, death/results/replay |
| same tool, `focused` | Bounds, mute/three saved sliders, focus loss, reduced motion, rotation, skip and small desktop hints |
| `node .../analyze-evidence.mjs` | Generated facts.json from final raw capture receipts |
| `git diff --exit-code 54d581958bdde8c5a4d7f9cbdf3ee7a4a7c4f054 -- src public index.html package.json package-lock.json vite.config.ts tsconfig.json tests playwright.config.ts scripts` | Exit 0; 428 protected tracked inputs unchanged |
| `python .../package-review.py prepare` / `pack` | Package construction and independent ZIP CRC/SHA inventory verification; external SHA-256 sidecar |
| `node .../verify-gallery.mjs` | Actual offline gallery browser check; see gallery-verification.json / gallery-review.png |

The first full browser run failed two audio tests **when writing optional JSON artifacts**: `audio-live.json` and `audio-restarts.json` could not be created because this audit invocation had not created REVIEW_RESULT_DIR. This was audit setup, not a failed gameplay assertion. Original error contexts/screenshots/traces and complete JSON/log are retained. Creating the directory and rerunning those two unchanged tests verifies the affected paths. This is not described as a second all-green full-suite run. Failed-case IDs and errors are available in `full-browser/browser-results.json`.

The first capture invocation was blocked by sandbox network policy at localhost (`ERR_NETWORK_ACCESS_DENIED`). The original log/receipt is retained. Authorized local Chrome/Vite execution succeeded after escalation. No policy bypass or external network download was used. The first focused receipt captured reduced-motion death start under a misleading filename; a follow-up capture explicitly separates death start, completed results and restart. Both receipts/logs remain; use final focused.json for current evidence.

## Native play duration

| Seed / strategy | Gameplay duration | Wall time after launch (includes screenshots/results) | Distance | Pickups | Hull at stopping point |
|---|---|---|---|---|---|
| 42 / idle native real-time keyboard run | 37.892s | 40.986s | 868m | 0 | 0 |
| 0 / collector native real-time keyboard run | 70.708s | 71.228s | 1802m | 3 | 2 |
| 123 / pilot native real-time keyboard run | 58.008s | 62.037s | 1424m | 0 | 0 |

Total native gameplay: **166.608s**. Longest continuous run: **70.708s**, manually paused by automation. Idle seed 42 and certificate-informed keyboard pilot seed 123 ended naturally and were restarted. The collector reads shard approach positions; the pilot reads the existing certificate and maps it to discrete keys. They use the real InputManager and native requestAnimationFrame, without gameplay mutation or accelerated time. They are not human skill measurements. Two natural deaths, one longer surviving run, seven accepted damage events, three accepted pickups and multiple mine approaches were observed.

Eight matrix runs use the real production instance obtained by a temporary CDP click-listener breakpoint, then invoke original fixed updates/renders to accelerate idle waiting. This preserves actual spawned hazards/HP rules but is **not additional real-time playtime** and may change planning cadence. Event subscribers are attached after launch, so very early run-start/first-record events can precede observation; zero record-event entries are not evidence of missing model events. The result acknowledgement finding is supported by visible results and source. A single separately labelled DOM visibility fixture forces phase/damage messages visible only to inspect simultaneous geometry; it proves neither a phase transition nor a natural collision. The primary overlap proof is the native seed-42 collision.

## Coverage and screenshots

115 screenshots are catalogued with viewport, game state, hull, immunity, phase, energy, position, camera/boundary policy, audio state, element rectangles and method. Original JSON captures and gallery captions identify accelerated/fixture states. Videos are native silent WebM browser recordings; no soundtrack/listening claims. Inspect native clips for timing; matrix recordings contain accelerated prefixes/frozen frames and are labelled accordingly.

Primary viewports: 1920×1080, 1366×768, 1280×720, 1024×600, 390×844, 360×800, 932×430 and 768×1024. Additional 800×450 fine-pointer desktop and portrait→844×390 rotation. Existing UI/touch tests add emulated safe-area, pointer cancel, extreme numeric fit and keyboard/focus coverage. Synthetic blur exercises the actual production focus-loss handler. Existing damage tests cover hidden-tab cinematic suspension and WebGL loss/recovery. The full suite also covers optional asset failure/fallback; those deliberate failures are fixtures, not primary-session network defects.

All eight matrix pause checks hold exactly the same model elapsed time through settings; P in Audio leaves PAUSED, Escape closes it without resuming, and resume input velocity is zero in the sampled states. Captured main controls fit and meet 44×44px. Damage/phase bounding boxes intersect in seven primary sizes; short 932×430 landscape is the observed exception. Current tests can pass without detecting this child-element visual overlap, which explains why screenshot inspection matters.

## Performance observations and limits

Native RAF p95 was 16.8/17.1/17.4ms; maxima 116.6/100.1/183.2ms. Raw samples are retained. Screenshot calls, CDP and the existing regression suite ran concurrently for part of this work. These are observational samples with outliers, not isolated benchmarks, no speedup, root-cause or phone-FPS claim. No SpectorJS/GPU capture was performed because no unexplained rendering defect warranted one.

No physical devices, mobile Safari/Firefox/Yandex webview, public-host cold load, true browser zoom, real notches/browser chrome, screen-reader user study, photosensitivity analysis or subjective listening was tested. No player-frustration/retention improvement is claimed.

## Skills actually applied

- Game Studio `game-playtest`: boot, main verbs, real motion, screenshots, overlay checks, severity/repro reporting.
- Game Studio `game-ui-frontend`: hierarchy, playfield protection, overlays/input boundaries, responsive target review, Concept A preservation.
- Game Studio `three-webgl-game`: separate camera projection, scene appearance, placement/timing and collision; inspect loader/render/resize/context behavior without replacing the approved runtime.
- Local `space-runner-ui-design`: current design/tokens/research, real-scene comparison, safe insets, focus, 44px targets and reduced-motion checks.

All four SKILL.md files were read. Game Studio did not expose a separate hosted playtest service in this session; its available skills were applied using the repository's installed Playwright/Chrome infrastructure. No external agent or subagent was used. No physics package, alternative test framework or art generation was installed or invoked. Production source, assets, dependencies and existing tests remain unchanged.
