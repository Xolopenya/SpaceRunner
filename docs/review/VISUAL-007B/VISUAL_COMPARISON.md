# Real gameplay comparison

Open `compare.html` at the review ZIP root, or
`.cache/review/VISUAL-007B/compare.html` locally. It links original-resolution
before/after screenshots, gameplay videos and raw receipts. Comparison boards
only scale/crop and label real screenshots; originals are retained.

All scenarios use the unmodified production app and ordinary Launch. The QA
driver observes the existing instance using CDP and feeds normal steering
inputs at 120Hz. It does not insert obstacles/rewards, teleport the ship or
edit model state. Seeds and complete inputs are retained in `scenarios.json`.
Before/after gameplay conditions and capture ticks are matched.

- `station-{center,left,right,upper,lower}-{haze,distant,approach,close,passage}`:
  actual integrated encounters, including Phase2, planet/star/warp background
  and all five apertures. The certificate pilot retains hull3 through them.
- `{body,left-wing,right-wing,phase2}-{fragment-distant,fragment-debris,fragment-close,fragment-inspect,pickup,magnet,after-pickup}`:
  naturally published collectibles, body/wing contacts, 50ms magnet samples and
  disappearance after the original 140ms animation.
- `mine-and-fragment`: an actual concurrent accepted mine and reward.
- Passage and collectible-close states also have 390×844 / 844×390 stills.

Videos cover lower/center station passage, body pickup and Phase2 pickup.
Loading/accelerated-prefix holds may precede native playback; they are shortened
only by keyframe-aligned stream copies, without generated frames or speed changes.
Extra orientation screenshots pause simulation while changing the viewport.

An automated pilot demonstrates mechanics and matching conditions. Owner
readability/comfort and physical-phone approval are not inferred from it.
