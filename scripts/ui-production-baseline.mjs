import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readZip } from './zip.mjs';

const baseline = '80f292347109e64c1c20d3b12b447048a89fc7bd';
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== baseline || execFileSync('git', ['diff', baseline, '--', 'src', 'public', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('Capture the approved production baseline before UI changes.');
const directory = '.cache/review/PHASE-3-004B/baseline';
await mkdir(directory, { recursive: true });
const files = [], screenshots = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function measure(path, prefix = '') {
  for (const item of await readdir(path, { withFileTypes: true })) {
    if (item.isDirectory()) await measure(join(path, item.name), `${prefix}${item.name}/`);
    else { const bytes = await readFile(join(path, item.name)); files.push({ path: prefix + item.name, bytes: bytes.length, sha256: hash(bytes), ...(item.name.endsWith('.js') ? { gzipBytes: gzipSync(bytes).length } : {}) }); }
  }
}
await measure('dist');
const approved = readZip(await readFile('review-packages/PHASE-3-004A-review-80f2923.zip'));
for (const state of ['menu', 'playing', 'paused', 'over']) {
  const bytes = approved.get(`screenshots/ui-a-${state}-desktop.png`);
  if (!bytes) throw new Error('Missing approved Concept A screenshot');
  const name = `ui-approved-${state}-desktop.png`;
  await writeFile(join(directory, name), bytes);
  screenshots.push({ name, bytes: bytes.length, sha256: hash(bytes), source: 'Reviewed PHASE-3-004A ZIP / actual Concept A browser render' });
}
const server = await createServer({ server: { host: '127.0.0.1', port: 5188, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [tier, width, height, touch] of [['desktop', 1440, 900, false], ['portrait', 390, 844, true], ['landscape', 844, 390, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function shot(state) {
      const name = `ui-before-${state}-${tier}.png`;
      const bytes = await page.screenshot({ path: join(directory, name) });
      screenshots.push({ name, bytes: bytes.length, sha256: hash(bytes), viewport: { width, height }, state: await page.locator('#game').getAttribute('data-state'), values: await page.evaluate(() => ({ score: window.spaceRunner.model.score, hull: window.spaceRunner.model.hull, seed: window.spaceRunner.model.seed })), source: 'Actual approved production UI; route 42; flight frozen at 150 m; death uses real collision/update path' });
    }
    await page.goto('http://127.0.0.1:5188/?debug&seed=42');
    await page.locator('#launch').waitFor({ state: 'visible' });
    await shot('menu');
    await page.locator('#launch').click();
    await page.waitForFunction(() => window.spaceRunner.model.distance >= 150);
    await page.evaluate(() => window.spaceRunner.loop.stop());
    await shot('playing');
    await page.locator('#pause').click();
    await shot('paused');
    await page.locator('#paused [data-sound-open]').click();
    await shot('audio');
    await page.locator('#sound-close').click();
    await page.locator('#resume').click();
    await page.evaluate(() => {
      const game = window.spaceRunner;
      for (let i = 0; i < 3; i++) {
        game.model.invulnerability = 0;
        Object.assign(game.model.field.hazards.find(hazard => !hazard.active), { active: true, x: game.model.ship.x, y: game.model.ship.y, z: -.3, radius: 1, kind: 0 });
        game.model.step(1 / 120, { x: 0, y: 0 });
      }
      game.syncState(); game.ui.update(game.model); game.world.render(game.model, 0);
    });
    await shot('over');
    if (errors.length) throw new Error(errors.join('\n'));
    await context.close();
  }
  const report = { baseline, browser: browser.version(), generatedAt: new Date().toISOString(), productionBuild: { totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), files }, screenshots };
  await writeFile(join(directory, 'ui-baseline.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ baseline, browser: report.browser, productionBytes: report.productionBuild.totalBytes, screenshots: screenshots.length }, null, 2));
} finally { await browser.close(); await server.close(); }
