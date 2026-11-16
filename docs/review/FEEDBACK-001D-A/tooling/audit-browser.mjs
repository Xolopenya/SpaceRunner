// Review-only instrumentation. Never imported by the production entry graph.
import { spawn } from 'node:child_process';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync('.cache/playwright/ffmpeg-1013/ffmpeg-win64.exe')) process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.cache/playwright');
const { chromium } = await import('@playwright/test');
const out = resolve('.cache/review/FEEDBACK-001D-A');
await mkdir(resolve(out, 'evidence'), { recursive: true });
const mode = process.argv[2] || 'live';
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5196', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
let browser;
const result = { mode, date: new Date().toISOString(), sessions: [], screenshots: [], errors: [] };
const save = () => writeFile(resolve(out, `${mode}.json`), JSON.stringify(result, null, 2));
async function state(page) {
  return page.evaluate(() => {
    const g = window.auditGame, m = g?.model;
    return { viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, state: m?.state, elapsed: m?.elapsed, distance: m?.distance,
      hull: m?.hull, immunity: m?.invulnerability, energy: m?.fragments?.count, phase: m?.phase, ship: m ? { ...m.ship } : undefined,
      cinematic: g?.world.destruction.sequence.active, active: document.activeElement?.id,
      camera: g?.world.flightCamera.mode, boundary: g?.world.boundaries.mode, quality: g?.world.quality,
      audio: g ? { status: g.audio.status, settings: g.audio.settings } : undefined,
      draw: g ? { calls: g.world.renderer.info.render.calls, memory: g.world.renderer.info.memory, programs: g.world.renderer.info.programs.length } : undefined,
      events: window.auditEvents ?? [], frameGaps: window.auditGaps ?? [],
      mines: m?.field?.slots?.filter(h => h.active && h.kind === 9).map(h => ({ x: h.x, y: h.y, z: h.z })),
      fragments: m?.fragments?.active?.map(p => ({ x: p.x, y: p.y, passDistance: p.passDistance, approach: p.approach })),
      rects: [...document.querySelectorAll('#hud, #hull, #energy-block, #phase-label, #phase-notice, #damage, #flight-hint, #pause, #launch, #resume, #restart-pause, #replay, #final-score, #final-best, .result-energy, #sound-settings, #sound-master, #sound-mute')].filter(n => n.getClientRects().length).map(n => ({ id: n.id || n.className, text: n.textContent.trim(), rect: n.getBoundingClientRect().toJSON(), font: getComputedStyle(n).fontSize, color: getComputedStyle(n).color })),
      buttons: [...document.querySelectorAll('button, input')].filter(n => n.getClientRects().length).map(n => { const r = n.getBoundingClientRect(), top = document.elementFromPoint(r.x+r.width/2, r.y+r.height/2); return { id: n.id, name: n.textContent.trim(), rect: r.toJSON(), reachable: !!top && (top === n || n.contains(top)) }; }),
      settingsInputs: [...document.querySelectorAll('#sound-settings input')].map(n=>({id:n.id,value:n.value})),
      scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight } };
  });
}
async function shot(page, name, method = 'native production UI; no state edits') {
  const path = `evidence/${name}.png`;
  await page.screenshot({ path: resolve(out, path) });
  result.screenshots.push({ path, method, ...await state(page) });
  await save();
}
async function open({ viewport = { width:1280, height:720 }, touch = false, reduced = false, seed = 42, video } = {}) {
  const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, reducedMotion: reduced ? 'reduce' : 'no-preference', ...(video ? { recordVideo: { dir: resolve(out,'raw-video'), size: viewport } } : {}) });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = [], failed = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if(m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('response', r => { if(r.status()>=400) failed.push({url:r.url(),status:r.status()}); });
  await page.goto(`http://127.0.0.1:5196/?seed=${seed}`);
  await page.locator('#launch').waitFor(); await page.evaluate(() => document.fonts.ready);
  return { context, page, errors, failed, seed, video, started:Date.now() };
}
async function launch(r) {
  const { context, page } = r, cdp = await context.newCDPSession(page);
  await cdp.send('Debugger.enable');
  await cdp.send('DOMDebugger.setEventListenerBreakpoint', { eventName:'click' });
  let observed = false, observationError;
  const paused = async e => { try {
    for(const frame of e.callFrames) {
      const a = await cdp.send('Debugger.evaluateOnCallFrame', {callFrameId:frame.callFrameId, expression:'!!(this && this.model && this.world)', returnByValue:true});
      if(a.result.value) { await cdp.send('Debugger.evaluateOnCallFrame', {callFrameId:frame.callFrameId,expression:'window.auditGame=this'}); observed=true; break; }
    }
  } catch(e) { observationError=String(e); } finally { await cdp.send('Debugger.resume').catch(()=>{}); } };
  cdp.on('Debugger.paused', paused);
  await page.locator('#launch').click();
  await cdp.send('DOMDebugger.removeEventListenerBreakpoint',{eventName:'click'});
  cdp.off('Debugger.paused',paused); await cdp.send('Debugger.disable');
  if(!observed) throw Error(`Could not observe ordinary production instance: ${observationError}`);
  await page.evaluate(() => {
    window.auditEvents=[];window.auditGaps=[];
    window.auditGame.model.events.subscribe(e => window.auditEvents.push({ wallMs:performance.now(), type:e.type, payload:e.payload }));
    let last=0; const observe = now => { if(last && window.auditGame.model.state==='PLAYING') window.auditGaps.push(now-last);last=now;requestAnimationFrame(observe); };requestAnimationFrame(observe);
  });
  r.playStart=Date.now();
}
async function close(r,label) {
  const final = await state(r.page), video = r.page.video();
  result.sessions.push({label,seed:r.seed,wallSeconds:(Date.now()-r.started)/1000,playWallSeconds:r.playStart?(Date.now()-r.playStart)/1000:0,final,errors:r.errors,failed:r.failed});
  await r.context.close();
  if(video && r.video) await copyFile(await video.path(),resolve(out,`evidence/${r.video}.webm`));
  await save(); console.log(label, JSON.stringify({elapsed:final.elapsed,hull:final.hull,energy:final.energy,phase:final.phase,errors:r.errors}));
}
async function realRun(r, seconds, strategy) {
  const end=Date.now()+seconds*1000, shots=new Set(), held=new Set();
  let sample=0;
  while(Date.now()<end) {
    const s = await state(r.page);
    if(s.state==='GAME_OVER') { await shot(r.page,`${r.video}-death`); await r.page.locator('#game-over').waitFor({timeout:8000}); await shot(r.page,`${r.video}-results`);break; }
    if(s.state!=='PLAYING') break;
    const tags = [];
    if(s.immunity>0)tags.push(`hull-${s.hull}`);
    if(s.energy>0)tags.push('pickup');
    if(s.mines?.some(h=>h.z>-65))tags.push('mine-approach');
    if(s.phase===2)tags.push('phase2');
    if(s.elapsed>=9 && !shots.has('after-hint'))tags.push('after-hint');
    for(const tag of tags)if(!shots.has(tag)){shots.add(tag);await shot(r.page,`${r.video}-${tag}`);}
    let axis={x:0,y:0};
    if(strategy==='collector')axis=await r.page.evaluate(() => {
      const m=window.auditGame.model,p=m.fragments.active.slice().sort((a,b)=>a.passDistance-b.passDistance)[0];
      if(p && p.passDistance-m.distance<Math.max(55,m.speed*2.4)){const goal=p.approach??p;return{x:goal.x-m.ship.x-m.ship.vx*.22,y:goal.y-m.ship.y-m.ship.vy*.22};}
      const cert=m.field.certificate;let at=cert?Math.round((m.elapsed-cert.context.elapsed)*120):0;
      for(const c of cert?.controls??[]){if(at<c.ticks)return c.input;at-=c.ticks;}return{x:0,y:0};
    });
    if(strategy==='pilot')axis=await r.page.evaluate(() => {const m=window.auditGame.model,c=m.field.certificate;let at=c?Math.round((m.elapsed-c.context.elapsed)*120):0;for(const f of c?.controls??[]){if(at<f.ticks)return f.input;at-=f.ticks;}return{x:0,y:0};});
    const next=new Set(); if(axis.x>.12)next.add('KeyD');if(axis.x<-.12)next.add('KeyA');if(axis.y>.12)next.add('KeyW');if(axis.y<-.12)next.add('KeyS');
    for(const k of held)if(!next.has(k)){await r.page.keyboard.up(k);held.delete(k);}
    for(const k of next)if(!held.has(k)){await r.page.keyboard.down(k);held.add(k);}
    await r.page.waitForTimeout(100);sample++;
  }
  for(const k of held)await r.page.keyboard.up(k);
  r.strategy=strategy;
}
try {
  for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5196/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'chrome',headless:true});result.browser=browser.version();
  if(mode==='live') {
    for(const [seed,strategy,seconds] of [[42,'idle',60],[0,'collector',70],[123,'pilot',90]]) {
      const r=await open({seed,video:`native-${seed}-${strategy}`});
      await shot(r.page,`${r.video}-menu`);await launch(r);await shot(r.page,`${r.video}-launch`);
      await realRun(r,seconds,strategy);
      if((await state(r.page)).state==='PLAYING'){await r.page.keyboard.press('Escape');await shot(r.page,`${r.video}-paused`);}
      if((await state(r.page)).state==='GAME_OVER'){
        await r.page.locator('#replay').click(); await r.page.waitForTimeout(250); await shot(r.page,`${r.video}-restart`);
      }
      await close(r,`${strategy} native real-time keyboard run`);
    }
  }
  if(mode==='matrix') {
    for(const [width,height,touch] of [[1920,1080,false],[1366,768,false],[1280,720,false],[1024,600,false],[390,844,true],[360,800,true],[932,430,true],[768,1024,true]]) {
      const label=`${width}x${height}`,r=await open({viewport:{width,height},touch,video:width===390?'touch-navigation':undefined});
      await shot(r.page,`${label}-menu`);
      await r.page.locator('#menu [data-sound-open]').click();await shot(r.page,`${label}-settings`);
      await r.page.keyboard.press('Escape');await launch(r);await r.page.waitForTimeout(350);await shot(r.page,`${label}-flight`);
      if(touch){const cdp=await r.context.newCDPSession(r.page);const x=width*.5,y=height*.65;
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+65,y:y-50}]});await r.page.waitForTimeout(450);await shot(r.page,`${label}-touch`);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }
      await r.page.locator('#pause').click();const before=await state(r.page);await shot(r.page,`${label}-pause`);
      await r.page.locator('#paused [data-sound-open]').click();
      await r.page.locator('#sound-master').focus();await r.page.keyboard.press('ArrowLeft');await r.page.keyboard.press('KeyP');
      await r.page.waitForTimeout(200);r.dialogKeyState=await state(r.page);
      await r.page.keyboard.press('Escape');await r.page.waitForTimeout(100);r.pauseBefore=before;r.pauseAfter=await state(r.page);
      await r.page.locator('#resume').click();await r.page.waitForTimeout(350);r.resumed=await state(r.page);
      // Fixed-step natural idle continuation uses the real production update path.
      // Speeds up waiting only; no HP, hazard, camera or simulation-state injection.
      await r.page.evaluate(() => {const g=window.auditGame;g.loop.stop();let ticks=0;while(g.model.state==='PLAYING'&&g.model.hull===3&&ticks++<24000){g.loop.update(1/120);g.loop.render(1/120);}g.loop.render(0);window.auditContinuationTicks=ticks;});
      await shot(r.page,`${label}-hull-hit`,'accelerated natural idle first collision; no HP or hazard edits');
      await r.page.evaluate(() => {const g=window.auditGame;for(let i=0;i<24000&&g.model.state==='PLAYING';i++){g.loop.update(1/120);g.loop.render(1/120);}g.loop.render(0);});
      await shot(r.page,`${label}-damage-or-death`,'accelerated natural idle continuation; original update/render and spawned hazards');
      await r.page.evaluate(()=>{const g=window.auditGame;for(let i=0;i<350;i++)g.loop.render(1/120);});
      await shot(r.page,`${label}-results`,'accelerated natural idle death; cinematic advanced via normal render path');
      if(await r.page.locator('#replay').isVisible()){await r.page.locator('#replay').click();await r.page.evaluate(()=>window.auditGame.loop.render(0));await shot(r.page,`${label}-restart`);}
      result.sessions.push({label:`${label} interaction checks`,dialogKeyState:r.dialogKeyState,pauseBefore:r.pauseBefore,pauseAfter:r.pauseAfter,resumed:r.resumed});
      await close(r,`${label} responsive matrix`);
    }
  }
  if(mode==='focused') {
    const r=await open({video:'focused-boundaries-settings'});await launch(r);
    await r.page.keyboard.down('KeyD');await r.page.waitForTimeout(1700);await shot(r.page,'boundary-right');
    await r.page.waitForTimeout(500);await shot(r.page,'boundary-right-held');await r.page.keyboard.up('KeyD');
    await r.page.keyboard.down('KeyW');await r.page.waitForTimeout(1400);await shot(r.page,'boundary-top');await r.page.keyboard.up('KeyW');
    await r.page.keyboard.down('KeyA');await r.page.waitForTimeout(3000);await shot(r.page,'boundary-left');await r.page.keyboard.up('KeyA');
    await r.page.locator('#pause').click();await r.page.locator('#paused [data-sound-open]').click();
    for(const [id,value] of [['sound-master','28'],['sound-music','17'],['sound-sfx','63']])await r.page.locator(`#${id}`).evaluate((n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));},value);
    await r.page.locator('#sound-mute').click();await shot(r.page,'settings-muted');
    await r.page.keyboard.press('Escape');await r.page.locator('#resume').click();await shot(r.page,'silent-flight');
    await r.page.evaluate(()=>window.dispatchEvent(new Event('blur')));await shot(r.page,'focus-loss-pause','synthetic window blur event through actual production listener');
    await r.page.reload();await r.page.locator('#launch').waitFor();await r.page.locator('#menu [data-sound-open]').click();await shot(r.page,'settings-persisted');await r.page.keyboard.press('Escape');
    await close(r,'boundaries, settings persistence, focus loss');
    const q=await open({viewport:{width:390,height:844},touch:true,reduced:true,video:'reduced-motion-rotation'});await launch(q);
    await q.page.waitForTimeout(500);await shot(q.page,'reduced-motion-flight');
    await q.page.setViewportSize({width:844,height:390});await q.page.waitForTimeout(400);await shot(q.page,'rotated-landscape-flight');
    await q.page.locator('#pause').click();await shot(q.page,'rotated-landscape-pause');await q.page.locator('#resume').click();
    await q.page.evaluate(()=>{const g=window.auditGame;g.loop.stop();for(let i=0;i<24000&&g.model.state==='PLAYING';i++){g.loop.update(1/120);g.loop.render(1/120);}g.loop.render(0);});await shot(q.page,'reduced-motion-death-start','accelerated natural idle run, OS reduced motion emulated');
    await q.page.evaluate(()=>{const g=window.auditGame;for(let i=0;i<120;i++)g.loop.render(1/120);});await shot(q.page,'reduced-motion-results','real reduced-motion results after accelerated presentation clock advancement');
    await q.page.locator('#replay').click();await q.page.evaluate(()=>window.auditGame.loop.render(0));await shot(q.page,'reduced-motion-restart');
    await close(q,'reduced motion and orientation');
    // Isolated DOM fixture verifies simultaneous damage/phase2 text geometry only.
    const f=await open();await launch(f);await f.page.locator('#pause').click();
    await f.page.evaluate(()=>{const g=window.auditGame;g.loop.stop();g.model.resume();g.ui.showState(g.model,0,'');g.ui.update(g.model);document.querySelector('#damage').hidden=false;document.querySelector('#phase-notice').hidden=false;});
    await shot(f.page,'fixture-phase2-damage','LABELLED DOM visibility fixture; not a natural phase2 run or gameplay evidence');
    await close(f,'DOM overlap fixture');
    const k=await open({viewport:{width:800,height:450},video:'keyboard-small-window'});
    await shot(k.page,'keyboard-small-window-menu');await launch(k);
    await k.page.keyboard.down('ArrowUp');await k.page.waitForTimeout(350);await k.page.keyboard.up('ArrowUp');await shot(k.page,'keyboard-small-window-flight');
    await k.page.keyboard.press('Escape');await k.page.keyboard.press('Tab');await shot(k.page,'keyboard-focus');
    await k.page.locator('#resume').click();
    await k.page.evaluate(()=>{const g=window.auditGame;g.loop.stop();for(let i=0;i<24000&&g.model.state==='PLAYING';i++){g.loop.update(1/120);g.loop.render(1/120);}g.loop.render(0);});
    await shot(k.page,'skip-cinematic','accelerated natural idle death, held at the actual cinematic state');
    if(await k.page.locator('#skip-destruction').isVisible())await k.page.locator('#skip-destruction').click();
    await shot(k.page,'skip-results');await close(k,'small mouse/keyboard window, focus and cinematic skip');
  }
} catch(e) {result.errors.push({message:String(e),stack:e.stack});console.error(e);process.exitCode=1;}
finally {await save();await browser?.close();server.kill();}
