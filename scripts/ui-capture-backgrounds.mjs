import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Run deliberately to refresh design references, never during review packaging.
// Captures only the actual game canvas, without changing production sources.
const directory = 'design/ui-concepts/assets';
await mkdir(directory, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 5185, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome' });
const captures = [];
async function captureCanvas(page, path) {
  // Locator screenshots clip to the canvas but can include overlapping DOM.
  // Hide only sibling interface layers while capturing, then restore them.
  const style = await page.addStyleTag({ content: '#game > :not(canvas) { visibility: hidden !important; }' });
  try { return await page.locator('#flight').screenshot({ path }); }
  finally { await style.evaluate(node => node.remove()); }
}
try {
  for (const [name, width, height, mobile] of [['desktop', 1440, 900, false], ['portrait', 390, 844, true], ['landscape', 844, 390, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5185/?debug&seed=42');
    await page.waitForFunction(() => window.spaceRunner?.model.state === 'MENU');
    const menu = await captureCanvas(page, `${directory}/${name}-menu.png`);
    await page.getByRole('button', { name: 'Launch run' }).click();
    await page.waitForFunction(() => window.spaceRunner.model.distance >= 150);
    // Freeze the real unsteered route at its actual score. No hazards are injected.
    const state = await page.evaluate(() => {
      const { model } = window.spaceRunner;
      model.pause();
      return { score: model.score, hull: model.hull, speed: model.speed, seed: model.seed,
        hazards: model.field.hazards.filter(h => h.active).length };
    });
    await page.waitForTimeout(100);
    const flight = await captureCanvas(page, `${directory}/${name}-flight.png`);
    if (errors.length) throw new Error(errors.join('\n'));
    captures.push({ name, viewport: { width, height }, ...state,
      files: [ ['menu', menu], ['flight', flight] ].map(([state, bytes]) => ({ file: `${name}-${state}.png`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })) });
    await context.close();
  }
  const manifest = { baseline: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    generatedAt: new Date().toISOString(), browser: browser.version(),
    method: 'Real canvas-only screenshots of the approved game. UI siblings temporarily hidden in the capture browser and immediately restored; no production file edits. Route 42, no steering or injected hazards, frozen after reaching 150 m. Menu has no prior best; results use this recorded score as the sample personal best.', captures };
  await writeFile(`${directory}/capture-provenance.json`, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
} finally { await browser.close(); await server.close(); }
