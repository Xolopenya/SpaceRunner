# UI accessibility and responsive review

## Reviewed behavior

The production UI uses native buttons, range inputs, associated labels/outputs and a labelled native dialog. Launch, gameplay canvas, Resume and Fly again keep the existing state focus targets. Keyboard Enter can replay immediately; ESC/P retain pause/resume, dialog Escape closes without resuming flight, and focus returns to Sound settings. Native dialog focus stays contained. M and all real audio statuses/persistence remain owned by existing code.

Three visible hull segments are accompanied by an exact `n/3` count. Meter values and spoken text match the model; warm critical/damage styling never carries the information alone. Damage status follows actual collision/cooldown state. Large numeric values remain formatted in full with metres; no fake readouts or animated digit replacement is added.

Active informational layers use pointer-events:none; Pause explicitly restores pointer input. The new touch checks drag through the visible HUD region into the actual canvas and confirm ship motion, pointer capture and release. Existing desktop/touch/control regressions are retained. There is no permanent title over flight.

## Viewports and layout

The primary captures cover 1440×900 desktop, 390×844 portrait and 844×390 landscape, with menu/flight/pause/death/audio states. Additional long-value checks cover 1024×600, 768×1024, 360×640, 320×568 and 667×320. Distances 999,999; 123,456,789; and 1,234,567,890 are assigned to the real model in a frozen layout fixture, then displayed by the actual HUD. Collision/death tests retain live updates separately.

Controls are checked for >=44px width/height and viewport fit. Primary actions are 48–58px; native ranges have 44px interaction height. Short dialogs may scroll internally rather than shrink controls. Portrait grid positions actions below the central scene; landscape compresses typography/gaps and uses three audio channels in one row. Very short landscape moves instruments upward to retain the central flight reservation. The game display keeps its existing maximum 2:1 aspect.

CSS uses env(safe-area-inset-*) through edge/top/bottom variables, with separate dialog insets. Chrome's documented native safe-area override injects top 44/right 28/bottom 34/left 36px; checks verify HUD and dialog bounds against those actual environment values. This is browser emulation, not a physical-device notch claim.

## Visual inspection and reference relationship

Before/approved/after boards retain the reviewed A screenshots, fresh old-UI captures and current real game captures with explicit labels. The wordmark scale, shared left anchors, cyan primary surface, compact HUD, results hierarchy and landscape audio arrangement follow A. Larger labels, variable pause reasons, long-number sizes, opaque audio surface and visible focus rings are deliberate production adaptations. No full-screen blur, card stack, fake gauges, reference screenshot background or review caption ships.

Keyboard focus has a high-contrast 2px ring. Reduced motion removes transitions and animations. Palette solid-color measurements from the approved tokens remain applicable; mixed-scene legibility is also inspected visually. No WCAG conformance or screen-reader user testing is claimed.

## Remaining limits

Physical phones/tablets, Safari/Firefox, translated labels, browser zoom/text scaling, sustained sessions and assistive-technology user testing remain. The numerical tests cover the stated large values, not every possible future display format. The four approved reference frames are historical static studies; comparison frames differ in actual run timing, focus and steering.
