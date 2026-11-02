import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumableCheck } from '../scripts/target-lock-review-resume.mjs';
const command='npm run test:browser',previous={command,exitCode:0};
test('review checkpoint permits only passed source-identical long checks for this task',()=>{
 assert.ok(resumableCheck('GAMEPLAY-EXPERIMENT-003C3',['scripts/target-lock-flow-preservation.mjs'],command,previous));
 assert.equal(resumableCheck('OTHER',[],command,previous),false);
});
test('review checkpoint refuses every gameplay, test, configuration and dependency change',()=>{
 for(const file of ['src/core/field-validator.ts','tests/browser/target-lock.spec.ts','playwright.config.ts','package-lock.json','review.config.json'])assert.equal(resumableCheck('GAMEPLAY-EXPERIMENT-003C3',[file],command,previous),false,file);
});
test('review checkpoint refuses failed results and different commands',()=>{
 assert.equal(resumableCheck('GAMEPLAY-EXPERIMENT-003C3',[],command,{command,exitCode:1}),false);
 assert.equal(resumableCheck('GAMEPLAY-EXPERIMENT-003C3',[],command,{command:'other',exitCode:0}),false);
});
test('review checkpoint never skips fresh unit, source-safety, fallback or targeted audits',()=>{
 for(const command of ['npm run test','node scripts/review-static.mjs','node --experimental-strip-types scripts/target-lock-flow-preservation.mjs','node --experimental-strip-types scripts/target-lock-benchmark.mjs'])assert.equal(resumableCheck('GAMEPLAY-EXPERIMENT-003C3',[],command,{command,exitCode:0}),false);
});

test('assignment browser receipt accepts only documentation-only follow-up commits',()=>{
 assert.ok(resumableCheck('ASSIGNMENT-002',['docs/assignment-002/DELIVERY_CHECKLIST.md'],command,previous));
 for(const file of ['src/release/model.ts','review.config.json','scripts/assignment-browser.mjs','tests/browser/ui.spec.ts'])assert.equal(resumableCheck('ASSIGNMENT-002',[file],command,previous),false);
 assert.equal(resumableCheck('ASSIGNMENT-002',[],command,previous),false);
 assert.equal(resumableCheck('ASSIGNMENT-002',['README.md'],command,{command,exitCode:1}),false);
});
