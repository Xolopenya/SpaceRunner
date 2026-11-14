/** Presentation-only tuning; the authoritative cooldown and death clock are unchanged. */
export const POLISH = {
  field: { scale: [1.63, .76, 1.72] as const, attack: .055, release: .26, impact: .24, sustain: .80, burst: 1.35 },
  mine: { flash: .16, wave: .72, radius: 3.2, residual: 1.2 },
  death: { flash: .22, wave: .85, secondary: [.10, .25, .42] as const, arcSegments: 24, heat: .7 },
} as const;
