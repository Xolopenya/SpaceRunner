# UI design tokens — proposal A

Source of truth for this exploration: `design/ui-concepts/prototype.css`. Values describe a proposed interface, not production constants. B/C overrides are alternatives; avoid blending all three styles.

| Role | A value | Usage |
| --- | --- | --- |
| Display | Oxanium 500 | Title, actions, distances, state headings |
| Telemetry/body | IBM Plex Mono 400 | Labels, units, hints, settings |
| B display only | Oxanium 700 | Forward-slanted title and score |
| Main type | `#edf4f5` | Primary labels and values |
| Secondary type | `#acb9c9` | Units/instructions on dark surfaces |
| Cyan | `#8cdeeb` | Primary action, healthy hull, restrained state label |
| Action ink | `#07131c` | Dark text on cyan |
| Hover cyan | `#c0f5ff` | Pointer feedback |
| Damage/end state | `#ffb17b` | Hull hit/end-state label; always accompanied by text |
| Lost hull | `#344556` | Missing segment plus explicit 0–3/3 count |
| Base / audio surface | `#050a14` / `#08111ff5` | Dark text support, no blur |
| B accent / C accent | `#c5ef66` / `#e5e8e9` | Isolated concept alternatives |

Contrast calculated with WCAG sRGB luminance math: primary/base **17.79:1**, secondary/base **9.94:1**, primary/audio **16.99:1**, secondary/audio **9.49:1**, action ink/cyan **12.30:1**. The diagnostic checks all five >=4.5:1. These measurements use solid colors; the audio sample uses the opaque surface RGB. Actual translucent/mixed scenery needs screenshot inspection; an opaque local button/scrim supports essential controls. A clear center does not justify illegible edge text.

| Dimension | Desktop | Portrait | Short landscape |
| --- | --- | --- | --- |
| Outer edge | `clamp(24px,4.5vw,68px)` | 24px / safe inset | 28px / safe inset |
| Spacing family | 4, 8, 12, 16, 24, 32px; large scene gaps may vary | Same | Same, compressed gaps |
| A title | 64–108px, .94 line height, -.055em tracking | 68px; 58px on short portrait | 50px |
| State heading | 56–90px | 58px | 48px |
| Active distance | 38px | 32px | 32px |
| Results | 84px | 84px | 62px |
| Core label / body | 11px / 12–14px | 9–12px | 9–11px |
| Review-only caption | 9px | 8px | 8px; never gameplay information |
| Primary action | 300px × >=58px | Available width × >=56px | 270px × >=48px |
| Other hit targets | >=44px; typical 48px | >=44px | >=44px |
| Main geometry | Square corners, 8px terminal cut | Same | Same |
| Focus | White 2px outline, 5px offset | Same | Same |
| Hover | 120ms, 3px along X | No dependency on hover | Same |

Keep the central rectangle X=20–80%, Y=20–80% free of active HUD elements in reviewed viewports. This is a **layout reservation**, not a guarantee that hazards never appear under edge UI. World/camera/ship transforms remain approved and untouched. Damage text sits near hull, not over the incoming path.

For production integration, preserve true model values, locale formatting, existing key bindings and lifecycle messages. Measure long-score/translated-label fit before changing token sizes. Use native labels/inputs/dialog semantics. No imported icon set, external runtime font CDN, new framework or animation library is needed.
