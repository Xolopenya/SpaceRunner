# Space Runner interface art direction

Status: **proposal for owner approval**, PHASE-3-004A. Approved playable baseline: `5efda476f725df038bfb46ebbf9d65aaec2b646f`. No production integration is authorized by this document.

## Thesis and recommendation

Minimalist flight instrumentation for a fast, atmospheric, low-poly space arcade.

Recommend **A — Flight Instrumentation**. Use an angular, two-line SPACE RUNNER title, a single cyan launch surface and a short, factual steering hint. During flight, remove the title entirely. Put three hull segments at upper left, distance and pause at upper right, and keep the central approach area open. The visible ship, planet and exhaust are the main illustration.

This creates a game identity through the relationship between title, numerical hierarchy, physical scene and immediate actions. No marketing headline, feature card, decorative dashboard gauge, rounded modal stack, build label or permanent brand banner is needed. Each line earns its place by identifying the game, explaining an input, reporting existing state or enabling an action.

## Three directions

**A / Flight Instrumentation:** Oxanium 500, modest cyan, stepped wordmark with one small terminal cut, compact horizontal HUD. Menus and pause share a left anchor; results shift emphasis to the distance. A narrow dark scrim supports text while retaining the same world at right. No glass effect or scene blur.

**B / Arcade Racing:** Oxanium 700, forward slant, offset stacked title, lime action surface and larger distance. It makes replay and personal improvement feel more assertive. The lime is a deliberate comparison variable, not a new in-game system. Its higher visual weight competes more with the existing quiet art and needs the most restraint during a future implementation.

**C / Isolation Minimalism:** tracked single-line title, pale monochrome interface, fine horizontal action rules and small hull marks. It gives the scene the most silence. Start and hull are less immediately prominent; there is a risk of under-signalling interactivity, particularly on touch.

## State and interaction inventory

| Existing state/control | Proposed representation | Prototype boundary |
| --- | --- | --- |
| Loading, failure and retry | Plain status, useful error, Retry loading | A supplemental states; retry navigates to menu as a preview |
| Menu / start | Game title, Launch run, personal best, steer/pause/mute hints, Sound settings | All A/B/C; fresh-save best is 0 |
| Active flight | Three-segment hull with explicit count, distance in metres, pause, current speed | All A/B/C; sample remains frozen at 150 m / 21 m/s |
| First-run guidance | Plain lower-edge steer/avoid hint | Shown for inspection; production should retain its existing nine-second lifetime |
| Hull hit / invulnerability | Warm text and hull segments, “Impact protection · 1.6 s” | A supplemental hit scenario; no new shield system or gauge |
| Pause / focus loss | Hold position, Resume flight, retained distance/hull, Sound settings and controls | ESC/P and buttons navigate preview states; copy slot must preserve real pause reason later |
| Death / replay | Hull depleted, final distance, personal best, route and Fly again | Results use recorded 150 m as the illustrative completed first run |
| Audio | Master/music/SFX, percentages, mute and close, truthful status | Native dialog; values work only in demo memory, no sound or persistence |
| Touch steering | Drag-anywhere hint; existing game pointer capture retained later | These screen studies do not steer the ship |

Audio production statuses must continue distinguishing locked, running, muted, blocked, suspended and unavailable, using the existing manager's messages. The prototype explicitly says it cannot play audio. Do not replace actual error/status reporting with aesthetic telemetry. Mute is never conveyed by color alone.

## Responsive composition

Desktop 1440×900 uses a shared 4.5vw outer anchor (capped at 68px) and a 300px action column. A's menu text remains left of the ship; the right side retains atmosphere and record. Pause and death reorganize content along the same anchors rather than opening a centered web card.

Portrait 390×844 places title near the upper edge, the ship in the middle and the launch/resume action below the ship. Record sits beside the scene. HUD uses a compact two-line distance and icon-only pause with its accessible name. Touch instructions replace keyboard steering copy. Landscape 844×390 compresses type and vertical gaps, retains a 48px action, and uses three audio channels in one row. Extremely short panels can scroll internally. Respect safe-area insets; physical notch/device testing remains pending.

Core controls are at least 44px in the inspected layouts; primary actions are 48–58px. Native dialog supplies focus containment, Escape dismissal and focus return. Focus rings stay visible. Reduced motion disables transforms/transitions; there is no automatic decorative animation. Review navigation and UI STUDY captions are explicitly outside the proposed game interface.

## Alignment, color and transitions

See `UI_DESIGN_TOKENS.md` for exact values. Use a small spacing family, align label edges with their values and actions, and retain clear distinction between large values and small units. Cyan is an action/status accent, amber is damage/end-state information, and neutral type supports the existing navy/violet world. Avoid adding separate chromatic systems for score, record and controls.

Hover changes take 120ms with a 3px directional movement; reduced motion removes it. Prototype state changes are immediate. A production transition proposal is a brief scrim fade with no input lock or delayed resume. This is not a claim about measured reference-game transitions.

## Approval and remaining risk

The recommendation is based on rendered static states, not player preference testing. Verify it over moving hazards before production acceptance, including damage timing, long localized labels, larger scores, touch reach, physical safe areas and screen-reader behavior. The full game and audio are unchanged; no subjective listening approval is implied. B/C are desktop alternatives; only A receives full mobile/audio exploration. A separate owner-approved task must wire any chosen layout to the real HUD and SoundPanel.
