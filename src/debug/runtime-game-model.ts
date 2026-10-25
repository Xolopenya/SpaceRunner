import { CONFIG } from '../config.ts';
import { GameModel } from '../core/game-model.ts';
import { RuntimeObstacleField } from './runtime-field.ts';
import type { Axis } from '../core/ship.ts';
import type { FieldPolicy } from '../core/field-policy.ts';
import type { RuntimeEncounterSource } from './runtime-field.ts';

/** Super.step retains the authoritative motion/damage/score/state ordering. */
export class RuntimeGameModel extends GameModel {
  override readonly field: RuntimeObstacleField;
  private observedInput: Axis = { x: 0, y: 0 };
  private disposed = false;
  constructor(policy: FieldPolicy = 'baseline', experiment?: RuntimeEncounterSource) {
    super();
    this.field = new RuntimeObstacleField(() => ({ player: this.ship, input: this.observedInput, elapsed: this.elapsed, distance: this.distance }), policy, experiment);
  }
  override step(dt: number, axis: Axis): void {
    if (this.disposed) return;
    if (this.state === 'PLAYING' && dt > 0 && Number.isFinite(dt)) {
      if (dt !== CONFIG.step) throw new RangeError('Experimental field requires the existing120Hz fixed simulation step');
      this.observedInput = { x: axis.x, y: axis.y };
    }
    super.step(dt, axis);
  }
  dispose(): void {
    this.disposed = true;
    this.field.pending?.cancel(); this.field.pending = undefined;
    this.field.certificate = undefined; this.field.lastOutcome = undefined;
  }
}
