import { RuntimeGameModel } from '../../debug/runtime-game-model.ts';
import { MineCollision } from './collision.ts';
import { movingMineSource } from './source.ts';
import { targetLockSource } from './target-lock-source.ts';
import type { TargetLockTuning } from './target-lock-settings.ts';
import type { MineConfiguration, MineMotionPolicy } from './settings.ts';
export class MovingMineGameModel extends RuntimeGameModel {
  protected override readonly collisions = new MineCollision();
  readonly motionPolicy: MineMotionPolicy;
  constructor(configuration?: MineConfiguration, first = false, motionPolicy: Exclude<MineMotionPolicy,'adaptive-homing'> = 'baseline', tuning?: TargetLockTuning) {
    super('baseline', motionPolicy === 'target-lock' ? targetLockSource(first, tuning) : movingMineSource(configuration, first, motionPolicy)); this.motionPolicy = motionPolicy;
    if(motionPolicy === 'target-lock' && configuration) throw new RangeError('Target lock has no crossing configuration');
  }
  get collisionQueries(): number { return this.collisions.primitiveQueries; }
}
