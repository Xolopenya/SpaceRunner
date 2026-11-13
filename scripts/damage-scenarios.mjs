import { mkdir, writeFile } from 'node:fs/promises';
import { IntegratedModel } from '../src/integrated/model.ts';
import { CONFIG } from '../src/config.ts';
import { PROFILES } from '../src/experiments/structure-variants/profile.ts';
import { collisionFamily } from '../src/feedback/collision-presentation.ts';
import { certifiedInput } from '../tests/fixtures/fragment-flight.ts';

const out = '.cache/review/FEEDBACK-001B'; await mkdir(out, { recursive: true });
const scenarios = [];
for (const family of ['rock', 'metal', 'mine', 'station', 'death']) {
  let found;
  for (const seed of [42, 0, 11, 7, 100]) {
    const m = new IntegratedModel(), inputs = [], hits = []; let tick = 0, target, restUntil = 0;
    m.events.on('obstacle.collision', event => { hits.push({ tick, ...event }); target = undefined; restUntil = tick + 225; });
    m.ready(); m.start(seed); m.events.flush();
    for (; tick < 12000 && m.state === 'PLAYING'; tick++) {
      if (tick % 2 === 0) m.beginPlanningFrame();
      if (tick >= restUntil && (!target || !target.active)) target = m.field.slots.filter(h => h.active && h.z < -3 && h.z > -85
        && (family === 'death' || collisionFamily(h.kind) === family)).sort((a, b) => b.z - a.z)[0];
      let input = certifiedInput(m);
      if (target?.active && tick >= restUntil) {
        let x = target.x, y = target.y;
        if (collisionFamily(target.kind) === 'station') {
          const boxes = PROFILES[target.kind - 4]?.boxes ?? [];
          const goals = boxes.map(b => ({ x: Math.max(-5.4, Math.min(5.4, target.x + b.center.x)),
            y: Math.max(-2.8, Math.min(2.8, target.y + b.center.y)) }));
          goals.sort((a, b) => Math.hypot(a.x - m.ship.x, a.y - m.ship.y) - Math.hypot(b.x - m.ship.x, b.y - m.ship.y));
          if (goals[0]) ({ x, y } = goals[0]);
        }
        input = { x: Math.max(-1, Math.min(1, (x - m.ship.x) * 2.1 - m.ship.vx * .65)),
          y: Math.max(-1, Math.min(1, (y - m.ship.y) * 2.1 - m.ship.vy * .65)) };
      }
      inputs.push({ ...input }); m.step(CONFIG.step, input); m.events.flush();
      if (tick % 2) m.finishPlanningFrame(1 / 60);
      if (family !== 'death' && hits.some(h => collisionFamily(h.obstacleKind) === family)) break;
    }
    const wanted = family === 'death' ? m.hull === 0 : hits.some(h => collisionFamily(h.obstacleKind) === family);
    console.log(family, seed, tick, m.distance.toFixed(1), m.hull, hits.map(h => `${h.obstacleKind}:${h.obstacleId}`).join(','));
    if (wanted) found = { name: family, seed, inputs, hits, endTick: inputs.length, hull: m.hull, distance: m.distance };
    m.dispose(); if (found) break;
  }
  if (!found) throw Error(`No natural accepted ${family} collision found within the bounded corpus`);
  scenarios.push(found);
}
await writeFile(`${out}/scenarios.json`, JSON.stringify({ method: 'Actual IntegratedModel, original field/publication/CCD, two fixed steps per planning/render interval. Pilot steers into already published hazards. No inserted entities, health edits, cooldown edits or generator changes.', scenarios }));
