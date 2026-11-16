import { CONFIG, difficulty } from '../config.ts';
import { HazardCollision } from './hazard-collision.ts';
import { ObstacleField } from './obstacles.ts';
import { Ship } from './ship.ts';
import type { Axis } from './ship.ts';
// FEEDBACK-001A instrumentation begin
import { GameEvents } from '../events/game-events.ts';
// FEEDBACK-001A instrumentation end

export type GameState = 'LOADING' | 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export class GameModel {
  // FEEDBACK-001A instrumentation begin
  readonly events = new GameEvents();
  runId = 0;
  private previousBest = 0;
  private recordAnnounced = false;
  setRecordBaseline(best: number): void { this.previousBest = Number.isFinite(best) ? Math.max(0, best) : 0; }
  dispose(): void { this.events.dispose(); }
  // FEEDBACK-001A instrumentation end
  state: GameState = 'LOADING';
  readonly ship = new Ship();
  readonly field = new ObstacleField();
  elapsed = 0;
  distance = 0;
  hull: number = CONFIG.ship.hull;
  invulnerability = 0;
  hitSerial = 0;
  seed = 1;
  protected readonly collisions = new HazardCollision();
  private readonly relativeFrom = { x: 0, y: 0, z: 0 };
  private readonly relativeTo = { x: 0, y: 0, z: 0 };

  get score(): number { return Math.floor(this.distance); }
  get speed(): number { return difficulty(this.elapsed).speed; }

  ready(): void { if (this.state === 'LOADING') this.state = 'MENU'; }

  // FEEDBACK-001D-C menu navigation begin
  /** Completed flight -> idle menu. No new run, score write or end event. */
  returnToMenu(): boolean {
    if (this.state !== 'GAME_OVER') return false;
    this.ship.reset();
    this.field.reset(this.seed);
    this.elapsed = this.distance = this.invulnerability = this.hitSerial = 0;
    this.hull = CONFIG.ship.hull;
    this.events.clear();
    this.state = 'MENU';
    return true;
  }
  // FEEDBACK-001D-C menu navigation end

  start(seed: number): void {
    if (this.state !== 'MENU' && this.state !== 'GAME_OVER') return;
    this.seed = seed >>> 0;
    this.ship.reset();
    this.field.reset(this.seed);
    this.elapsed = this.distance = this.invulnerability = this.hitSerial = 0;
    this.hull = CONFIG.ship.hull;
    this.state = 'PLAYING';
    // FEEDBACK-001A instrumentation begin
    this.events.clear();
    this.runId++;
    this.recordAnnounced = false;
    this.events.emit('run.started', { runId: this.runId, elapsed: 0, seed: this.seed });
    // FEEDBACK-001A instrumentation end
  }

  pause(): void { if (this.state === 'PLAYING') this.state = 'PAUSED'; }
  resume(): void { if (this.state === 'PAUSED') this.state = 'PLAYING'; }

  step(dt: number, axis: Axis): void {
    if (this.state !== 'PLAYING' || dt <= 0 || !Number.isFinite(dt)) return;
    dt = Math.min(dt, CONFIG.maxFrameDelta);
    const previousX = this.ship.x;
    const previousY = this.ship.y;
    this.ship.update(dt, axis);
    this.elapsed += dt;
    const travel = this.speed * dt;
    this.distance += travel;
    this.invulnerability = Math.max(0, this.invulnerability - dt);
    this.field.update(dt, this.speed, this.distance, this.elapsed);
    // FEEDBACK-001A instrumentation begin
    if (!this.recordAnnounced && this.score > this.previousBest) {
      this.recordAnnounced = true;
      this.events.emit('score.recordBroken', { runId: this.runId, elapsed: this.elapsed, previousBest: this.previousBest, score: this.score });
    }
    // FEEDBACK-001A instrumentation end
    if (this.invulnerability > 0) return;
    for (const hazard of this.field.hazards) {
      if (!hazard.active) continue;
      this.relativeFrom.x = previousX - hazard.x;
      this.relativeFrom.y = previousY - hazard.y;
      this.relativeFrom.z = -(hazard.z - travel);
      this.relativeTo.x = this.ship.x - hazard.x;
      this.relativeTo.y = this.ship.y - hazard.y;
      this.relativeTo.z = -hazard.z;
      if (this.collisions.hit(this.relativeFrom, this.relativeTo, hazard, this.elapsed, dt)) {
        hazard.active = false;
        this.hull--;
        this.hitSerial++;
        this.invulnerability = CONFIG.ship.invulnerability;
        if (this.hull <= 0) this.state = 'GAME_OVER';
        // FEEDBACK-001A instrumentation begin
        const context = {
          runId: this.runId, elapsed: this.elapsed, source: 'obstacle' as const,
          obstacleKind: hazard.kind, obstacleId: (hazard as typeof hazard & { planned?: { id: string } }).planned?.id,
          position: Object.freeze({ x: this.ship.x, y: this.ship.y, z: 0 }),
          obstaclePosition: Object.freeze({ x: hazard.x, y: hazard.y, z: hazard.z }),
          velocity: Object.freeze({ x: this.ship.vx, y: this.ship.vy }),
          obstaclePose: Object.freeze({ radius: hazard.radius, phase: hazard.phase, spin: hazard.spin, distance: this.distance }),
        };
        this.events.emit('obstacle.collision', { ...context, damageApplied: true });
        this.events.emit('player.damage', { ...context, previousHP: this.hull + 1, currentHP: this.hull });
        if (this.hull <= 0) {
          this.events.emit('player.destroyed', { ...context, score: this.score });
          this.events.emit('run.ended', { runId: this.runId, elapsed: this.elapsed, reason: 'destroyed', score: this.score, seed: this.seed });
        }
        // FEEDBACK-001A instrumentation end
        break;
      }
    }
  }
}
