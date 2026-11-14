import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO, AudioSettingsStorage, masterGain, normalizeSettings } from '../src/audio/settings.ts';
import { AudioManager } from '../src/audio/audio-manager.ts';
import { musicSamples, SOUNDS, soundSamples } from '../src/audio/synthesis.ts';
import { AudioPressure } from '../src/audio/pressure.ts';
import { collisionSound } from '../src/feedback/settings.ts';
import type { PlanningOutcome } from '../src/core/field-scheduler.ts';
import { musicStems } from '../src/audio/music-synthesis.ts';

class Parameter {
  value = 0;
  setTargetAtTime(value: number) { this.value = value; return this; }
  cancelScheduledValues() { return this; }
}

class Node {
  gain = new Parameter(); frequency = new Parameter(); Q = new Parameter();
  playbackRate = new Parameter();
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
const contact = {runId:1,elapsed:1,source:'obstacle' as const,obstacleKind:0,position:{x:0,y:0,z:0},obstaclePosition:{x:0,y:0,z:0},velocity:{x:0,y:0}};

test('audio pressure gates future publications by distance, includes repeated phases and clears stale runs', () => {
  const pressure=new AudioPressure();
  const field=(id:string,start:number,end:number,pacing:string,status='committed')=>({lastOutcome:{status,section:{id,startDistance:start,endDistance:end,pacing}} as PlanningOutcome});
  const future=Object.freeze(field('one',160,224,'high'));
  assert.equal(pressure.update(80,future),'regular');
  assert.equal(pressure.update(160,future),'high');
  assert.equal(pressure.update(200,field('two',224,288,'high')),'high');
  assert.equal(pressure.update(240,field('three',288,352,'rising','omitted-certified')),'high');
  assert.equal(pressure.update(300),'recovery');
  assert.equal(pressure.update(400),'recovery');
  pressure.reset(); assert.equal(pressure.update(0),'regular');
  assert.equal(future.lastOutcome!.section.startDistance,160);
});

test('score layers retain exactly synchronized lengths and contain distinct musical chapters', () => {
  const stems=musicStems(2000), channels=[...stems.ambient,...stems.pulse,...stems.pressure];
  for(const channel of channels) {
    assert.equal(channel.length,128000); assert.ok(channel.every(Number.isFinite));
    assert.ok(Math.abs(channel[0]!-channel.at(-1)!)<.02);
    assert.notDeepEqual(channel.slice(0,32000),channel.slice(32000,64000));
  }
});

test('three score sources crossfade without rebuilding buffers through pacing and restart', async () => {
  const context=new Context(), audio=new AudioManager(storage(),()=>context as unknown as AudioContext);
  audio.update(frame()); await audio.unlock(); const g=graph(audio);
  const buffers=g.score.sources.map(s=>s.buffer), sources=[...g.score.sources];
  g.setPacing('high'); assert.ok(g.score.layers[2]!.gain.value>.8);
  g.setPacing('recovery'); assert.ok(g.score.layers[2]!.gain.value<.03);
  for(let i=0;i<20;i++) { audio.resetRun(); audio.update(frame()); }
  assert.deepEqual(g.score.sources,sources); assert.deepEqual(g.score.sources.map(s=>s.buffer),buffers);
  assert.equal(context.starts,6); audio.dispose(); assert.equal(context.sources.size,0);
});

test('typed damage arms occasional malfunctions; hull snapshots alone and muted intervals cannot replay', async () => {
  const context=new Context(), audio=new AudioManager(storage(),()=>context as unknown as AudioContext);
  await audio.unlock(); audio.update({...frame(),hull:1,elapsed:100}); assert.equal(graph(audio).counts.crackle,0);
  audio.observe({type:'player.damage',payload:{...contact,previousHP:3,currentHP:2}});
  audio.update({...frame(),elapsed:9}); assert.equal(graph(audio).counts.crackle,0);
  audio.update({...frame(),elapsed:10}); assert.equal(graph(audio).counts.crackle,1);
  audio.setSettings({muted:true}); audio.update({...frame(),elapsed:20});
  audio.setSettings({muted:false}); audio.update({...frame(),elapsed:20.01}); assert.equal(graph(audio).counts.crackle,1);
  audio.resetRun(); audio.update({...frame(),elapsed:100}); assert.equal(graph(audio).counts.crackle,1); audio.dispose();
});

test('fatal audio follows visual breakup/secondary thresholds once and skip discards remaining phases', async () => {
  const context=new Context(), audio=new AudioManager(storage(),()=>context as unknown as AudioContext);
  await audio.unlock(); audio.observe({type:'player.destroyed',payload:{...contact,score:10}});
  const model={...frame(),state:'GAME_OVER'}, sequence={active:true,elapsed:.49,breakupAt:.5};
  audio.update(model,sequence); assert.equal(graph(audio).counts.rupture,0);
  sequence.elapsed=.51; audio.update(model,sequence); audio.update(model,sequence); assert.equal(graph(audio).counts.rupture,1);
  sequence.elapsed=.61; audio.update(model,sequence); assert.equal(graph(audio).counts.secondary,1);
  sequence.active=false; sequence.elapsed=2.05; audio.update(model,sequence); assert.equal(graph(audio).counts.secondary,1);
  audio.resetRun(); sequence.active=true; sequence.elapsed=.95; audio.update(frame(),sequence);
  assert.equal(graph(audio).counts.rupture,1); assert.equal(graph(audio).voices.size,0); audio.dispose();
});

test('collision families vary independently and pickup saturation cannot evict destruction', async () => {
  const context=new Context(), audio=new AudioManager(storage(),()=>context as unknown as AudioContext);
  await audio.unlock();
  for(const kind of [0,2,4,9]) {
    const cue=collisionSound(kind); assert.equal(cue.variants.length,3);
    for(let i=0;i<6;i++) audio.playCue(cue);
    assert.ok(cue.variants.every(name=>graph(audio).counts[name]>0));
  }
  assert.equal(graph(audio).counts.impact,24); audio.clearFeedback();
  for(let i=0;i<6;i++) audio.play('destruction'); const sources=[...graph(audio).voices].map(v=>v.source);
  for(let i=0;i<20;i++) audio.play('pickup');
  assert.deepEqual([...graph(audio).voices].map(v=>v.source),sources); assert.equal(graph(audio).counts.pickup,0); audio.dispose();
});

test('explicit pickup cues respect independent Master/SFX/mute and never replay muted requests', async () => {
  const context = new Context(), audio = new AudioManager(storage(), () => context as unknown as AudioContext);
  await audio.unlock();
  const cue = { variants: ['pickup'] as const, gain: 1, rate: [1, 1] as const };
  audio.playCue(cue); audio.update(frame()); assert.equal(graph(audio).counts.pickup, 1);
  audio.setSettings({ master: .3, sfx: .4, music: .8 });
  assert.equal(graph(audio).master.gain.value, .3 * AUDIO.headroom); assert.equal(graph(audio).sfxBus.gain.value, .4);
  audio.setSettings({ muted: true }); audio.playCue(cue); audio.setSettings({ muted: false }); audio.update(frame());
  assert.equal(graph(audio).counts.pickup, 1); assert.equal(graph(audio).musicBus.gain.value, .8);
  audio.resetRun(); audio.playCue(cue); assert.equal(graph(audio).counts.pickup, 2); audio.dispose();
});

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
  assert.equal(created, 1); assert.equal(context.resumes, 1); assert.equal(context.starts, 6);
  const identity = graph(audio);
  for (let run = 0; run < 10; run++) { audio.resetRun(); audio.update(model); await audio.unlock(); }
  assert.equal(graph(audio), identity); assert.equal(context.starts, 6); assert.equal(created, 1);
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

test('menu music reacts immediately to settings and menu return reuses the same loop', async () => {
  const context = new Context(), audio = new AudioManager(storage(), () => context as unknown as AudioContext);
  const model = { ...frame(), state: 'MENU' }; audio.update(model); await audio.unlock();
  const initial = graph(audio), starts = context.starts;
  assert.equal(initial.engine.output.gain.value, 0);
  const music = initial as unknown as { musicLevel: { gain: Parameter } };
  assert.ok(music.musicLevel.gain.value > 0);
  audio.setSettings({ music: 0, sfx: .81 }); assert.equal(initial.musicBus.gain.value, 0); assert.equal(initial.sfxBus.gain.value, .81);
  audio.setSettings({ music: .7, muted: true }); assert.equal(initial.musicBus.gain.value, .7); assert.equal(initial.master.gain.value, 0);
  audio.setSettings({ muted: false }); assert.ok(initial.master.gain.value > 0);
  for (const state of ['PLAYING', 'PAUSED', 'GAME_OVER', 'MENU']) { model.state = state; audio.update(model); }
  await audio.unlock(); assert.equal(graph(audio), initial); assert.equal(context.starts, starts);
  assert.ok(music.musicLevel.gain.value > 0); audio.dispose();
});

test('explicit contacts, distinct final sounds, bounded voices and completed cleanup', async () => {
  const context = new Context(), audio = new AudioManager(storage(), () => context as unknown as AudioContext);
  const model = frame(); audio.update(model); await audio.unlock();
  model.hitSerial = 1; model.hull = 2;
  audio.play('impact');
  for (let i = 0; i < 100; i++) audio.update(model);
  assert.equal(graph(audio).counts.impact, 1);
  model.hitSerial = 2; model.hull = 1; audio.update(model);
  audio.play('impact');
  model.hitSerial = 3; model.hull = 0; model.state = 'GAME_OVER';
  audio.play('destruction'); audio.play('gameOver', .55);
  for (let i = 0; i < 100; i++) audio.update(model);
  assert.equal(graph(audio).counts.impact, 2); assert.equal(graph(audio).counts.destruction, 1); assert.equal(graph(audio).counts.gameOver, 1);
  for (let i = 0; i < 50; i++) audio.play('click');
  assert.ok(graph(audio).voices.size <= AUDIO.maxVoices);
  assert.ok(context.sources.size <= AUDIO.maxVoices + 6);
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
  model.hitSerial = 1; model.hull = 2; audio.update(model); audio.play('impact');
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

test('cue variants apply bounded pitch/gain, release nodes and do not consume gameplay randomness', async () => {
  const context = new Context(), audio = new AudioManager(storage(), () => context as unknown as AudioContext);
  audio.update(frame()); await audio.unlock();
  audio.playCue({ variants: ['impact', 'pickup'], gain: .5, rate: [.9, 1.1] }, 1);
  const voice = [...graph(audio).voices][0]!;
  assert.equal(graph(audio).counts.pickup, 1); assert.equal(voice.source.playbackRate.value, 1.1);
  assert.equal(voice.gain?.gain.value, .5);
  const gain = voice.gain as unknown as Node; (voice.source as unknown as Node).finish();
  assert.equal(gain.connected, false); assert.equal(graph(audio).voices.size, 0); audio.dispose();
});

test('run reset invalidates an unfinished gesture cue and cancels scheduled old game-over voices', async () => {
  const context = new Context(); let finish!: () => void;
  context.resumeAction = () => new Promise<void>(resolve => { finish = resolve; });
  const audio = new AudioManager(storage(), () => context as unknown as AudioContext);
  audio.update(frame()); audio.activate('launch'); audio.resetRun(); finish();
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  context.resumeAction = undefined; await audio.unlock(); assert.equal(graph(audio).counts.launch, 0);
  audio.play('gameOver', .55); assert.equal(graph(audio).voices.size, 1);
  audio.resetRun(); assert.equal(graph(audio).voices.size, 0); audio.dispose();
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
