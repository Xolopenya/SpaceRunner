# Responsive UI and accessibility

All device tests below are desktop Chrome emulation. There was no physical phone/tablet, notch, mobile Safari, Firefox, screen-reader participant or motion-sensitive participant test.

## Viewport matrix

Each primary size has actual production menu, Audio, active HUD, pause, natural first-hit, death/results and replay screenshots. Touch sizes also have a real Chromium touch-protocol drag/capture/release sample. Idle waiting for collisions/results was accelerated through the original update/render path; it is not additional real-time play duration.

| Viewport | Input profile | Observed result |
|---|---|---|
| 1920×1080 | Fine pointer / keyboard | Actions fit; damage/phase overlap |
| 1366×768 | Fine pointer / keyboard | Actions fit; damage/phase overlap |
| 1280×720 | Fine pointer / keyboard | Actions fit; overlap also reproduced in native real time |
| 1024×600 | Fine pointer / keyboard | Actions fit; damage/phase overlap |
| 390×844 | Coarse / touch emulated | Drag/release, pause, dialog and replay work; overlap and multiline phase notice |
| 360×800 | Coarse / touch emulated | Compact hull/distance fit; damage/phase overlap |
| 932×430 | Coarse / touch emulated | Flight area letterboxed to 860×430 by the existing 2:1 maximum; sampled damage/phase rectangles do not intersect vertically |
| 768×1024 | Coarse / tablet emulated | Actions fit; damage/phase overlap; auxiliary keyboard shortcut copy remains |

Additional checks: a fine-pointer 800×450 window proves touch-only hint wording (UX-03); 390×844 → 844×390 rotation retains controls and pause. All inspected buttons/inputs in primary menu, active HUD, pause, Audio and results snapshots have at least 44×44 CSS px and fit their viewport. This is target geometry coverage, not a claim that every text glyph, long translation or future label fits.

The matrix's seven positive phase/damage intersections have height 13px and width approximately 101–160px. The raw rectangles are in `facts.json`. This defect is specific and reproducible, unlike a general claim that the responsive layout is broken.

## Touch, safe areas, resize and zoom

The production input uses pointer capture, bounded drag radius and explicit release/cancel handling. Actual Chromium touch events moved the ship in both axes; releasing touch hid the stick. Pause and resume clear inputs, and the sampled resume velocities settled to zero. The translucent virtual stick follows the user's initial touch, which can cover nearby objects; no recorded gameplay failure is attributed to it. Human thumb reach/occlusion needs a device study.

CSS uses `viewport-fit=cover`, safe-area environment insets and dynamic viewport height. The existing browser suite additionally tests native emulated safe-area overrides (44 top / 28 right / 34 bottom / 36 left), pointer cancel, orientation and extreme score fits. Passing emulation is not proof of physical notches, browser chrome, virtual keyboards or Yandex webviews.

True browser page zoom was not independently tested. Small viewport and large-score regressions cover some related constraints but are not substitutes for 200% browser zoom. Include 125%/200% zoom in desktop human acceptance for the next UI task. The current defect inventory does not invent a zoom failure.

## Keyboard and semantics

Launch, Resume, Skip and Fly again receive explicit focus at state transitions. Visible button/input focus rings exist. Audio uses a native `<dialog>` with labels for sliders, a named close control and mute's `aria-pressed`. Escape closes Audio without unpausing; P in the dialog is stopped. Existing tests cover focus containment/return, keyboard launch/replay, modifier/text-input guards and hidden/background lifecycle. A raw empty active-element id after dialog close denotes an id-less opener; it is not enough to diagnose focus loss.

Hull uses a numeric meter with 0–3 range and value text; explicit N/3 supports users who cannot distinguish warm/cyan. Damage is a status region. Distance is a constantly changing visual value; making every frame a live announcement would be counterproductive. The canvas has a descriptive label, but spatial play is inherently visual: this audit does not claim screen-reader accessibility or WCAG conformance.

## Motion, flashing and audio independence

OS reduced motion removes CSS transitions/animations and camera shake/streaks, reduces impact particles to 12 and shortens the death presentation (configured 0.65s versus 2.05s). The focused capture sequence covers reduced-motion flight, rotation, actual natural death, completed results and replay. The player still moves; reduced motion is not motion-free gameplay. In-game discovery is UX-09, a low-priority improvement opportunity.

The damage shell, hull count, local pickup ring, +1, mine model/core and death/results make critical states visible without sound. Muted flight and saved mute were exercised. Whether a new player recognizes all cues while muted requires human testing. Color is supported by shape/count/text for hull and collection; mine arming relies more strongly on visual phase/color change and should be included in that identification test.

Impact/death include brief luminous flashes. Reduced mode lowers effects, and skipping is available. No photometric flash-area/frequency analysis or photosensitivity safety certification was performed. Do not infer such safety from fewer particles or owner approval. Preserve approved effects unless a reproducible usability issue is found.

The audio tests verify settings/state/lifecycle; native browser videos are silent. This audit provides no new subjective listening approval. The owner's earlier approval of sampled collisions, music, shield and destruction remains the relevant context.
