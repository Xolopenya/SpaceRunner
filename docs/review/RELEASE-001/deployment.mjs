import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const sha=process.argv[2];assert.match(sha??'',/^[a-f0-9]{40}$/);
const dir='.cache/review/RELEASE-001',publicUrl='https://xolopenya.github.io/SpaceRunner/';
await mkdir(dir,{recursive:true});
const headers={'User-Agent':'SpaceRunner-RELEASE-001','Accept':'application/vnd.github+json'};
// One bounded poll per invocation; the agent can communicate between polls.
const response=await fetch('https://api.github.com/repos/Xolopenya/SpaceRunner/actions/workflows/deploy.yml/runs?branch=main&per_page=10',{headers});
assert.equal(response.status,200,`Actions API ${response.status}`);
const body=await response.json(),run=body.workflow_runs.find(r=>r.head_sha===sha);
await writeFile(`${dir}/actions-latest.json`,JSON.stringify({expected:sha,run:run??null,checkedAt:new Date().toISOString()},null,2));
if(!run||run.status!=='completed'){console.log(JSON.stringify({state:run?.status??'not visible yet',id:run?.id,sha}));process.exit(3);}
assert.equal(run.conclusion,'success',`Workflow ${run.id}: ${run.conclusion}`);
const jobsResponse=await fetch(run.jobs_url,{headers});assert.equal(jobsResponse.status,200);
await writeFile(`${dir}/actions-jobs.json`,JSON.stringify(await jobsResponse.json(),null,2));
const logs=await fetch(run.logs_url,{headers});
const logReceipt={url:run.logs_url,status:logs.status};
if(logs.ok){const bytes=Buffer.from(await logs.arrayBuffer());await writeFile(`${dir}/logs/deployment-actions.zip`,bytes);logReceipt.bytes=bytes.length;logReceipt.sha256=createHash('sha256').update(bytes).digest('hex');}
await writeFile(`${dir}/actions-log-download.json`,JSON.stringify(logReceipt,null,2));
const remote=await fetch('https://api.github.com/repos/Xolopenya/SpaceRunner/commits/main',{headers});assert.equal(remote.status,200);assert.equal((await remote.json()).sha,sha);
const metadataResponse=await fetch(`${publicUrl}release.json?revision=${sha}&t=${Date.now()}`,{headers:{'Cache-Control':'no-cache'}});assert.equal(metadataResponse.status,200);
const metadata=await metadataResponse.json();
if(metadata.commit!==sha){console.log(JSON.stringify({state:'waiting for Pages edge',actual:metadata.commit,expected:sha}));process.exit(3);}
assert.equal(metadata.task,'RELEASE-001');assert.equal(metadata.approvedImplementation,'b34b5a6a3f8b04ab8f4254abaf432c5e2bfb9127');
const assets=[];
for(const item of metadata.files){
 const r=await fetch(`${publicUrl}${item.path}?revision=${sha}`,{headers:{'Cache-Control':'no-cache'}});assert.equal(r.status,200,item.path);
 const bytes=Buffer.from(await r.arrayBuffer()),hash=createHash('sha256').update(bytes).digest('hex');assert.equal(bytes.length,item.bytes,item.path);assert.equal(hash,item.sha256,item.path);
 assets.push({...item,status:r.status,contentType:r.headers.get('content-type')});
}
await writeFile(`${dir}/deployment.json`,JSON.stringify({publicUrl,sha,run,metadata,assets,verifiedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({state:'verified',sha,run:run.id,publicUrl,assets:assets.length}));
