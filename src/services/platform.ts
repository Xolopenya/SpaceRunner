import { ScoreStorage } from './storage.ts';

export interface PlatformAdapter {
  scores: ScoreStorage;
  ready(): void;
  gameplayChanged(active: boolean): void;
}

/** The only hosting seam. A future SDK adapter can implement the same interface. */
export class StandalonePlatform implements PlatformAdapter {
  readonly scores = new ScoreStorage();
  ready(): void { /* Standalone web has no host loading lifecycle. */ }
  gameplayChanged(_active: boolean): void { /* No host SDK in Phase 1. */ }
}
