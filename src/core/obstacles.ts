import { CONFIG, difficulty } from '../config.ts';
import { Random } from './random.ts';

export interface Hazard {
  active: boolean;
  x: number;
  y: number;
  z: number;
  radius: number;
  kind: number;
  spin: number;
  phase: number;
}

export interface Wave {
  active: boolean;
  z: number;
  safeX: number;
}

/** Adjacent corridors only. Spacing includes acceleration, braking and reaction budget. */
export function corridorTravelBudget(): number {
  return CONFIG.waves.reactionSeconds
    + CONFIG.ship.maxSpeed / CONFIG.ship.acceleration
    + CONFIG.ship.maxSpeed / CONFIG.ship.braking
    + CONFIG.waves.laneWidth / CONFIG.ship.maxSpeed
    + 2 * (CONFIG.hazards.maxRadius + CONFIG.ship.radius) / CONFIG.flight.maxSpeed;
}

export class ObstacleField {
  readonly hazards: Hazard[] = Array.from({ length: CONFIG.hazards.capacity }, () => ({
    active: false, x: 0, y: 0, z: 0, radius: 1, kind: 0, spin: 0, phase: 0,
  }));
  readonly waves: Wave[] = Array.from({ length: CONFIG.waves.capacity }, () => ({ active: false, z: 0, safeX: 0 }));
  private random = new Random(1);
  private safeLane = 0;
  private nextDistance = 0;
  spawnedWaves = 0;

  reset(seed: number): void {
    this.random = new Random(seed);
    this.safeLane = 0;
    this.nextDistance = 0;
    this.spawnedWaves = 0;
    for (const hazard of this.hazards) hazard.active = false;
    for (const wave of this.waves) wave.active = false;
  }

  update(dt: number, speed: number, distance: number, elapsed: number): void {
    for (const hazard of this.hazards) {
      if (!hazard.active) continue;
      hazard.z += speed * dt;
      if (hazard.z > CONFIG.hazards.despawnZ) hazard.active = false;
    }
    for (const wave of this.waves) {
      if (!wave.active) continue;
      wave.z += speed * dt;
      if (wave.z > CONFIG.hazards.despawnZ) wave.active = false;
    }
    if (elapsed >= CONFIG.flight.warmupSeconds && distance >= this.nextDistance) {
      this.spawn(elapsed);
      this.nextDistance = distance + difficulty(elapsed).spacing;
    }
  }

  private spawn(elapsed: number): void {
    const candidates = [-1, 0, 1].filter(lane => Math.abs(lane - this.safeLane) <= 1);
    this.safeLane = candidates[Math.floor(this.random.next() * candidates.length)] ?? 0;
    const wave = this.waves.find(item => !item.active);
    if (!wave) return;
    wave.active = true;
    wave.z = CONFIG.hazards.spawnZ;
    wave.safeX = this.safeLane * CONFIG.waves.laneWidth;
    const { density } = difficulty(elapsed);
    for (const lane of [-1, 0, 1]) {
      if (lane === this.safeLane) continue;
      for (const row of [-1, 0, 1]) {
        if (this.random.next() > density) continue;
        const hazard = this.hazards.find(item => !item.active);
        if (!hazard) break;
        Object.assign(hazard, {
          active: true,
          x: lane * CONFIG.waves.laneWidth + this.random.between(-0.35, 0.35),
          y: row * 2.45 + this.random.between(-0.15, 0.15),
          z: CONFIG.hazards.spawnZ,
          radius: this.random.between(0.65, CONFIG.hazards.maxRadius),
          kind: Math.floor(this.random.next() * 3),
          spin: this.random.between(-0.7, 0.7),
          phase: this.random.between(0, Math.PI * 2),
        });
      }
    }
    this.spawnedWaves++;
  }
}
