import { RuntimeGameModel } from '../../debug/runtime-game-model.ts';
import { MineCollision } from './collision.ts';
import { movingMineSource } from './source.ts';
import type { MineConfiguration, MineMotionPolicy } from './settings.ts';
export class MovingMineGameModel extends RuntimeGameModel {
  protected override readonly collisions = new MineCollision();
  readonly motionPolicy: MineMotionPolicy;
  constructor(configuration?: MineConfiguration, first = false, motionPolicy: MineMotionPolicy = 'baseline') {
    super('baseline', movingMineSource(configuration, first, motionPolicy)); this.motionPolicy = motionPolicy;
  }
  get collisionQueries(): number { return this.collisions.primitiveQueries; }
}
