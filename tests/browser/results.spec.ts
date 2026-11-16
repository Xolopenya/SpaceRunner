import {test,expect} from './helpers';
import type {Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const evidence='.cache/review/FEEDBACK-001D-C/evidence';

async function boot(page:Page,best?:number,denied=false) {
  await page.addInitScript(({best,denied})=>{
    window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};
    if(best!==undefined)localStorage.setItem('space-runner.best.v1',String(best));
    localStorage.setItem('space-runner.audio.v1',JSON.stringify({master:.28,music:.17,sfx:.63,muted:true}));
    if(denied)Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}});
  },{best,denied});
  await page.goto('/?debug=integrated&seed=42');await page.waitForFunction(()=>!!window.spaceRunner,null,{polling:50});
  await page.locator('#launch').click();
}

/** Original neutral flight and collision path; suppress draws while waiting, then
 * restore actual WebGL rendering. No health, hazard, score or UI-text injection. */
async function die(page:Page) {
  await page.evaluate(()=>{
    const g=window.spaceRunner as any;g.loop.stop();const render=g.world.renderer.render;g.world.renderer.render=()=>{};
    try{for(let i=0;i<24000&&g.model.state==='PLAYING';i++){g.loop.update(1/120);g.loop.render(1/120);}}
    finally{g.world.renderer.render=render;g.loop.render(0);}
  });
  await expect(page.locator('#game')).toHaveAttribute('data-state','GAME_OVER');
}
async function finish(page:Page,skip=false) {
  if(skip)await page.locator('#skip-destruction').click();
  else await page.evaluate(()=>{const g=window.spaceRunner as any;for(let i=0;i<150;i++)g.loop.render(1/60);});
  await expect(page.locator('#game-over')).toBeVisible();
  await expect(page.locator('#replay')).toBeFocused();
}

for(const [label,best,expected] of [['first',undefined,true],['improved',400,true],['higher saved best',2000,false],['equal',868,false]] as const) {
  test(`natural completed record: ${label}`,async({page})=>{
    await boot(page,best);await die(page);
    await expect(page.locator('#game-over')).toBeHidden();await expect(page.locator('#skip-destruction')).toBeFocused();
    await finish(page);
    await expect(page.locator('#final-score')).toHaveText('868');
    if(expected)await expect(page.locator('#new-record')).toBeVisible();else await expect(page.locator('#new-record')).toBeHidden();
    if(label==='improved')await expect(page.locator('#record-comparison')).toHaveText('Previous best · 400 m');
    await expect(page.locator('#final-best')).toHaveText(best===2000?'2,000':'868');
    await page.keyboard.press('Tab');await expect(page.locator('#back-menu')).toBeFocused();
    await page.keyboard.press('Shift+Tab');await expect(page.locator('#replay')).toBeFocused();
    await page.keyboard.press('Escape');await expect(page.locator('#game')).toHaveAttribute('data-state','GAME_OVER');
    await page.keyboard.press('Tab');await page.keyboard.press('Enter');
    await expect(page.locator('#launch')).toBeFocused();await expect(page.locator('#skip-destruction')).toBeHidden();
    const m=await page.evaluate(()=>{const g=window.spaceRunner as any;const before=g.model.distance;g.loop.update(1/120);g.loop.render(0);return{before,after:g.model.distance,state:g.model.state,voices:g.audio.graph?.voices?.length??0,settings:g.audio.settings};});
    expect(m.before).toBe(0);expect(m.after).toBe(0);expect(m.state).toBe('MENU');expect(m.settings).toMatchObject({master:.28,music:.17,sfx:.63,muted:true});
    await page.keyboard.down('KeyD');await page.keyboard.press('Enter');await page.keyboard.up('KeyD');
    await page.evaluate(()=>{const g=window.spaceRunner as any;g.loop.update(1/120);g.loop.render(0);});
    expect(await page.evaluate(()=>({x:window.spaceRunner!.model.ship.x,hull:window.spaceRunner!.model.hull}))).toEqual({x:0,hull:3});
    if(label==='first'){await page.reload();await page.waitForFunction(()=>!!window.spaceRunner,null,{polling:50});await expect(page.locator('#menu-best')).toHaveText('868');}
  });
}

test('skip, replay and menu cycles remain single-run, single-write and resource bounded',async({page})=>{
  test.setTimeout(120000);await boot(page);
  await page.evaluate(()=>{
    const g=window.spaceRunner as any;(window as any).resultFacts=[];(window as any).resultWrites=0;
    g.model.events.subscribe((e:any)=>(window as any).resultFacts.push(e));
    const record=g.platform.scores.record.bind(g.platform.scores);g.platform.scores.record=(n:number)=>{(window as any).resultWrites++;return record(n);};
  });
  const counts=[];
  for(let i=0;i<10;i++){
    await page.locator('#pause').click();await page.locator('#resume').click();
    await die(page);
    if(i%2===0){await page.keyboard.press('Space');await expect(page.locator('#game-over')).toBeVisible();await expect(page.locator('#game')).toHaveAttribute('data-state','GAME_OVER');}else await finish(page);
    const snapshot=await page.evaluate(()=>{const g=window.spaceRunner as any;return {score:g.results.completed.score,id:g.results.completed.runId,record:g.results.completed.newRecord};});
    expect(snapshot.score).toBe(868);expect(snapshot.record).toBe(i===0);
    if(i%2===0){await page.locator('#back-menu').click();await expect(page.locator('#launch')).toBeFocused();await page.locator('#launch').click();}
    else await page.keyboard.press('Space');
    await page.evaluate(()=>{const g=window.spaceRunner as any;g.start();g.loop.render(0);}); // duplicate start is rejected
    counts.push(await page.evaluate(()=>{const g=window.spaceRunner as any;return{runId:g.model.runId,hull:g.model.hull,energy:g.model.fragments.count,distance:g.model.distance,events:g.model.events.subscriberCount,dom:document.getElementsByTagName('*').length,memory:{...g.world.renderer.info.memory},cinematic:g.world.destruction.sequence.active,ended:(window as any).resultFacts.filter((e:any)=>e.type==='run.ended').length,writes:(window as any).resultWrites};}));
    expect(counts[i]).toMatchObject({runId:i+2,hull:3,energy:0,distance:0,cinematic:false,ended:i+1,writes:i+1});
  }
  expect(counts.map(c=>c.events)).toEqual(Array(10).fill(counts[0]!.events));
  expect(counts.map(c=>c.dom)).toEqual(Array(10).fill(counts[0]!.dom));
  expect(counts.map(c=>c.memory)).toEqual(Array(10).fill(counts[0]!.memory));
});

test('touch results navigation survives portrait-to-landscape rotation',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
  await boot(page);await die(page);await page.locator('#skip-destruction').tap();
  await expect(page.locator('#new-record')).toBeVisible();await page.locator('#back-menu').tap();await expect(page.locator('#launch')).toBeFocused();
  await page.locator('#launch').tap();await page.setViewportSize({width:932,height:430});await page.locator('#pause').tap();await page.locator('#resume').tap();
  await die(page);await page.locator('#skip-destruction').tap();await expect(page.locator('#new-record')).toBeHidden();await page.locator('#replay').tap();
  await page.evaluate(()=>{const g=window.spaceRunner as any;g.loop.render(0);});await expect(page.locator('#hull-count')).toHaveText('3');
  await context.close();
});

test('denied storage and reduced-motion skip retain the completed run record',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await boot(page,undefined,true);await die(page);await finish(page,true);
  await expect(page.locator('#new-record')).toBeVisible();await page.locator('#back-menu').click();await expect(page.locator('#menu-best')).toHaveText('868');
  await page.locator('#launch').click();await die(page);await finish(page,true);await expect(page.locator('#new-record')).toBeHidden();
});

for(const [width,height] of [[1920,1080],[1366,768],[1280,720],[1024,600],[800,450],[390,844],[360,800],[932,430],[768,1024],[667,320]]) {
  test(`results metrics and both actions fit ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width:width!,height:height!});await boot(page);await die(page);await finish(page,true);
    const fit=()=>page.evaluate(()=>{
      const ids=['new-record','final-score','final-best','record-comparison','final-energy','replay','back-menu','seed'];
      const rects=ids.map(id=>document.getElementById(id)!).filter(n=>n.getClientRects().length).map(n=>({id:n.id,r:n.getBoundingClientRect(),n}));
      const errors:string[]=[];
      for(const {id,r,n} of rects){if(r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight||n.scrollWidth>n.clientWidth+1)errors.push(id+' clipped');if(n.tagName==='BUTTON'&&(r.width<44||r.height<44))errors.push(id+' target');}
      for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i]!,b=rects[j]!;if(Math.min(a.r.right,b.r.right)>Math.max(a.r.left,b.r.left)&&Math.min(a.r.bottom,b.r.bottom)>Math.max(a.r.top,b.r.top))errors.push(a.id+'/'+b.id);}
      return errors;
    });
    expect(await fit()).toEqual([]);await mkdir(evidence,{recursive:true});await page.screenshot({path:`${evidence}/test-${width}x${height}-results.png`});
    // Labelled layout fixture, separate from natural record verification above.
    await page.evaluate(()=>{const g=window.spaceRunner as any;g.model.distance=1234567890;g.ui.showState(g.model,1234567890,'',false);});
    expect(await fit()).toEqual([]);
    await page.locator('#back-menu').click();await expect(page.locator('#launch')).toBeFocused();
  });
}
