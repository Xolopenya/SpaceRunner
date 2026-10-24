import { FlightPrediction } from '../src/core/field-prediction.ts';
import { ClearanceHazardCollision } from '../src/core/field-clearance.ts';
import { CONFIG } from '../src/config.ts';
import { beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { knownControls } from '../tests/fixtures/trajectory-fixtures.ts';
import { VALIDATION_LIMITS as L } from '../src/core/field-validator-types.ts';

export const complete = job => { while (!job.getResult()) job.advance(); return job.getResult(); };

/** Diagnostic only: reproduce the compulsory input prefix against existing geometry. */
export function existingFieldProbe(context) {
  const state = { ...context.player, elapsed: context.elapsed, distance: context.distance };
  const prediction = new FlightPrediction(), query = new ClearanceHazardCollision();
  const collision = (previous, current) => {
    for (const h of context.committed) {
      const from = { x: previous.x - h.x, y: previous.y - h.y, z: h.passDistance - previous.distance };
      const to = { x: current.x - h.x, y: current.y - h.y, z: h.passDistance - current.distance };
      if (query.hit(from, to, h, current.elapsed, CONFIG.step, L.margin)) return h.id;
    }
    return null;
  };
  let prefix = null;
  for (let tick = 1; tick <= L.reactionTicks; tick++) {
    const previous = { ...state }; prediction.step(state, context.input);
    const hazard = collision(previous, state);
    if (hazard) { prefix = { tick, hazard, distance: state.distance }; break; }
  }
  const firstActions = [];
  if (!prefix) for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) {
    const next = { ...state }; let hit = null;
    for (let tick = 1; tick <= L.macroTicks; tick++) {
      const previous = { ...next }; prediction.step(next, { x, y });
      const hazard = collision(previous, next);
      if (hazard) { hit = { tick: L.reactionTicks + tick, hazard, distance: next.distance }; break; }
    }
    firstActions.push({ input: { x, y }, hit });
  }
  return { prefix, stateAfterPrefix: state, firstActions, margin: L.margin };
}

/** A hand-authored diagnostic route, independently replayed under normal policy.
 * This does not participate in beam search, acceptance rates or runtime selection.
 */
export function intendedManeuver(context) {
  const source = context.candidate.provenance.pattern;
  if (!source || !['alternating', 'vertical-weave'].includes(source.family)) throw new Error('Unsupported diagnostic maneuver');
  const axis = source.family === 'alternating' ? 'x' : 'y', offset = axis === 'x' ? source.offsetX : source.offsetY;
  const groups = [];
  for (let i = 0; i < context.candidate.hazards.length; i += 2) {
    const pair = context.candidate.hazards.slice(i, i + 2);
    const pressure = pair.reduce((s, h) => s + h[axis], 0) / 2;
    groups.push({ target: offset - Math.sign(pressure - offset) * 1.8,
      exit: Math.max(...pair.map(h => h.passDistance + h.radius + CONFIG.ship.radius + .15)) + .8 });
  }
  const duration = knownControls(context).reduce((s, run) => s + run.ticks, 0);
  const state = { ...context.player, elapsed: context.elapsed, distance: context.distance }, prediction = new FlightPrediction(), controls = [];
  let group = 0;
  for (let tick = 0; tick < duration; tick++) {
    while (group < groups.length && state.distance > groups[group].exit) group++;
    const input = { x: 0, y: 0 };
    if (tick < 54) Object.assign(input, context.input);
    else if (tick < duration - L.brakingTicks && group < groups.length) input[axis] = Math.max(-1, Math.min(1, 2 * (groups[group].target - state[axis]) - .7 * state[axis === 'x' ? 'vx' : 'vy']));
    const last = controls.at(-1);
    if (last && last.input.x === input.x && last.input.y === input.y) last.ticks++; else controls.push({ ticks: 1, input });
    prediction.step(state, input);
  }
  const result = complete(beginTrajectoryReplay(context, controls));
  return { result, ...(result.decision === 'accept' ? analyzeWitness(result.witness) : {}) };
}

/** Real sweeps of the validated controls. Clearance is collider padding, not mesh distance. */
export function analyzeWitness(witness) {
  const state = { ...witness.context.player, elapsed: witness.context.elapsed, distance: witness.context.distance };
  const prediction = new FlightPrediction(), query = new ClearanceHazardCollision(), points = [{ ...state }];
  const hazards = [...witness.context.committed, ...witness.context.candidate.hazards];
  let minPadding = 2, path = 0, xTravel = 0, yTravel = 0, xReversals = 0, yReversals = 0, lastX = 0, lastY = 0;
  const from = { x: 0, y: 0, z: 0 }, to = { x: 0, y: 0, z: 0 };
  for (const run of witness.controls) for (let tick = 0; tick < run.ticks; tick++) {
    const previous = { ...state }; prediction.step(state, run.input);
    const dx = state.x - previous.x, dy = state.y - previous.y;
    path += Math.hypot(dx, dy); xTravel += Math.abs(dx); yTravel += Math.abs(dy);
    const sx = Math.abs(state.vx) > .3 ? Math.sign(state.vx) : 0, sy = Math.abs(state.vy) > .3 ? Math.sign(state.vy) : 0;
    if (sx && lastX && sx !== lastX) xReversals++; if (sx) lastX = sx;
    if (sy && lastY && sy !== lastY) yReversals++; if (sy) lastY = sy;
    for (const h of hazards) {
      const extent = h.radius + CONFIG.ship.radius + minPadding;
      if (h.passDistance + extent < previous.distance || h.passDistance - extent > state.distance) continue;
      from.x = previous.x - h.x; from.y = previous.y - h.y; from.z = h.passDistance - previous.distance;
      to.x = state.x - h.x; to.y = state.y - h.y; to.z = h.passDistance - state.distance;
      if (!query.hit(from, to, h, state.elapsed, CONFIG.step, minPadding)) continue;
      let low = 0, high = minPadding;
      for (let i = 0; i < 12; i++) {
        const middle = (low + high) / 2;
        if (query.hit(from, to, h, state.elapsed, CONFIG.step, middle)) high = middle; else low = middle;
      }
      minPadding = high;
    }
    points.push({ ...state });
  }
  // Remove selected Y controls after the held-input prefix. This is one alternate
  // trace, never a proof that every horizontal route is impossible.
  const noY = []; let elapsedTicks = 0;
  for (const run of witness.controls) for (let tick = 0; tick < run.ticks; tick++) {
    const input = elapsedTicks++ < 54 ? { ...witness.context.input } : { x: run.input.x, y: 0 };
    const last = noY.at(-1);
    if (last && last.input.x === input.x && last.input.y === input.y) last.ticks++;
    else noY.push({ ticks: 1, input });
  }
  const noYResult = complete(beginTrajectoryReplay(witness.context, noY, { margin: witness.margin }));
  return { points, stats: { path, xTravel, yTravel, xReversals, yReversals,
    extraRadiusClearance: minPadding, clearanceCap: 2, clearanceResolution: 2 / 4096,
    noYDecision: noYResult.decision, noYReason: noYResult.reason,
    note: 'Minimum additional player-radius padding causing actual swept-proxy contact, capped at2; numerical binary estimate. Removing Y tests this trace only, not all horizontal routes.' } };
}
