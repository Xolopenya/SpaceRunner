# CAMERA-001: verified reference

Baseline: `3b63f1d9ebb25cf6d79639447a2692dfc8af5538`, inherited directly through Git ancestry. Main and the mine experiments are excluded. This is a camera research branch; the owner has approved the inherited004B gameplay, not a final camera choice.

`src/world.ts` originally owns one `PerspectiveCamera(58,1,.1,260)`. Resize sets aspect to the actual game canvas width/height and rear Z to `max(13,7/tan(29 degrees)/aspect)`. At1280×800 this is13; narrow portrait moves the same camera farther back. FOV, near/far clipping, renderer quality and pixel-ratio caps are unchanged in every policy.

Reset sets position `(0,2.4,rearZ)`. Every render uses `blend=1-exp(-8*dt)`, `x=lerp(previousX,shipX*.12,blend)+sin(elapsed*80)*shake`, `y=lerp(previousY,2.4+shipY*.12,blend)`, `z=rearZ`, then `lookAt(0,0,-28)`. Shake is the existing impact remainder×.08 while playing. Baseline retains that recurrence, including its accumulated shake and fixed target. Paused baseline retains its historical settling behavior.

The ship is rendered at `(ship.x,ship.y,0)`. Automatic travel accumulates distance; hazards are presented at `passDistance-distance`, moving toward +Z. There is no camera-driven control or simulation dependency. Input is world-axis X/Y. GameLoop integrates120Hz and renders the latest authoritative state: there is no fractional ship interpolation to reuse. Render dt is capped by the existing loop. Cosmetic model roll/pitch still ease toward `-vx*.045`/`vy*.025` with the same blend, independently of camera orientation. Speeder A remains normalized to2.8×1.12×2.94.

Shared compound collider remains body `(0,0,0),r=.42`, left `(-1.02,-.35,.70),r=.28`, right `(1.02,-.35,.70),r=.28`. It does not follow cosmetic banking. All source under `src/` apart from the camera extraction in World and DEV routing in main is pinned against004B by `camera-audit.mjs`; no movement, collision, pickup, generator, validator, audio, HUD or deployment change is allowed by that audit.

`tests/camera.test.ts` compares4000 rendered reference steps against the actual old formulas, with exact position/quaternion/projection equality across four aspects, varied dt, resets and impacts. The historical VFX source fingerprint retains its original expected digest by reversing only the three extracted call sites; the new behavioral test checks the extracted implementation independently. This does not change expected gameplay outcomes.
