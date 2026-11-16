import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RunResults} from '../src/run-results.ts';
import {ScoreStorage} from '../src/services/storage.ts';
import {GameModel} from '../src/core/game-model.ts';
import {ReleaseModel} from '../src/release/model.ts';
import {DestructionSequence} from '../src/feedback/destruction-sequence.ts';

for (const [best, score, expected] of [[0,35,true],[35,90,true],[35,35,false],[90,35,false],[0,0,false]] as const) {
  test(`run-specific record: previous ${best}, result ${score}`,()=>{
    const result=new RunResults(),store=new ScoreStorage(()=>({getItem:()=>String(best),setItem(){}}));
    result.begin(1,store.best);result.finish(1,score,3,42,store);
    assert.equal(result.completed?.newRecord,expected);assert.equal(result.completed?.previousBest,best);
    assert.equal(result.completed?.energy,3);assert.equal(store.best,Math.max(best,score));
    assert.ok(Object.isFrozen(result.completed));
  });
}

test('completion persists once, ignores stale runs, and clears the next baseline independently',()=>{
  let writes=0;const store=new ScoreStorage(()=>({getItem:()=>null,setItem(){writes++;}})),r=new RunResults();
  r.begin(1,store.best);r.finish(99,999,1,1,store);assert.equal(r.completed,undefined);
  r.finish(1,50,2,42,store);const first=r.completed;r.finish(1,500,9,1,store);
  assert.equal(r.completed,first);assert.equal(writes,1);assert.equal(store.best,50);
  r.begin(2,store.best);assert.equal(r.completed,undefined);r.finish(1,999,9,1,store);
  r.finish(2,50,0,43,store);assert.equal(r.completed?.newRecord,false);assert.equal(writes,1);
  r.begin(3,store.best);r.finish(3,51,1,44,store);assert.equal(r.completed?.newRecord,true);assert.equal(writes,2);
  r.clear();r.finish(3,999,1,44,store);assert.equal(r.completed,undefined);assert.equal(writes,2);
});

test('persisted best survives reload and denied storage keeps an in-memory baseline',()=>{
  let saved:string|null=null;const access=()=>({getItem:()=>saved,setItem(_key:string,value:string){saved=value;}});
  const one=new ScoreStorage(access),r=new RunResults();r.begin(1,one.best);r.finish(1,120,0,1,one);
  const two=new ScoreStorage(access);assert.equal(two.best,120);r.begin(2,two.best);r.finish(2,120,0,1,two);assert.equal(r.completed?.newRecord,false);
  const denied=new ScoreStorage(()=>{throw Error('denied');});r.begin(3,denied.best);r.finish(3,80,0,1,denied);
  assert.equal(denied.best,80);r.begin(4,denied.best);r.finish(4,79,0,1,denied);assert.equal(r.completed?.newRecord,false);
});

test('record snapshot is unchanged by cinematic completion or skip',()=>{
  const r=new RunResults(),store=new ScoreStorage(()=>{throw Error('denied');});r.begin(1,0);r.finish(1,60,2,42,store);
  const result=r.completed;
  for(const reduced of [false,true]){const sequence=new DestructionSequence();sequence.begin(1,reduced);sequence.update('GAME_OVER',.1);sequence.skip();assert.equal(sequence.active,false);assert.equal(r.completed,result);}
});

test('navigation rejects active/paused states and never creates another run or end event',()=>{
  const m=new GameModel(),events:string[]=[];m.events.subscribe(e=>events.push(e.type));m.ready();assert.equal(m.returnToMenu(),false);
  m.start(42);m.events.flush();m.pause();assert.equal(m.returnToMenu(),false);m.resume();assert.equal(m.returnToMenu(),false);
  m.state='GAME_OVER';m.distance=50;m.hull=0;m.invulnerability=1;m.ship.x=4;
  const id=m.runId;m.events.emit('score.recordBroken',{runId:id,elapsed:1,previousBest:0,score:50});
  assert.equal(m.returnToMenu(),true);m.events.flush();assert.equal(m.events.pendingCount,0);assert.deepEqual(events,['run.started']);
  assert.equal(m.runId,id);assert.equal(m.hull,3);assert.equal(m.distance,0);assert.equal(m.ship.x,0);
  m.step(1/120,{x:1,y:1});assert.equal(m.distance,0);assert.equal(m.ship.x,0);
  m.start(99);m.events.flush();assert.equal(m.runId,id+1);assert.equal(m.state,'PLAYING');assert.equal(events.filter(e=>e==='run.started').length,2);m.dispose();
});

test('release menu cleanup retires collectibles and pending work without changing the next start',()=>{
  const m=new ReleaseModel();m.ready();m.start(42);m.state='GAME_OVER';m.fragments.count=5;
  assert.equal(m.returnToMenu(),true);assert.equal(m.fragments.count,0);assert.equal(m.fragments.active.length,0);
  assert.equal(m.field.pending,undefined);m.start(42);assert.equal(m.hull,3);assert.equal(m.distance,0);assert.equal(m.fragments.count,0);m.dispose();
});
