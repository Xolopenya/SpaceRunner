import { DAMAGE_FX as F } from './visual-settings.ts';
import { visualDelta } from '../visuals/settings.ts';

export class DestructionSequence {
  elapsed = 0;
  private started = false;
  private reduced = false;
  private run = -1;
  get duration(): number { return this.reduced ? F.death.reducedSeconds : F.death.seconds; }
  get breakupAt(): number { return this.reduced ? F.death.reducedBreakup : F.death.breakup; }
  get active(): boolean { return this.started && this.elapsed < this.duration; }
  get broken(): boolean { return this.started && this.elapsed >= this.breakupAt; }
  get phase(): 'idle' | 'contact' | 'failure' | 'breakup' | 'aftermath' | 'results' {
    return !this.started ? 'idle' : !this.active ? 'results' : this.broken ? this.elapsed < F.death.aftermath ? 'breakup' : 'aftermath'
      : this.elapsed < F.death.failure ? 'contact' : 'failure';
  }
  begin(runId: number, reducedMotion: boolean): boolean {
    if (this.started && this.run === runId) return false;
    this.run = runId; this.started = true; this.elapsed = 0; this.reduced = reducedMotion; return true;
  }
  update(state: string, dt: number, suspended = false): void {
    if (this.active && !suspended) this.elapsed = Math.min(this.duration, this.elapsed + visualDelta(state, dt, true));
  }
  skip(): void { if (this.started) this.elapsed = this.duration; }
  reset(): void { this.elapsed = 0; this.started = false; this.run = -1; }
}
