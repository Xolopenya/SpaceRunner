import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO, AudioSettingsStorage, masterGain, normalizeSettings } from '../src/audio/settings.ts';
import { AudioManager } from '../src/audio/audio-manager.ts';
import { musicSamples, SOUNDS, soundSamples } from '../src/audio/synthesis.ts';

class Parameter {
  value = 0;
  setTargetAtTime(value: number) { this.value = value; return this; }
  cancelScheduledValues() { return this; }
}

class Node {
  gain = new Parameter(); frequency = new Parameter(); Q = new Parameter();
  threshold = new Parameter(); knee = new Parameter(); ratio = new Parameter(); attack = new Parameter(); release = new Parameter();
  type = ''; loop = false; buffer: unknown = null; onended: (() => void) | null = null;
  connected = false;
  private owner: Context;
  constructor(owner: Context) { this.owner = owner; }
  connect(node: Node) { this.connected = true; return node; }
  disconnect() { this.connected = false; }
  start() { this.owner.sources.add(this); this.owner.starts++; }
  stop() { this.owner.sources.delete(this); }
  finish() { this.owner.sources.delete(this); this.onended?.(); }
}

class Context {
  state = 'suspended'; currentTime = 0; starts = 0; resumes = 0;
  readonly sources = new Set<Node>();
  readonly nodes: Node[] = [];
  readonly destination = new Node(this);
  resumeAction?: () => Promise<void>;
  createGain() { const node = new Node(this); this.nodes.push(node); return node; }
  createOscillator() { return this.createGain(); }
  createBufferSource() { return this.createGain(); }
  createBiquadFilter() { return this.createGain(); }
  createDynamicsCompressor() { return this.createGain(); }
  createBuffer(channels: number, length: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: (index: number) => data[index]! };
  }
  async resume() { this.resumes++; if (this.resumeAction) await this.resumeAction(); if (this.state !== 'closed') this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; this.sources.clear(); }
}

const storage = () => new AudioSettingsStorage(() => ({ getItem: () => null, setItem: () => {} }));
const frame = () => ({ state: 'PLAYING', speed: 20, ship: { vx: 0, vy: 0 }, hitSerial: 0, hull: 3 });
const graph = (manager: AudioManager) => (manager as unknown as { graph: import('../src/audio/graph.ts').AudioGraph }).graph;

test('audio defaults, clamping, mute and gain headroom are safe', () => {
  assert.deepEqual(normalizeSettings(null), AUDIO.defaults);
  assert.deepEqual(normalizeSettings({ master: -1, music: 3, sfx: NaN, muted: 'yes' }), { master: 0, music: 1, sfx: 0.75, muted: false });
  assert.equal(masterGain({ ...AUDIO.defaults, muted: true }), 0);
  assert.equal(masterGain({ ...AUDIO.defaults, master: 1 }), AUDIO.headroom);
});

test('audio preferences persist independently and tolerate corrupt/denied/quota storage', () => {
  const data = new Map<string, string>([['space-runner.best.v1', '99']]);
  const store = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const first = new AudioSettingsStorage(() => store);
  first.save({ master: 0.2, music: 0.1, sfx: 0.6, muted: true });
  assert.deepEqual(new AudioSettingsStorage(() => store).settings, first.settings);
  assert.equal(data.get('space-runner.best.v1'), '99');
  for (const value of ['{', 'null', 'false', '"text"', '{"master":"loud","music":null}']) {
    assert.deepEqual(new AudioSettingsStorage(() => ({ getItem: () => value, setItem: () => {} })).settings, AUDIO.defaults);
  }
  const denied = new AudioSettingsStorage(() => { throw new Error('denied'); });
  denied.save({ ...AUDIO.defaults, muted: true });
  assert.equal(denied.settings.muted, true);
  const quota = new AudioSettingsStorage(() => ({ getItem: () => null, setItem: () => { throw new Error('quota'); } }));
  quota.save({ ...AUDIO.defaults, music: 0.1 });
  assert.equal(quota.settings.music, 0.1);
});

test('no context before gesture; unlock and restarts reuse one engine/music graph', async () => {
  const context = new Context(); let created = 0;
  const audio = new AudioManager(storage(), () => { created++; return context as unknown as AudioContext; });
  const model = frame(); audio.update(model);
  assert.equal(created, 0); assert.equal(audio.status, 'locked');
  await Promise.all([audio.unlock(), audio.unlock()]);
  assert.equal(created, 1); assert.equal(context.resumes, 1); assert.equal(context.starts, 4);
  const identity = graph(audio);
  for (let run = 0; run < 10; run++) { audio.resetRun(); audio.update(model); await audio.unlock(); }
  assert.equal(graph(audio), identity); assert.equal(context.starts, 4); assert.equal(created, 1);
  audio.dispose(); audio.dispose();
  assert.equal(audio.status, 'disposed'); assert.equal(context.state, 'closed'); assert.equal(context.sources.size, 0);
  assert.ok(context.nodes.every(node => !node.connected));
});

test('mute and individual volumes route to the intended buses', async () => {
  const audio = new AudioManager(storage(), () => new Context() as unknown as AudioContext);
  audio.update(frame()); await audio.unlock();
  audio.setSettings({ master: 0.5, music: 0.2, sfx: 0.9 });
  assert.equal(graph(audio).master.gain.value, 0.5 * AUDIO.headroom);
  assert.equal(graph(audio).musicBus.gain.value, 0.2); assert.equal(graph(audio).sfxBus.gain.value, 0.9);
  audio.setSettings({ muted: true }); assert.equal(audio.status, 'muted'); assert.equal(graph(audio).master.gain.value, 0);
  audio.update({ ...frame(), state: 'PAUSED' }); assert.equal(graph(audio).engine.output.gain.value, 0);
  audio.setSettings({ muted: false }); assert.equal(graph(audio).master.gain.value, 0.5 * AUDIO.headroom);
  audio.dispose();
});

test('one impact per damage serial, distinct final sounds, bounded voices and completed cleanup', async () => {
  const context = new Context(), audio = new AudioManager(storage(), () => context as unknown as AudioContext);
  const model = frame(); audio.update(model); await audio.unlock();
  model.hitSerial = 1; model.hull = 2;
  for (let i = 0; i < 100; i++) audio.update(model);
  assert.equal(graph(audio).counts.impact, 1);
  model.hitSerial = 2; model.hull = 1; audio.update(model);
  model.hitSerial = 3; model.hull = 0; model.state = 'GAME_OVER';
  for (let i = 0; i < 100; i++) audio.update(model);
  assert.equal(graph(audio).counts.impact, 2); assert.equal(graph(audio).counts.destruction, 1); assert.equal(graph(audio).counts.gameOver, 1);
  for (let i = 0; i < 50; i++) audio.play('click');
  assert.ok(graph(audio).voices.size <= AUDIO.maxVoices);
  assert.ok(context.sources.size <= AUDIO.maxVoices + 4);
  for (const voice of graph(audio).voices) (voice.source as unknown as Node).finish();
  assert.equal(graph(audio).voices.size, 0);
  audio.resetRun(); model.hitSerial = 0; model.hull = 3; model.state = 'PLAYING'; audio.update(model);
  assert.equal(graph(audio).voices.size, 0); audio.dispose();
});

test('pause, focus suspension and explicit resume do not repeat impacts or create sources', async () => {
  const context = new Context(), audio = new AudioManager(storage(), () => context as unknown as AudioContext);
  const model = frame(); audio.update(model); await audio.unlock();
  const sourceCount = context.starts;
  model.state = 'PAUSED'; audio.update(model);
  assert.equal(graph(audio).engine.output.gain.value, 0);
  audio.background(); assert.equal(audio.status, 'suspended'); assert.equal(graph(audio).master.gain.value, 0);
  model.state = 'PLAYING'; audio.update(model); await audio.unlock();
  assert.equal(audio.status, 'running'); assert.ok(graph(audio).engine.output.gain.value > 0);
  assert.equal(context.starts, sourceCount); assert.equal(graph(audio).counts.impact, 0); audio.dispose();
});

test('unavailable or rejected Web Audio remains silent and consumes stale hit events', async () => {
  const unavailable = new AudioManager(storage(), () => { throw new Error('unsupported'); });
  unavailable.update(frame()); await unavailable.unlock(); assert.equal(unavailable.status, 'unavailable'); unavailable.dispose();
  const context = new Context(); context.resumeAction = () => Promise.reject(new Error('blocked'));
  const audio = new AudioManager(storage(), () => context as unknown as AudioContext);
  const model = frame(); audio.update(model); await audio.unlock(); assert.equal(audio.status, 'blocked');
  model.hitSerial = 1; model.hull = 2; audio.update(model);
  context.resumeAction = undefined; await audio.unlock(); audio.update(model);
  assert.equal(graph(audio).counts.impact, 0); audio.dispose();
});

test('late resume after disposal cannot initialize or revive audio', async () => {
  const context = new Context(); let complete!: () => void;
  context.resumeAction = () => new Promise<void>(resolve => { complete = resolve; });
  const audio = new AudioManager(storage(), () => context as unknown as AudioContext);
  const pending = audio.unlock(); audio.dispose(); complete(); await pending;
  assert.equal(context.starts, 0); assert.equal(audio.status, 'disposed');
});

test('partial graph allocation failure closes the context and releases started sources', async () => {
  const context = new Context();
  const createBuffer = context.createBuffer.bind(context); let allocations = 0;
  context.createBuffer = (channels: number, length: number) => {
    if (++allocations === 2) throw new Error('Intentional music buffer failure');
    return createBuffer(channels, length);
  };
  const audio = new AudioManager(storage(), () => context as unknown as AudioContext);
  audio.update(frame()); await audio.unlock();
  assert.equal(audio.status, 'unavailable'); assert.equal(context.state, 'closed');
  assert.equal(context.sources.size, 0); assert.equal(context.starts, 3);
  audio.dispose();
});

test('runtime audio errors are contained and release the graph without changing flight state', async () => {
  const context = new Context(), audio = new AudioManager(storage(), () => context as unknown as AudioContext);
  const model = frame(); audio.update(model); await audio.unlock();
  graph(audio).engine.update = () => { throw new Error('Intentional native routing failure'); };
  assert.doesNotThrow(() => audio.update(model));
  assert.equal(audio.status, 'unavailable'); assert.equal(context.state, 'closed');
  assert.equal(model.state, 'PLAYING'); assert.equal(context.sources.size, 0);
  assert.doesNotThrow(() => audio.resetRun()); audio.dispose();
});

test('original music and SFX are finite, deterministic, tapered and below full scale', () => {
  for (const kind of SOUNDS) {
    const data = soundSamples(kind);
    assert.ok(data.length > 1000); assert.ok(data[0] === 0); assert.ok(data.at(-1) === 0);
    assert.ok(data.every(value => Number.isFinite(value) && Math.abs(value) <= AUDIO.voicePeak + 1e-7));
    assert.ok(data.some(value => Math.abs(value) > 0.01));
    assert.deepEqual(data, soundSamples(kind));
  }
  const music = musicSamples();
  assert.equal(music[0].length, AUDIO.sampleRate * AUDIO.musicSeconds);
  for (const channel of music) {
    assert.ok(channel.every(value => Number.isFinite(value) && Math.abs(value) < 0.2));
    assert.ok(Math.abs(channel[0]! - channel.at(-1)!) < 0.01);
  }
  assert.notDeepEqual(music[0], music[1]);
});
