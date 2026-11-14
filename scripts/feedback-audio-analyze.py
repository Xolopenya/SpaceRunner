"""Measure actual native-graph WAVs; this is signal QA, not human artistic approval."""
from pathlib import Path
import json
import math
import wave
import numpy as np

ROOT = Path('.cache/review/FEEDBACK-001C')
results = []
for mode in ['baseline', 'final']:
    for path in sorted((ROOT / mode / 'audio').glob('*.wav')):
        with wave.open(str(path), 'rb') as wav:
            rate, channels = wav.getframerate(), wav.getnchannels()
            samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').reshape(-1, channels).astype(float) / 32768
        peak = float(np.max(np.abs(samples)))
        rms = float(np.sqrt(np.mean(samples ** 2)))
        windows = [float(np.sqrt(np.mean(samples[i:i + rate] ** 2))) for i in range(0, len(samples), rate)]
        row = dict(mode=mode, file=path.name, seconds=len(samples)/rate, peak=peak, peakDbFS=20*math.log10(max(peak, 1e-12)),
                   rms=rms, rmsDbFS=20*math.log10(max(rms, 1e-12)), fullScaleSamples=int(np.sum(np.abs(samples)>=.9999)), oneSecondRms=windows)
        row['monoRmsRatio']=float(np.sqrt(np.mean(samples.mean(axis=1)**2))/max(rms,1e-12))
        if path.stem=='music' and mode=='final':
            row['loopSeamSampleSteps']={str(t):float(np.max(np.abs(samples[int(t*rate)]-samples[int(t*rate)-1]))) for t in [64,128]}
        assert peak < .95 and row['fullScaleSamples'] == 0, row
        if path.stem == 'collisions' and mode == 'final':
            families = []
            names = ['rock1','rock2','rock3','metal1','metal2','metal3','station1','station2','station3','mine1','mine2','mine3','pickup','pickup2','pickup3','crackle']
            for i, name in enumerate(names):
                start = int((.5 + i * 1.4) * rate)
                clip = samples[start:start+int(1.2*rate)]
                mono = clip.mean(axis=1)
                power = np.abs(np.fft.rfft(mono * np.hanning(len(mono)))) ** 2
                frequencies = np.fft.rfftfreq(len(mono), 1/rate)
                families.append(dict(name=name, at=.5+i*1.4, peak=float(np.max(np.abs(clip))), rms=float(np.sqrt(np.mean(clip**2))),
                                     centroidHz=float(np.sum(power*frequencies)/max(np.sum(power),1e-12))))
            row['families'] = families
            # Individually playable excerpts from the actual rendered SFX graph.
            for name, start, end in [('mine',13.0,17.1),('pickups',17.2,21.4)]:
                with wave.open(str(path.parent/f'{name}-excerpt.wav'),'wb') as out:
                    out.setparams((channels,2,rate,0,'NONE','not compressed'))
                    out.writeframes((samples[int(start*rate):int(end*rate)]*32767).astype('<i2').tobytes())
        if path.stem == 'lifecycle':
            row['pausedRmsAt9s'] = windows[9]
            row['mutedRmsAt13s'] = windows[13]
            assert windows[9] < .00001 and windows[13] < .00001
        results.append(row)
(ROOT/'signal-analysis.json').write_text(json.dumps({'method':'Actual rendered PCM; no normalisation. NumPy FFT centroid is descriptive, not a subjective listening score.', 'results':results},indent=2),encoding='utf8')
print(json.dumps([dict(mode=r['mode'],file=r['file'],peak=round(r['peak'],4),rmsDbFS=round(r['rmsDbFS'],2)) for r in results],indent=2))
