import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { readFile, readdir, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const baseline = '80f292347109e64c1c20d3b12b447048a89fc7bd';
const baselineDirectory = '.cache/review/PHASE-3-004B/baseline';
const directory = process.env.REVIEW_RESULT_DIR ?? '.cache/review/PHASE-3-004B/final';
await mkdir(directory, { recursive: true });
const before = JSON.parse(await readFile(join(baselineDirectory, 'ui-baseline.json'), 'utf8'));
assert.equal(before.baseline, baseline);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const protectedPaths = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, '--', 'src', 'public', 'design', 'tests', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n').filter(path => !['src/ui.ts', 'src/styles.css'].includes(path));
for (const path of protectedPaths) {
  const approved = execFileSync('git', ['show', `${baseline}:${path}`]);
  const actual = await readFile(path);
  assert.ok(approved.equals(actual) || approved.toString().replaceAll('\r\n', '\n') === actual.toString().replaceAll('\r\n', '\n'), `Protected gameplay/audio/rendering/reference/test input changed: ${path}`);
}
const fontSources = JSON.parse(await readFile('design/ui-concepts/assets/fonts/sources.json', 'utf8'));
const fonts = [];
for (const name of ['oxanium-medium.ttf', 'ibm-plex-mono-regular.ttf', 'OFL-Oxanium.txt', 'OFL-IBM-Plex-Mono.txt']) {
  const source = fontSources.files.find(file => file.Name === name);
  const bytes = await readFile(`public/assets/fonts/${name}`);
  assert.equal(hash(bytes), source.sha256);
  fonts.push({ file: `public/assets/fonts/${name}`, bytes: bytes.length, sha256: hash(bytes), author: source.author, source: source.Url, license: source.license });
}
const currentNames = [];
for (const tier of ['desktop', 'portrait', 'landscape']) for (const state of ['menu', 'playing', 'paused', 'over', 'audio']) currentNames.push(`ui-live-${state}-${tier}.png`);
currentNames.push('ui-live-damage-desktop.png', 'ui-live-large-score-desktop.png', 'ui-live-large-score-portrait.png', 'ui-live-loading-desktop.png', 'ui-live-error-desktop.png', 'ui-live-safe-area-portrait.png', 'ui-live-production-preview.png');
for (const image of before.screenshots) {
  const bytes = await readFile(join(baselineDirectory, image.name));
  assert.equal(hash(bytes), image.sha256);
  await copyFile(join(baselineDirectory, image.name), `test-results/${image.name}`);
}
const browser = await chromium.launch({ channel: 'chrome' });
const server = await createServer({ server: { host: '127.0.0.1', port: 5189, strictPort: true } });
await server.listen();
let cachedUi;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:5189/?debug&seed=42');
  await page.locator('#launch').click();
  cachedUi = await page.evaluate(() => {
    const game = window.spaceRunner;
    game.loop.stop(); game.ui.update(game.model);
    const root = document.getElementById('game');
    const count = root.querySelectorAll('*').length;
    const observer = new MutationObserver(() => {});
    observer.observe(root, { subtree: true, attributes: true, childList: true, characterData: true });
    const start = performance.now();
    for (let i = 0; i < 5000; i++) game.ui.update(game.model);
    const averageMs = (performance.now() - start) / 5000;
    const mutations = observer.takeRecords().length; observer.disconnect();
    return { calls: 5000, averageMs, mutations, nodesBefore: count, nodesAfter: root.querySelectorAll('*').length, method: 'Synchronous cached-frame HUD update microbenchmark; excludes changing score, audio and rendering; not an end-to-end frame-time measurement.' };
  });
  assert.equal(cachedUi.mutations, 0);
  assert.equal(cachedUi.nodesBefore, cachedUi.nodesAfter);
  async function imageTag(name) { return `<img alt="${name}" src="data:image/png;base64,${(await readFile(`test-results/${name}`)).toString('base64')}">`; }
  async function board(name, title, columns, rows) {
    const cards = [];
    for (const row of rows) for (const [label, image] of row) cards.push(`<article><h2>${label}</h2>${await imageTag(image)}</article>`);
    await page.setViewportSize({ width: columns === 3 ? 1920 : 1280, height: 1000 });
    await page.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#09101c;color:#e9f1f5;font:14px/1.6 Arial}h1{font-size:32px;margin:0 0 12px}p{color:#acb9c9;margin:0 0 28px}.grid{display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:28px 20px}h2{font-size:16px;font-weight:400;margin:0 0 10px}img{width:100%;display:block}article{min-width:0}</style></head><body><h1>${title}</h1><p>PHASE-3-004B · Approved source baseline ${baseline.slice(0, 7)} · actual browser screenshots. Old UI and production use the live game; the approved study uses its recorded capture. Gameplay timing and focus rings can differ.</p><div class="grid">${cards.join('')}</div></body></html>`);
    await page.locator('img').evaluateAll(nodes => Promise.all(nodes.map(node => node.decode())));
    await page.screenshot({ path: `test-results/${name}`, fullPage: true });
  }
  await board('ui-production-comparison-desktop.png', 'From approved direction to playable interface', 3, ['menu', 'playing', 'paused', 'over'].map(state => [[`Before / ${state}`, `ui-before-${state}-desktop.png`], [`Approved Concept A / ${state}`, `ui-approved-${state}-desktop.png`], [`Production / ${state}`, `ui-live-${state}-desktop.png`]]));
  await board('ui-production-comparison-mobile.png', 'Mobile interface before and after', 2, [['portrait', 'menu'], ['portrait', 'playing'], ['landscape', 'menu'], ['landscape', 'playing']].map(([tier, state]) => [[`Before / ${tier} / ${state}`, `ui-before-${state}-${tier}.png`], [`Production / ${tier} / ${state}`, `ui-live-${state}-${tier}.png`]]));
} finally { await browser.close(); await server.close(); }
const screenshots = [];
for (const name of [...currentNames, ...before.screenshots.map(image => image.name), 'ui-production-comparison-desktop.png', 'ui-production-comparison-mobile.png']) {
  const bytes = await readFile(`test-results/${name}`);
  assert.equal(bytes.toString('hex', 0, 8), '89504e470d0a1a0a');
  screenshots.push({ name, bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256: hash(bytes) });
}
const files = [];
async function measure(path, prefix = '') {
  for (const item of await readdir(path, { withFileTypes: true })) {
    if (item.isDirectory()) await measure(join(path, item.name), prefix + item.name + '/');
    else {
      const bytes = await readFile(join(path, item.name));
      const name = prefix + item.name;
      assert.ok(!/\.(png|wav|woff2)$/.test(name), `Unapproved production media: ${name}`);
      assert.ok(!/ui-concepts|review|prototype/.test(name));
      if (name.endsWith('.js') || name.endsWith('.html')) assert.ok(!bytes.includes(Buffer.from('UI STUDY')) && !bytes.includes(Buffer.from('review-bar')));
      files.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
    }
  }
}
await measure('dist');
assert.equal(files.filter(file => file.path.endsWith('.ttf')).length, 2);
const afterBytes = files.reduce((sum, file) => sum + file.bytes, 0);
const result = { baseline, generatedAt: new Date().toISOString(), protectedFiles: protectedPaths.length, fonts, screenshots, cachedUi, productionBuild: { beforeBytes: before.productionBuild.totalBytes, afterBytes, deltaBytes: afterBytes - before.productionBuild.totalBytes, files }, limitations: ['Chrome/mobile emulation and native safe-area override, not physical devices.', 'Long-distance fixtures assign real model distance for layout verification; no gameplay tuning.', 'Static comparisons do not establish subjective player preference.'] };
await writeFile(join(directory, 'ui-production.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ protectedFiles: protectedPaths.length, screenshots: screenshots.length, cachedUi, beforeBytes: result.productionBuild.beforeBytes, afterBytes, deltaBytes: result.productionBuild.deltaBytes }, null, 2));
