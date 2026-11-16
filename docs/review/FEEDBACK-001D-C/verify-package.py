"""Independent archive inventory, exact Git-source and full-diff verification."""
from pathlib import Path
import hashlib,json,subprocess,zipfile

root=Path(__file__).resolve().parents[3]
path=root/'review-packages/FEEDBACK-001D-C-review.zip'
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *a:subprocess.check_output(['git',*a],cwd=root)
digest=sha(path.read_bytes())
assert path.with_suffix('.zip.sha256').read_text().split()[0]==digest
with zipfile.ZipFile(path) as z:
    assert z.testzip() is None
    names=z.namelist();assert len(names)==len(set(names))
    assert not any(n.startswith('/') or '..' in Path(n).parts for n in names)
    inventory=json.loads(z.read('MANIFEST.json'))
    assert set(names)==set(inventory)|{'MANIFEST.json'}
    for name,fact in inventory.items():
        data=z.read(name)
        assert sha(data)==fact['sha256'] and len(data)==fact['bytes'],name
    meta=json.loads(z.read('metadata.json'));head=git('rev-parse','HEAD').decode().strip()
    assert meta['base']=='f7827c2cad673a56d27cedff444ad56cc4b7fb26'
    assert meta['finalCommit']==head
    assert meta['branch']=='feature/feedback-001d-c-results-navigation'
    assert z.read('complete.patch')==git('diff','--binary',meta['base'],head)
    for p in meta['changed']:
        assert z.read('source/'+p).replace(b'\r\n',b'\n')==git('show',head+':'+p).replace(b'\r\n',b'\n'),p
    for p,digest_in in json.loads(z.read('verified-inputs.json')).items():
        assert sha(git('show',head+':'+p).replace(b'\r\n',b'\n'))==digest_in,p
    for n in ['REPORT.md','RESULTS-DESIGN.md','STATE-TRANSITIONS.md','TESTING.md','PERFORMANCE.md','VISUAL-REVIEW.md','index.html','gallery-verification.json']:
        assert z.read(n),n
    assert not any(n.startswith(('node_modules/','dist/','.git/')) for n in names)
receipt={'zip':str(path),'entries':len(names),'sha256':digest,'CRC':'pass','inventory':'pass','exactFinalSource':'pass','completeDiff':'pass','base':meta['base'],'finalCommit':head}
path.with_suffix('.zip.independent-verification.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print(json.dumps(receipt))
