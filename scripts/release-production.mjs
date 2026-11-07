import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {openGame,advance,chromium} from './release-browser-lib.mjs';
import {buildPages} from './release-build.mjs';
const dir=process.env.REVIEW_RESULT_DIR??'.cache/review/RELEASE-007/final';await mkdir(`${dir}/media`,{recursive:true});
const env={...process.env,GITHUB_ACTIONS:'true'};await buildPages();
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5188','--strictPort'],{env,stdio:'ignore',windowsHide:true});
for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:5188/SpaceRunner/');break}catch{await new Promise(r=>setTimeout(r,100))}}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const r=await openGame(browser,'http://127.0.0.1:5188/SpaceRunner/');await advance(r.page,null,5000);const s=await r.page.evaluate(()=>window.releaseState());
 assert.equal(s.source,'integrated-playable-v1');assert.equal(s.camera,'hybrid-chase');assert.equal(s.warp,'fragmented-warp');assert.equal(s.legacyVisible,false);assert.equal(s.fieldVisible,true);assert.equal(s.phase,2);assert.equal(s.hull,3);
 await r.page.screenshot({path:`${dir}/media/production-phase2.png`});assert.deepEqual(r.errors,[]);assert.deepEqual(r.failed,[]);await writeFile(`${dir}/production-browser.json`,JSON.stringify({url:r.page.url(),state:s,requests:r.requests,errors:r.errors,failed:r.failed,probe:'CDP observes existing normal Launch listener; no altered production response, debug URL or inserted entities'},null,2));await r.context.close();
}finally{await browser.close();server.kill();}
