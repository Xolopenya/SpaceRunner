# Third-party asset provenance

## Original station wreck v2 — GAMEPLAY-EXPERIMENT-003B2, 2026-10-25

**Salvaged station pressure-frame v2**, authored by Codex for Space Runner. Original/final format: TypeScript / Three.js meshes; composed asymmetric steel members, original panel/repair/scorch/stencil paint and a real internally offset aperture. No downloaded model, texture, font, conversion or asset pack. Source: `src/experiments/structure-variants/profile.ts` and `view.ts`. Original geometry/markings are dedicated under CC0-1.0, without attribution obligations; existing Three.js MIT and Kenney notices remain. [Provenance/source URL/license](../assets/experimental/station-wreck-v2/PROVENANCE.md), [research and construction](review/GAMEPLAY-EXPERIMENT-003B2/VISUAL_DESIGN.md). Mixed neighbors use unchanged native Kenney hazard assets and generated geometry/IDs. Everything new is DEV-only; production assets and v1 model source stay unchanged.

## Original DEV bulkhead — GAMEPLAY-EXPERIMENT-003B, 2026-10-25

**Abandoned Docking Bulkhead v1**, original project model authored by Codex for Space Runner. Format: TypeScript / Three.js basic geometry, source in `src/experiments/large-structure/view.ts` and shared dimensions in `profile.ts`; no downloaded model, conversion, texture or new GLB. Four joined box solids, flush surface markings and a real5.6×4.4 passage. The model is dedicated under CC0-1.0 in `assets/experimental/bulkhead/LICENSE.txt`; no attribution/redistribution notice is required for the model. Three.js retains its existing MIT notice. [Model provenance and source URL](../assets/experimental/bulkhead/PROVENANCE.md), [official-source asset research](review/GAMEPLAY-EXPERIMENT-003B/ASSET_RESEARCH.md). This source is loaded only by the explicit DEV experiment and adds no production asset or network request. Existing Kenney assets remain unchanged.

## Kenney Space Kit — integrated 2026-10-22

Author/distributor: **Kenney**. Official source: https://kenney.nl/assets/space-kit. Verified the official page's CC0 link and the archive's original `License.txt` (Space Kit **2.0**, creation date printed as 27-08-2020). License: **Creative Commons Zero / CC0 1.0**, https://creativecommons.org/publicdomain/zero/1.0/. The original notice is shipped at `public/assets/kenney-space/LICENSE.txt`.

Official download: https://kenney.nl/media/pages/assets/space-kit/20874c75ac-1677698978/kenney_space-kit.zip

Downloaded with approved network access to ignored `assets/incoming/kenney_space-kit.zip`; archive SHA256: `d5d7cdf2635ed5a43a9187deaf409b6f47484e402321128341d3c3698e9ef4d9`. Only the six used GLBs and original license were extracted into production folders. The source archive, previews, other formats and unused assets remain outside the build and Git. No downloaded scripts were executed.

All rows below are authored by Kenney, from the official Space Kit URL above, under CC0 1.0. Original archive paths are `Models/GLTF format/<filename>`. Original and shipped format: glTF 2.0 binary **GLB**. **No conversion or file modification**; source bytes are preserved. No external textures, fonts or audio are used.

| Name / original filename | Repository location | Bytes | Runtime transformation | Game use |
| --- | --- | ---: | --- | --- |
| Speeder A / `craft_speederA.glb` | `public/assets/kenney-space/craft_speederA.glb` | 20,496 | Center source pivot; uniform width 2.8; original −Z nose, +Y up (no rotation) | Player ship |
| Meteor / `meteor.glb` | `public/assets/kenney-space/meteor.glb` | 6,496 | Center pivot; unit maximum vertex radius | Asteroid variant 1 |
| Detailed meteor / `meteor_detailed.glb` | `public/assets/kenney-space/meteor_detailed.glb` | 14,208 | Center pivot; unit maximum vertex radius | Asteroid variant 2 |
| Half meteor / `meteor_half.glb` | `public/assets/kenney-space/meteor_half.glb` | 4,680 | Center pivot; unit maximum vertex radius | Asteroid variant 3 |
| Cargo barrel / `barrel.glb` | `public/assets/kenney-space/barrel.glb` | 4,656 | Center pivot; unit maximum vertex radius | Debris variant 1 |
| Generator debris / `machine_generator.glb` | `public/assets/kenney-space/machine_generator.glb` | 28,044 | Center pivot; unit maximum vertex radius | Debris variant 2 |

Runtime normalization compensates the source node translation `(2, 0, 1.5)` and floor-based Y pivot using measured bounds. Hazard clones are then scaled by the existing logical collider radius and rotated by existing seeded phase/spin. Original material colors remain; runtime metallic is capped at 0.3 and roughness set to 0.72 so the models remain readable without an environment map. These edits affect shared in-memory materials, not the GLBs. Existing cheap procedural engine glows are attached behind the ship's rear ports.

GLBs contain rigid meshes and flat material colors, with no skinning, animation, textures, external buffer URIs or decoder dependencies. The asset manager shares resources across clones; no model downloads occur on restart. Asset tests parse every GLB and verify normalization. Desktop and touch screenshots are included in the review ZIP; the all-variant scene uses a documented deterministic test fixture. Individual file SHA256 values are generated in the review manifest.

## Original environmental elements

The distant planet, stars, corner guides, engine glow and impact particles are repository-authored rendering. PHASE-3-002 moves environment/engine/impact ownership into `src/visuals/`, adds an original procedural sky shader, planet rim, combined exhaust ribbons, sparks/ring and shield shimmer. No external image/texture/audio assets, downloads or new libraries are introduced. Temporary Phase 1 ship and hazard meshes have been removed. All six GLB files and their normalization remain unchanged.

PHASE-3-001 retains all six GLB files and render normalization unchanged. Measured additional collision boxes for the half meteor, barrel and generator are documented in `COLLISIONS.md`; no new asset download or conversion is involved.

## Original audio — PHASE-3-003, 2026-10-23

Engine, hull/shield/destruction, UI effects and the 16-second stereo ambient composition are generated from repository-authored code in `src/audio/synthesis.ts`. No third-party audio recordings, samples, downloaded tracks, remote runtime URLs or additional libraries are used. No external audio attribution/license is claimed; Kenney's CC0 applies only to its models. The source composition and synthesis are included in the review snapshot.

Review-only `audio-flight-preview.wav` and `audio-music-preview.wav` are native OfflineAudioContext renders of the same graph, with explicit generated-PCM provenance and integrity hashes in the review manifest. They are not microphone recordings, listening approvals or shipped audio assets, and remain in ignored test/review directories. Original 3D asset bytes and their licenses are unchanged.

## Runtime library notice

Three.js 0.186.1 is the production runtime dependency, obtained through the npm registry on 2026-10-22. Author: three.js authors. Source: https://github.com/mrdoob/three.js. License: MIT, read from the installed package's `LICENSE`. The complete notice is preserved in `public/THIRD_PARTY_NOTICES.txt` and copied into the static build. Dependencies are version-pinned in `package-lock.json`; `node_modules` is excluded from Git. Development tooling is not shipped in the production bundle.

## Design-only fonts and captures — PHASE-3-004A, 2026-10-23

Three unchanged font files were downloaded with approval from the official Google Fonts distribution, after checking the complete SIL Open Font License 1.1 notices. They live only in `design/ui-concepts/assets/fonts/`, outside `public/` and the production entry graph. No font is added to the playable application or its output.

| File | Author / weight | Bytes | SHA256 |
| --- | --- | ---: | --- |
| `oxanium-medium.ttf` | The Oxanium Project Authors / 500 | 28,420 | `109f93e40ad9112766699347a94955300c5944b9b087f878ed8581e6ae33644d` |
| `oxanium-bold.ttf` | The Oxanium Project Authors / 700 | 28,332 | `ac6e97ef18247a69a70454c7a1032239b75a2d39a6f6a901583cc83bf5855cb9` |
| `ibm-plex-mono-regular.ttf` | IBM Corp. / 400 | 128,812 | `a7fdc993f9f0387caedba4e42521136fa97e4c0837ae6239bf0413ccf8af00c2` |

Sources: [Oxanium official distribution](https://github.com/google/fonts/tree/main/ofl/oxanium), [IBM Plex authors](https://github.com/IBM/plex), [Plex Google Fonts distribution](https://github.com/google/fonts/tree/main/ofl/ibmplexmono). Complete copyright/license notices are `OFL-Oxanium.txt` and `OFL-IBM-Plex-Mono.txt` beside the fonts; `sources.json` records the exact official stylesheet/download URLs, date, hashes, bytes and no-modification status. Oxanium's notice credits its project authors; Plex retains IBM's reserved font name. No font conversion, renaming inside the font, subsetting or third-party script execution occurred. Local filenames describe the existing styles.

The two original notices are retained byte-for-byte by a narrowly scoped `.gitattributes` rule (`-text -whitespace`). This preserves upstream line endings and the Plex notice's trailing space without weakening whitespace checks for authored code/docs. License hashes in `sources.json` therefore match both the downloaded files and committed blobs.

Six design reference backgrounds are canvas-only PNGs captured from this repository's approved baseline `5efda476f725df038bfb46ebbf9d65aaec2b646f`, using the existing Kenney models and original procedural scene. Their viewport/model values/browser/method and hashes are in `design/ui-concepts/assets/capture-provenance.json`. Production DOM siblings were hidden only while the test browser captured the canvas and then restored. No new world artwork was generated or downloaded.

Race the Sun, Hyperburner and WipEout images remain reference links in `docs/design/UI_REFERENCE_RESEARCH.md`. No proprietary reference screenshot, logo or game asset is bundled in the repository or review package.

## Production typography — PHASE-3-004B, 2026-10-23

Concept A approval authorizes production use of the existing local Oxanium 500 and IBM Plex Mono 400 files. These two TTFs and their two full notices are copied unchanged to `public/assets/fonts/`. Their authors, official source URLs and SHA256 values are the same as the design-font table above; current review diagnostics independently verify every copied font/notice against `design/ui-concepts/assets/fonts/sources.json`. No new download, conversion, subsetting, dependency or CDN is involved. Unused Oxanium 700 stays design-only.

Production font bytes total **157,232**; the two notices total **8,840**. `.gitattributes` preserves original production notice bytes/whitespace, as for the historical design notices. CSS/preloads request only the two local used fonts. The small Sound settings arrow is repository-authored CSS/SVG background decoration with empty generated text so it does not alter accessible names. No comparison screenshot or prototype control is copied into public or the production entry graph.
# DEV moving space mine — 2026-10-28

Space mine (Modular Spaceships and Space Fleet), publisher3D Assets, [exact source](https://3dassets.dev/assets/interstellar-fleet-modular-starships-space-mine-4cafd369), CC0 1.0 Universal verified against the asset page and publisher license policy. Original56,912-byte GLB is preserved at `src/experiments/moving-mine/space-mine.glb`; SHA-256 `c64b8bfa0146ffc7d819f46ab74887326828b2b8266604b516a3cdc570189c77`. Runtime pivot/radius/material adjustments; no required attribution. DEV-only local loading, excluded from production. Full provenance: [003C asset record](review/GAMEPLAY-EXPERIMENT-003C/ASSET_PROVENANCE.md).
