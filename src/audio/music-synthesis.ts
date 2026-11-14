import { AUDIO } from './settings.ts';

const TAU = Math.PI * 2;
const wave=Float32Array.from({length:4096},(_,i)=>Math.sin(TAU*i/4096));
const sine=(phase:number):number=>{
  const position=phase*(4096/TAU), index=Math.floor(position), fraction=position-index;
  return wave[index&4095]!*(1-fraction)+wave[(index+1)&4095]!*fraction;
};
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);
export interface MusicStems { ambient: [Float32Array, Float32Array]; pulse: [Float32Array]; pressure: [Float32Array] }

/** Original 32-bar / 64-second score at 120 BPM. The four eight-bar chapters
 * change voicing, bass syncopation, arp contour and percussion orchestration.
 * Circular note tails cross the loop seam; all stems share exactly one grid. */
export function musicStems(sampleRate: number = AUDIO.sampleRate): MusicStems {
  const length = Math.round(AUDIO.musicSeconds * sampleRate);
  const left = new Float32Array(length), right = new Float32Array(length);
  const pulse = new Float32Array(length), pressure = new Float32Array(length);
  const chords = [[50,57,60,64], [46,53,57,62], [41,48,55,57], [48,55,62,64],
    [50,57,60,65], [53,60,64,69], [46,53,60,62], [45,52,59,64],
    [50,57,64,65], [48,55,62,67], [46,53,57,64], [43,50,57,62],
    [41,48,55,60], [46,53,60,65], [45,52,57,62], [45,52,60,64]];
  const add = (buffer: Float32Array, start: number, duration: number, sample: (t: number) => number) => {
    const offset = Math.round(start * sampleRate), count = Math.ceil(duration * sampleRate);
    for (let i = 0; i < count; i++) buffer[(offset+i) % length]! += sample(i/sampleRate);
  };
  for (let chord = 0; chord < chords.length; chord++) {
    const notes = chords[chord]!, chapter = Math.floor(chord / 4);
    for (let voice = 0; voice < notes.length; voice++) {
      const f = hz(notes[voice]!), level = voice === 0 ? .025 : .018;
      const pad = (t: number, detune: number) => {
        const envelope = Math.min(1, t/.7) * Math.min(1, (4.9-t)/.9);
        const phase = TAU*f*detune*t;
        return (sine(phase) + .16*sine(phase*2+.3)) * envelope * level * (1 + .07*sine(TAU*.31*t));
      };
      add(left, chord*4, 4.9, t => pad(t, .9994));
      add(right, chord*4, 4.9, t => pad(t, 1.0006));
    }
    // A sparse upper response appears only in chapters two and four.
    if (chapter % 2) for (let n = 0; n < 3; n++) {
      const f = hz(notes[(n+chapter)%4]!+12);
      add(left, chord*4+.75+n, 1.5, t => sine(TAU*f*t)*Math.min(1,t/.025)*Math.exp(-t*3)*.018);
      add(right, chord*4+.78+n, 1.5, t => sine(TAU*f*t)*Math.min(1,t/.025)*Math.exp(-t*3)*.015);
    }
    const bassPattern = chapter === 0 ? [0,1,2,3] : chapter === 1 ? [0,.75,1.5,2,2.75,3.5] : chapter === 2 ? [0,.5,1.25,2,2.5,3.25,3.75] : [0,1.5,2,3.5];
    bassPattern.forEach((beat, index) => {
      const f = hz(notes[0]!-12+(index%4===3 ? 12 : 0));
      add(pulse, chord*4+beat, .55, t => (sine(TAU*f*t)+.22*sine(TAU*f*2*t)) * Math.min(1,t/.012)*Math.exp(-t*8)*.085);
    });
    const contour = chapter === 0 ? [0,2,1,3] : chapter === 1 ? [3,1,2,0,2,1] : chapter === 2 ? [0,1,3,2,1,2,0,3] : [2,0,3,1];
    const step = chapter === 2 ? .25 : .5;
    for (let tick = 0; tick*step < 4; tick++) {
      const f = hz(notes[contour[tick%contour.length]!]!+12+(tick%7===6 ? 12 : 0));
      add(pressure, chord*4+tick*step, .4, t => (sine(TAU*f*t)+.18*sine(TAU*f*3*t)) * Math.min(1,t/.006)*Math.exp(-t*15)*.032);
    }
    let seed = 6719 + chord*919;
    for (let beat = 0; beat < 8; beat++) {
      if (beat%2===0) add(pressure, chord*4+beat*.5, .24, t => sine(TAU*(48*t+1.8*(1-Math.exp(-t*35)))) * Math.min(1,t/.003)*Math.exp(-t*23)*.09);
      if (beat%4===2) add(pressure, chord*4+beat*.5, .16, t => {
        seed = (Math.imul(seed,1664525)+1013904223)>>>0;
        return (seed/2147483648-1)*Math.min(1,t/.002)*Math.exp(-t*38)*.032;
      });
      const subdivisions = chapter === 2 ? 2 : 1;
      for(let sub=0;sub<subdivisions;sub++) add(pressure, chord*4+beat*.5+sub*.25+.25, .075, t => {
        seed = (Math.imul(seed,1664525)+1013904223)>>>0;
        return (seed/2147483648-1)*Math.min(1,t/.001)*Math.exp(-t*85)*.014;
      });
    }
  }
  return { ambient: [left,right], pulse: [pulse], pressure: [pressure] };
}
