import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const baseline = '5efda476f725df038bfb46ebbf9d65aaec2b646f';
const output = process.env.REVIEW_RESULT_DIR ?? '.cache/review/PHASE-3-004A/final';
await mkdir(output, { recursive: true });
await mkdir('test-results', { recursive: true });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const unchanged = ['src', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json'];
assert.equal(git('diff', baseline, '--', ...unchanged), '', 'Production inputs must remain byte-identical to approved Git blobs');
const productionPaths = git('ls-tree', '-r', '--name-only', baseline, '--', ...unchanged).trim().split('\n');
for (const path of productionPaths) {
  const expected = execFileSync('git', ['show', `${baseline}:${path}`]);
  const actual = await readFile(path);
  // Git checks normalized line endings; browser/build source may use CRLF in this Windows checkout.
  const normalize = bytes => bytes.toString().replaceAll('\r\n', '\n');
  assert.ok(expected.equals(actual) || normalize(expected) === normalize(actual), `Changed production input: ${path}`);
}
const provenance = JSON.parse(await readFile('design/ui-concepts/assets/capture-provenance.json', 'utf8'));
assert.equal(provenance.baseline, baseline);
for (const capture of provenance.captures) for (const file of capture.files) {
  assert.equal(createHash('sha256').update(await readFile(`design/ui-concepts/assets/${file.file}`)).digest('hex'), file.sha256);
}
const server = await createServer({ server: { host: '127.0.0.1', port: 5186, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const shots = [], checks = [], errors = [];
function contrast(foreground, background) {
  const luminance = hex => {
    const c = hex.match(/[a-f0-9]{2}/gi).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
const contrastSamples = [ ['primary/base', '#edf4f5', '#050a14'], ['secondary/base', '#acb9c9', '#050a14'], ['primary/audio', '#edf4f5', '#08111f'], ['secondary/audio', '#acb9c9', '#08111f'], ['action', '#07131c', '#8cdeeb'] ].map(([role, foreground, background]) => ({ role, foreground, background, ratio: contrast(foreground, background) }));
for (const sample of contrastSamples) assert.ok(sample.ratio >= 4.5, `Insufficient solid-surface contrast: ${sample.role}`);
const base = 'http://127.0.0.1:5186/design/ui-concepts/';
async function open(context, url) {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5186/') && !request.url().startsWith('data:')) errors.push(`External request: ${request.url()}`); });
  await page.goto(base + url);
  await page.waitForFunction(() => document.querySelector('#stage')?.dataset.ready === 'true');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.querySelector('#scene-image').complete && document.querySelector('#scene-image').naturalWidth > 0);
  return page;
}
async function capture(page, name) {
  const fullPage = name.startsWith('ui-comparison');
  const bytes = await page.screenshot({ path: `test-results/${name}`, fullPage });
  shots.push({ name, viewport: page.viewportSize(), fullPage, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
async function fit(page, description) {
  const failures = await page.evaluate(() => {
    const barTop = document.querySelector('.review-bar').getBoundingClientRect().top;
    const visible = node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
    const nodes = document.querySelector('#audio').open ? document.querySelectorAll('dialog button, dialog input') : document.querySelectorAll('#interface button');
    return [...nodes].filter(visible).flatMap(node => {
      const box = node.getBoundingClientRect();
      const dialog = node.closest('dialog');
      // Scrollable landscape audio intentionally contains offscreen content.
      const canScroll = dialog && dialog.scrollHeight > dialog.clientHeight;
      return box.width < 44 || box.height < 44 || box.left < 0 || box.right > innerWidth + 1 || (!canScroll && (box.top < 0 || box.bottom > barTop + 1)) ? [{ text: node.textContent || node.ariaLabel, box: box.toJSON() }] : [];
    });
  });
  assert.deepEqual(failures, [], `Clipped or undersized controls: ${description}`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Horizontal overflow: ${description}`);
}
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  for (const concept of ['a', 'b', 'c']) for (const state of ['menu', 'playing', 'paused', 'over']) {
    const page = await open(desktop, `prototype.html?concept=${concept}&state=${state}`);
    await fit(page, `${concept}/${state}`);
    await capture(page, `ui-${concept}-${state}-desktop.png`);
    if (state === 'menu') {
      await page.getByRole('button', { name: 'Launch run' }).click();
      await page.getByRole('button', { name: 'Pause flight' }).click();
      assert.equal(await page.locator('#stage').getAttribute('data-screen'), 'paused');
      await page.getByRole('button', { name: 'Sound settings' }).click();
      assert.equal(await page.locator('#audio').evaluate(node => node.open), true);
      await page.getByRole('slider', { name: 'Music volume' }).focus();
      await page.keyboard.press('End');
      assert.equal(await page.locator('#music-value').textContent(), '100%');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.closest('dialog')?.id), 'audio');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#audio').evaluate(node => node.open), false);
      assert.equal(await page.evaluate(() => document.activeElement.textContent.trim().startsWith('Sound settings')), true);
      await page.keyboard.press('KeyP');
      assert.equal(await page.locator('#stage').getAttribute('data-screen'), 'playing');
      checks.push(`${concept}: launch/pause/audio/slider/Escape/focus-return/P-resume`);
    }
    if (state === 'over') {
      await page.getByRole('button', { name: 'Fly again' }).click();
      assert.equal(await page.locator('#stage').getAttribute('data-screen'), 'playing');
      checks.push(`${concept}: replay preview`);
    }
    await page.close();
  }
  for (const [tier, width, height] of [['portrait', 390, 844], ['landscape', 844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    for (const state of ['menu', 'playing', 'paused', 'over']) {
      const page = await open(context, `prototype.html?concept=a&state=${state}`);
      await fit(page, `a/${state}/${tier}`);
      await capture(page, `ui-a-${state}-${tier}.png`);
      if (state === 'menu') { await page.getByRole('button', { name: 'Launch run' }).tap(); assert.equal(await page.locator('#stage').getAttribute('data-screen'), 'playing'); }
      await page.close();
    }
    const audio = await open(context, 'prototype.html?concept=a&state=paused&audio');
    await fit(audio, `audio/${tier}`);
    await capture(audio, `ui-a-audio-${tier}.png`);
    await audio.getByRole('button', { name: 'Mute sound' }).tap();
    assert.equal(await audio.getByRole('button', { name: 'Unmute sound' }).getAttribute('aria-pressed'), 'true');
    await audio.getByRole('button', { name: 'Close audio settings' }).tap();
    assert.equal(await audio.locator('#audio').evaluate(node => node.open), false);
    checks.push(`${tier}: all four states fit; touch launch; scroll-reachable audio/mute/close`);
    await context.close();
  }
  for (const state of ['hit', 'loading', 'error']) {
    const page = await open(desktop, `prototype.html?concept=a&state=${state}`);
    await fit(page, state);
    await capture(page, `ui-a-${state}-desktop.png`);
    if (state === 'error') { await page.getByRole('button', { name: 'Retry loading' }).click(); assert.equal(await page.locator('#stage').getAttribute('data-screen'), 'menu'); }
    await page.close();
  }
  const audio = await open(desktop, 'prototype.html?concept=a&state=paused&audio');
  await fit(audio, 'desktop audio');
  await capture(audio, 'ui-a-audio-desktop.png');
  await audio.keyboard.press('KeyM');
  assert.equal(await audio.locator('#mute').getAttribute('aria-pressed'), 'true');
  await audio.close();
  // All concepts reserve a central area for the actual ship and hazard approach.
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) for (const concept of width === 1440 ? ['a', 'b', 'c'] : ['a']) {
    const page = await open(desktop, `prototype.html?concept=${concept}&state=playing`);
    await page.setViewportSize({ width, height });
    const overlap = await page.evaluate(() => [...document.querySelectorAll('.hud, .pause-button, .first-hint, .flight-speed')].some(node => {
      const r = node.getBoundingClientRect();
      return r.left < innerWidth * .8 && r.right > innerWidth * .2 && r.top < innerHeight * .8 && r.bottom > innerHeight * .2;
    }));
    assert.equal(overlap, false, `${concept}/${width}: UI overlaps center 60% flight area`);
    await page.close();
  }
  const boardContext = await browser.newContext({ viewport: { width: 1920, height: 1800 }, reducedMotion: 'reduce' });
  for (const [view, name, height] of [['', 'ui-comparison-desktop.png', 2100], ['?view=hud', 'ui-comparison-hud.png', 850], ['?view=mobile', 'ui-comparison-mobile.png', 5100]]) {
    const page = await boardContext.newPage();
    await page.setViewportSize({ width: view.includes('mobile') ? 1400 : 1920, height });
    await page.goto(base + view);
    await page.waitForFunction(() => document.querySelectorAll('iframe').length > 0);
    for (const frame of page.frames().slice(1)) { await frame.waitForFunction(() => document.querySelector('#stage')?.dataset.ready === 'true'); await frame.evaluate(() => document.fonts.ready); }
    await page.evaluate(() => document.fonts.ready);
    await capture(page, name);
    await page.close();
  }
  assert.deepEqual(errors, [], 'Concept console/network errors');
  const build = [];
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await inspect(path);
      else {
        const bytes = await readFile(path);
        assert.ok(!/\.(?:ttf|woff2?)$/.test(path), 'Concept fonts leaked to production');
        if (path.endsWith('.html') || path.endsWith('.js')) assert.ok(!bytes.includes(Buffer.from('UI STUDY')) && !bytes.includes(Buffer.from('ui-concepts')), 'Prototype leaked to production');
        build.push({ path: relative('dist', path).replaceAll('\\', '/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
    }
  }
  await inspect('dist');
  assert.equal(build.length, 11);
  checks.push(`${productionPaths.length} approved production inputs unchanged; 11 production output files; no prototype/font inclusion`, 'central 60% flight area free of HUD in reviewed viewports', 'background capture SHA256 values verified', 'zero concept console/network/external-request errors');
  const result = { baseline, browser: browser.version(), checks, contrastSamples, screenshots: shots, productionFiles: build, limitations: ['Static captures do not verify animated hazard readability.', 'Mobile layouts are Chrome emulation, not physical devices.', 'Only A receives full mobile/audio art-direction review.', 'Subjective owner approval remains pending.'] };
  await writeFile(join(output, 'ui-concepts.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ browser: result.browser, checks, screenshots: shots.map(shot => shot.name), productionBytes: build.reduce((sum, file) => sum + file.bytes, 0) }, null, 2));
} finally { await browser.close(); await server.close(); }
