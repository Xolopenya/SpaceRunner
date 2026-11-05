export type RevealMode = 'legacy' | 'seamless';
export type RevealFamily = 'debris' | 'station' | 'mine' | 'fragment';
/** World-space forward depth from the ship plane; independent of camera aspect. */
export const REVEAL = Object.freeze({
  banks: 2, maximumBirthSeconds: .42,
  debris: Object.freeze({ clear: 105, far: 205, haze: .22, birth: .36 }),
  station: Object.freeze({ clear: 150, far: 215, haze: .18, birth: .42 }),
  mine: Object.freeze({ clear: 145, far: 235, haze: .15, birth: .32 }),
  fragment: Object.freeze({ clear: 140, far: 215, haze: .12, birth: .28 }),
});
export function revealCoverage(family: RevealFamily, depth: number, age: number): number {
  const s = REVEAL[family], smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  return (1 - smooth((depth - s.clear) / (s.far - s.clear))) * smooth(age / s.birth);
}
