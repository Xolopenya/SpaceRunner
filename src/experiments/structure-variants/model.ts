import { RuntimeGameModel } from '../../debug/runtime-game-model.ts';
import { WreckCollision } from './profile.ts';
import type { Aperture, StructureMode } from './profile.ts';
import { wreckSource } from './encounter.ts';
export class StructureVariantsGameModel extends RuntimeGameModel {
  protected override readonly collisions = new WreckCollision();
  readonly aperture: Aperture;
  readonly mode: StructureMode;
  constructor(aperture: Aperture = 'center', mode: StructureMode = 'isolated') { super('baseline', wreckSource(aperture, mode)); this.aperture = aperture; this.mode = mode; }
  get collisionQueries(): number { return this.collisions.primitiveQueries; }
}
