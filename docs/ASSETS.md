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

The distant planet, stars, corridor guides, engine glow and impact particles remain repository-authored geometry in `src/world.ts`. Temporary Phase 1 ship and hazard meshes have been removed. No other external art is included.

PHASE-3-001 retains all six GLB files and render normalization unchanged. Measured additional collision boxes for the half meteor, barrel and generator are documented in `COLLISIONS.md`; no new asset download or conversion is involved.

## Runtime library notice

Three.js 0.186.1 is the production runtime dependency, obtained through the npm registry on 2026-10-22. Author: three.js authors. Source: https://github.com/mrdoob/three.js. License: MIT, read from the installed package's `LICENSE`. The complete notice is preserved in `public/THIRD_PARTY_NOTICES.txt` and copied into the static build. Dependencies are version-pinned in `package-lock.json`; `node_modules` is excluded from Git. Development tooling is not shipped in the production bundle.
