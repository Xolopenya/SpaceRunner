import { CONFIG } from '../config.ts';
import { GameModel } from '../core/game-model.ts';
import { RuntimeObstacleField } from './runtime-field.ts';
import type { Axis } from '../core/ship.ts';
import type { FieldPolicy } from '../core/field-policy.ts';
import type { RuntimeEncounterSource } from './runtime-field.ts';
import type { PacingState } from '../core/field-director.ts';

/** Super.step retains the authoritative motion/damage/score/state ordering. */
export class RuntimeGameModel extends GameModel {
  override readonly field: RuntimeObstacleField;
  private observedInput: Axis = { x: 0, y: 0 };
  private disposed = false;
  private pacing: PacingState | 'start' = 'start';
  private observedSection = '';
  constructor(policy: FieldPolicy = 'baseline', experiment?: RuntimeEncounterSource, release = false) {
    super();
    this.field = new RuntimeObstacleField(() => ({ player: this.ship, input: this.observedInput, elapsed: this.elapsed, distance: this.distance, ...(release?{release:true as const}:{}) }), policy, experiment);
  }
  override step(dt: number, axis: Axis): void {
    if (this.disposed) return;
    if (this.state === 'PLAYING' && dt > 0 && Number.isFinite(dt)) {
      if (dt !== CONFIG.step) throw new RangeError('Experimental field requires the existing120Hz fixed simulation step');
      this.observedInput = { x: axis.x, y: axis.y };
    }
    super.step(dt, axis);
    // Observe existing publication metadata; never enter the planner's atomic admission.
    const outcome = this.field.lastOutcome;
    if (this.state === 'PLAYING' && outcome && outcome.section.id !== this.observedSection) {
      this.observedSection = outcome.section.id;
      const section = outcome.section;
      if (outcome.status === 'committed' && section.pacing !== this.pacing) {
        this.events.emit('game.phaseChanged', { runId: this.runId, elapsed: this.elapsed, scope: 'director',
          previous: this.pacing, current: section.pacing, intensity: section.intensity,
          sectionId: section.id, startDistance: section.startDistance });
        this.pacing = section.pacing;
      }
    }
  }
  override start(seed: number): void {
    if (this.disposed) return;
    if (this.state === 'MENU' || this.state === 'GAME_OVER') { this.pacing = 'start'; this.observedSection = ''; }
    super.start(seed);
  }
  override dispose(): void {
    this.disposed = true;
    this.field.pending?.cancel(); this.field.pending = undefined;
    this.field.certificate = undefined; this.field.lastOutcome = undefined;
    this.field.clearDiagnosticTrace();
    super.dispose();
  }
}
