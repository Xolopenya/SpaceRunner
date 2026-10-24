import { CONFIG, difficulty } from '../config.ts';
import { Ship } from './ship.ts';
import { ClearanceHazardCollision } from './field-clearance.ts';
import { HazardCollision } from './hazard-collision.ts';
import type { Axis } from './ship.ts';
import type { PlannedHazard } from './field-types.ts';

export interface FlightState { x: number; y: number; vx: number; vy: number; elapsed: number; distance: number }

/** Private shadow Ship, never the live player. Exact GameModel update ordering. */
export class FlightPrediction {
  private readonly ship = new Ship();
  private readonly query = new ClearanceHazardCollision();
  private readonly gameplayQuery = new HazardCollision();
  private readonly from = { x: 0, y: 0, z: 0 };
  private readonly to = { x: 0, y: 0, z: 0 };

  step(state: FlightState, input: Readonly<Axis>): void {
    this.lateral(state, input);
    state.elapsed += CONFIG.step;
    state.distance += difficulty(state.elapsed).speed * CONFIG.step;
  }

  /** Search can reuse an exact, input-independent end-step clock table. */
  stepAt(state: FlightState, input: Readonly<Axis>, elapsed: number, distance: number): void {
    this.lateral(state, input); state.elapsed = elapsed; state.distance = distance;
  }

  private lateral(state: FlightState, input: Readonly<Axis>): void {
    this.ship.x = state.x; this.ship.y = state.y; this.ship.vx = state.vx; this.ship.vy = state.vy;
    this.ship.update(CONFIG.step, input);
    state.x = this.ship.x; state.y = this.ship.y; state.vx = this.ship.vx; state.vy = this.ship.vy;
  }

  hit(previous: Readonly<FlightState>, next: Readonly<FlightState>, hazard: PlannedHazard, margin: number): boolean {
    this.endpoints(previous, next, hazard);
    return this.query.hit(this.from, this.to, hazard, next.elapsed, CONFIG.step, margin);
  }

  hitGameplay(previous: Readonly<FlightState>, next: Readonly<FlightState>, hazard: PlannedHazard): boolean {
    this.endpoints(previous, next, hazard);
    return this.gameplayQuery.hit(this.from, this.to, hazard, next.elapsed, CONFIG.step);
  }

  private endpoints(previous: Readonly<FlightState>, next: Readonly<FlightState>, hazard: PlannedHazard): void {
    this.from.x = previous.x - hazard.x; this.from.y = previous.y - hazard.y;
    this.from.z = hazard.passDistance - previous.distance;
    this.to.x = next.x - hazard.x; this.to.y = next.y - hazard.y;
    this.to.z = hazard.passDistance - next.distance;
  }
}
