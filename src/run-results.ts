/** Immutable presentation snapshot, independent of the already-updated saved best. */
export interface CompletedRun {
  readonly runId: number;
  readonly score: number;
  readonly energy: number;
  readonly seed: number;
  readonly previousBest: number;
  readonly newRecord: boolean;
}

interface ResultStore { record(score: number): number }

export class RunResults {
  private runId = 0;
  private previousBest = 0;
  private result?: CompletedRun;
  get completed(): CompletedRun | undefined { return this.result; }

  begin(runId: number, previousBest: number): void {
    this.runId = runId;
    this.previousBest = Number.isFinite(previousBest) ? Math.max(0, Math.floor(previousBest)) : 0;
    this.result = undefined;
  }

  finish(runId: number, score: number, energy: number, seed: number, store: ResultStore): void {
    if (runId !== this.runId || this.result) return;
    this.result = Object.freeze({ runId, score, energy, seed, previousBest: this.previousBest,
      newRecord: score > this.previousBest });
    store.record(score);
  }

  clear(): void { this.result = undefined; this.runId = 0; this.previousBest = 0; }
}
