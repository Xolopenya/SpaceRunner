import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CollisionSamples,collisionMix,SAMPLE_FILES} from '../src/audio/samples.ts';
import type {Sound} from '../src/audio/synthesis.ts';
function buffer(length=22050,rate=22050) {
 const data=Float32Array.from({length},(_,i)=>Math.sin(i*.5)*Math.exp(-i/4000)*.6);
 return{length,sampleRate:rate,duration:length/rate,numberOfChannels:1,getChannelData:()=>data} as unknown as AudioBuffer;
}
const context={createBuffer:(_c:number,n:number,r:number)=>buffer(n,r),decodeAudioData:async()=>buffer()} as unknown as BaseAudioContext;
const fallback=new Map<Sound,AudioBuffer>(['rock1','rock2','metal1','metal2','station1','station2','mine1','mine2'].map(k=>[k as Sound,buffer()]));
test('layered sample mix is finite, tapered, capped and removes excess sub-bass',()=>{
 const source=buffer(),low=Float32Array.from({length:22050},(_,i)=>.6*Math.sin(2*Math.PI*30*i/22050)+.2*Math.sin(2*Math.PI*1300*i/22050));source.getChannelData(0).set(low);
 const mixed=collisionMix(context,source,buffer(),'rock'),data=mixed.getChannelData(0);
 assert.equal(data[0],0);assert.equal(data.at(-1),0);assert.ok(data.every(v=>Number.isFinite(v)&&Math.abs(v)<=.140001));
 assert.notDeepEqual(data,low);assert.ok(data.some(v=>Math.abs(v)>.1));
 const energy=(values:Float32Array,hz:number)=>{let a=0,b=0;for(let i=0;i<values.length;i++){const p=2*Math.PI*hz*i/22050;a+=values[i]!*Math.cos(p);b+=values[i]!*Math.sin(p);}return Math.hypot(a,b);};
 // At least6dB attenuation of sub-bass relative to the original material detail;
 // peak normalization must not be mistaken for frequency-dependent filtering.
 assert.ok(energy(data,30)/energy(data,1300)<energy(low,30)/energy(low,1300)*.5);
});
test('sample bank loads each selected file once, aliases cosmetic third variants and survives optional failure',async()=>{
 const saved=globalThis.fetch;let calls=0;
 globalThis.fetch=async url=>{calls++;return new Response(new Uint8Array([1]),{status:String(url).includes('metal-b')?404:200});};
 try {
  const bank=new CollisionSamples(context,fallback);await bank.ready;
  assert.equal(calls,SAMPLE_FILES.length);assert.equal(bank.stats.loaded,7);assert.equal(bank.stats.failed,1);
  assert.equal(bank.get('rock1'),bank.get('rock3'));assert.notEqual(bank.get('rock1'),bank.get('rock2'));assert.equal(bank.get('metal2'),undefined);
  assert.ok(bank.stats.pcmBytes>0);bank.dispose();assert.equal(bank.buffers.size,0);
 }finally{globalThis.fetch=saved;}
});
test('disposing during native decode prevents late buffer revival or delayed sound',async()=>{
 const saved=globalThis.fetch;let finish!:()=>void;const decoded=new Promise<void>(resolve=>finish=resolve);
 globalThis.fetch=async()=>new Response(new Uint8Array([1]));
 try{
  const c={...context,decodeAudioData:async()=>{await decoded;return buffer();}} as unknown as BaseAudioContext;
  const bank=new CollisionSamples(c,fallback);await new Promise(resolve=>setTimeout(resolve,0));bank.dispose();finish();await bank.ready;
  assert.equal(bank.buffers.size,0);assert.equal(bank.stats.loaded,0);
 }finally{globalThis.fetch=saved;}
});
test('malformed decoded PCM cannot reject the bank or revive a partial mix',async()=>{
 const saved=globalThis.fetch;globalThis.fetch=async()=>new Response(new Uint8Array([1]));
 try{
  const c={...context,decodeAudioData:async()=>{const b=buffer();b.getChannelData(0).fill(NaN);return b;}} as unknown as BaseAudioContext;
  const bank=new CollisionSamples(c,fallback);await bank.ready;assert.equal(bank.stats.failed,8);assert.equal(bank.buffers.size,0);bank.dispose();
 }finally{globalThis.fetch=saved;}
});
