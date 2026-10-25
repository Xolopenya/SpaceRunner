import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Plain Node review tooling has no application declaration.
import { reviewWorktree } from '../scripts/review-worktree.mjs';

test('review packaging preserves only explicitly named untracked work and refuses tracked changes', async () => {
  const git = (...args: string[]) => Buffer.from(args[0] === 'status' ? '' : 'docs/TASKS.md\0');
  await assert.rejects(reviewWorktree({}, process.cwd(), git), /Unexpected untracked/);
  const files = await reviewWorktree({ preservedUntracked: ['docs/TASKS.md'] }, process.cwd(), git);
  assert.equal(files.length, 1); assert.match(files[0].sha256, /^[a-f0-9]{64}$/);
  await assert.rejects(reviewWorktree({ preservedUntracked: ['docs/'] }, process.cwd(), () => Buffer.from(' M src/main.ts')), /tracked changes/);
  await assert.rejects(reviewWorktree({ preservedUntracked: ['../'] }, process.cwd(), () => Buffer.from('')), /Unsafe/);
});
