# Third-party asset provenance

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
