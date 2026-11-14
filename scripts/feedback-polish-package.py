"""Exact committed FEEDBACK-001B1 source and actual visual/verification evidence."""
from pathlib import Path
import hashlib
import html
import json
import os
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/review/FEEDBACK-001B1'
BASE = '2eb974199bfa58ae120dbf9f12e8bf53a6b5da2a'
BRANCH = 'feature/feedback-001b1-visual-polish'

def git(*args, env=None):
    return subprocess.check_output(['git', *args], cwd=ROOT, env=env)

def sha(data):
    return hashlib.sha256(data).hexdigest()

head = git('rev-parse', 'HEAD').decode().strip()
assert git('branch', '--show-current').decode().strip() == BRANCH
assert not git('diff', '--name-only', 'HEAD').strip(), 'Commit tracked changes first'
git('merge-base', '--is-ancestor', BASE, head)
browser = json.loads((OUT / 'full-browser/browser-results.json').read_text(encoding='utf-8'))['stats']
assert browser['expected'] == 114 and all(browser[k] == 0 for k in ['unexpected', 'flaky', 'skipped']), browser
unit = (OUT / 'unit.log').read_text(encoding='utf-8-sig')
assert 'tests 328' in unit and 'pass 328' in unit and 'fail 0' in unit
build = (OUT / 'build.log').read_text(encoding='utf-8-sig')
assert 'built in' in build
preservation = json.loads((OUT / 'preservation.json').read_text())
assert len(preservation['changed']) == 4 and preservation['unchanged'] == preservation['checked'] - 4
performance = json.loads((OUT / 'performance.json').read_text())
assert len(performance['rows']) == 20
for i in range(10):
    assert performance['rows'][i]['stateHash'] == performance['rows'][i + 10]['stateHash']
before = json.loads((OUT / 'baseline/captures.json').read_text())
after = json.loads((OUT / 'final/captures.json').read_text())
assert len(before['receipts']) == len(after['receipts']) == 38
for b, a in zip(before['receipts'], after['receipts']):
    for key in ['path', 'tick', 'elapsed', 'hull', 'immunity', 'position', 'distance', 'cinematic', 'collisions', 'camera', 'fault']:
        assert b[key] == a[key], (key, b['path'])
    assert a['fault'] is None

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

identity = {'task': 'FEEDBACK-001B1', 'base': BASE, 'head': head,
            'tree': git('rev-parse', 'HEAD^{tree}').decode().strip(), 'branch': BRANCH,
            'remote': git('remote', '-v').decode(), 'pushed': False,
            'patch': 'Forward/reverse cached apply checks passed with an isolated index',
            'unit': 328, 'browser': browser, 'validatedInputs': len(inputs), 'naturalGameplayFrames': 76}
entries['git/identity.json'] = json.dumps(identity, indent=2).encode()
entries['git/full.diff'] = patch
entries['git/status.txt'] = git('status', '--short', '--branch')
entries['git/changed-files.txt'] = git('diff', '--name-status', BASE, head)
entries['git/log.txt'] = git('log', '--format=fuller', f'{BASE}..{head}')
for name in ['REPORT.md', 'ARCHITECTURE.md', 'TESTING.md', 'VISUAL-REVIEW.md', 'PERFORMANCE.md', 'AUDIT.md']:
    entries[name] = entries[f'source/docs/review/FEEDBACK-001B1/{name}']
for path in OUT.glob('*'):
    if path.is_file() and path.suffix in ('.json', '.log', '.md'):
        entries[f'evidence/{path.name}'] = path.read_bytes()
for directory in ['first-browser-failure', 'passive-baseline', 'passive-final']:
    for path in (OUT / directory).glob('*'):
        if path.is_file():
            entries[f'evidence/{directory}/{path.name}'] = path.read_bytes()
for mode in ['baseline', 'final']:
    for path in (OUT / mode).glob('*'):
        if path.is_file():
            entries[f'{mode}/{path.name}'] = path.read_bytes()
for path in (OUT / 'iteration-1').glob('*.png'):
    entries[f'iteration-1/{path.name}'] = path.read_bytes()
figures=[]
for row in after['receipts']:
    name=html.escape(row['path'], quote=True)
    caption=html.escape(f"{row['path']}   HP{row['hull']}   tick{row['tick']}   immunity{row['immunity']:.3f}s   death{row['cinematic']:.3f}s")
    figures.append(f'<section><h2>{caption}</h2><div class="pair"><figure><figcaption>001B baseline</figcaption><a href="baseline/{name}"><img loading="lazy" src="baseline/{name}"></a></figure><figure><figcaption>001B1 final</figcaption><a href="final/{name}"><img loading="lazy" src="final/{name}"></a></figure></div></section>')
clips=[]
for name in ['desktop-shield','desktop-mine','desktop-death','mobile-shield','mobile-mine','mobile-death']:
    clips.append(f'<h2>{name}   silent native captures</h2><div class="pair"><div>001B baseline<video controls preload="none" src="baseline/{name}.webm"></video></div><div>001B1 final<video controls preload="none" src="final/{name}.webm"></video></div></div>')
entries['visuals.html']=('''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FEEDBACK-001B1 matched production review</title>
<style>body{font:16px system-ui;background:#07111e;color:#d8edf3;margin:24px}p{max-width:1100px;line-height:1.5}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}img,video{width:100%;height:auto}h2{font-size:15px;margin-top:28px}a{color:#8ceaff}@media(max-width:750px){.pair{grid-template-columns:1fr}}</style>
<h1>001B baseline /001B1 final</h1><p>Original production app, same seed42 input tapes, accepted hazards, Hybrid camera, viewport, tick and post-contact times. No hazard/HP/cooldown edits. Prefixes accelerated and screenshots held; native RAF post-contact progression. Videos are silent. Inspected automation evidence does not replace owner artistic/comfort acceptance. See REPORT.md and VISUAL-REVIEW.md.</p>
'''+''.join(clips)+''.join(figures)).encode()
entries['evidence/full-browser-results.json'] = (OUT / 'full-browser/browser-results.json').read_bytes()
for path in (OUT / 'full-browser').glob('*.json'):
    entries[f'evidence/full-browser/{path.name}'] = path.read_bytes()
manifest = {**identity, 'files': [{'path': name, 'bytes': len(data), 'sha256': sha(data)} for name, data in entries.items()]}
entries['manifest.json'] = json.dumps(manifest, indent=2).encode()
destination = ROOT / 'review-packages'
destination.mkdir(exist_ok=True)
archive_path = destination / 'FEEDBACK-001B1-review.zip'
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
(destination / 'FEEDBACK-001B1-review.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
print(json.dumps(receipt, indent=2))
