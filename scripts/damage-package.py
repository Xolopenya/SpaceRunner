"""Exact committed FEEDBACK-001B source and actual visual/verification evidence."""
from pathlib import Path
import hashlib
import html
import json
import os
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/review/FEEDBACK-001B'
BASE = '5f5a4282d110187d7549e38366051ccfab139f6d'
BRANCH = 'feature/feedback-001b-damage-destruction'

def git(*args, env=None):
    return subprocess.check_output(['git', *args], cwd=ROOT, env=env)

def sha(data):
    return hashlib.sha256(data).hexdigest()

head = git('rev-parse', 'HEAD').decode().strip()
assert git('branch', '--show-current').decode().strip() == BRANCH
assert not git('diff', '--name-only', 'HEAD').strip(), 'Commit tracked changes first'
git('merge-base', '--is-ancestor', BASE, head)
browser = json.loads((OUT / 'full-browser/browser-results.json').read_text(encoding='utf-8'))['stats']
assert browser['expected'] == 113 and all(browser[k] == 0 for k in ['unexpected', 'flaky', 'skipped']), browser
unit = (OUT / 'unit.log').read_text(encoding='utf-8-sig')
assert 'tests 325' in unit and 'pass 325' in unit and 'fail 0' in unit
build = (OUT / 'build.log').read_text(encoding='utf-8-sig')
assert 'built in' in build
preservation = json.loads((OUT / 'preservation.json').read_text())
assert preservation['checked'] == 130 and preservation['unchanged'] == 120
performance = json.loads((OUT / 'performance.json').read_text())
assert len(performance['rows']) == 8
for i in range(4):
    assert performance['rows'][i]['stateHash'] == performance['rows'][i + 4]['stateHash']
for name, count in [('heavy-performance.json', 8), ('memory-performance.json', 4)]:
    rows=json.loads((OUT/name).read_text())['rows']
    assert len(rows)==count
    for i in range(count//2):
        assert rows[i]['stateHash']==rows[i+count//2]['stateHash']
captures = json.loads((OUT / 'gameplay/captures.json').read_text())
assert len(captures['receipts']) == 32
assert all(r['fault'] is None for r in captures['receipts'])
assert all(r['hull'] == 2 for r in captures['receipts'] if r['path'].endswith('-damaged.png'))
assert all(r['hull'] == 1 for r in captures['receipts'] if r['path'].endswith('-critical.png'))

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

identity = {'task': 'FEEDBACK-001B', 'base': BASE, 'head': head,
            'tree': git('rev-parse', 'HEAD^{tree}').decode().strip(), 'branch': BRANCH,
            'remote': git('remote', '-v').decode(), 'pushed': False,
            'patch': 'Forward/reverse cached apply checks passed with an isolated index',
            'unit': 325, 'browser': browser, 'validatedInputs': len(inputs), 'naturalGameplayFrames': 32}
entries['git/identity.json'] = json.dumps(identity, indent=2).encode()
entries['git/full.diff'] = patch
entries['git/status.txt'] = git('status', '--short', '--branch')
entries['git/changed-files.txt'] = git('diff', '--name-status', BASE, head)
entries['git/log.txt'] = git('log', '--format=fuller', f'{BASE}..{head}')
for name in ['REPORT.md', 'ARCHITECTURE.md', 'TESTING.md', 'VISUAL-REVIEW.md', 'PERFORMANCE.md', 'AUDIT.md']:
    entries[name] = entries[f'source/docs/review/FEEDBACK-001B/{name}']
for path in OUT.glob('*'):
    if path.is_file() and path.suffix in ('.json', '.log', '.md'):
        entries[f'evidence/{path.name}'] = path.read_bytes()
for path in (OUT / 'gameplay').glob('*'):
    if path.is_file():
        entries[f'gameplay/{path.name}'] = path.read_bytes()
figures=[]
for row in captures['receipts']:
    name=html.escape(row['path'], quote=True)
    caption=html.escape(f"{row['path']} · HP{row['hull']} · {row['phase']} · {row['cinematicTime']:.2f}s")
    figures.append(f'<figure><a href="gameplay/{name}"><img loading="lazy" src="gameplay/{name}"></a><figcaption>{caption}</figcaption></figure>')
entries['visuals.html']=('''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FEEDBACK-001B actual production gameplay</title>
<style>body{font:16px system-ui;background:#07111e;color:#d8edf3;margin:24px}p{max-width:1050px;line-height:1.5}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}figure{margin:0}img,video{width:100%;height:auto}figcaption{font-size:12px;margin:8px 0 20px}a{color:#8ceaff}video{max-width:1280px}</style>
<h1>FEEDBACK-001B · actual production gameplay</h1><p>Original certified hazards and input-only pilot, no entities/HP/cooldown edits. Prefixes accelerated, screenshot poses deliberately held; death progresses on native RAF. This is browser automation, not owner acceptance. See REPORT.md, VISUAL-REVIEW.md and gameplay/captures.json for provenance and limits.</p>
<video controls preload="metadata" src="gameplay/natural-destruction.webm"></video><div class="grid">'''+''.join(figures)+'</div>').encode()
entries['evidence/full-browser-results.json'] = (OUT / 'full-browser/browser-results.json').read_bytes()
for path in (OUT / 'full-browser').glob('*.json'):
    entries[f'evidence/full-browser/{path.name}'] = path.read_bytes()
manifest = {**identity, 'files': [{'path': name, 'bytes': len(data), 'sha256': sha(data)} for name, data in entries.items()]}
entries['manifest.json'] = json.dumps(manifest, indent=2).encode()
destination = ROOT / 'review-packages'
destination.mkdir(exist_ok=True)
archive_path = destination / 'FEEDBACK-001B-review.zip'
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
(destination / 'FEEDBACK-001B-review.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
print(json.dumps(receipt, indent=2))
