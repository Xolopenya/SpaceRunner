import { CONFIG, difficulty } from '../config.ts';
import { HazardCollision } from './hazard-collision.ts';
import { ObstacleField } from './obstacles.ts';
import { Ship } from './ship.ts';
import type { Axis } from './ship.ts';

export type GameState = 'LOADING' | 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export class GameModel {
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

  start(seed: number): void {
    if (this.state !== 'MENU' && this.state !== 'GAME_OVER') return;
    this.seed = seed >>> 0;
    this.ship.reset();
    this.field.reset(this.seed);
    this.elapsed = this.distance = this.invulnerability = this.hitSerial = 0;
    this.hull = CONFIG.ship.hull;
    this.state = 'PLAYING';
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
        break;
      }
    }
  }
}
