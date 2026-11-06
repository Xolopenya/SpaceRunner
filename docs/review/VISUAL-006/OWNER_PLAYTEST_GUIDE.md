# Owner playtest

Run `npm run dev -- --port 5173 --strictPort`,then open:

- `http://127.0.0.1:5173/?debug=visuals&warp=legacy&seed=42`
- `http://127.0.0.1:5173/?debug=visuals&warp=fragmented-arcs&seed=42`
- `http://127.0.0.1:5173/?debug=visuals&warp=flowing-filaments&seed=42`
- `http://127.0.0.1:5173/?debug=visuals&warp=fragmented-warp&seed=42`

The four named buttons change only rendering and retain the active run. Pause first to compare exactly the same tick. The extra boundaries/reveal controls are retained historical diagnostics;leave reveal=seamless. The station-occlusion toggle applies only to the legacy005B2 shader;new geometric exclusion is always enabled.

Ordinary Play starts in combined C on this feature branch. Controls,WASD/arrows/drag,pause,resume,restart,audio,three hull points and distance records retain their behavior. No merge or production deployment is authorized.

Compare center/each edge/corners,fast diagonal steering,station approach and passage,mine warnings,optional fragment pickup and Phase2. Decide whether speed/orientation improve,whether the center feels open,whether fragments resemble gates,and whether blue decoration competes with red danger or bright rewards. Choose A/B/C/legacy or request tuning;no mode has final approval.

Review package:project_snapshot contains exact tracked HEAD source;changes contains the binary patch and identities;logs contains checks,input histories,state hashes and raw measurements;screenshots contains matched native Chrome PNGs;videos contains silent native gameplay recordings A/B/C,D legacy/new station and E integrated clean. Start with VISUAL_COMPARISON and STATION_OCCLUSION.

Reproduction:Node22.12+ and installed Chrome,`npm ci --ignore-scripts`,the four standard npm checks,then `node scripts/warp-evidence.mjs --stills`, `--videos`, `--performance` sequentially. Playwright's ffmpeg is required for native video;this run reused the existing `.cache/playwright` copy without downloads. Do not edit runtime source during capture. `node scripts/warp-verify.mjs` runs all checks and freezes input hashes;after report-only updates/commit,`node scripts/warp-pack.mjs` compares every tested input to HEAD and packages verified evidence. No external recording program is needed.
