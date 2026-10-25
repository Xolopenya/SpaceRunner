import { RuntimeGameModel } from '../../debug/runtime-game-model.ts';
import { BulkheadCollision } from './profile.ts';
import { structureSource } from './encounter.ts';
import type { Aperture } from './encounter.ts';

/** Inherits the authoritative movement, damage, score, pause and restart loop. */
export class LargeStructureGameModel extends RuntimeGameModel {
  protected override readonly collisions = new BulkheadCollision();
  constructor(aperture?: Aperture) { super('baseline', structureSource(aperture)); }
  get collisionQueries(): number { return this.collisions.primitiveQueries; }
}
