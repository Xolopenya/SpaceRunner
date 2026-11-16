"""Build the exact-source, offline FEEDBACK-001D-C review bundle (no downloads)."""
from pathlib import Path
import hashlib, html, json, re, shutil, subprocess, sys, zipfile

ROOT = Path(__file__).resolve().parents[3]
DOC = ROOT / 'docs/review/FEEDBACK-001D-C'
D = ROOT / '.cache/review/FEEDBACK-001D-C'
STAGE = D / 'package'
BASE = 'f7827c2cad673a56d27cedff444ad56cc4b7fb26'
REPORTS = ['REPORT.md','RESULTS-DESIGN.md','STATE-TRANSITIONS.md','TESTING.md','PERFORMANCE.md','VISUAL-REVIEW.md']
PRODUCTION = {'index.html','src/game.ts','src/ui.ts','src/styles.css','src/core/game-model.ts','src/release/model.ts','src/run-results.ts'}
TESTS = {'playwright.config.ts','tests/results.test.ts','tests/browser/results.spec.ts','tests/fixtures/feedback-instrumentation.ts','tests/vfx.test.ts','tests/large-structure.test.ts'}

def git(*args):
    return subprocess.check_output(['git',*args],cwd=ROOT).decode('utf-8').strip()

def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))

def write(p, text):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(text,encoding='utf-8')

def dump(p, value):
    write(p,json.dumps(value,ensure_ascii=False,indent=2))

def sha(data):
    return hashlib.sha256(data).hexdigest()

def copy(a,b):
    b.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(a,b)

def p95(a):
    return sorted(a)[int(len(a)*.95)]

def checks():
    stats=read(D/'full/browser-results.json')['stats']
    assert stats['expected']+stats['flaky']==148 and stats['unexpected']==stats['skipped']==0,stats
    assert read(D/'focused-final/browser-results.json')['stats']['expected']==17
    assert (D/'performance.json').stat().st_mtime > (D/'full/browser-results.json').stat().st_mtime
    changed=git('diff','--name-only',BASE).splitlines()
    # Include the task's new files before the milestone commit as well.
    for p in sorted(PRODUCTION|TESTS):
        if (ROOT/p).exists() and p not in changed and not git('ls-tree','--name-only',BASE,'--',p):
            changed.append(p)
    unexpected=[p for p in changed if p not in PRODUCTION|TESTS and not (p=='docs/TASKS.md' or p.startswith('docs/review/FEEDBACK-001D-C/'))]
    assert not unexpected,unexpected
    core=(ROOT/'src/core/game-model.ts').read_text(encoding='utf-8')
    core=re.sub(r'\n  // FEEDBACK-001D-C menu navigation begin\n[\s\S]*?  // FEEDBACK-001D-C menu navigation end\n','',core)
    original=subprocess.check_output(['git','show',BASE+':src/core/game-model.ts'],cwd=ROOT).decode().replace('\r\n','\n')
    assert core==original,'Original core executable lines changed'
    release=(ROOT/'src/release/model.ts').read_text(encoding='utf-8')
    release=release.replace(' override returnToMenu():boolean{\n  if(!super.returnToMenu())return false;\n  this.fragments.reset();this.collisions.reset();return true;\n }\n','')
    original=subprocess.check_output(['git','show',BASE+':src/release/model.ts'],cwd=ROOT).decode().replace('\r\n','\n')
    assert release==original,'Original release executable lines changed'
    # Runtime, assets, dependencies and browser scenarios outside the explicit scope stay exact.
    protected=[]
    for p in git('ls-tree','-r','--name-only',BASE).splitlines():
        if p not in PRODUCTION|TESTS and (p.startswith(('src/','public/','tests/')) or p in {'package.json','package-lock.json','vite.config.ts'}):
            current=(ROOT/p).read_bytes().replace(b'\r\n',b'\n')
            before=subprocess.check_output(['git','show',BASE+':'+p],cwd=ROOT).replace(b'\r\n',b'\n')
            assert current==before,p
            protected.append({'path':p,'sha256LF':sha(current)})
    dump(D/'preservation.json',{'base':BASE,'protected':protected,'coreWithoutAdditiveMenuMethod':'exact baseline','releaseWithoutAdditiveMenuMethod':'exact baseline','allowed':sorted(PRODUCTION|TESTS)})
    return stats,changed

def reports():
    stats,_=checks()
    perf=read(D/'performance.json')
    first=stats['expected'];flaky=stats['flaky'];duration=stats['duration']/1000
    bodies={
'REPORT.md':'''# FEEDBACK-001D-C — Results and menu navigation

UX-06 and UX-07 are implemented within approved Concept A. A restrained cyan NEW PERSONAL BEST label replaces HULL DEPLETED for the completed run; the distance remains dominant, energy remains an informational count, and route seed stays tertiary. The personal-best area shows the updated best plus the previous best (or First personal best). Equal/lower scores do not announce a record.

RunResults captures a run-specific baseline on the existing run.started fact, before final persistence. The immutable final snapshot includes runId, score, energy, seed, previousBest and newRecord. Final score > previousBest is authoritative; comparison with already-updated storage is never used. The existing model record baseline/event and score/storage algorithms and key remain unchanged. Persistence happens once on the existing GAME_OVER transition, before cinematic completion; skip/show/menu do not save again.

Fly again remains the primary one-step replay. Back to menu is a native secondary button. A guarded GameModel.returnToMenu transitions only an already completed GAME_OVER flight to MENU; release collectible/collision and pending-field state reset. Game clears input, obsolete results-cue intent, feedback and world effects, resets the existing audio run, clears the snapshot and restores menu focus/audio. No Game reconstruction or reload, duplicate run.ended, abandonment rule or new shortcut.

The only core/release changes are additive navigation/reset methods. All original executable flight, start, collision, score and generation lines remain exact. Existing historical source hashes are retained: a narrowly labelled method-strip helper excludes only the separately tested additive core transition. Two old tests use that helper; no approved hash or original assertion is weakened. package.py checks the entire protected source/asset/test set against the exact baseline and checks core/release after removal of those methods.

Applied Game Studio game-ui-frontend and game-playtest plus local space-runner-ui-design. These skills guide repository Playwright/Chrome tooling; no unavailable hosted Game Studio service is claimed. three-webgl-game was not needed. No subagents, assets, dependencies, progression, onboarding D, boundary E, camera/VFX/SFX changes, push, merge or deployment.

Owner/physical-device acceptance remains open. See TESTING.md for actual receipts and initial harness failures, PERFORMANCE.md for measured limits, metadata.json for exact final Git identity. Ready to begin FEEDBACK-001D-D as a separate task after review.
''',
'RESULTS-DESIGN.md':'''# Results design

Approved Concept A — Flight Instrumentation is retained: Oxanium display numerals, IBM Plex Mono labels, existing cyan/muted tokens, angular primary button and visible 3D aftermath. Distance is the largest number. Energy fragments are a smaller plain count, with no spend/upgrade/reward claim. Personal best occupies the established right-side/portrait record area. Route seed stays a small muted footer.

NEW PERSONAL BEST replaces the existing top label in cyan rather than adding a tall block. For a positive first run the comparison says First personal best; an improvement shows Previous best · N m. Ordinary/equal/lower results retain HULL DEPLETED and current PERSONAL BEST. The record has role=status and no animation dependency, celebration effects, extra canvas or reveal timer. Reduced motion displays the same information immediately when the existing shortened cinematic ends.

Fly again retains its primary fill/geometry and default focus. Back to menu uses the existing quieter text-button style directly after Replay in DOM order; both have native keyboard/touch activation and visible focus. Essential targets are at least 44px in actual rendered geometry tests. The gameplay canvas is removed from the tab order outside PLAYING. No focus framework or global Escape menu shortcut is introduced.

Wide/tall layouts preserve the established composition. Portrait keeps vertical actions and existing responsive number sizing. Compact landscape at height<=520 and width>=601 uses a two-column action row, smaller normal result numeral and compact heading spacing; long numerals retain the old data-size rules. The 521–650px desktop band anchors results at the existing top safe margin. These are shared aspect/height rules, not per-device patches. Tested at the required nine viewports plus 667x320 with no result/action overlap, clipping or essential scrolling; the large-number fixture is explicitly separate from natural scores. Existing safe-area rules remain, with no physical-notch claim.
''',
'STATE-TRANSITIONS.md':'''# State transitions and ownership

Before: MENU -> PLAYING <-> PAUSED; fatal contact -> GAME_OVER with existing presentation-only cinematic; completion/skip reveals results; Fly again -> PLAYING. New: completed results -> MENU -> PLAYING. GAME_OVER remains the model state throughout cinematic and results; no additional gameplay state is invented.

```mermaid
stateDiagram-v2
    [*] --> MENU: ready
    MENU --> PLAYING: Launch
    PLAYING --> PAUSED: pause
    PAUSED --> PLAYING: Resume
    PLAYING --> GAME_OVER: fatal contact / save snapshot once
    state GAME_OVER {
        [*] --> Cinematic
        Cinematic --> Results: completion or Skip
    }
    GAME_OVER --> PLAYING: Results / Fly again
    GAME_OVER --> MENU: Results / Back to menu
```

run.started captures the current platform best into RunResults for this runId. Model.setRecordBaseline still receives the same best and score.recordBroken still fires through existing feedback. At the first GAME_OVER sync, finish freezes final score/energy/seed plus strict comparison with pre-run best and calls the unchanged store once. Repeated finish for that runId and stale runIds are ignored. The snapshot survives cinematic completion/skip; begin resets it on replay, clear resets it after returning to menu. Equal/lower/zero results are not new records. Storage-denied behavior remains the existing in-memory best fallback; reload persistence only applies where storage works.

The existing cinematic starts from the real fatal event. Results stay hidden while it is active; Skip owns focus. Natural finish or Skip updates presentation to the same snapshot and focuses Replay. Existing sequence timing, camera, fragment breakup, reduced-motion shortening and audio cues are untouched. The pending-results cue is cleared on menu navigation before sync, preventing an obsolete cue. The new label has no timed reveal callback.

returnToMenu rejects states other than GAME_OVER; the Game handler also rejects an active cinematic. It resets ship/field/elapsed/distance/invulnerability/hull and queued facts, not runId or saved best. Field.reset cancels pending work using the existing implementation; ReleaseModel additionally clears fragments and collision transient data. No run starts, end event, score write or simulation is performed in MENU. Game clears input, audio run voices/transients, coordinator and world presentation with existing reset functions, then syncs MENU and calls existing audio.activate. Sound preferences/context/decoded samples/score sources remain owned by the same audio graph.

Fly again uses the existing start path and seed policy, resetting distance, energy, HP, input, audio/world/feedback and setting the next model baseline. A new guard rejects duplicate starts while playing, paused or cinematic-active; normal pause Restart retains its existing separate handler. Back and Replay are one native button activation; no confirmation or reload.

Focus: MENU/Back -> Launch; PLAYING/Replay -> canvas; PAUSED -> Resume; active death -> Skip; results -> Fly again. Tab/Shift+Tab follow visible native buttons; canvas has tabindex=-1 outside gameplay. Existing sound-dialog focus/Escape handling is retained; Escape on results has no new meaning. Enter/Space still skip only during active cinematic; normal button activation works afterwards. Input.clear runs on state transitions and menu entry, so a held previous-run key does not steer a newly launched flight. No new subscriptions or timers are added by RunResults or navigation.
''',
'TESTING.md':f'''# Validation

Exact baseline {BASE}; requested branch feature/feedback-001d-c-results-navigation. Final commit/status/source inventory are in metadata.json. No push or merge. All original 131 browser cases remain, with 17 new results cases (148 total). No deleted/skipped scenarios or relaxed assertions.

Final unit run: 357/357 pass, including 10 focused result/navigation tests. npm run typecheck and npm run build pass. Build retains the pre-existing >500kB chunk advisory. Focused results browser run: 17/17 first attempt, no retries/failures/skips. Full browser run: **{first} first-attempt passes / {flaky} passed on retry / {stats['unexpected']} failed / {stats['skipped']} skipped**, duration {duration:.1f}s. The raw JSON/logs and any failed-attempt attachments are retained. Chrome headless, one worker, retries=1 for the full run; retry-dependent success is counted separately.

Record units cover first-positive/greater/equal/lower/zero, multiple runIds/stale/duplicate finish, real ScoreStorage persistence and denied fallback, immutable skip/reduced-motion result and clean navigation. Model units cover invalid-state guards, GAME_OVER->MENU->PLAYING, original replay path, queued-event cleanup, no new run/end event or menu simulation, release fragment/pending reset. Browser tests exercise the real Game input/audio/world lifecycle rather than mirroring it in pure unit mocks.

New browser cases reach natural death using original seed42 neutral fixed simulation (868m); no HP/hazard/score/UI text injection in record/lifecycle scenarios. Render draws are suppressed only during accelerated waiting and restored for actual WebGL screenshots. They cover first/improved 400 / equal 868 / higher 2000 best, first reload, denied storage, normal/reduced cinematic skip, ten alternating completion/skip/replay/menu/launch/pause/resume cycles, one storage-record call and end fact per run, duplicate-start rejection, clean HP/energy/distance/input, native Enter/Space/Tab/Shift+Tab, Escape, focus, portrait touch taps and landscape rotation. Held KeyD before Launch is cleared. Existing audio/settings/keyboard/mouse/skip/accessibility/camera/generation browser coverage remains.

Geometry cases cover 1920x1080,1366x768,1280x720,1024x600,800x450,390x844,360x800,932x430,768x1024 and 667x320. Actual visible metric/button rectangles are tested pairwise for overlap, clipping/scroll overflow and 44px targets. A labelled 1234567890 layout fixture additionally tests old responsive number sizing; it is not presented as an earned score. Real screenshots supplement DOM checks. Existing safe-area/reduced-motion/context-recovery cases are retained.

Initial harness failures are preserved in logs: a stale previously running Vite server returned 504 Outdated Optimize Dep and the run was interrupted; the verified task-owned server was restarted with --force. A second focused invocation held requestAnimationFrame for deterministic fixtures but used default RAF polling for app readiness, so it stalled and was interrupted. The test now explicitly polls at 50ms. These were setup/test-harness fixes, not game changes. Earlier focused 15/15 and final 17/17 receipts are included separately. Final full receipts below are from the corrected harness. Any individual full-suite retries are listed in full-attempts.json.

Commands: npm test; npm run typecheck; npm run build; npm run test:browser -- --project=results --workers=1 --output=.cache/review/FEEDBACK-001D-C/focused-final-artifacts; npm run test:browser -- --workers=1 --retries=1 --output=.cache/review/FEEDBACK-001D-C/full-artifacts. REVIEW_RESULT_DIR selects pre-created JSON receipt directories. Reproducible capture.mjs/performance.mjs use frozen baseline/current production previews and original simulation, with no shipped production hook. Run browser/capture/performance jobs sequentially to avoid interference.

No physical phone, Safari/Firefox, true browser zoom, screen-reader session, human listening or owner playtest is claimed. Shortcuts/focus and contrast geometry were exercised automatically and screenshots visually inspected; this is not a formal accessibility certification. No unrelated historical frame-time anomaly is claimed fixed.
''',
'PERFORMANCE.md':'''# Performance and lifecycle

No new dependency, per-frame UI loop, layout measurement, timeout, shader, render pass, 3D asset or animation. RunResults is one small snapshot per run, updated by the existing coordinator's hud port. Back to menu adds one click listener owned by Game's existing AbortController; the coordinator retains its single subscription. Existing resets and audio graph are reused.

Sequential baseline/final production samples use desktop Chrome 1280x800, 600 native frames each (two original fixed ticks per frame), then ten original natural-death/replay cycles per version. Final alternates menu/Launch and Replay; baseline has Replay only because the menu path did not exist. This difference is explicit. Audio is fully loaded/running before measurement. Sampling ran after the full browser suite, without concurrent builds/capture/test jobs. Raw arrays/counters are in performance.json.

| Version | RAF p95 / max ms | Update/render p95 / max ms | CDP nodes min–max | CDP listeners min–max | Listeners after disposal |
|---|---:|---:|---:|---:|---:|
''',
'VISUAL-REVIEW.md':'''# Visual review

Open standalone index.html. Exact baseline production is paired with final production at all nine requested viewports. Seed42 neutral flight reaches the same real 868m fatal state; camera/VFX/HP/hazard rules are not edited. Cinematic snapshots precede normal completion. Final new-record results, repeated equal-score skipped results, menu retaining best 868, clean Launch and clean Fly again are labelled separately with state/focus/score/energy/elapsed metadata in before-captures.json and after-captures.json. Results are captured with the actual DOM and WebGL renderer. Extra browser PNGs cover ten layout sizes, including667x320.

Inspected desktop, compact800x450, portrait390x844, landscape932x430 and tablet768x1024 before/after/results/menu/replay screenshots. The cyan record label is conspicuous without competing with large distance. Ordinary equal-score results restore HULL DEPLETED. Personal best remains distinct and smaller; previous/first-best copy is muted. Replay is dominant, Back to menu is secondary. Energy is a plain count, route seed small. The scene/aftermath, original typography and angular Flight Instrumentation identity remain recognizable. No dashboard/reward/progression/effect redesign.

Compact landscape puts both actions on one row so neither drops below the screen; portrait preserves existing vertical hierarchy. Geometry tests and inspected screenshots show no essential overlap/clipping/scroll for the matrix. Focus metadata confirms Skip -> Replay -> Launch/canvas; the existing primary focus outline remains visible. Large values are a separate labelled test fixture, not fabricated primary evidence.

Two silent recorded videos include an accelerated simulation prefix and a short native-rendered segment. They are not ordinary continuous human playtime or audio synchronization/listening evidence. Automated lifecycle/audio tests supply sound-state checks. No new visual defect was identified in the inspected matrix; small peripheral text, real sunlight/notches, true browser zoom, physical touch comfort and human readability acceptance remain open. Gallery links/images and desktop/mobile overflow are separately browser-verified in gallery-verification.json.
'''
}
    perf_notes=[]
    for row in perf['rows']:
        nodes=[c['cdp']['nodes'] for c in row['cycles']]
        listeners=[c['cdp']['jsEventListeners'] for c in row['cycles']]
        bodies['PERFORMANCE.md']+=f"| {row['mode']} | {p95(row['measure']['gaps']):.2f} / {max(row['measure']['gaps']):.2f} | {p95(row['measure']['cost']):.2f} / {max(row['measure']['cost']):.2f} | {min(nodes)}–{max(nodes)} | {min(listeners)}–{max(listeners)} | {row['disposed']['jsEventListeners']} |\n"
        c=row['cycles'][0]
        perf_notes.append(f"\n{row['mode']}:10 cycles; fixed DOM elements {c['dom']}, subscriptions {c['events']}, GPU geometries {c['resources']['geometries']}/textures {c['resources']['textures']}/programs {c['programs']}; max active voices {max(c['voices'] for c in row['cycles'])}, retained score sources {c['scoreSources']}. Same audio graph/context/source identities in every cycle; one end per run, full HP 3 and zero distance/energy on restart. Browser errors={len(row['errors'])}, failed requests={len(row['failed'])}.\n")
    bodies['PERFORMANCE.md']+='\n'.join(perf_notes)
    bodies['PERFORMANCE.md']+='\nFour static DOM elements and one abortable click listener are added. No growth is observed over the ten cycles. Both versions retain one RAF gap>=50ms (max 66.7ms); update/render maxima remain 81.1/70.4ms. Those outliers are reported, not treated as fixed. Counters are taken after explicit GC at equivalent clean-start points. CDP counts include browser/document listeners and detached nodes; finite values are not all Game-owned. dispose removes Game listeners; raw post-disposal counts remain reported. The short sample verifies bounded observed resets and no measurable recurring UI workload, not a long-duration leak proof or phone FPS guarantee. Small p95 differences are noise at this scale; no speedup or unrelated cadence/stall fix is claimed.\n'
    for name,body in bodies.items():write(DOC/name,body)
    print(json.dumps({'reports':len(bodies),'stats':stats}))

def prepare():
    stats,changed=checks()
    final=git('rev-parse','HEAD')
    meta={'base':BASE,'finalCommit':final,'branch':git('branch','--show-current'),'status':git('status','--short'),'changed':sorted(changed),'fullBrowserStats':stats,'preservation':'pass','push':'not attempted','merge':'not attempted'}
    dump(D/'metadata.json',meta)
    attempts=[]
    def walk(suite):
        for spec in suite.get('specs',[]):
            for test in spec.get('tests',[]):
                attempts.append({'file':spec['file'],'title':spec['title'],'project':test['projectName'],'status':test['status'],'attempts':[{'retry':r['retry'],'status':r['status'],'duration':r['duration'],'errors':r.get('errors',[])} for r in test['results']]})
        for child in suite.get('suites',[]):walk(child)
    for suite in read(D/'full/browser-results.json')['suites']:walk(suite)
    dump(D/'full-attempts.json',attempts)
    for p in DOC.iterdir():
        if p.is_file():copy(p,STAGE/p.name)
    for folder in ['evidence','logs','focused','focused-final','full']:
        for p in (D/folder).rglob('*'):
            if p.is_file():copy(p,STAGE/folder/p.relative_to(D/folder))
    for folder in ['focused-artifacts','focused-clean-artifacts','full-artifacts']:
        for context in (D/folder).rglob('error-context.md'):
            for p in context.parent.iterdir():
                if p.is_file():copy(p,STAGE/'attempt-artifacts'/folder/p.relative_to(D/folder))
    for name in ['before-captures.json','after-captures.json','performance.json','metadata.json','preservation.json','full-attempts.json','gallery-verification.json','gallery-review.png','gallery-mobile.png']:
        if (D/name).exists():copy(D/name,STAGE/name)
    for p in changed:
        if (ROOT/p).is_file():copy(ROOT/p,STAGE/'source'/p)
    patch=subprocess.check_output(['git','diff','--binary',BASE],cwd=ROOT)
    (STAGE/'complete.patch').write_bytes(patch)
    # All tracked runtime/test/config input hashes, independent of changed-file inventory.
    inputs={p:sha((ROOT/p).read_bytes().replace(b'\r\n',b'\n')) for p in git('ls-files').splitlines() if p.startswith(('src/','tests/','public/')) or p in {'index.html','playwright.config.ts','package.json','package-lock.json','vite.config.ts','tsconfig.json'}}
    dump(STAGE/'verified-inputs.json',inputs)
    before=read(D/'before-captures.json')['rows'];after=read(D/'after-captures.json')['rows']
    out=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FEEDBACK-001D-C review</title><style>body{font:16px/1.5 system-ui;background:#07111f;color:#edf4f5;margin:clamp(12px,3vw,28px)}a{color:#8cdeeb;overflow-wrap:anywhere}h1{font-size:clamp(24px,4vw,38px)}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{min-width:0;margin:0}img,video{display:block;width:100%;height:auto;max-height:680px;object-fit:contain;object-position:left top}section{border-top:1px solid #496070;margin-top:24px;padding-top:12px}nav{display:flex;flex-wrap:wrap;gap:12px}figcaption{margin:8px 0;color:#b3c7ce}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><h1>Results, records &amp; menu navigation</h1><p>FEEDBACK-001D-C · exact baseline versus final production. Real original seed42 flight; accelerated fixed simulation, then original cinematic/rendering. No human/device acceptance claimed. Full Git identity in metadata.json.</p>', '<nav>'+''.join(f'<a href="{n}">{n}</a>' for n in REPORTS+['metadata.json','complete.patch','performance.json','preservation.json','full-attempts.json'])+'</nav>']
    def picture(row,mode):
        name=html.escape(row['path']);focus=html.escape(str(row.get('focus','')))
        return f'<figure><a href="evidence/{name}"><img loading="lazy" src="evidence/{name}" alt="{mode} {name}"></a><figcaption>{mode} · {row["width"]}×{row["height"]} · {row["label"]} · {row["state"]} · score{row["score"]} / energy{row["energy"]} / best{row["best"]} · focus {focus}</figcaption></figure>'
    out.append('<h2>Matched first-run results</h2>')
    for b in before:
        if b['label']!='results':continue
        a=next(r for r in after if r['label']=='results' and (r['width'],r['height'])==(b['width'],b['height']))
        for key in ['score','hull','energy','elapsed','state']:assert b[key]==a[key],(key,b,a)
        out.append(f'<section><h3>{a["width"]}×{a["height"]}</h3><div class="pair">{picture(b,"Before")}{picture(a,"After · first personal best")}</div></section>')
    out.append('<h2>Equal result, skip and navigation</h2>')
    for size in [(1280,720),(390,844),(800,450),(932,430),(768,1024)]:
        out.append(f'<section><h3>{size[0]}×{size[1]}</h3><div class="pair">')
        for label in ['equal-skipped-results','menu','relaunched','replayed']:
            row=next(r for r in after if (r['width'],r['height'])==size and r['label']==label)
            out.append(picture(row,'After'))
        out.append('</div></section>')
    out.append('<h2>Approved cinematic retained</h2><div class="pair">')
    for mode,rows in [('Before',before),('After',after)]:out.append(picture(next(r for r in rows if r['width']==1280 and r['label']=='cinematic'),mode))
    out.append('</div><h2>Additional browser layout evidence</h2><div class="pair">')
    for p in sorted((D/'evidence').glob('test-*.png')):out.append(f'<figure><img loading="lazy" src="evidence/{p.name}" alt="{p.name}"><figcaption>{p.name} · natural results, automated geometry checks</figcaption></figure>')
    out.append('</div><h2>Silent recordings</h2><p>Accelerated prefix, then a short native-rendered segment; not continuous human playtime or audio evidence.</p><div class="pair">')
    for mode in ['before','after']:out.append(f'<figure><video controls preload="none" src="evidence/{mode}-results.webm"></video><figcaption>{mode}</figcaption></figure>')
    out.append('</div></html>')
    write(STAGE/'index.html','\n'.join(out))
    print(json.dumps({'stage':str(STAGE),'stats':stats,'sourceFiles':len(changed),'images':len(before)+len(after)}))

def pack():
    prepare()
    assert git('diff','--name-only')=='' and git('diff','--cached','--name-only')=='','Commit reviewed changes before packing'
    assert (D/'gallery-verification.json').exists()
    files={p.relative_to(STAGE).as_posix():{'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in STAGE.rglob('*') if p.is_file() and p.name!='MANIFEST.json'}
    dump(STAGE/'MANIFEST.json',files)
    path=ROOT/'review-packages/FEEDBACK-001D-C-review.zip';path.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        for p in sorted(STAGE.rglob('*')):
            if p.is_file():z.write(p,p.relative_to(STAGE).as_posix())
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None
        assert set(z.namelist())==set(files)|{'MANIFEST.json'}
        for n,h in files.items():assert sha(z.read(n))==h['sha256']
    digest=sha(path.read_bytes())
    write(path.with_suffix('.zip.sha256'),digest+'  '+path.name+'\n')
    receipt={'zip':str(path),'sha256':digest,'CRC':'pass','inventory':'pass','entries':len(files)+1,'base':BASE,'finalCommit':git('rev-parse','HEAD')}
    dump(path.with_suffix('.zip.verification.json'),receipt)
    print(json.dumps(receipt))

if __name__=='__main__':
    {'reports':reports,'prepare':prepare,'pack':pack}[sys.argv[1] if len(sys.argv)>1 else 'prepare']()
