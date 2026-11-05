import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root='.cache/review/GAMEPLAY-005B',base=JSON.parse(await readFile(`${root}/baseline/pop-in-summary.json`,'utf8')),head=JSON.parse(await readFile(`${root}/final/pop-in-summary.json`,'utf8'));
const sha=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const rows=[],families=new Map();
for(const b of base.runs){const h=head.runs.find(r=>r.seed===b.seed);assert.ok(h);assert.deepEqual(h.publications,b.publications,'Publication decisions changed');
 const br=JSON.parse(await readFile(`${root}/baseline/pop-in-${b.seed}.json`,'utf8')),hr=JSON.parse(await readFile(`${root}/final/pop-in-${b.seed}.json`,'utf8'));assert.deepEqual(hr.inputs,br.inputs);assert.equal(h.hull,b.hull);assert.equal(h.distance,b.distance);
 assert.equal(br.assetsPreloadedBeforeLaunch,true);assert.equal(hr.assetsPreloadedBeforeLaunch,true);assert.equal(hr.revealFallbacks,0);
 for(const o of b.objects){const n=h.objects.find(r=>r.id===o.id);assert.ok(n,o.id);assert.equal(n.publicationTick,o.publicationTick);assert.equal(n.firstActiveTick,o.firstActiveTick);
  const row={seed:b.seed,id:o.id,family:o.family,phase:o.phase,proposalTick:o.proposalTick,publicationTick:o.publicationTick,
   legacy:o.firstVisible,seamless:n.firstVisible,legacyRecognizable:o.firstRecognizable,seamlessRecognizable:n.firstRecognizable,
   recognizableDelaySeconds:o.firstRecognizable&&n.firstRecognizable?(n.firstRecognizable.tick-o.firstRecognizable.tick)/120:null,
   firstCoverage:n.firstDraw?.reveal?.coverage??null};rows.push(row);if(!families.has(o.family))families.set(o.family,[]);families.get(o.family).push(row);
 }
}
const summary=[...families].map(([family,objects])=>{const min=(key,field)=>Math.min(...objects.filter(o=>o[key]).map(o=>o[key][field]));return{family,objects:objects.length,
 legacyDetectOnPublication:objects.filter(o=>o.legacy&&o.legacy.tick<=o.publicationTick+2).length,seamlessDetectOnPublication:objects.filter(o=>o.seamless&&o.seamless.tick<=o.publicationTick+2).length,
 legacyMinRecognizableLead:min('legacyRecognizable','secondsToLeadingCollision'),seamlessMinRecognizableLead:min('seamlessRecognizable','secondsToLeadingCollision'),
 maxRecognitionDelaySeconds:Math.max(...objects.map(o=>o.recognizableDelaySeconds??0)),maxFirstDrawCoverage:Math.max(...objects.map(o=>o.firstCoverage??0))};});
const bcap=JSON.parse(await readFile(`${root}/baseline/visual-captures.json`,'utf8')),hcap=JSON.parse(await readFile(`${root}/final/visual-captures.json`,'utf8'));
const captures=[];for(const b of bcap.results){for(const h of hcap.results.filter(r=>r.name===b.name)){assert.equal(h.stateHash,b.stateHash,`Baseline/HEAD state mismatch: ${b.name}`);
 let exactLegacyPixels;if(h.boundaries==='legacy'&&h.reveal==='legacy'){const x=await readFile(`${root}/baseline/media/${b.screenshot}`),y=await readFile(`${root}/final/media/${h.screenshot}`);exactLegacyPixels=x.equals(y);}
 captures.push({name:b.name,boundaries:h.boundaries,reveal:h.reveal,stateHash:h.stateHash,exactLegacyPng:exactLegacyPixels});}}
const result={baseline:'393c2c6ae48b5cc0f5ec164367d3bcd3f7b0b5ea',matchedRuns:base.runs.length,matchedObjectCount:rows.length,matchedCaptures:captures.length,
 inputAndPublicationHashes:base.runs.map(r=>({seed:r.seed,publications:sha(r.publications)})),families:summary,captures,objects:rows,
 note:'Detectable/recognizable are explicitly defined pixel proxies; not human approval. Matched simulations and publication hashes are exact. An odd-tick station may contribute a few pixels on its first render at tiny birth coverage. No claim of zero stochastic grain or universal occlusion freedom.'};
await writeFile(`${root}/final/visual-analysis.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({objects:rows.length,captures:captures.length,families:summary},null,2));
