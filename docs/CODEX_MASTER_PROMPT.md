# CODEX MASTER BRIEF — SPACE RUNNER

You are the lead gameplay programmer, technical designer, and build engineer responsible for delivering a complete, playable, polished vertical slice of an original browser-based 3D arcade game. Work inside the currently opened Git repository. Implement and verify real software, rather than producing only a plan, mockup, or isolated demonstration.

## 1. Product vision and success definition

Working title: **SPACE RUNNER** (temporary; keep branding replaceable).

Build a third-person, behind-the-ship 3D endless space runner. A small spacecraft continuously flies forward through a dangerous field of asteroids and space debris. The player steers horizontally and vertically, reads incoming obstacle patterns, survives as long as possible, and competes with their previous distance/score. The game should be readable in seconds, responsive to control, visually attractive in motion, and worth replaying.

The final v0.1 must be playable in a modern desktop browser and a mobile browser. It needs a complete start-to-finish loop: load -> menu -> tutorial/controls -> gameplay -> collision/damage -> death -> score and best-score display -> restart. No server, accounts, purchases, multiplayer, combat, inventory, upgrade trees, or user-generated content in v0.1.

**Priority:** fun and control feel > gameplay correctness and clarity > stable performance > cohesive presentation > decorative complexity. Do not substitute a flyable placeholder cube for the final ship or simple primitives for all final obstacles.

## 2. Technology constraints

- Use **Three.js + TypeScript (strict) + Vite**.
- Use standard HTML/CSS for menus and HUD. Avoid React and heavyweight UI frameworks unless a clear technical reason emerges.
- No full physics engine initially. Use lightweight deterministic collision and movement math, with collision proxies separate from visible meshes.
- Avoid heavy dependencies and external runtime CDNs. Include everything needed for the production build locally.
- Keep configuration and game balance in named, editable TypeScript constants.
- Set up `npm run dev`, `npm run build`, `npm run preview`, `npm run typecheck`, and `npm run test` (plus `npm run lint` if linting is configured).
- Use `requestAnimationFrame` with delta-time clamping and stable, frame-rate-independent gameplay. A fixed timestep is appropriate for gameplay simulation if justified.
- Treat the working directory as the only writable project. Do not modify sibling projects or global system settings.

## 3. Visual direction

A cohesive stylized low-poly sci-fi arcade aesthetic, not a photorealistic simulation. Present a clearly identifiable, attractive spaceship from the rear, with readable silhouette and visible engines. Create a deep-space environment with multiple starfield layers, subtle environmental color gradients, occasional distant planets/nebula-like gradients, and varied debris. Render incoming obstacles with enough contrast that their collision footprint is intuitively understandable.

The ship banks/tilts slightly during steering, accelerates smoothly, returns to neutral with damping, and leaves an inexpensive emissive engine trail. Add restrained impact feedback: brief flash, small particle burst, camera shake, damage indication, and temporary invulnerability cue. Keep the camera stable and readable; avoid excessive motion blur or shaking. Prefer lightweight techniques such as InstancedMesh and Points for repeated scenery.

Implement a simple, consistent palette and reusable UI styles. Add a loading indicator and a clear title screen. Optional tasteful postprocessing is allowed only after performance is stable, with a mobile-safe path.

## 4. Coordinate system and core flight controls

Use a documented, consistent coordinate system: X = horizontal, Y = vertical, and forward travel visually along -Z. It is acceptable for the ship to remain near a fixed Z position while obstacles and scenery move toward +Z; convey constant forward speed through motion and visual effects.

- Desktop: WASD and arrow keys for horizontal/vertical steering. Escape/P to pause or resume. M to toggle sound where appropriate. The UI explains controls.
- Mobile: responsive touch dragging or a simple virtual joystick; no keyboard requirement. Handle pointer capture, safe areas, portrait and landscape, accidental page scroll, and touch releases.
- Use acceleration, deceleration, damped velocity, maximum lateral speed, and clear X/Y playfield boundaries. No instantaneous teleportation when a control begins.
- Ship motion and steering feel must be tunable centrally. Camera follows smoothly, with restrained lag and tilt. Keep the ship and hazards legible in portrait layout.
- The game automatically pauses on page visibility loss, window deactivation when appropriate, and platform pause events. Audio must stop while not in focus.

## 5. Playable game loop and balance

Implement explicit game states: BOOT/LOADING, MENU, PLAYING, PAUSED, GAME_OVER. Make restart fully reset the run without refreshing the browser or accumulating event listeners.

Core rules for v0.1:
- The player begins with 3 hull points. Each valid hit removes 1 point.
- After a hit, brief invulnerability prevents a single large obstacle from draining all health. Show visible feedback for this state.
- At zero hull, stop gameplay, show final distance/score, display best score, and offer an immediate replay action.
- Distance travelled (or survival distance units) drives the main score; optional near-miss bonuses are allowed only if implemented correctly and visibly.
- Persist best score locally using `localStorage` with safe failure handling.
- Speed, obstacle density, and pattern complexity gradually rise via a readable difficulty curve. Start with a short forgiving warm-up and never spike difficulty arbitrarily.
- During the first few seconds after the run starts, do not spawn unavoidable obstacles near the player.

## 6. Obstacle generation and fairness

Use seeded pseudo-random generation where practical so specific runs are reproducible for debugging. Support multiple obstacle types and silhouettes: asteroid rocks of several sizes, isolated debris, and occasional larger space structures. Rotate and scale model instances to achieve variety without excessive new files.

This is an avoidance game, not random unavoidable punishment. Design a lane/corridor or equivalent reachable-safe-space generation strategy. For every generated wave, ensure at least one physically reachable escape corridor given ship radius, maximum lateral velocity, reaction time, obstacle collider sizes, and overlap between consecutive waves. Use spawn previews/long sight distance so players can read obstacles. Test challenging seeds and wave combinations.

Use sphere or AABB collision proxies instead of triangle-mesh collision. Do not equate the decorative full bounding box of a model with its visible collision silhouette when that would feel unfair. Separate scene rendering, obstacle lifetime, spawner policy, and collisions.

Pool frequently spawned hazards and particle effects. Despawn objects behind the player; do not leak geometries, materials, audio nodes, timers, or listeners.

## 7. Real 3D asset acquisition and provenance

Actively obtain actual legally usable low-poly 3D models. Start with the official **Kenney Space Kit** at https://kenney.nl/assets/space-kit (Creative Commons CC0). Other suitable official Kenney packs may be used if their licenses are verified. Use the package's glTF/GLB files if available; otherwise convert supported formats carefully using an appropriate documented workflow.

Asset workflow:
1. Inspect official source/download access and verify license for each asset pack independently.
2. Ask for narrow network/download approval when necessary. Never bypass sandbox controls or run unknown remote scripts.
3. Download from a trustworthy origin, inspect archive contents, and record source URL, author, license, original package/file name, any modifications, and access date in `docs/ASSETS.md`.
4. Keep only the models/textures/audio actually used by the game in production folders (`public/assets/...`). Keep source download archives outside the production build and out of Git if large.
5. Load models through a centralized Three.js asset manager with useful error reporting. Normalize their scale, rotation, and pivots; verify visible orientation and materials.
6. Reuse/cloned loaded resources safely instead of fetching the same model repeatedly; dispose resources correctly when required.
7. Check console/network errors and confirm that all essential models actually render in the running game.

Never fabricate a download, fake a license, or claim an asset has been integrated without seeing it render. Do not scrape asset sites against access restrictions. If the official download requires human interaction, clearly request that the user place the legitimately downloaded ZIP into `assets/incoming/`, then continue integration. Temporary primitive fallbacks are acceptable during Phase 1 only, not as the final implementation for the main ship and obstacle set.

## 8. UI, usability, and audio

Provide a visually coherent game HUD with hull/health, current distance/score, and pause button. Include a title screen, controls hint, loading status, sound toggle, paused overlay, and game-over overlay with score, best score, and replay button. Buttons must work by mouse and touch, have readable contrast, and not be obstructed by browser safe-area insets.

Use short, original sound effects for steering/engine ambience, hits, and game-over if feasible. Synthesized Web Audio effects are welcome; if downloading sounds, verify license and document them. Respect browser autoplay restrictions: unlock audio only after user interaction and remember mute settings when appropriate. No copyrighted tracks or externally hosted runtime assets.

## 9. Performance and mobile readiness

Aim for approximately 60 FPS on a typical desktop and at least a stable, usable 30 FPS on midrange phones; measure rather than merely claim these targets. Cap device pixel ratio according to device class, adapt quality if needed, use frustum culling and pooled or instanced repeated objects, and limit draw calls/transparency-heavy effects. Avoid unnecessarily high-resolution textures and large mesh packs. Keep memory use bounded across multiple restarts.

Handle browser resizing, screen rotation, portrait/landscape, and WebGL context loss gracefully where practical. The visible gameplay area must work across aspect ratios; for Yandex desktop compliance plan for a playable display area with no more than a 2:1 side ratio, using letterboxing or layout adjustments on ultrawide screens if needed.

## 10. Yandex Games readiness

Keep game logic independent of hosting platform. Create a small interface/adapter for platform lifecycle, persistence, and future advertising, but do not allow monetization work to delay the playable prototype. Standalone local web mode must work without Yandex SDK.

Future Yandex build requirements to accommodate from day one:
- Static production output with `index.html` at the archive root and no runtime dependency on a separate backend or unapproved external CDN.
- Uncompressed total game bundle <= 100 MB; aim materially lower.
- ASCII filenames without spaces where possible, especially in production assets.
- Mobile touch controls and correct focus/visibility pausing, including silence while unfocused.
- SDK initialization, loading-ready and gameplay start/stop lifecycle, if/when the actual Yandex adapter is implemented. Use the latest official SDK documentation rather than guessing method signatures.
- Guest play without a login.
- No live generative/interactive AI inside the published game.

Do not claim it is ready for Yandex moderation until the real SDK has been integrated, production ZIP inspected, and platform-specific behavior verified. Produce a separate release checklist showing what remains.

## 11. Architecture and documentation

Keep code clear, modular, and proportional to this small project. Suggested responsibilities (use the simplest useful modules, not an excessive framework):

- `Game`: lifecycle and state machine
- `GameLoop`: time/update/render coordination
- `World`: scene, camera, lighting, environmental scrolling
- `ShipController`: player steering/tilt/health-related state
- `InputManager`: keyboard and touch input
- `ObstacleSpawner` and `ObstaclePool`: patterns and reusable obstacles
- `CollisionSystem`: player/hazard collision and cooldown
- `AssetManager`: glTF loading, caching, errors
- `HUD` / `MenuUI`: menus and DOM UI
- `AudioManager`: sounds, muting, lifecycle
- `StorageService`: persisted best score
- `PlatformAdapter`: standalone web now, Yandex integration later
- `config`: tuning parameters and difficulty curves

Create `docs/PROJECT.md` (vision, controls, architecture overview), `docs/TASKS.md` (small milestone checklist), and `docs/ASSETS.md` (licenses/provenance). Keep `README.md` current with prerequisites, exact commands, controls, test/build instructions, and known limitations. Avoid unnecessarily lengthy duplicated documentation and speculative task graphs.

Read root `AGENTS.md` and obey its repository rules. Before changing architecture, inspect current files and avoid breaking working features. Record nontrivial decisions in short notes when necessary.

## 12. Implementation sequence and Git hygiene

Work in incremental, verifiable milestones. Do not stop after writing a plan; proceed with implementation unless blocked by a required approval or unavailable source.

**Phase 0 — Repository inspection and plan**
Inspect the actual repository and tools, document a compact implementation plan, confirm scripts and dependencies, and establish a minimal application skeleton. Do not overwrite useful existing work.

**Phase 1 — Playable graybox**
Implement rendering, stable ship motion, keyboard/touch steering, camera, scrolling environment, obstacle generation, collisions, state machine, health, score, game over, and restart. Placeholder geometry is permitted only in this phase. Run the build and basic gameplay checks.

**Phase 2 — Licensed models**
Acquire, verify, normalize, and integrate real spaceship/asteroid/debris models. Document their licenses and verify successful browser rendering. Retire critical primitive placeholders.

**Phase 3 — Presentation and game feel**
Improve camera, banking, engine trail, particles, feedback, sound, menus, mobile layout, tutorial hints, and progressive difficulty. Avoid feature creep.

**Phase 4 — Verification and optimization**
Add/execute appropriate unit tests for difficulty, state transitions, score storage, and collision/fairness logic. Test keyboard and touch flows, multiple restarts, pause/resume, resize, build and preview, browser console, and performance. Fix issues rather than only report them.

**Phase 5 — Packaging readiness**
Inspect production assets and total uncompressed bundle size, document Yandex SDK integration work that remains, and supply exact run/build/publish-preparation commands. Do not attempt publication or deploy without explicit user authorization.

Make reasonably scoped Git commits at tested checkpoints using meaningful messages such as `feat: implement playable flight loop` and `feat: integrate licensed space assets`. Never delete user work, force-push, rewrite history, or use `git reset --hard` / `git clean -fd` without explicit permission. Do not push to remote without approval. Do not commit secrets or `node_modules`/`dist`.

## 13. Verification and definition of done

Provide and execute the available checks (`npm run typecheck`, `npm run test`, `npm run build`, and browser smoke checks; lint if configured). If the environment supports browser automation or screenshots, actually inspect the result. Do not invent completed tests, screenshots, measurements, or successful downloads.

**v0.1 is done only if:**
- A new user can open the local game and understand how to begin.
- A real licensed spacecraft model is visible and controllable.
- Incoming real-model hazards move, spawn, despawn, and collide correctly.
- At least one reachable escape route exists for generated obstacle patterns.
- Damage, invulnerability, death, scoring, best score, restart, and pause operate correctly.
- Keyboard and mobile touch input work in relevant test environments.
- Core screens look intentional rather than debug-only.
- Multiple runs do not noticeably accumulate orphaned objects or listeners.
- Type checking and production build pass; tests are run and failures are disclosed/fixed.
- Download sources and asset licenses are documented; Yandex-specific unfinished work is explicit.

At the end of each phase, provide a compact report of changed files, tests executed and their real results, important gameplay decisions, any blockers, Git commit hash if committed, and the next planned step. If a step cannot be verified, state exactly what was not verified. Favor a reliable, fully playable small game over a broad but unfinished system.

**Begin now** by inspecting the Git workspace, then implement Phase 0 and continue toward the verified playable v0.1. Request user input only for a genuine missing permission, irretrievable licensed asset, or product decision that would materially block progress.
