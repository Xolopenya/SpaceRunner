import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=process.argv.find(a=>a.startsWith('--sha='))?.slice(6),stage=process.argv.find(a=>a.startsWith('--stage='))?.slice(8)??'final';assert.match(sha??'',/^[0-9a-f]{40}$/);assert.ok(['first','final'].includes(stage));
const directory='.cache/review/RELEASE-007/final';await mkdir(directory,{recursive:true});
const headers={'User-Agent':'SpaceRunner-release-verifier','Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
let run;
for(let n=0;n<40;n++){
 const url=run?`https://api.github.com/repos/Xolopenya/SpaceRunner/actions/runs/${run.id}`:'https://api.github.com/repos/Xolopenya/SpaceRunner/actions/workflows/deploy.yml/runs?branch=main&per_page=10';
 const response=await fetch(url,{headers});assert.equal(response.status,200,`GitHub Actions API ${response.status}: ${await response.clone().text()}`);const data=await response.json();run=run?data:data.workflow_runs.find(r=>r.head_sha===sha);
 if(run){await writeFile(`${directory}/deployment-${stage}-progress.json`,JSON.stringify(run,null,2));console.log(run.id,run.status,run.conclusion??'');if(run.status==='completed')break;}
 await new Promise(r=>setTimeout(r,15000));
}
assert.ok(run&&run.status==='completed','Deployment did not complete within bounded observation');assert.equal(run.head_sha,sha);assert.equal(run.conclusion,'success','Deployment workflow failed; do not claim publication');
const url='https://xolopenya.github.io/SpaceRunner/';let metadata;
for(let n=0;n<30;n++){const r=await fetch(`${url}release.json?verify=${sha}&attempt=${n}`,{headers:{'Cache-Control':'no-cache'}});if(r.ok){const m=await r.json();if(m.commit===sha){metadata=m;break;}}await new Promise(r=>setTimeout(r,5000));}
assert.equal(metadata?.commit,sha,'Public Pages metadata does not match deployed commit');
const assets=[];for(const item of metadata.files){const response=await fetch(`${url}${item.path}?verify=${sha}`);assert.equal(response.status,200,item.path);const bytes=Buffer.from(await response.arrayBuffer()),hash=createHash('sha256').update(bytes).digest('hex');assert.equal(bytes.length,item.bytes,item.path);assert.equal(hash,item.sha256,item.path);assets.push({...item,status:response.status,contentType:response.headers.get('content-type')});}
const result={stage,commit:sha,publicUrl:url,run:{id:run.id,url:run.html_url,headSha:run.head_sha,status:run.status,conclusion:run.conclusion,startedAt:run.run_started_at,updatedAt:run.updated_at},metadata,assets,verifiedAt:new Date().toISOString()};
await writeFile(`${directory}/deployment-${stage}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({commit:sha,run:run.id,conclusion:run.conclusion,publicMetadata:'exact SHA',assetHashesVerified:assets.length},null,2));
