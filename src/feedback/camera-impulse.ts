import { visualDelta } from '../visuals/settings.ts';
import type { FeedbackPreset } from './settings.ts';

/** Additive scalar, evaluated from a bounded envelope; no stored camera offsets. */
export class CameraImpulse {
  private remaining = 0;
  private duration = 1;
  private strength = 0;
  get amplitude(): number { return this.strength * (this.remaining / this.duration) ** 2; }
  trigger(preset: FeedbackPreset): void {
    this.remaining = this.duration = preset.duration;
    this.strength = preset.camera;
  }
  update(state: string, dt: number): void { this.remaining = Math.max(0, this.remaining - visualDelta(state, dt, true)); }
  reset(): void { this.remaining = this.strength = 0; }
}
