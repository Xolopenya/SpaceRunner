import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {openGame,advance,chromium} from './release-browser-lib.mjs';
const directory=process.env.REVIEW_RESULT_DIR??'.cache/review/RELEASE-007/final',live=process.argv.includes('--live'),url=live?'https://xolopenya.github.io/SpaceRunner/':'http://127.0.0.1:5188/SpaceRunner/';
const media=`${directory}/media`;await mkdir(media,{recursive:true});
const server=live?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5188','--strictPort'],{env:{...process.env,GITHUB_ACTIONS:'true'},stdio:'ignore',windowsHide:true});
if(server)for(let i=0;i<100;i++){try{await fetch(url);break}catch{await new Promise(r=>setTimeout(r,100))}}
const browser=await chromium.launch({channel:'chrome',headless:true}),receipts=[];
try{
 const rows=JSON.parse(await readFile(`${directory}/release-scenarios.json`,'utf8'));
 for(const row of rows){
  const video=!live&&['clean-integrated','pickup-phase2','left-wing-hit'].includes(row.name),r=await openGame(browser,url,{seed:row.seed,...(video?{videoDir:`${directory}/video-raw`}:{})});
  const prefix=live?'public':'production';
  // The production app is unmodified. Seeded normal Launch is observed by CDP;
  // only real input and the existing fixed update/render path advance the run.
  await advance(r.page,row.inputs,video&&row.name!=='clean-integrated'?Math.max(0,row.captureTick-300):video?0:row.captureTick);
  if(row.name==='clean-integrated'){
   if(!video)await r.page.evaluate(()=>{const g=window.releaseQA;g.model.pause();g.loop.render(0)});
   if(!video){await r.page.locator('#restart-pause').click();await r.page.evaluate(()=>{window.releaseTick=0;window.releaseQA.loop.render(0)})}
   for(const e of row.events.filter(e=>['mine','station','phase2'].includes(e.kind)).sort((a,b)=>a.tick-b.tick)){await advance(r.page,row.inputs,e.tick,video);await r.page.screenshot({path:`${media}/${prefix}-${e.kind}.png`})}
   await advance(r.page,row.inputs,row.captureTick,video);
  }else if(video)await advance(r.page,row.inputs,row.captureTick,true);
  const state=await r.page.evaluate(()=>window.releaseState());
  assert.equal(state.hull,row.final.hull);assert.equal(state.count,row.final.count);assert.equal(state.phase,row.final.phase);assert.equal(state.state,row.final.state);
  if(row.name.endsWith('wing-hit')){assert.equal(state.contact.part,row.name.slice(0,-4));assert.equal(state.contact.bodyClear,true);}
  if(row.name==='pickup-wing')assert.notEqual(state.pickup.part,'body');
  assert.equal(state.camera,'hybrid-chase');assert.equal(state.warp,'fragmented-warp');assert.equal(state.legacyVisible,false);
  await r.page.screenshot({path:`${media}/${prefix}-${row.name}.png`});
  if(row.name==='natural-game-over'){await r.page.locator('#replay').click();const reset=await r.page.evaluate(()=>{const g=window.releaseQA;g.loop.render(0);return window.releaseState()});assert.equal(reset.distance,0);assert.equal(reset.hull,3);assert.equal(reset.count,0);await r.page.screenshot({path:`${media}/${prefix}-restart.png`});}
  if(row.name==='clean-integrated'){
   for(const viewport of [{width:390,height:844},{width:844,height:390}]){await r.page.setViewportSize(viewport);await r.page.waitForFunction(()=>{const g=window.releaseQA,rect=document.getElementById('flight').getBoundingClientRect();return Math.abs(g.world.flightCamera.camera.aspect-rect.width/rect.height)<1e-6},null,{polling:100});await r.page.evaluate(()=>window.releaseQA.loop.render(0));await r.page.screenshot({path:`${media}/${prefix}-${viewport.width}-phase2.png`});}
   await r.page.locator('#pause').click();await r.page.locator('#resume').click();assert.equal(await r.page.locator('#game').getAttribute('data-state'),'PLAYING');
   await r.page.locator('#pause').click();await r.page.getByRole('button',{name:'Sound settings',exact:true}).click();await r.page.waitForTimeout(150);
   for(const [key,value]of [['master',52],['music',21],['sfx',64]])await r.page.locator(`#sound-${key}`).evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);
   await r.page.locator('#sound-mute').click();assert.equal(await r.page.evaluate(()=>window.releaseQA.audio.settings.muted),true);await r.page.locator('#sound-mute').click();
   const audio=await r.page.evaluate(()=>({status:window.releaseQA.audio.status,settings:window.releaseQA.audio.settings,fontStatus:document.fonts.status}));assert.equal(audio.status,'running');state.publicAudio=audio;
   assert.deepEqual(audio.settings,{master:.52,music:.21,sfx:.64,muted:false});
   await r.page.getByRole('button',{name:'Close sound settings',exact:true}).click();
  }
  assert.deepEqual(r.errors,[]);assert.deepEqual(r.failed,[]);const videoFile=r.page.video();await r.context.close();if(videoFile)await copyFile(await videoFile.path(),`${media}/${prefix}-${row.name}.webm`);
  receipts.push({name:row.name,url,seed:row.seed,state,requests:r.requests,errors:r.errors,failed:r.failed});console.log(prefix,row.name,state.distance,state.hull,state.count);
 }
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();await page.goto(url);await page.locator('#launch').waitFor();await page.screenshot({path:`${media}/${live?'public':'production'}-menu.png`});await page.getByRole('button',{name:'Sound settings',exact:true}).click();await page.waitForFunction(()=>document.getElementById('sound-status').textContent==='Audio enabled.',null,{polling:100});await page.screenshot({path:`${media}/${live?'public':'production'}-sound-settings.png`});await context.close();
 await writeFile(`${directory}/${live?'public':'production'}-captures.json`,JSON.stringify({url,browser:browser.version(),receipts,method:'Normal production build and ordinary URL; CDP observes existing Launch listener. Reproducible seed via browser crypto; no modified server responses, debug parameters, teleports or inserted entities. Video has accelerated prefixes except clean-integrated continuous run.'},null,2));
}finally{await browser.close();server?.kill();}
