import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const dir=resolve('.cache/review/FEEDBACK-001D-A');
const modes=['live','matrix','focused'];
const raw=await Promise.all(modes.map(async m=>JSON.parse(await readFile(resolve(dir,`${m}.json`),'utf8'))));
const shots=raw.flatMap(j=>j.screenshots), sessions=raw.flatMap(j=>j.sessions);
const intersect=(a,b)=>({width:Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)),height:Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))});
const percentile=(v,q)=>v.slice().sort((a,b)=>a-b)[Math.floor((v.length-1)*q)];
const facts={browser:raw.map(j=>({mode:j.mode,browser:j.browser,errors:j.errors})),captureCount:shots.length,
  nativeRuns:raw[0].sessions.map(s=>{const group=shots.filter(p=>p.path.startsWith(`evidence/native-${s.seed}-`));const played=Math.max(0,...group.filter(p=>p.state==='PLAYING'||p.state==='PAUSED'||p.state==='GAME_OVER').map(p=>p.elapsed??0));const end=s.final.events.find(e=>e.type==='run.ended');const gaps=s.final.frameGaps;return {label:s.label,seed:s.seed,wallSeconds:s.wallSeconds,playWallSeconds:s.playWallSeconds,gameplaySeconds:end?.payload.elapsed??played,score:end?.payload.score??Math.floor(s.final.distance),hullAtEnd:group.filter(p=>p.path.includes('paused')||p.path.includes('results')).at(-1)?.hull,pickups:s.final.events.filter(e=>e.type==='collectible.collected').length,damage:s.final.events.filter(e=>e.type==='player.damage').map(e=>({elapsed:e.payload.elapsed,kind:e.payload.obstacleKind,hp:e.payload.currentHP})),recordEvents:s.final.events.filter(e=>e.type==='score.recordBroken'),raf:{samples:gaps.length,p50:percentile(gaps,.5),p95:percentile(gaps,.95),max:Math.max(...gaps)},errors:s.errors,failed:s.failed};}),
  overlap:shots.filter(s=>s.path.includes('hull-hit')||s.path.includes('idle-hull-2')).flatMap(s=>{const a=s.rects.find(r=>r.id==='damage'),b=s.rects.find(r=>r.id==='phase-label');return a&&b?[{path:s.path,viewport:s.viewport,damage:a.rect,phase:b.rect,intersection:intersect(a.rect,b.rect)}]:[];}),
  pausedChecks:sessions.filter(s=>s.pauseBefore).map(s=>({label:s.label,before:s.pauseBefore.elapsed,after:s.pauseAfter.elapsed,dialogState:s.dialogKeyState.state,afterDialogState:s.pauseAfter.state,returnedFocus:s.pauseAfter.active,resumeState:s.resumed.state,resumeVelocity:s.resumed.ship})),
  controlFit:shots.filter(s=>/-(menu|pause|results|settings|flight)\.png$/.test(s.path)).map(s=>({path:s.path,viewport:s.viewport,problems:s.buttons.filter(b=>b.rect.width<44||b.rect.height<44||b.rect.left<-.5||b.rect.right>s.viewport.width+.5||b.rect.top<-.5||b.rect.bottom>s.viewport.height+.5).map(b=>({id:b.id,rect:b.rect}))})),
  focused:shots.filter(s=>/boundary-|reduced-motion|settings-(muted|persisted)|skip-/.test(s.path)).map(s=>({path:s.path,ship:s.ship,elapsed:s.elapsed,quality:s.quality,audio:s.audio,state:s.state,cinematic:s.cinematic})),
  caveat:'RAF samples are observational; full browser regressions ran concurrently. They are not isolated performance benchmarks. Matrix continuations are accelerated actual update/render paths, not measured playtime.'};
await writeFile(resolve(dir,'facts.json'),JSON.stringify(facts,null,2));
console.log(JSON.stringify(facts,null,2));
