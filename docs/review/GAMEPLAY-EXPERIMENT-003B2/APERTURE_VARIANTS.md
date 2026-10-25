# Aperture variants — GAMEPLAY-EXPERIMENT-003B2

Approved base:6ecae59074ce65a9a4fdf036583a7ba4c97485b4. The owner's center-only complaint was investigated against that source. The v1 parser did read all five query values; its transaction translated the **entire frame** by the chosen XY offset. The opening's local position therefore stayed(0,0) in every model. Diagnostics showed dimensions but no selected variant. Screenshots made near the moving ship/entry also removed a useful fixed reference. This was a design/readability problem, not evidence that query parsing ignored the values.

V2 fixes the hull origin at(0,0) and authors four different solid sections around an internally offset opening. World entry positions remain compatible with the approved steering envelope; the frame no longer follows the opening. Stepped member depths/outline are shared by rendering and collision.

| Selection | Fixed hull origin | Opening center X/Y | Opening size |
| --- | --- | --- | --- |
| center |0 /0|0 /0|5.6 ×4.4|
| left |0 /0|−3 /0|5.6 ×4.4|
| right |0 /0|3 /0|5.6 ×4.4|
| upper |0 /0|0 /1.9|5.6 ×4.4|
| lower |0 /0|0 /−1.9|5.6 ×4.4|

Use `?debug=field&experiment=large-structure&aperture=NAME&seed=42`. Missing aperture now explicitly means **center**, missing mode means **isolated**; there is no hidden cycle. The selected aperture repeats for every encounter. Unknown names/modes fail explicitly. Add `&mode=mixed` or `&colliders=1`. The DEV label names MODE, APERTURE, fixed hull and opening XY. Model fields and source IDs retain the same information.

Historical003B remains at `experiment=large-structure-v1`; its five world translations/default cycle, model code and collision profile are unchanged. Historical browser tests and its capture script change only their URL to that versioned endpoint; their assertions are retained.

The new browser evidence includes five **neutral-approach** screenshots at the same distance110, ship(0,0), viewport and unchanged camera. Aperture and hull centers are projected through the real camera and recorded; left/right X differs by more than0.05 normalized device coordinates and upper/lower Y by more than0.04. This explicitly avoids a witness steering toward the hole masking the difference. Separate entry/exit screenshots use certified controls and real GameModel steps. Tests also exercise every direct URL in both source modes.
