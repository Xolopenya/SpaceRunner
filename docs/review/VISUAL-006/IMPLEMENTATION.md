# Implementation and preservation

The smallest integration seam is ArenaBoundaries. It owns the original streams, the unchanged005B2 WarpCorridor and one FragmentedWarpField. World changes exactly two presentation calls:initial mode and passing existing hazard slots into the boundary update. `warp-preservation.mjs` verifies117 other approved runtime/asset files have zero Git diff and verifies exact World/old-shader replacements.

One indexed BufferGeometry and one additive ShaderMaterial serve all three new policies.56 ribbons ×25 cross-sections ×2 vertices =2800 vertices;2688 triangles before conservative exclusion. Positions/UVs/category/depth origins are built once. A mode uniform selects policy without allocating scene objects. The CPU reuses40 exclusion boxes, one index buffer and one fade buffer; only changed masks/fades upload. Hidden links become degenerate triangles, so no visible geometry spans a solid. No per-frame mesh/material/vector creation, particle pool, full-screen pass or gameplay collider exists.

All fragment vertices lie on X=±CONFIG.bounds.x or Y=±CONFIG.bounds.y:the actual ship-center limits±6/±3.6. Short curves stay inside each side's transverse extent. They describe orientation, not wing-clearance tolerance. Camera80% follow,FOV58°,rear distance,look direction and interpolation are protected unchanged.

Each side receives the original smoothstep distance response over the nearest2.4m;strength0.30+0.65×response. Opposite sides stay ambient;corners activate two adjacent components. Longitudinal shader motion is exactly the existing run distance,one world metre per metre travelled,including Phase2's existing continuous speed schedule. No wall clock or gameplay RNG is read.

The distance wraps every256m with center depths−32..224. The depth envelope fades in over−8..8 and out over150..208;all ribbon endpoints are invisible at wrap. Pause/game over freeze distance and masks;resume continues that reference. Reset restores travel0,clears masks and retains selection. Reduced motion removes the8 extra streaks;the remaining geometry still scrolls coherently with the world.

Depth testing is enabled,depth writing disabled,DoubleSide/additive blending,default transparent render order. Opaque asteroid/station meshes and their accepted reveal/depth flags stay unchanged. Far light fades before the camera far plane. Cleanup removes the root and disposes the owned geometry/material once;existing World cleanup owns no borrowed GLB resources through this field.

The DEV selector supports four `warp` candidates. Historical `boundaries=legacy|warp` and reveal diagnostic controls remain for earlier regression reproducibility;historical `legacy` there means005A streams,while `warp=legacy` means the requested005B2 comparison. Public HUD has no selector.
