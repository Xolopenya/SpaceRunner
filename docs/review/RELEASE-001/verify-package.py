from pathlib import Path
import hashlib,json,subprocess,zipfile
root=Path(__file__).resolve().parents[3]
path=root/'review-packages/RELEASE-001-review.zip'
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *a:subprocess.check_output(['git',*a],cwd=root)
digest=sha(path.read_bytes());assert digest==path.with_suffix('.zip.sha256').read_text().split()[0]
with zipfile.ZipFile(path) as z:
    assert z.testzip() is None
    names=z.namelist();assert len(names)==len(set(names))
    inventory=json.loads(z.read('MANIFEST.json'));assert set(names)==set(inventory)|{'MANIFEST.json'}
    for n,f in inventory.items():assert sha(z.read(n))==f['sha256'] and len(z.read(n))==f['bytes'],n
    meta=json.loads(z.read('metadata.json'));head=git('rev-parse','main').decode().strip()
    deploy=json.loads(z.read('deployment.json'))
    assert meta['finalMain']==meta['remoteMain']==deploy['sha']==deploy['metadata']['commit']==head
    assert deploy['run']['conclusion']=='success'
    for n in ['PLAYTEST_NOTES.md','README.md','CHANGELOG.md']:
        assert z.read(n).replace(b'\r\n',b'\n')==git('show',head+':'+n).replace(b'\r\n',b'\n')
    for n in ['RELEASE-REPORT.md','DOCUMENTATION-CHANGES.md','GIT-INTEGRATION.md','DEPLOYMENT.md','TESTING.md','SUBMISSION-SUMMARY.md','index.html']:
        assert z.read(n),n
    assert not git('diff',meta['approvedImplementation'],head,'--','src','public','tests','index.html','package.json','package-lock.json','vite.config.ts','playwright.config.ts')
    assert not any(n.startswith(('node_modules/','dist/','.git/')) for n in names)
receipt={'ZIP':str(path),'SHA256':digest,'entries':len(names),'CRC':'pass','manifest':'pass','documentationMatchesMain':'pass','approvedGamePreserved':'pass','main':head,'publicRevision':deploy['metadata']['commit']}
path.with_suffix('.zip.independent-verification.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print(json.dumps(receipt))
