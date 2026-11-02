import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export const REVIEW_ONLY_FILES=Object.freeze(['scripts/target-lock-flow-preservation.mjs','scripts/target-lock-review-resume.mjs','scripts/review-verify.mjs','scripts/target-lock-verify-package.mjs','tests/review-resume.test.ts','docs/review/GAMEPLAY-EXPERIMENT-003C3/ARCHITECTURE.md']);
export function resumableCheck(taskId,changed,command,previous){
  if(taskId==='ASSIGNMENT-002')return changed.length>0&&changed.every(p=>['README.md','CHANGELOG.md','docs/TASKS.md'].includes(p)||/^docs\/assignment-002\/[A-Z_]+\.md$/.test(p))
    &&['npm run test:browser','node scripts/assignment-browser.mjs'].includes(command)&&previous?.command===command&&previous.exitCode===0;
  return taskId==='GAMEPLAY-EXPERIMENT-003C3'&&changed.every(p=>REVIEW_ONLY_FILES.includes(p))
    &&['npm run test:browser','node --experimental-strip-types scripts/runtime-history.mjs','node --experimental-strip-types scripts/runtime-benchmark.mjs'].includes(command)
    &&previous?.command===command&&previous.exitCode===0;
}
export async function loadReviewCheckpoint(taskId,directory,head,git){
  if(process.env.REVIEW_RESUME_RECEIPT!=='1')return undefined;
  const receipt=JSON.parse(await readFile(join(directory,'review-resume-receipt.json'),'utf8'));
  assert.equal(receipt.taskId,taskId);git('merge-base','--is-ancestor',receipt.head,head);
  const changed=git('diff','--name-only',receipt.head,head).toString().trim().split('\n').filter(Boolean);
  if(taskId==='ASSIGNMENT-002'){
    assert.equal(receipt.checks.length,2);assert.ok(receipt.checks.every(c=>resumableCheck(taskId,changed,c.command,c)),'Only documentation changes may reuse completed browser evidence');
    for(const file of ['test-browser.log','browser-results.json','assignment-browser.log','browser.json'])assert.ok(receipt.files.some(f=>f.file===file));
    for(const f of receipt.files){assert.ok(/^[a-zA-Z0-9-]+\.(?:json|log)$/.test(f.file));const b=await readFile(join(directory,f.file));assert.equal(b.length,f.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);}
    return{receipt,changed};
  }

  assert.ok(changed.every(p=>REVIEW_ONLY_FILES.includes(p)),'Resume refuses changes outside the explicit review-only allowlist');
  assert.equal(receipt.checks.length,3);assert.ok(receipt.checks.every(c=>resumableCheck(taskId,changed,c.command,c)));
  for(const file of [...receipt.checks.map(c=>c.log),'browser-results.json','runtime-history.json','runtime-metrics.json','runtime-model-metrics.json'])assert.ok(receipt.files.some(r=>r.file===file),'Missing checkpoint evidence: '+file);
  for(const r of receipt.files){assert.ok(/^[a-zA-Z0-9-]+\.(?:json|log)$/.test(r.file));const bytes=await readFile(join(directory,r.file));assert.equal(bytes.length,r.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256,'Checkpoint file changed: '+r.file);}
  return{receipt,changed};
}
