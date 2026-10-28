import { RuntimeGameModel } from '../../debug/runtime-game-model.ts';
import { MineCollision } from './collision.ts';
import { movingMineSource } from './source.ts';
import type { MineConfiguration } from './settings.ts';
export class MovingMineGameModel extends RuntimeGameModel {
  protected override readonly collisions = new MineCollision();
  constructor(configuration?: MineConfiguration, first = false) { super('baseline', movingMineSource(configuration, first)); }
  get collisionQueries(): number { return this.collisions.primitiveQueries; }
}
