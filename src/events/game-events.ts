import type { PacingState } from '../core/field-director.ts';

export interface EventContext { readonly runId: number; readonly elapsed: number }
export interface EventPosition { readonly x: number; readonly y: number; readonly z: number }
export interface CollisionContext extends EventContext {
  readonly source: 'obstacle';
  readonly obstacleKind: number;
  readonly obstacleId?: string;
  /** Ship reference position at the collision step, not a fabricated surface normal. */
  readonly position: EventPosition;
  readonly obstaclePosition: EventPosition;
  readonly velocity: Readonly<{ x: number; y: number }>;
  /** Rendering snapshot retained after slot deactivation; not a physics contact. */
  readonly obstaclePose?: Readonly<{ radius: number; phase: number; spin: number; distance: number }>;
}
export interface GameEventMap {
  'run.started': EventContext & { readonly seed: number };
  'obstacle.collision': CollisionContext & { readonly damageApplied: boolean };
  'player.damage': CollisionContext & { readonly previousHP: number; readonly currentHP: number };
  'player.destroyed': CollisionContext & { readonly score: number };
  'collectible.collected': EventContext & {
    readonly item: 'energy-fragment'; readonly itemId: string; readonly position: EventPosition;
    /** Existing reward is one energy unit; distance score is unaffected. */
    readonly reward: number; readonly total: number; readonly assisted: boolean;
  };
  'game.phaseChanged': EventContext & (
    { readonly scope: 'progression'; readonly previous: 1; readonly current: 2 } |
    { readonly scope: 'director'; readonly previous: PacingState | 'start'; readonly current: PacingState;
      readonly intensity: number; readonly sectionId: string; readonly startDistance: number }
  );
  'score.recordBroken': EventContext & { readonly previousBest: number; readonly score: number };
  'run.ended': EventContext & { readonly reason: 'destroyed'; readonly score: number; readonly seed: number };
}
export type GameEventType = keyof GameEventMap;
export type GameEvent = { [K in GameEventType]: Readonly<{ type: K; payload: GameEventMap[K] }> }[GameEventType];
type Listener = (event: GameEvent) => void;

/** Presentation mailbox, flushed after a complete simulation step. No scene dependencies.
 * FIFO events and insertion-order subscriptions. Subscriber failures cannot stop flight.
 * Subscribers may unsubscribe, but may not publish facts recursively during delivery. */
export class GameEvents {
  private readonly listeners = new Set<Listener>();
  private readonly queue: GameEvent[] = [];
  private delivering = false;
  private disposed = false;
  readonly capacity = 64;
  dropped = 0;
  failures = 0;

  get subscriberCount(): number { return this.listeners.size; }
  get pendingCount(): number { return this.queue.length; }

  subscribe(listener: Listener): () => void {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  on<K extends GameEventType>(type: K, listener: (payload: GameEventMap[K]) => void): () => void {
    return this.subscribe(event => {
      if (event.type === type) listener(event.payload as GameEventMap[K]);
    });
  }

  emit<K extends GameEventType>(type: K, payload: GameEventMap[K]): void {
    if (this.disposed || !this.listeners.size) return;
    if (this.delivering || this.queue.length >= this.capacity) { this.dropped++; return; }
    this.queue.push(Object.freeze({ type, payload: Object.freeze(payload) }) as unknown as GameEvent);
  }

  flush(): void {
    if (this.delivering || !this.queue.length || this.disposed) return;
    this.delivering = true;
    // Snapshot once per batch: newly added listeners start with the next batch.
    const listeners = [...this.listeners];
    try {
      for (const event of this.queue) for (const listener of listeners) {
        if (!this.listeners.has(listener)) continue;
        try { listener(event); } catch { this.failures++; }
      }
    } finally { this.queue.length = 0; this.delivering = false; }
  }

  clear(): void { if (!this.delivering) this.queue.length = 0; }
  dispose(): void { this.disposed = true; this.listeners.clear(); this.clear(); }
}
