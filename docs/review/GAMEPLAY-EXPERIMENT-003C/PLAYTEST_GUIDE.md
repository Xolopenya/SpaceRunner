# Owner playtest

Run `npm run dev`, open `http://127.0.0.1:5173/?debug=field&experiment=moving-mine&seed=42`, and use the existing WASD/arrows or drag controls. The first default mine's pass distance is468m. For a faster repeat use `&firstMine=1`; its pass distance is180m. This retains nearby original asteroid content and full safety validation.

1. Test `&firstMine=1&mine=slow-ltr`, then `slow-rtl`, `moderate-ltr`, `moderate-rtl`. Reset between attempts. Do not change controls/speed/camera.
2. Before reaching the mine, state what the object is and where it will move. Record when the red warning and lateral movement become understandable.
3. Try retaining a safe side, crossing the band earlier/later and vertical avoidance. Forward speed cannot be stopped. All three choices need not be available from every state.
4. Intentionally approach the mine. Check whether one hull hit, invulnerability and contact feel consistent with the visible arms. `&colliders=1` shows the enclosing mine sphere and existing ship/structure debug geometry.
5. Pause while the mine is moving, resume, lose focus and resume, then restart. The same seed/inputs should reproduce the same motion; visible position must freeze during pause.
6. Repeat default mixed play long enough for several mine encounters. Compare with `?debug=field&experiment=mixed-flow&seed=42` and record whether mine frequency adds interest or interrupts the flow.
7. Repeat portrait and landscape on a real touch device. Desktop emulation screenshots are available but do not establish touch performance or readability.

Record device/browser, seed/configuration, input history or a video, hull/score and proposed/published/omitted diagnostics. Answer: recognizable immediately? direction predictable? enough warning? appropriate size? distinct from asteroid/collectible? helpful warning? fair contacts? more interesting run? appropriate spacing? Note any uncertain or invisible contact.

Evidence mapping: `mine-desktop-distant.png` includes ordinary asteroid context; `mine-desktop-mid.png`/`mine-desktop-path.png` show left-to-right approach; `mine-rtl.png` shows the opposite configuration; `mine-desktop-avoidance.png` is the close-up after safe passage; `mine-collision.png`, `mine-colliders.png` and `mine-restart.png` cover the other lifecycle/contact cases. Portrait/landscape have their own distant/mid/path/avoidance captures. Four native WebMs include the baseline and all three moving render profiles, with associated tick/pose data.

No human playtest has been performed by this implementation. The safe certificate actor demonstrates a route, not owner acceptance. Review collision/readability, frame outliers (including the precommit116.6ms portrait gap) and physical-touch behavior before deciding whether to merge or pursue moving-hazard integration. No next gameplay mechanic is authorized by this guide.
