/** DEV balance policy. Physics, fairness and work budgets live in their original configs. */
export const MIXED_FLOW = Object.freeze({ version: 'mixed-flow-v1', geometry: 'mixed-flow-geometry-v1',
  minimumOrdinarySections: 3, maximumOrdinarySections: 6, structureChance: .42,
  ambientCells: 2, ownedTailCells: 1, regularIntensity: .35, risingIntensity: .5, highIntensity: .65 } as const);
