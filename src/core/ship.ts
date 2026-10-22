import { CONFIG } from '../config.ts';

export interface Axis { x: number; y: number }

function approach(value: number, target: number, maxChange: number): number {
  return value + Math.max(-maxChange, Math.min(maxChange, target - value));
}

export class Ship {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;

  reset(): void {
    this.x = this.y = this.vx = this.vy = 0;
  }

  update(dt: number, axis: Axis): void {
    const length = Math.max(1, Math.hypot(axis.x, axis.y));
    const ax = axis.x / length;
    const ay = axis.y / length;
    this.vx = approach(this.vx, ax * CONFIG.ship.maxSpeed, (ax ? CONFIG.ship.acceleration : CONFIG.ship.braking) * dt);
    this.vy = approach(this.vy, ay * CONFIG.ship.maxSpeed, (ay ? CONFIG.ship.acceleration : CONFIG.ship.braking) * dt);
    // Constrain the combined speed, including while changing direction.
    const velocityScale = Math.max(1, Math.hypot(this.vx, this.vy) / CONFIG.ship.maxSpeed);
    this.vx /= velocityScale;
    this.vy /= velocityScale;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.abs(this.x) > CONFIG.bounds.x) {
      this.x = Math.sign(this.x) * CONFIG.bounds.x;
      this.vx = 0;
    }
    if (Math.abs(this.y) > CONFIG.bounds.y) {
      this.y = Math.sign(this.y) * CONFIG.bounds.y;
      this.vy = 0;
    }
  }
}
