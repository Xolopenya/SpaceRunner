import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { safeZipName } from './zip.mjs';

/** Preserve explicitly named pre-existing user work without adding it to HEAD/ZIP.
 * Tracked changes and every other untracked path still fail closed. */
export async function reviewWorktree(config, root, git) {
  if (git('status', '--porcelain=v1', '--untracked-files=no').toString().trim()) throw new Error('Commit intended tracked changes before packaging.');
  const allowed = config.preservedUntracked ?? [];
  if (allowed.some(p => !safeZipName(p.replace(/\/$/, '')) || /[*?]/.test(p))) throw new Error('Unsafe preserved-user-work path');
  const files = git('ls-files', '--others', '--exclude-standard', '-z').toString().split('\0').filter(Boolean).sort();
  const inventory = [];
  for (const path of files) {
    if (!allowed.some(p => p.endsWith('/') ? path.startsWith(p) : path === p)) throw new Error(`Unexpected untracked file: ${path}`);
    const bytes = await readFile(join(root, path));
    inventory.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  return inventory;
}
