"""Package exact committed source, Git materials and actual FEEDBACK-001A evidence."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/review/FEEDBACK-001A'
BASE = '8edfec076ef3860eea33058ce6da2a678e31dbf4'
BRANCH = 'feature/feedback-001a-event-foundation'

def git(*args, env=None):
    return subprocess.check_output(['git', *args], cwd=ROOT, env=env)

def sha(data):
    return hashlib.sha256(data).hexdigest()

head = git('rev-parse', 'HEAD').decode().strip()
assert git('branch', '--show-current').decode().strip() == BRANCH
assert not git('diff', '--name-only', 'HEAD').strip(), 'Commit tracked changes first'
git('merge-base', '--is-ancestor', BASE, head)
browser = json.loads((OUT / 'full-browser/browser-results.json').read_text(encoding='utf-8'))['stats']
assert browser['expected'] == 109 and all(browser[k] == 0 for k in ['unexpected', 'flaky', 'skipped']), browser
unit = (OUT / 'unit.log').read_text(encoding='utf-8-sig')
assert 'tests 318' in unit and 'pass 318' in unit and 'fail 0' in unit
build = (OUT / 'build.log').read_text(encoding='utf-8-sig')
assert 'built in' in build
preservation = json.loads((OUT / 'preservation.json').read_text())
assert preservation['checked'] == 126 and preservation['unchanged'] == 115
performance = json.loads((OUT / 'performance.json').read_text())
assert len(performance['rows']) == 4
for i in range(2):
    assert performance['rows'][i]['stateHash'] == performance['rows'][i + 2]['stateHash']

entries = {}
# Read canonical blobs, not Windows checkout/archive EOL conversions.
paths = git('ls-tree', '-r', '--name-only', head).decode().splitlines()
specs = '\n'.join(f'{head}:{path}' for path in paths) + '\n'
batch = subprocess.check_output(['git', 'cat-file', '--batch'], cwd=ROOT, input=specs.encode())
cursor = 0
for path in paths:
    assert not path.startswith(('node_modules/', 'dist/', '.cache/', 'review-packages/', '.env'))
    end = batch.index(b'\n', cursor)
    header = batch[cursor:end].split()
    assert header[1] == b'blob'
    size = int(header[2]); cursor = end + 1
    entries[f'source/{path}'] = batch[cursor:cursor + size]; cursor += size + 1
assert cursor == len(batch)

inputs = json.loads((OUT / 'validated-inputs.json').read_text())
for item in inputs:
    data = entries[f"source/{item['path']}"]
    if item['text']:
        data = data.replace(b'\r\n', b'\n')
    assert sha(data) == item['sha256'], f"Validated source changed: {item['path']}"

patch = git('diff', '--binary', '--full-index', BASE, head)
patch_path = OUT / 'complete.patch'
patch_path.write_bytes(patch)
# Alternate index stays inside the workspace and never changes the real index.
env = {**os.environ, 'GIT_INDEX_FILE': str(OUT / 'patch-check.index')}
git('read-tree', BASE, env=env)
git('apply', '--cached', '--check', '--binary', str(patch_path), env=env)
git('read-tree', head, env=env)
git('apply', '--cached', '--reverse', '--check', '--binary', str(patch_path), env=env)

identity = {'task': 'FEEDBACK-001A', 'base': BASE, 'head': head,
            'tree': git('rev-parse', 'HEAD^{tree}').decode().strip(), 'branch': BRANCH,
            'remote': git('remote', '-v').decode(), 'pushed': False,
            'patch': 'Forward/reverse cached apply checks passed with an isolated index',
            'unit': 318, 'browser': browser, 'validatedInputs': len(inputs)}
entries['git/identity.json'] = json.dumps(identity, indent=2).encode()
entries['git/full.diff'] = patch
entries['git/status.txt'] = git('status', '--short', '--branch')
entries['git/changed-files.txt'] = git('diff', '--name-status', BASE, head)
entries['git/log.txt'] = git('log', '--format=fuller', f'{BASE}..{head}')
for name in ['REPORT.md', 'ARCHITECTURE.md', 'TESTING.md', 'NEXT-STEPS.md']:
    entries[name] = entries[f'source/docs/review/FEEDBACK-001A/{name}']
for path in OUT.glob('*'):
    if path.is_file() and path.suffix in ('.json', '.log', '.md'):
        entries[f'evidence/{path.name}'] = path.read_bytes()
for path in (OUT / 'screenshots').glob('*.png'):
    entries[f'screenshots/{path.name}'] = path.read_bytes()
entries['evidence/full-browser-results.json'] = (OUT / 'full-browser/browser-results.json').read_bytes()
for path in (OUT / 'full-browser').glob('*.json'):
    entries[f'evidence/full-browser/{path.name}'] = path.read_bytes()
manifest = {**identity, 'files': [{'path': name, 'bytes': len(data), 'sha256': sha(data)} for name, data in entries.items()]}
entries['manifest.json'] = json.dumps(manifest, indent=2).encode()
destination = ROOT / 'review-packages'
destination.mkdir(exist_ok=True)
archive_path = destination / 'FEEDBACK-001A-review.zip'
with zipfile.ZipFile(archive_path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name, data in entries.items():
        archive.writestr(name, data)
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(entries)
    for item in manifest['files']:
        data = archive.read(item['path'])
        assert len(data) == item['bytes'] and sha(data) == item['sha256']
receipt = {**identity, 'path': str(archive_path), 'bytes': archive_path.stat().st_size,
           'sha256': sha(archive_path.read_bytes()), 'entries': len(entries), 'crc': 'passed', 'inventory': 'all SHA256/sizes passed'}
(destination / 'FEEDBACK-001A-review.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
print(json.dumps(receipt, indent=2))
