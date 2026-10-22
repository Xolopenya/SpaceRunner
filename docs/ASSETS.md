# Third-party asset provenance

As of 2026-10-22, no external 3D models, textures, fonts, or audio have been downloaded or included. Phase 1 art is original code-generated geometry. Do not mark planned downloads as complete until their package/license and browser rendering are verified.

| Asset / pack | Author | Official source URL | License | Local file path | Changes / notes |
| --- | --- | --- | --- | --- | --- |
| Planned: Space Kit | Kenney | https://kenney.nl/assets/space-kit | CC0 (verify file/package on download) | Not downloaded | Candidate source only |
| Graybox spacecraft, asteroid/debris geometry, planet, stars, engine glow, impact particles | Authored in this repository | `src/world.ts` | Project-authored; no external art license needed | `src/world.ts` | Temporary Phase 1 meshes; replace main ship/hazards in Phase 2 |

## Runtime library notice

Three.js 0.186.1 is the production runtime dependency, obtained through the npm registry on 2026-10-22. Author: three.js authors. Source: https://github.com/mrdoob/three.js. License: MIT, read from the installed package's `LICENSE`. The complete notice is preserved in `public/THIRD_PARTY_NOTICES.txt` and copied into the static build. Dependencies are version-pinned in `package-lock.json`; `node_modules` is excluded from Git. Development tooling is not shipped in the production bundle.
