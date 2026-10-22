import { test, expect, launch, collide, endRun } from './helpers';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

async function inspect(page: Page) {
  return page.evaluate(() => {
    const audio = window.spaceRunner!.audio as unknown as {
      status: string; settings: unknown; context?: AudioContext;
      graph?: import('../../src/audio/graph').AudioGraph;
    };
    return { status: audio.status, settings: audio.settings, context: audio.context?.state ?? null, voices: audio.graph?.voices.size ?? 0, counts: audio.graph ? { ...audio.graph.counts } : null, master: audio.graph?.master.gain.value ?? null, music: audio.graph?.musicBus.gain.value ?? null, sfx: audio.graph?.sfxBus.gain.value ?? null, engine: audio.graph?.engine.output.gain.value ?? null };
  });
}

test('gesture unlock, real output, steering modulation, pause, mute and focus suspension', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    const probe = { contexts: 0, gestures: [] as boolean[] };
    (window as unknown as { audioProbe: typeof probe }).audioProbe = probe;
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options); probe.contexts++; probe.gestures.push(navigator.userActivation.isActive);
      }
    };
  });
  await page.goto('/?debug&seed=42');
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'MENU');
  expect(await page.evaluate(() => (window as unknown as { audioProbe: { contexts: number } }).audioProbe.contexts)).toBe(0);
  expect((await inspect(page)).status).toBe('locked');
  await page.getByRole('button', { name: 'Launch run' }).click();
  await expect.poll(async () => (await inspect(page)).status).toBe('running');
  await page.evaluate(() => {
    const audio = window.spaceRunner!.audio as unknown as { context: AudioContext; graph: { master: GainNode } };
    const analyser = audio.context.createAnalyser(); analyser.fftSize = 2048;
    // Test-only capture of the actual final bus, with one destination path.
    audio.graph.master.disconnect(); audio.graph.master.connect(analyser).connect(audio.context.destination);
    (window as unknown as { audioMeter: AnalyserNode }).audioMeter = analyser;
  });
  const rms = () => page.evaluate(() => {
    const analyser = (window as unknown as { audioMeter: AnalyserNode }).audioMeter;
    const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
    return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
  });
  await expect.poll(rms).toBeGreaterThan(0.001);
  const hz = () => page.evaluate(() => ((window.spaceRunner!.audio as unknown as { graph: { engine: { bass: OscillatorNode } } }).graph.engine.bass.frequency.value));
  const idleHz = await hz();
  await page.keyboard.down('KeyD');
  await expect.poll(hz).toBeGreaterThan(idleHz + 1);
  await page.keyboard.up('KeyD');
  const playingRms = await rms();
  await page.keyboard.press('KeyP');
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
  await expect.poll(rms, { timeout: 4000 }).toBeLessThan(0.00003);
  const pausedRms = await rms();
  await page.getByRole('button', { name: 'Resume flight' }).click();
  await expect.poll(rms).toBeGreaterThan(0.001);
  await page.keyboard.press('KeyM');
  await expect.poll(rms).toBeLessThan(0.00003);
  expect((await inspect(page)).status).toBe('muted');
  await page.keyboard.press('KeyM');
  await expect.poll(rms).toBeGreaterThan(0.001);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
  await expect.poll(async () => (await inspect(page)).context).toBe('suspended');
  await page.getByRole('button', { name: 'Resume flight' }).click();
  await expect.poll(async () => (await inspect(page)).status).toBe('running');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await inspect(page)).context).toBe('suspended');
  await page.evaluate(() => { delete (document as { hidden?: boolean }).hidden; });
  await page.getByRole('button', { name: 'Resume flight' }).click();
  await expect.poll(async () => (await inspect(page)).status).toBe('running');
  const probe = await page.evaluate(() => (window as unknown as { audioProbe: unknown }).audioProbe);
  expect(probe).toEqual({ contexts: 1, gestures: [true] });
  const performance = await page.evaluate(() => {
    const game = window.spaceRunner!;
    const graph = (game.audio as unknown as { graph: { buffers: Map<string, AudioBuffer>; music: AudioBufferSourceNode; engine: { rush: AudioBufferSourceNode } } }).graph;
    const start = window.performance.now();
    for (let i = 0; i < 5000; i++) game.audio.update(game.model);
    const stateSyncCpuMs = (window.performance.now() - start) / 5000;
    const buffers = [graph.music.buffer!, graph.engine.rush.buffer!, ...graph.buffers.values()];
    return { stateSyncCpuMs, cachedPcmBytes: buffers.reduce((sum, buffer) => sum + buffer.length * buffer.numberOfChannels * 4, 0), fixedSources: 4, temporaryVoiceLimit: 6 };
  });
  const evidence = { playingRms, pausedRms, idleHz, probe, performance, final: await inspect(page) };
  if (process.env.REVIEW_RESULT_DIR) await writeFile(join(process.env.REVIEW_RESULT_DIR, 'audio-live.json'), JSON.stringify(evidence, null, 2));
  console.log('Real Web Audio lifecycle:', JSON.stringify(evidence));
});

test('settings route, persist and restore without autoplay; desktop menu and pause UI', async ({ page }) => {
  await page.goto('/?debug&seed=42');
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'MENU');
  await page.getByRole('button', { name: 'Sound settings', exact: true }).click();
  await expect.poll(async () => (await inspect(page)).status).toBe('running');
  for (const [id, value] of [['master', '52'], ['music', '21'], ['sfx', '64']]) {
    await page.locator(`#sound-${id}`).fill(value!);
    await page.locator(`#sound-${id}`).dispatchEvent('change');
  }
  await expect.poll(async () => (await inspect(page)).music).toBeCloseTo(0.21, 3);
  await expect.poll(async () => (await inspect(page)).sfx).toBeCloseTo(0.64, 3);
  await expect.poll(async () => (await inspect(page)).master).toBeCloseTo(0.52 * 0.7, 3);
  await page.screenshot({ path: 'test-results/audio-desktop-settings.png' });
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
  await expect(page.locator('#sound-mute')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  expect((await inspect(page)).context).toBe(null);
  expect((await inspect(page)).settings).toEqual({ master: 0.52, music: 0.21, sfx: 0.64, muted: true });
  await page.getByRole('button', { name: 'Sound settings · muted', exact: true }).click();
  expect((await inspect(page)).context).toBe(null);
  await page.getByRole('button', { name: 'Unmute sound' }).click();
  await expect.poll(async () => (await inspect(page)).status).toBe('running');
  await page.getByRole('button', { name: 'Close sound settings' }).click();
  await page.getByRole('button', { name: 'Launch run' }).click();
  await page.keyboard.press('KeyP');
  await page.getByRole('button', { name: 'Sound settings', exact: true }).click();
  await page.screenshot({ path: 'test-results/audio-pause-settings.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('#sound-settings')).not.toBeVisible();
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
});

test('actual damage emits once, final feedback finishes, five restarts reuse audio and assets', async ({ page }) => {
  const downloads: string[] = [];
  page.on('response', response => { if (response.url().endsWith('.glb')) downloads.push(response.url()); });
  await launch(page);
  await expect.poll(async () => (await inspect(page)).status).toBe('running');
  await page.evaluate(() => {
    const audio = window.spaceRunner!.audio as unknown as { graph: unknown; context: unknown };
    (window as unknown as { retainedAudio: unknown[] }).retainedAudio = [audio.graph, audio.context];
  });
  await collide(page); await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '2');
  await collide(page); await page.waitForTimeout(150);
  expect((await inspect(page)).counts!.impact).toBe(1);
  await endRun(page);
  expect((await inspect(page)).counts!.destruction).toBe(1);
  expect((await inspect(page)).counts!.gameOver).toBe(1);
  await expect.poll(async () => (await inspect(page)).voices).toBe(0);
  for (let run = 0; run < 5; run++) {
    await page.getByRole('button', { name: 'Fly again' }).click();
    expect(await page.evaluate(() => {
      const audio = window.spaceRunner!.audio as unknown as { graph: unknown; context: unknown };
      const retained = (window as unknown as { retainedAudio: unknown[] }).retainedAudio;
      return audio.graph === retained[0] && audio.context === retained[1];
    })).toBe(true);
    expect(downloads).toHaveLength(6);
    await endRun(page);
    expect((await inspect(page)).voices).toBeLessThanOrEqual(6);
  }
  const final = await inspect(page);
  expect(final.counts!.destruction).toBe(6); expect(final.counts!.gameOver).toBe(6); expect(final.counts!.impact).toBe(12);
  console.log('Audio five-restart sample:', JSON.stringify({ ...final, downloads: downloads.length, fixedSources: 4 }));
  if (process.env.REVIEW_RESULT_DIR) await writeFile(join(process.env.REVIEW_RESULT_DIR, 'audio-restarts.json'), JSON.stringify({ ...final, downloads: downloads.length, fixedSources: 4, restarts: 5 }, null, 2));
  await page.evaluate(() => window.spaceRunner!.dispose());
  await expect.poll(async () => (await inspect(page)).context).toBe('closed');
});

for (const failure of ['missing', 'rejected', 'runtime'] as const) test(`silent fallback preserves flight when audio is ${failure}`, async ({ page }) => {
  await page.addInitScript(kind => {
    if (kind === 'missing') Object.defineProperty(window, 'AudioContext', { value: undefined });
    else if (kind === 'rejected') window.AudioContext = class extends window.AudioContext { resume() { return Promise.reject(new DOMException('Intentional blocked-audio fixture', 'NotAllowedError')); } };
  }, failure);
  await launch(page);
  if (failure === 'runtime') {
    await expect.poll(async () => (await inspect(page)).status).toBe('running');
    await page.evaluate(() => {
      const graph = (window.spaceRunner!.audio as unknown as { graph: import('../../src/audio/graph').AudioGraph }).graph;
      graph.engine.update = () => { throw new Error('Intentional runtime audio failure'); };
    });
  }
  await expect.poll(async () => (await inspect(page)).status).toBe(failure === 'rejected' ? 'blocked' : 'unavailable');
  await page.keyboard.down('KeyD');
  await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.ship.x)).toBeGreaterThan(1);
  await page.keyboard.up('KeyD'); await page.keyboard.press('KeyP');
  await page.getByRole('button', { name: 'Sound settings', exact: true }).click();
  // Opening settings is a valid retry gesture after a contained runtime error.
  await expect(page.locator('#sound-status')).toContainText(failure === 'rejected' ? 'blocked' : failure === 'missing' ? 'unavailable' : 'Audio enabled');
  if (failure === 'missing') await page.screenshot({ path: 'test-results/audio-silent-fallback.png' });
});

test('mobile sound controls fit portrait and landscape, remain touch accessible and leave flight paused', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/?debug&seed=42');
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'MENU');
  await page.getByRole('button', { name: 'Sound settings', exact: true }).tap();
  await expect(page.locator('#sound-settings')).toBeVisible();
  await page.screenshot({ path: 'test-results/audio-mobile-portrait.png' });
  const mute = page.getByRole('button', { name: 'Mute sound', exact: true });
  const box = await mute.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);
  await mute.tap();
  await page.getByRole('button', { name: 'Close sound settings' }).tap();
  await page.getByRole('button', { name: 'Launch run' }).tap();
  await page.getByRole('button', { name: 'Pause flight' }).tap();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: 'Sound settings · muted', exact: true }).tap();
  await page.screenshot({ path: 'test-results/audio-mobile-landscape.png' });
  const master = page.getByRole('slider', { name: 'Master volume', exact: true });
  await expect(master).toHaveAccessibleName('Master volume');
  await master.scrollIntoViewIfNeeded();
  const range = await master.boundingBox(); expect(range!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button', { name: 'Close sound settings' }).tap();
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]); await context.close();
});

test('actual OfflineAudioContext rendering produces bounded PCM and original review previews', async ({ page }) => {
  await page.goto('/?debug&seed=42');
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'MENU');
  const captures = await page.evaluate(async () => {
    const { AudioGraph } = await import('/src/audio/graph.ts');
    const { AUDIO } = await import('/src/audio/settings.ts');
    const captures = [];
    for (const mode of ['flight', 'music', 'muted', 'headroom']) {
      const seconds = mode === 'music' ? 16 : mode === 'flight' ? 8 : 3;
      const context = new OfflineAudioContext(2, seconds * AUDIO.sampleRate, AUDIO.sampleRate);
      const graph = new AudioGraph(context, mode === 'headroom' ? { master: 1, music: 1, sfx: 1, muted: false } : AUDIO.defaults);
      graph.setState(mode === 'music' ? 'MENU' : 'PLAYING', 0);
      if (mode === 'flight') {
        graph.engine.update(34, 8, 0, 1); graph.play('launch'); graph.play('impact', 2);
        graph.play('destruction', 4); graph.play('gameOver', 4.55); graph.setState('GAME_OVER', 4);
      }
      if (mode === 'muted') graph.settings({ ...AUDIO.defaults, muted: true }, 1);
      if (mode === 'headroom') for (let i = 0; i < 6; i++) graph.play('destruction', 0.5);
      const buffer = await context.startRendering();
      let peak = 0, sum = 0, tail = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) { peak = Math.max(peak, Math.abs(data[i]!)); sum += data[i]! ** 2; if (i >= AUDIO.sampleRate * 2) tail += data[i]! ** 2; }
      }
      const diagnostics = { mode, sampleRate: buffer.sampleRate, seconds, frames: buffer.length, peak, rms: Math.sqrt(sum / (buffer.length * 2)), tailRms: Math.sqrt(tail / Math.max(1, (buffer.length - AUDIO.sampleRate * 2) * 2)) };
      let wav: string | undefined;
      if (mode === 'flight' || mode === 'music') {
        const data = new ArrayBuffer(44 + buffer.length * 4), view = new DataView(data);
        const word = (at: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i)); };
        word(0, 'RIFF'); view.setUint32(4, data.byteLength - 8, true); word(8, 'WAVE'); word(12, 'fmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, buffer.length * 4, true);
        for (let i = 0; i < buffer.length; i++) for (let channel = 0; channel < 2; channel++) view.setInt16(44 + i * 4 + channel * 2, Math.round(Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]!)) * 32767), true);
        const bytes = new Uint8Array(data); let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
        wav = btoa(binary);
      }
      captures.push({ diagnostics, wav }); graph.dispose();
    }
    return captures;
  });
  const diagnostics = captures.map(item => item.diagnostics);
  for (const capture of captures) {
    expect(capture.diagnostics.peak).toBeGreaterThan(0.001); expect(capture.diagnostics.peak).toBeLessThan(0.95);
    expect(Number.isFinite(capture.diagnostics.rms)).toBe(true);
    if (capture.wav) await writeFile(`test-results/audio-${capture.diagnostics.mode}-preview.wav`, Buffer.from(capture.wav, 'base64'));
  }
  expect(diagnostics.find(item => item.mode === 'muted')!.tailRms).toBeLessThan(0.00001);
  if (process.env.REVIEW_RESULT_DIR) { await mkdir(process.env.REVIEW_RESULT_DIR, { recursive: true }); await writeFile(join(process.env.REVIEW_RESULT_DIR, 'audio-browser.json'), JSON.stringify({ capture: 'Actual native OfflineAudioContext and production synthesis/routing; generated PCM, not a microphone recording or subjective listening test.', diagnostics }, null, 2)); }
  console.log('Native audio render diagnostics:', JSON.stringify(diagnostics));
});
