import { AUDIO } from './settings.ts';
import { musicStems } from './music-synthesis.ts';

export const SOUNDS = ['launch','resume','pause','click','impact','destruction','gameOver','pickup',
  'rock1','rock2','rock3','metal1','metal2','metal3','station1','station2','station3',
  'mine1','mine2','mine3','pickup2','pickup3','crackle','rupture','secondary'] as const;
export type Sound = typeof SOUNDS[number];
const TAU = Math.PI * 2;
const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Original deterministic synthesis. Never touches the game's random source. */
export function noise(seconds = 2, sampleRate: number = AUDIO.sampleRate): Float32Array {
  const output = new Float32Array(Math.ceil(seconds * sampleRate));
  let seed = 71883, previous = 0;
  for (let i = 0; i < output.length; i++) {
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    previous = previous*.88+(seed/2147483648-1)*.12;
    output[i] = previous*Math.min(1,i/(sampleRate*.01),(output.length-1-i)/(sampleRate*.01));
  }
  return output;
}

export function soundSamples(kind: Sound, sampleRate: number = AUDIO.sampleRate): Float32Array {
  const rock = kind === 'impact' || kind.startsWith('rock'), metal = kind.startsWith('metal');
  const station = kind.startsWith('station'), mine = kind.startsWith('mine');
  const pickup = kind.startsWith('pickup'), fatal = kind === 'destruction' || kind === 'rupture';
  const seconds = kind === 'rupture' ? 1.4 : kind === 'destruction' ? .6 : mine ? 1.1 : station ? .85
    : metal ? .65 : rock ? .48 : kind === 'gameOver' ? 1.8 : kind === 'secondary' ? .48 : kind === 'crackle' ? .22 : .24;
  const output = new Float32Array(Math.ceil(seconds*sampleRate));
  const variant = Number(kind.at(-1)) || 1;
  let seed = 92347+SOUNDS.indexOf(kind)*7417, low = 0, lower = 0;
  for (let i = 0; i < output.length; i++) {
    const t = i/sampleRate;
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    const white = seed/2147483648-1;
    low = low*.82+white*.18; lower = lower*.97+white*.03;
    const attack = Math.min(1,t/.003), sin = (f: number) => Math.sin(TAU*f*t);
    let value = 0;
    if (rock) value = (.11*Math.sin(TAU*(92*t+1.8*(1-Math.exp(-t*20))))+low*.34)*Math.exp(-t*16)
      +(white-low)*.022*Math.exp(-t*35)+sin(261+variant*11)*.018*Math.exp(-t*22);
    else if (metal) value = (white-low)*.08*Math.exp(-t*48)+low*.14*Math.exp(-t*20)
      +(sin(293+variant*13)*.058+sin(457+variant*21)*.043+sin(731+variant*9)*.018)*Math.exp(-t*9)
      +sin(109)*.055*Math.exp(-t*22);
    else if (station) value = (sin(57)*.12+lower*.55)*Math.exp(-t*6.5)
      +(sin(173+variant*7)*.045+sin(387+variant*17)*.025)*Math.exp(-t*10)
      +(white-low)*.035*Math.exp(-t*24)*(1+.4*sin(31));
    else if (mine) value = Math.sin(TAU*(47*t+3.6*(1-Math.exp(-t*25))))*.12*Math.exp(-t*5)
      +low*.3*Math.exp(-t*11)+(white-low)*.045*Math.exp(-t*40)
      +Math.sin(TAU*(740*t-185*t*t)+variant*.15)*.034*Math.exp(-t*7)*(1-Math.exp(-t*35));
    else if (fatal) {
      const main = kind === 'rupture';
      value = Math.sin(TAU*((main ? 42 : 85)*t+2.8*(1-Math.exp(-t*25))))*.13*Math.exp(-t*(main ? 4 : 10))
        +low*.35*Math.exp(-t*(main ? 6 : 15))+(sin(217)*sin(353))*.04*Math.exp(-t*14)
        +(white-low)*.026*Math.exp(-t*32);
    } else if (kind === 'secondary') value = (low*.27+sin(72)*.1+sin(449)*.025)*Math.exp(-t*13);
    else if (kind === 'crackle') value = ((white-low)*.07+sin(173)*.02)*Math.max(0,sin(43))**8*Math.exp(-t*9);
    else if (pickup) {
      const f = frequency(variant === 3 ? 81 : variant === 2 ? 77 : 74);
      value = (sin(f)*.065+sin(f*1.5)*.023+sin(f*2)*.008)*Math.exp(-t*18);
    } else if (kind === 'gameOver') value = (sin(frequency(50))*.045+sin(frequency(57))*.025+sin(frequency(64))*.018)*Math.min(1,t/.12)*Math.exp(-t*2.8);
    else if (kind === 'click') value = (low*.08+sin(310)*.018)*Math.exp(-t*42);
    else {
      const phase = TAU*((kind==='launch' ? 147 : 165)*t+(kind==='pause' ? -180 : 320)*t*t);
      value = (Math.sin(phase)*.045+Math.sin(phase*2)*.012+low*.03)*Math.exp(-t*18);
    }
    output[i] = value*attack*Math.min(1,(output.length-1-i)/(sampleRate*.025));
  }
  let peak=0; for(const sample of output) peak=Math.max(peak,Math.abs(sample));
  if(peak>AUDIO.voicePeak) for(let i=0;i<output.length;i++) output[i]! *= AUDIO.voicePeak/peak;
  return output;
}

/** Ambient-score preview; the runtime renders all stems once. */
export function musicSamples(sampleRate: number = AUDIO.sampleRate): [Float32Array,Float32Array] {
  return musicStems(sampleRate).ambient;
}

export function audioBuffer(context: BaseAudioContext, channels: readonly Float32Array[], sampleRate: number = AUDIO.sampleRate): AudioBuffer {
  const buffer = context.createBuffer(channels.length,channels[0]!.length,sampleRate);
  channels.forEach((data,index)=>buffer.getChannelData(index).set(data));
  return buffer;
}
