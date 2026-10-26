import { RuntimeGameModel } from '../../debug/runtime-game-model.ts';
import { WreckCollision } from '../structure-variants/profile.ts';
import type { Aperture } from '../structure-variants/profile.ts';
import { mixedFlowSource } from './source.ts';
export class MixedFlowGameModel extends RuntimeGameModel {
  protected override readonly collisions = new WreckCollision();
  readonly forcedAperture?: Aperture;
  constructor(forcedAperture?: Aperture) { super('baseline', mixedFlowSource(forcedAperture)); this.forcedAperture = forcedAperture; }
  get collisionQueries(): number { return this.collisions.primitiveQueries; }
}
