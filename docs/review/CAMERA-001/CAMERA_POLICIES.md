# Three matched optical policies

One existing PerspectiveCamera, one `FlightCamera.update`, centralized named constants in `src/camera/flight-camera.ts`. No new spring, replay framework, shader, camera resource, physics coupling or per-frame object creation.

| Mode | Camera position before impact | Look target | Tracking |
| --- | --- | --- | --- |
| A `baseline` | Exact previous004B recurrence | `(0,0,-28)` |12% target, exponential damping8/s |
| B `full-chase` | `(shipX,2.4+shipY,rearZ)` | `(shipX,shipY,-28)` |100% X/Y, zero follow lag |
| C `hybrid-chase` | `(.8*shipX,2.4+.8*shipY,rearZ)` | `(.8*shipX,.8*shipY,-28)` |80% X/Y, zero follow lag |

B/C translate both endpoints by the same reference vector. Their forward direction is constant during lateral/vertical steering. Existing impact displacement `sin(elapsed*80)*shake` also translates both endpoints, so impact produces lateral motion without extra yaw. Neither follows decorative roll/pitch. All three use identical FOV58°, near.1/far260 and responsive rear distance. No zoom advantage is introduced.

Switches snap on the next render. Entering B/C directly evaluates their exact pose. A live return to A snaps to the static12% pose once, then resumes the exact old recurrence; it does not ease from an unrelated chase pose. A started normally from reset never takes that entry branch and remains identical to004B. Reset clears camera position/history, retains the researcher's selected mode and uses the existing World lifecycle. Pause does not reset selection or simulation; B/C remain frozen for a fixed ship pose.

DEV-only `?debug=camera&camera=baseline|full-chase|hybrid-chase&seed=42` selects the real ReleaseModel, Mixed Flow, five station variations, Phase2 and normal fragments. Add `&colliders=1` for the existing compound visualizer. Three bottom-right buttons switch during flight; active mode uses `aria-pressed`. No new keyboard shortcuts conflict with WASD/arrows, P/Escape or M. Invalid camera parameters fall back to A. No tuning slider is needed for this experiment.

With colliders enabled, their large inherited text panel starts collapsed so it cannot cover A's boundary-positioned ship. `Collider text` expands it; all original wires remain visible. Clean comparison captures hide research panels equally for every mode.

Normal Play remains A. Production ignores the research parameters; DEV selector/debugger chunks and inspection seam are removed by Vite. New modes remain research options until the owner chooses. No main merge or Pages deployment is performed.
