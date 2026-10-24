# Playable developer prototype

Run `npm run dev`, then open `http://127.0.0.1:5173/?debug=field&seed=42`. Launch, WASD/arrows, touch dragging, pause/resume, audio settings, hull damage, game over and replay use the existing interface and controls. No new player-facing screen or production selector exists.

## Focused changes

| Source | Responsibility |
| --- | --- |
| core/field-validator.ts | Additive actual-state publication entry point with conservative axial query culling; old unpruned APIs/default behavior remain available |
| core/field-runtime-session.ts | One pending transaction, shared work/deadline, normal admission, independent replay, actual publication and explicit omission |
| debug/runtime-field.ts | Development-only adapter, full source ledger, stable logical identities and atomic mapping into the existing72 records |
| debug/runtime-game-model.ts | Inherit authoritative GameModel.step; observe current input, require the existing120Hz step and cancel on teardown |
| main.ts / game.ts | DEV-only dynamic model selection and optional model/lifecycle injection; ordinary default remains GameModel |
| research scripts/fixtures/tests | Unknown-input histories, full certificate audits, actual-model cases, old/new windows, real rendered performance and packaging evidence |

Ship, CONFIG/speed, original GameModel/ObstacleField, collision response/proxies, World/camera, audio, VFX, HUD, assets and dependencies are unchanged. Existing B-1 through B-4 tests and goldens are retained. Game's optional injected model and cleanup hook change the compiled bridge, so current production byte identity with B-4 is **not** claimed. Production stripping, unchanged core hashes, actual normal gameplay tests and build attribution establish the tested boundary.

## Ownership and rendering

Each committed source owns its complete cell span, including empty cells. The ledger persists independently of visible objects, retains stable canonical IDs/provenance and rejects overlap/duplicates. Source retirement remains beyond full end+maximum radius+8. Reset changes token epoch and clears the frontier.

The adapter borrows the original72 hazard records consumed by GameModel and World; resets reuse their identities. Every slot retains its immutable PlannedHazard. `z=D-passDistance`, kind/phase/radius/spin and the existing catalog mapping give the same render/collision representation. Models/materials/geometries are not allocated on spawn. Pending geometry is private; the union respects hard32 known plus candidate hazards.

A hit may set the actual slot inactive through the original damage loop. Its logical geometry and slot identity remain reserved until natural logical expiry, rather than being erased to help validation. Visual center despawn is still+8; logical known geometry can outlive that center until q+radius+8. Full source ownership can outlive both. These are separate lifetimes.

Before publication, all required slots are preflighted. There is no partial commit or silent truncation. Full pool identities/poses are compared against the ledger; unknown, altered, duplicated or missing geometry stops generation and cancels pending work until reset. Derived Z remains governed by immutable q. The API is trusted in-process data, not an anti-cheat/network decoder.

Only compact bounded diagnostics are retained live:64 events,2048 recent samples, the latest outcome/certificate, at most16 ownership records and one pending session. The certificate is preserved on an uncertified omission. Research files intentionally retain full histories outside this live ownership model.

## Startup and lifecycle

The explicit initial ownership cell is4 (96 units), rather than B-4's6. It uses a complete normal ambient transaction and the same actual-state gate, clearance, reaction and braking rules. There is no unconditional initial acceptance or dangerously close placeholder. First-source vetoes are measured, including their longer empty introduction. The normal seed/distance director then continues without a competing speed curve.

The original state machine remains authoritative. Field update runs only inside a valid PLAYING step. Pause/focus stops planning and simulation clocks; resume uses the next observed input. Restart cancels the old pending session before clearing slots/ledger, and old epochs cannot publish. Game teardown calls the developer model's optional dispose hook; it cancels pending work and prevents further developer simulation. Asset loading/retry and resource ownership are unchanged.

No worker, alternate physics, damage suppression, recentering, safety autopilot, new asset, scoring reward, progression or SDK change is introduced. Reference actors exist only in tests/research. The actual player controls the ship.

## Reproduction and package

Use `node --experimental-strip-types scripts/runtime-benchmark.mjs --logical-only` for the primary2632-decision API corpus. Without that flag the command additionally runs384 actual-model cases, six32-section passive supplements, eight real rendered cases and actual video capture/decoding. `node scripts/runtime-browser.mjs` repeats only rendered evidence. `node --experimental-strip-types scripts/runtime-model-benchmark.mjs` repeats actual-model/bootstrap/passive diagnostics.

Original source-pinned B-1/B-2/B-3/B-4 commands run through `node --experimental-strip-types scripts/runtime-history.mjs`, which reconstructs approved d523cc4 in ignored storage, uses installed dependencies and read-only Git metadata, and preserves original assertions. Its historical byte comparisons occur inside that snapshot; they are not claims about the new compiled bridge.

The existing review packer is reused. Its small optional WebM extension validates the EBML header, includes the actual recording and hashes it in the inventory. PNGs are real game captures; the decoded video frame is labeled as canvas-only, with no DOM HUD/audio. No generated evidence, dependency, dist or ZIP is committed.
