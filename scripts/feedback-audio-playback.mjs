import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from './release-browser-lib.mjs';
import assert from 'node:assert/strict';

// Actual browser decoding and audible playback of delivered recordings/renders.
// This verifies media/output, not a human listener's artistic/fatigue judgement.
const root=resolve('.cache/review/FEEDBACK-001C'),browser=await chromium.launch({channel:'chrome',headless:true,ignoreDefaultArgs:['--mute-audio']});
const page=await browser.newPage(),receipts=[];
try {
  await page.route('http://127.0.0.1:5193/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/favicon.ico')return route.fulfill({status:204,body:''});
    if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><button id="start">Play review audio</button><script>start.onclick=async()=>{window.reviewContext=new AudioContext();await reviewContext.resume();window.player=new Audio();window.meter=reviewContext.createAnalyser();reviewContext.createMediaElementSource(player).connect(meter).connect(reviewContext.destination);window.ready=true;};</script>'});
    const name=decodeURIComponent(path.slice(1));assert.ok(!name.includes('..'));
    await route.fulfill({body:await readFile(resolve(root,name)),contentType:name.endsWith('.wav')?'audio/wav':'audio/webm'});
  });
  await page.goto('http://127.0.0.1:5193/');await page.locator('#start').click();await page.waitForFunction(()=>window.ready);
  const examples=[['baseline/audio/flight.wav',0],['final/live/steering-audio.webm',0],['final/live/mine-audio.webm',2.5],['final/live/death-audio.webm',2.8],
    ['final/audio/collisions.wav',0],['final/audio/adaptive.wav',23.5],['final/audio/music.wav',29],['final/audio/music.wav',59],['final/audio/music.wav',170],['final/audio/lifecycle.wav',13]];
  for(const [file,start] of examples) {
    const row=await page.evaluate(async({file,start})=>{
      const url=new URL(file,location.href).href,c=window.reviewContext,p=window.player;
      const encoded=await(await fetch(url)).arrayBuffer();
      const decoded=await c.decodeAudioData(encoded.slice(0));
      // Fully buffered local media gives the native player a seekable Blob URL;
      // a route.fulfill fixture is not a byte-range HTTP server.
      const playbackURL=URL.createObjectURL(new Blob([encoded],{type:file.endsWith('.wav')?'audio/wav':'audio/webm'}));
      let peak=0,energy=0;for(let channel=0;channel<decoded.numberOfChannels;channel++)for(const sample of decoded.getChannelData(channel)){peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;}
      p.src=playbackURL;await new Promise((resolve,reject)=>{p.onloadedmetadata=resolve;p.onerror=()=>reject(Error('Playback decode failed'));p.load();});
      if(start>0)await new Promise(resolve=>{p.onseeked=resolve;p.currentTime=start;});
      const actualStart=p.currentTime;
      await p.play();await new Promise(r=>setTimeout(r,100));
      const span=file.includes('steering')?12:file.includes('collisions')?24:file.includes('mine-audio')?2:file.includes('death-audio')?3:file.includes('lifecycle')?.6:1.2;
      const interval=span>3?250:150,measurements=[];for(let i=0;i<Math.ceil(span*1000/interval);i++){
        await new Promise(r=>setTimeout(r,interval));const samples=new Float32Array(window.meter.fftSize);window.meter.getFloatTimeDomainData(samples);
        measurements.push(Math.sqrt(samples.reduce((n,s)=>n+s*s,0)/samples.length));
      }p.pause();const end=p.currentTime;URL.revokeObjectURL(playbackURL);
      return{file,start,actualStart,end,seconds:decoded.duration,channels:decoded.numberOfChannels,rate:decoded.sampleRate,decodedPeak:peak,decodedRms:Math.sqrt(energy/(decoded.length*decoded.numberOfChannels)),playbackRms:measurements,context:c.state};
    },{file,start});
    receipts.push(row);await writeFile(resolve(root,'playback-progress.json'),JSON.stringify(receipts,null,2));
    assert.equal(row.context,'running');assert.ok(row.decodedPeak>.001&&row.decodedPeak<.95);
    assert.ok(Math.abs(row.actualStart-start)<.1 && row.end>=start+.2,'Player did not actually seek/play the requested range');
    if(file.includes('lifecycle'))assert.ok(Math.max(...row.playbackRms)<.00003);else assert.ok(Math.max(...row.playbackRms)>.0003);
    console.log(file,start,row.decodedPeak.toFixed(4));
  }
  await page.evaluate(()=>window.reviewContext.close());
  await writeFile(resolve(root,'playback-review.json'),JSON.stringify({method:'Actual native Chromium decodeAudioData + HTMLAudioElement → Analyser → destination playback after a genuine Play gesture. Measurements verify delivered media and output. No human subjective listening/phone/fatigue approval is asserted.',browser:browser.version(),receipts},null,2));
}finally{await browser.close();}
