export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'space-runner.best.v1';

export class ScoreStorage {
  best = 0;
  private getStorage: () => Store;

  constructor(getStorage: () => Store = () => window.localStorage) {
    this.getStorage = getStorage;
    try {
      const value = Number(getStorage().getItem(KEY));
      if (Number.isFinite(value) && value > 0) this.best = Math.floor(value);
    } catch { /* Private browsing / denied storage: keep an in-memory best. */ }
  }

  record(score: number): number {
    if (!Number.isFinite(score) || score <= this.best) return this.best;
    this.best = Math.floor(score);
    try { this.getStorage().setItem(KEY, String(this.best)); } catch { /* Session best still works. */ }
    return this.best;
  }
}
