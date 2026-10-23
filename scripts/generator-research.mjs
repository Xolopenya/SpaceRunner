// GAMEPLAY-001A: observes the shipped generator; no proposed generator is implemented.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { CONFIG, difficulty } from '../src/config.ts';
import { ObstacleField, corridorTravelBudget } from '../src/core/obstacles.ts';
import { HazardCollision } from '../src/core/hazard-collision.ts';
import { hazardVariant } from '../src/core/hazard-profile.ts';
import { Ship } from '../src/core/ship.ts';

const baseline = 'f1a651e5d2a6079aadf51a31e6ca929e25bf0d31';
const seeds = [0, 1, 2, 3, 7, 11, 23, 42, 64, 127, 255, 1024, 4096, 65535, 2147483647, 4294967295];
const seconds = 600, dt = CONFIG.step;
const output = process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-001A/final';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const productionPaths = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, '--', 'src', 'public', 'tests', 'design', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'playwright.config.ts'], { encoding: 'utf8' }).trim().split('\n');
const protectedInputs = [];
for (const path of productionPaths) {
  const approved = execFileSync('git', ['show', `${baseline}:${path}`]);
  const actual = await readFile(path);
  assert.ok(approved.equals(actual) || (!approved.includes(0) && approved.toString().replaceAll('\r\n', '\n') === actual.toString().replaceAll('\r\n', '\n')), `Protected input changed: ${path}`);
  protectedInputs.push({ path, baselineBlobSha256: digest(approved), comparison: approved.equals(actual) ? 'byte-identical' : 'text-identical after checkout newline normalization' });
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: values.length, min: sorted[0] ?? null, p50: sorted[Math.floor((sorted.length - 1) * .5)] ?? null, p95: sorted[Math.floor((sorted.length - 1) * .95)] ?? null, max: sorted.at(-1) ?? null, mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
}

function observe(seed) {
  const field = new ObstacleField(); field.reset(seed);
  const events = [], waveSlots = new Map(), query = new HazardCollision();
  const hitMasks = new Uint8Array(CONFIG.hazards.capacity), probeContacts = [0, 0, 0];
  const probes = [-2, 0, 2], activeHistogram = new Array(73).fill(0), nearHistogram = new Array(7).fill(0);
  const lowRuns = [], highRuns = [], phases = [{ from: 0, to: 30 }, { from: 30, to: 120 }, { from: 120, to: 600 }].map(p => ({ ...p, distance: 0, hazards: 0, waves: 0 }));
  let elapsed = 0, distance = 0, previousSafe = 0, peakWaves = 0, low = 0, high = 0;
  const from = { x: 0, y: 0, z: 0 }, to = { x: 0, y: 0, z: 0 };
  for (let tick = 0; tick < Math.round(seconds / dt); tick++) {
    elapsed += dt;
    const speed = difficulty(elapsed).speed, travel = speed * dt;
    distance += travel;
    const phase = phases.find(p => elapsed <= p.to + 1e-7 && elapsed > p.from);
    phase.distance += travel;
    const previousCount = field.spawnedWaves;
    field.update(dt, speed, distance, elapsed);
    if (field.spawnedWaves !== previousCount) {
      assert.equal(field.spawnedWaves, previousCount + 1);
      const wave = field.waves.find(item => item.active && item.z === CONFIG.hazards.spawnZ);
      assert.ok(wave); assert.ok(Math.abs(wave.safeX - previousSafe) <= 4);
      previousSafe = wave.safeX;
      const hazards = [];
      let mask = 0;
      field.hazards.forEach((hazard, slot) => {
        if (!hazard.active || hazard.z !== CONFIG.hazards.spawnZ) return;
        hitMasks[slot] = 0;
        const lane = Math.round(hazard.x / 4), row = Math.round(hazard.y / 2.45);
        assert.ok(Math.abs(hazard.x - lane * 4) <= .350000001);
        assert.ok(Math.abs(hazard.y - row * 2.45) <= .150000001);
        assert.ok(hazard.radius >= .65 && hazard.radius <= 1.1);
        assert.ok(Math.abs(hazard.x - wave.safeX) - hazard.radius > 1.5 + .42);
        assert.ok(Math.abs(hazard.x - 2) > hazard.radius + .42 && Math.abs(hazard.x + 2) > hazard.radius + .42);
        mask |= 1 << ((lane + 1) * 3 + row + 1);
        hazards.push({ x: hazard.x, y: hazard.y, radius: hazard.radius, kind: hazard.kind, phase: hazard.phase, spin: hazard.spin, variant: hazardVariant(hazard.kind, hazard.phase) });
      });
      const event = { time: elapsed, distance, centerPassDistance: distance + 108, safeX: wave.safeX, mask, hazards, passTime: null };
      events.push(event); waveSlots.set(wave, event);
      phase.waves++; phase.hazards += hazards.length;
    }
    let active = 0, nearby = 0, activeWaves = 0;
    field.hazards.forEach((hazard, slot) => {
      if (!hazard.active) return;
      active++;
      if (Math.abs(hazard.z) <= 10) nearby++;
      if (Math.abs(hazard.z) > 2) return;
      for (let probe = 0; probe < probes.length; probe++) {
        if (hitMasks[slot] & (1 << probe)) continue;
        from.x = to.x = probes[probe] - hazard.x;
        from.y = to.y = -hazard.y;
        from.z = -(hazard.z - travel); to.z = -hazard.z;
        if (query.hit(from, to, hazard, elapsed, dt)) { hitMasks[slot] |= 1 << probe; probeContacts[probe]++; }
      }
    });
    for (const wave of field.waves) if (wave.active) {
      activeWaves++;
      const event = waveSlots.get(wave);
      if (wave.z >= 0 && event && event.passTime === null) event.passTime = elapsed;
    }
    assert.ok(active <= CONFIG.hazards.capacity && activeWaves <= CONFIG.waves.capacity);
    peakWaves = Math.max(peakWaves, activeWaves);
    activeHistogram[active]++; nearHistogram[nearby]++;
    if (!nearby) low += dt; else if (low) { lowRuns.push(low); low = 0; }
    if (nearby >= 4) high += dt; else if (high) { highRuns.push(high); high = 0; }
  }
  if (low) lowRuns.push(low); if (high) highRuns.push(high);
  assert.equal(probeContacts[0], 0); assert.equal(probeContacts[2], 0);
  assert.ok(events[0].time >= 4 && events[0].time < 4 + dt * 1.01);
  const eventHash = digest(JSON.stringify(events));
  const pool = field.hazards; field.reset(seed);
  assert.equal(field.hazards, pool); assert.ok(field.hazards.every(h => !h.active)); assert.equal(field.spawnedWaves, 0);
  return { seed, distance, eventHash, events, phases, probeContacts, activeHistogram, nearHistogram, peakWaves, lowRuns, highRuns };
}

const start = performance.now();
const runs = seeds.map(observe);
const replay = observe(42);
assert.equal(replay.eventHash, runs.find(run => run.seed === 42).eventHash);
const elapsedMs = performance.now() - start;
const allEvents = runs.flatMap(run => run.events), allHazards = allEvents.flatMap(event => event.hazards);
const passGaps = [], waveSpacing = [], depthSpacing = [], patternCounts = new Map();
let laneChanges = 0, transitions = 0, repeatedPatterns = 0;
for (const run of runs) {
  const depths = run.events.flatMap(event => event.hazards.map(() => event.centerPassDistance));
  for (let i = 1; i < depths.length; i++) depthSpacing.push(depths[i] - depths[i - 1]);
  for (let i = 0; i < run.events.length; i++) {
    const event = run.events[i], previous = run.events[i - 1];
    const key = `${event.safeX}:${event.mask}`;
    patternCounts.set(key, (patternCounts.get(key) ?? 0) + 1);
    if (!previous) continue;
    transitions++;
    if (event.safeX !== previous.safeX) laneChanges++;
    if (event.safeX === previous.safeX && event.mask === previous.mask) repeatedPatterns++;
    waveSpacing.push(event.distance - previous.distance);
    if (event.passTime !== null && previous.passTime !== null && event.hazards.length && previous.hazards.length) passGaps.push(event.passTime - previous.passTime);
  }
}
const phases = [0, 1, 2].map(i => {
  const values = runs.map(run => run.phases[i]);
  const distance = values.reduce((sum, p) => sum + p.distance, 0), hazards = values.reduce((sum, p) => sum + p.hazards, 0);
  return { from: values[0].from, to: values[0].to, distance, hazards, waves: values.reduce((sum, p) => sum + p.waves, 0), hazardsPer100Units: 100 * hazards / distance };
});
function arrival(axis, distance, velocity = 0, initial = 0) {
  const ship = new Ship(); ship[axis] = initial; ship[axis === 'x' ? 'vx' : 'vy'] = velocity;
  for (let tick = 1; tick <= 1200; tick++) {
    ship.update(dt, { x: axis === 'x' ? 1 : 0, y: axis === 'y' ? 1 : 0 });
    if (ship[axis] >= initial + distance) return { axis, distance, initial, initialVelocity: velocity, firstCrossingSeconds: tick * dt, crossingPosition: ship[axis], crossingVelocity: ship[axis === 'x' ? 'vx' : 'vy'] };
  }
  throw new Error('Movement fixture did not arrive');
}
const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
const lowRuns = runs.flatMap(run => run.lowRuns), highRuns = runs.flatMap(run => run.highRuns);
const body = {
  baseline, seeds, secondsPerSeed: seconds, stepSeconds: dt, protectedFiles: productionPaths.length, protectedInputs,
  method: 'Actual ObstacleField.update at the same 120Hz and elapsed/speed/distance order as GameModel; collision-independent 600s stream observation, not natural player run lengths. Stationary probes use the real HazardCollision and count one contact per generated hazard at y=0. No production mutation.',
  summary: {
    waves: allEvents.length, emptyWaves: allEvents.filter(event => !event.hazards.length).length, hazards: allHazards.length, totalDistance, hazardsPer100Units: 100 * allHazards.length / totalDistance,
    hazardsPerMinute: allHazards.length / (seeds.length * seconds / 60), hazardsPerWave: stats(allEvents.map(event => event.hazards.length)),
    adjacentHazardDepthSpacing: stats(depthSpacing), sameDepthNeighborFraction: depthSpacing.filter(value => value === 0).length / depthSpacing.length,
    waveDepthSpacing: stats(waveSpacing), nonemptyAdjacentWavePassGapSeconds: stats(passGaps),
    radius: stats(allHazards.map(h => h.radius)), x: stats(allHazards.map(h => h.x)), y: stats(allHazards.map(h => h.y)),
    peakActiveHazards: Math.max(...runs.map(run => run.activeHistogram.findLastIndex(count => count > 0))), peakActiveWaves: Math.max(...runs.map(run => run.peakWaves)),
    noNearbySlabFraction: runs.reduce((sum, run) => sum + run.nearHistogram[0], 0) / (seeds.length * seconds / dt),
    noNearbySlabRunSeconds: stats(lowRuns), fourOrMoreNearbyRunSeconds: stats(highRuns),
    corridorChangeFraction: laneChanges / transitions, mandatoryVerticalCorridorChanges: 0,
    coarsePatternConsecutiveRepeatFraction: repeatedPatterns / transitions,
    coarsePatterns: [...patternCounts.entries()].sort((a, b) => b[1] - a[1]),
    variantCounts: [0, 1, 2, 3, 4].map(variant => allHazards.filter(h => h.variant === variant).length),
    laneCounts: [-1, 0, 1].map(lane => allHazards.filter(h => Math.round(h.x / 4) === lane).length),
    rowCounts: [-1, 0, 1].map(row => allHazards.filter(h => Math.round(h.y / 2.45) === row).length),
    stationaryProbeContacts: [-2, 0, 2].map((x, i) => ({ x, y: 0, contacts: runs.reduce((sum, run) => sum + run.probeContacts[i], 0) })),
  },
  phases,
  perSeed: runs.map(({ events, lowRuns, highRuns, ...run }) => ({ ...run, waves: events.length, hazards: events.reduce((sum, event) => sum + event.hazards.length, 0) })),
  movement: { firstCrossings: [arrival('x', 4), arrival('x', 8, 0, -4), arrival('x', 4, -8), arrival('y', 2.45)], oldCorridorBudgetSeconds: corridorTravelBudget(), minimumWaveIntervalSeconds: 60 / 34, analyticSingleAxisRestToRestSeconds: { fourUnits: .25 + (4 - 1 - 1.28) / 8 + .32, eightUnits: .25 + (8 - 1 - 1.28) / 8 + .32, verticalFullSpan: .25 + (7.2 - 1 - 1.28) / 8 + .32 }, asymptoticSamples: [120, 600, 3600, 86400].map(t => ({ elapsed: t, ...difficulty(t) })) },
  reproducibility: { seed42ReplayHash: replay.eventHash, restartPoolIdentity: 'passed', spawnRanges: 'passed', oldCorridorClearance: 'passed', permanentX2Clearance: 'passed', activeLimits: 'passed' },
  measurement: { elapsedMs, node: process.version, platform: process.platform, architecture: process.arch, note: 'Wall time includes one seed replay and diagnostic assertions; not a new-validator, browser-frame or phone benchmark.' },
  limitations: ['Nearby means any active center in the axial slab -10<=z<=10, regardless of XY; this is not subjective danger.', 'Low-density runs include initial warmup and a right-censored final run; high-density means >=4 in that slab.', 'Corridor changes count metadata choices, not mandatory steering. No vertical corridor requirement exists.', 'Pattern repeats use safeX plus a 9-cell occupancy mask, ignoring continuous jitter/radius/rotation.', 'No proposed generator or reachability validator is implemented or benchmarked. Human reaction/readability, clearance preference and playtest fun remain unmeasured.'],
  conclusions: ['Every nonempty wave is a single obstacle center plane.', 'Uniform X-band gaps admit permanently safe x=-2 and x=+2 trajectories under the actual collision outer limit.', 'Recommend a bounded hybrid distance stream with jointly validated stateful trajectories, subject to independent architecture approval.'],
};
await mkdir(output, { recursive: true }); await mkdir('test-results', { recursive: true });
await writeFile(`${output}/generator-baseline.json`, JSON.stringify(body, null, 2) + '\n');
await writeFile(`${output}/generator-seed42-events.json`, JSON.stringify(runs.find(run => run.seed === 42).events, null, 2) + '\n');

const header = (title, subtitle) => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="520" viewBox="0 0 1280 520"><style>text{font-family:Arial,sans-serif;fill:#e8f1f5} .muted{fill:#acb9c9;font-size:16px} .grid{stroke:#344354;stroke-width:1}</style><rect width="1280" height="520" fill="#08111f"/><text x="44" y="48" font-size="27">${title}</text><text x="44" y="78" class="muted">${subtitle}</text>`;
const axes = () => `<path d="M90 120V420H1220" class="grid" fill="none"/>${[-6,-4,-2,0,2,4,6].map(x => `<text x="50" y="${274-x*23}" class="muted">${x}</text><path d="M90 ${270-x*23}H1220" class="grid"/>`).join('')}${[0,60,120,180,240,300,360].map(d => `<text x="${93+d*3}" y="441" class="muted">${d}</text>`).join('')}<text x="90" y="465" class="muted">Relative pass depth / world units →</text><text x="44" y="108" class="muted">X</text>`;
const dot = (depth, x, radius, color = '#8cdeeb') => `<circle cx="${100 + depth * 3}" cy="${270 - x * 23}" r="${radius * 7}" fill="${color}" opacity=".9"/>`;
const firstEvents = runs.find(run => run.seed === 42).events.slice(0, 6);
const currentSvg = header('Measured current field / seed 42 / first six waves', 'Actual production generator output. X versus relative center-pass depth; Y and rotation are not shown.') + axes() + firstEvents.flatMap(e => e.hazards.map(h => dot(e.centerPassDistance-firstEvents[0].centerPassDistance, h.x, h.radius))).join('') + `<text x="90" y="495" class="muted">Dots in each wave share depth. Permanent clear stripes at X = −2 and +2 are a source-derived invariant.</text></svg>`;
const illustrative = [[0,-3,.8],[13,2,.9],[31,4,1],[44,-1,.7],[62,-4,1],[83,1,.9],[96,3,1.1],[119,-2,.8],[140,4,.9],[158,-4,1],[176,1,.8],[194,3,1],[213,-1,.7],[237,-3,1],[255,2,.8],[277,4,.9],[294,-2,1],[321,1,.8],[344,-4,.9]];
const conceptSvg = header('Concept only / continuous depth distribution', 'Hand-positioned illustration, not generated output, implemented gameplay or a fairness certificate.') + axes() + illustrative.map(([d,x,r]) => dot(d,x,r)).join('') + `<text x="90" y="495" class="muted">The proposed stream uses independent depths and full XY placement; final counts and safety require GAMEPLAY-001B.</text></svg>`;
const safetySvg = header('Concept only / position + velocity through overlapping collision windows', 'A continuous gap is insufficient: validate a realizable trajectory and a safe continuation across segment seams.') + `<path d="M90 420H1210M90 420V125" class="grid"/><text x="90" y="465" class="muted">Future time →</text><text x="45" y="118" class="muted">X</text><rect x="360" y="120" width="130" height="210" fill="#ffb17b" opacity=".28"/><rect x="660" y="240" width="140" height="180" fill="#ffb17b" opacity=".28"/><path d="M90 300C200 310 250 380 400 365S550 160 640 170S850 160 1020 240" stroke="#8cdeeb" stroke-width="6" fill="none"/><path d="M1020 240H1210" stroke="#8cdeeb" stroke-width="5" stroke-dasharray="9 7"/><text x="250" y="112" class="muted">Committed occupancy + candidate occupancy</text><text x="900" y="130" class="muted">Certified empty tail</text><text x="90" y="495" class="muted">Schematic 2D slice only. Real checks require X,Y,Vx,Vy, simulation time and rotating 3D logical proxies.</text></svg>`;
const patternRows = [
  ['Scattered field / X-depth slice', [[0,-2],[1,2],[2,-1],[3,3],[4,-3],[5,1]]],
  ['Narrowing passage / X-depth slice', [[0,-4],[1,4],[2,-3],[3,3],[4,-2],[5,2]]],
  ['Alternating avoidance / X-depth slice', [[0,-2],[1,-1],[2,2],[3,1],[4,-2],[5,-1]]],
  ['Vertical weave / Y-depth slice', [[0,-2],[1,-1],[2,2],[3,1],[4,-2],[5,0]]],
];
const patternsSvg = header('Concept only / four encounter intents', 'Hand-positioned slices. Dots omit other dimensions and do not establish forced maneuvers or certified clearance.') + patternRows.map(([label, points], i) => {
  const left = 70 + (i % 2) * 600, top = 145 + Math.floor(i / 2) * 160;
  return `<text x="${left}" y="${top-15}" font-size="18">${label}</text><path d="M${left} ${top}V${top+105}H${left+520}" class="grid" fill="none"/>` + points.map(([d, p]) => `<circle cx="${left+40+d*84}" cy="${top+52-p*10}" r="9" fill="#8cdeeb"/>`).join('');
}).join('') + `<text x="70" y="495" class="muted">Future candidates must be checked jointly with ambient objects, current velocity, prior obstacles and the reserved tail.</text></svg>`;
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 520 } });
  for (const [name, svg] of [['gameplay-current-depth.png', currentSvg], ['gameplay-continuous-concept.png', conceptSvg], ['gameplay-reachability-concept.png', safetySvg], ['gameplay-pattern-concepts.png', patternsSvg]]) {
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    await page.screenshot({ path: `test-results/${name}` });
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ baseline, protectedFiles: productionPaths.length, seeds, secondsPerSeed: seconds, ...body.summary, phases, movement: body.movement, measurement: body.measurement }, null, 2));
