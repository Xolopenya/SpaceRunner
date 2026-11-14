import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openGame,advance,chromium } from './release-browser-lib.mjs';

const root=resolve('.cache/review/FEEDBACK-001C/final/live'); await mkdir(root,{recursive:true});
const tapes=JSON.parse(await readFile('.cache/review/FEEDBACK-001B/scenarios.json','utf8')).scenarios;
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5194','--strictPort'],{stdio:'ignore',windowsHide:true});
const browser=await chromium.launch({channel:'chrome',headless:true,ignoreDefaultArgs:['--mute-audio']});
const receipts=[];
try {
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5194/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const selection=process.argv[2];
  for(const name of selection ? [selection] : ['flight','mine','death']) {
    const r=await openGame(browser,'http://127.0.0.1:5194/',{seed:42});
    await r.page.waitForFunction(()=>window.releaseQA.audio.status==='running');
    const tape=tapes.find(t=>t.name===name);
    if(tape) await advance(r.page,tape.inputs,Math.max(0,tape.endTick-360));
    const initialHeap=await r.cdp.send('Runtime.getHeapUsage');
    await r.page.evaluate(({name})=>{
      const g=window.releaseQA, a=g.audio, c=a.context, graph=a.graph;
      graph.clearVoices();
      const destination=c.createMediaStreamDestination(); graph.master.connect(destination);
      const videoTracks=name==='endurance' ? [] : document.querySelector('canvas').captureStream(60).getVideoTracks();
      const streams=[{name:'audio',stream:destination.stream,mime:'audio/webm;codecs=opus'},
        ...(videoTracks.length ? [{name:'canvas',stream:new MediaStream([...videoTracks,...destination.stream.getAudioTracks()]),mime:'video/webm;codecs=vp8,opus'}] : [])];
      window.audioLive={started:performance.now(),records:[],events:[],pacing:[],samples:[],restarts:0,destination,videoTracks,
        sources:[...graph.score.sources],buffers:[...graph.score.sources.map(s=>s.buffer),...graph.buffers.values(),graph.engine.rush.buffer]};
      const q=window.audioLive;
      g.model.events.subscribe(event=>q.events.push({at:(performance.now()-q.started)/1000,event}));
      const pacing=graph.setPacing.bind(graph); let previous;
      graph.setPacing=state=>{if(previous!==state){q.pacing.push({at:(performance.now()-q.started)/1000,state,distance:g.model.distance,active:a.pressure.sections.find(s=>g.model.distance>=s.start&&g.model.distance<s.end),section:g.model.field.lastOutcome?.section,status:g.model.field.lastOutcome?.status});previous=state;}pacing(state);};
      q.recorders=streams.map(({name,stream,mime})=>{
        const chunks=[],recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:96000,videoBitsPerSecond:1800000});
        recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
        const stopped=new Promise(resolve=>recorder.onstop=async()=>{
          const bytes=new Uint8Array(await new Blob(chunks,{type:mime}).arrayBuffer());
          let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
          q.records.push({name,mime,data:btoa(binary)});resolve();
        }); recorder.start(500);return{recorder,stopped};
      });
    },{name});
    if(name==='endurance') {
      await r.page.evaluate(()=>new Promise(resolve=>{
        let count=0;const g=window.releaseQA,q=window.audioLive;
        const frame=()=>{
          if(g.model.state==='PLAYING'){window.releaseStep();window.releaseStep();}
          else if(g.world.destruction.sequence.active)g.loop.render(1/60);
          else {document.querySelector('#replay').click();window.releaseTick=0;q.restarts++;}
          if(count%60===0)q.samples.push({second:count/60,state:g.model.state,distance:g.model.distance,hull:g.model.hull,voices:g.audio.graph.voices.size,pcm:q.buffers.reduce((n,b)=>n+b.length*b.numberOfChannels*4,0),sameBuffers:q.buffers.every(b=>b!==null),sameSources:q.sources.every((s,i)=>s===g.audio.graph.score.sources[i]),heap:performance.memory?.usedJSHeapSize});
          if(++count<10800)window.nativeRAF(frame);else resolve();
        };window.nativeRAF(frame);
      }));
    } else {
      const steering=name==='steering' ? Array.from({length:1440},(_,tick)=>tick<180?{x:0,y:0}:tick<420?{x:.6,y:.3}:tick<720?{x:-.7,y:.2}:tick<1080?{x:0,y:-.4}:{x:.4,y:.6}) : undefined;
      await advance(r.page,steering??tape?.inputs,tape ? tape.endTick+180 : steering ? 1440 : 1800,true);
      if(name==='death'){
        await r.page.evaluate(()=>new Promise(resolve=>{let n=140;const frame=()=>{window.releaseQA.loop.render(1/60);if(--n)window.nativeRAF(frame);else resolve();};window.nativeRAF(frame);}));
        await r.page.locator('#replay').click(); await r.page.evaluate(()=>{window.releaseTick=0;}); await advance(r.page,undefined,240,true);
      }
    }
    const result=await r.page.evaluate(async()=>{
      const q=window.audioLive,g=window.releaseQA;
      q.recorders.forEach(r=>r.recorder.stop());await Promise.all(q.recorders.map(r=>r.stopped));
      g.audio.graph.master.disconnect(q.destination);q.destination.disconnect();q.videoTracks.forEach(t=>t.stop());
      return{records:q.records,events:q.events,pacing:q.pacing,samples:q.samples,restarts:q.restarts,seconds:(performance.now()-q.started)/1000,
        endpoint:window.releaseState(),counts:g.audio.graph.counts,voices:g.audio.graph.voices.size,audioStatus:g.audio.status,
        buffersStable:q.sources.every((s,i)=>s===g.audio.graph.score.sources[i]&&s.buffer===q.buffers[i]),pcmBytes:q.buffers.reduce((n,b)=>n+b.length*b.numberOfChannels*4,0)};
    });
    await r.cdp.send('HeapProfiler.collectGarbage'); const settledHeap=await r.cdp.send('Runtime.getHeapUsage');
    for(const record of result.records)await writeFile(resolve(root,`${name}-${record.name}.webm`),Buffer.from(record.data,'base64'));
    delete result.records; assert.deepEqual(r.errors,[]);assert.deepEqual(r.failed,[]);assert.ok(result.buffersStable);
    receipts.push({name,initialHeap,settledHeap,...result});await r.context.close();console.log(name,result.seconds.toFixed(2),result.pcmBytes,'PCM bytes',result.voices,'voices');
  }
  await writeFile(resolve(root,selection?`${selection}.json`:'live.json'),JSON.stringify({method:'Actual production Chrome WebAudio master → MediaStreamDestination → Opus. Canvas capture + same audio stream where supplied; canvas excludes HTML HUD. Unchanged seed42 controls/collision rules, certificate pilot, explicit steering axes or recorded real input tape; native RAF after accelerated prefix. No microphone, fake hazard or HP edits.',browser:browser.version(),receipts},null,2));
}finally{await browser.close();server.kill();}
