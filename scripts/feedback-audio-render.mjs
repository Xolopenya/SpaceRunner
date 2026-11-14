import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from './release-browser-lib.mjs';

// Actual production AudioGraph in Chromium's OfflineAudioContext, never replacement synthesis.
const mode = process.argv[2] ?? 'final';
const root = resolve('.cache/review/FEEDBACK-001C');
const output = resolve(root, mode, 'audio');
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5195', '--strictPort'],
  { cwd: mode === 'baseline' ? resolve(root, 'baseline-source') : process.cwd(), stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const receipts = [];
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5195/')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  const page = await browser.newPage();
  await page.route('**/__audio_review__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Native audio review</title>'}));
  await page.goto('http://127.0.0.1:5195/__audio_review__');
  const examples = mode === 'baseline' ? [['flight', 12], ['music', 32], ['collisions', 12]]
    : [['flight', 18], ['music', 180], ['adaptive', 64], ['collisions', 24], ['destruction', 8], ['lifecycle', 16], ['headroom', 5]];
  for (const [name, seconds] of examples) {
    const result = await page.evaluate(async ({ name, seconds }) => {
      const { AudioGraph } = await import('/src/audio/graph.ts');
      const { AUDIO } = await import('/src/audio/settings.ts');
      const context = new OfflineAudioContext(2, seconds * AUDIO.sampleRate, AUDIO.sampleRate);
      const settings = { ...AUDIO.defaults, ...(name === 'music' || name === 'adaptive' ? { music: .8, sfx: 0 } : {}) };
      const before = performance.now(), graph = new AudioGraph(context, settings);
      const initializationMs = performance.now() - before;
      const events = new Map();
      const schedule = (at, fn) => { const group=events.get(at) ?? []; group.push(fn); events.set(at,group); };
      const cue = (kind, at, options) => schedule(at,()=>graph.play(kind,0,options));
      graph.setState('PLAYING', 0);
      graph.engine.update(name==='headroom' ? 34 : 20, name==='headroom' ? 8 : 0, 0, 0);
      if (name === 'flight') {
        graph.engine.update(28, 0, 0, 4); graph.engine.update(28, 7, -2, 7);
        graph.engine.update(28, -7, 3, 10); graph.engine.update(34, 0, 0, 13);
      }
      if (name === 'music' || name === 'adaptive') {
        graph.setPacing?.('regular', 0);
        for (const [state, at] of [['rising', 12], ['high', 24], ['recovery', 40], ['regular', 52]]) graph.setPacing?.(state, at);
        if (name === 'music') for (const [state, at] of [['rising', 72], ['high', 88], ['recovery', 112], ['regular', 128], ['high', 148], ['recovery', 168]]) graph.setPacing?.(state, at);
      }
      if (name === 'collisions') {
        graph.setState('MENU',0); // Isolated family audition; live files retain the full mix.
        const kinds = 'setPacing' in graph ? ['rock1','rock2','rock3','metal1','metal2','metal3','station1','station2','station3','mine1','mine2','mine3','pickup','pickup2','pickup3','crackle'] : ['impact','impact','impact','pickup','destruction'];
        graph.settings({ ...settings, music: 0 }, 0);
        kinds.forEach((kind, i) => cue(kind, .5 + i * 1.4));
      }
      if (name === 'destruction') {
        cue('destruction', 1); cue('rupture', 1.5);
        cue('secondary', 1.6); cue('secondary', 1.75); cue('secondary', 1.92);
        schedule(1,()=>graph.setState('GAME_OVER')); cue('gameOver', 3.05);
      }
      if (name === 'lifecycle') {
        cue('pickup', 2); cue('crackle', 4, {gain:.35,rate:1}); cue('crackle', 6, {gain:.65,rate:1});
        schedule(8,()=>graph.setState('PAUSED')); schedule(10,()=>graph.setState('PLAYING'));
        graph.settings({ ...settings, muted: true }, 12); graph.settings(settings, 14);
      }
      if (name === 'headroom') {
        graph.settings({ master: 1, music: 1, sfx: 1, muted: false }, 0);
        graph.setPacing('high',0);
        for (let i = 0; i < AUDIO.maxVoices; i++) cue('destruction', 2);
      }
      const suspensions=[...events].sort((a,b)=>a[0]-b[0]).map(([at,actions])=>context.suspend(at).then(()=>{ actions.forEach(fn=>fn()); return context.resume(); }));
      const rendering=context.startRendering(); await Promise.all(suspensions);
      const pcm = await rendering;
      let peak = 0, energy = 0, clipped = 0;
      const windows = [];
      for (let from = 0; from < pcm.length; from += AUDIO.sampleRate) {
        let sum = 0, maximum = 0;
        const to = Math.min(pcm.length, from + AUDIO.sampleRate);
        for (let c = 0; c < pcm.numberOfChannels; c++) for (let i = from; i < to; i++) {
          const s = pcm.getChannelData(c)[i]; sum += s*s; maximum = Math.max(maximum, Math.abs(s)); if (Math.abs(s) >= 1) clipped++;
        }
        energy += sum; peak = Math.max(peak, maximum);
        windows.push({ second: from / AUDIO.sampleRate, rms: Math.sqrt(sum / ((to-from)*2)), peak: maximum });
      }
      const bytes = new Uint8Array(44 + pcm.length * 4), view = new DataView(bytes.buffer);
      const text = (at, value) => [...value].forEach((c, i) => view.setUint8(at+i, c.charCodeAt(0)));
      text(0,'RIFF'); view.setUint32(4, bytes.length-8, true); text(8,'WAVE'); text(12,'fmt '); view.setUint32(16,16,true);
      view.setUint16(20,1,true); view.setUint16(22,2,true); view.setUint32(24,AUDIO.sampleRate,true);
      view.setUint32(28,AUDIO.sampleRate*4,true); view.setUint16(32,4,true); view.setUint16(34,16,true); text(36,'data'); view.setUint32(40,pcm.length*4,true);
      for (let i=0;i<pcm.length;i++) for(let c=0;c<2;c++) view.setInt16(44+(i*2+c)*2, Math.max(-1,Math.min(1,pcm.getChannelData(c)[i]))*32767,true);
      let binary=''; for(let i=0;i<bytes.length;i+=16384) binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
      graph.dispose();
      return { wav: btoa(binary), metrics: { name, seconds, initializationMs, sampleRate: AUDIO.sampleRate, peak, rms: Math.sqrt(energy/(pcm.length*2)), clipped, windows } };
    }, { name, seconds });
    await writeFile(resolve(output, `${name}.wav`), Buffer.from(result.wav, 'base64'));
    receipts.push(result.metrics); console.log(mode, name, result.metrics.peak.toFixed(4), result.metrics.initializationMs.toFixed(1), 'ms');
  }
  await writeFile(resolve(output,'renders.json'), JSON.stringify({ mode, method: 'Native Chromium OfflineAudioContext; actual AudioGraph and cached production synthesis. Scripted presentation inputs, not a live flight recording.', browser: browser.version(), receipts },null,2));
} finally { await browser.close(); server.kill(); }
