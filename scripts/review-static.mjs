import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, git } from './review-verify.mjs';
import { excludedPath, containsSecret } from './review-safety.mjs';

const files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z').toString().split('\0').filter(Boolean);
const excluded = [];
let checked = 0;
for (const file of files) {
  if (excludedPath(file)) { excluded.push(file); continue; }
  if (containsSecret(await readFile(join(root, file)))) throw new Error(`Potential credential signature in ${file}; inspect locally without exposing the value.`);
  checked++;
}
console.log(JSON.stringify({ checkedFiles: checked, excludedPaths: excluded, knownCredentialSignatures: 0, note: 'Known-pattern check, not an exhaustive secret audit. Snapshot generation independently scans committed blobs.' }, null, 2));
