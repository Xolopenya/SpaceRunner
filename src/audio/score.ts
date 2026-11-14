import { AUDIO } from './settings.ts';
import { musicStems } from './music-synthesis.ts';
import { audioBuffer } from './synthesis.ts';
import type { PacingState } from '../core/field-director.ts';

const target = (param: AudioParam, value: number, at: number, seconds: number) => {
  param.cancelScheduledValues(at); param.setTargetAtTime(value,at,seconds);
};

/** Three fixed sources share one sample grid and start time. State changes only
 * automate gains/filter; pause/background suspend or attenuate the same score. */
export class AdaptiveScore {
  readonly sources: readonly AudioBufferSourceNode[];
  readonly level: GainNode;
  readonly filter: BiquadFilterNode;
  readonly duck: GainNode;
  readonly layers: readonly GainNode[];
  private pacing: PacingState = 'regular';
  private state = 'LOADING';
  private readonly nodes: readonly AudioNode[];

  constructor(context: BaseAudioContext, destination: AudioNode) {
    const stems = musicStems(AUDIO.musicSampleRate);
    const buffers = [stems.ambient,stems.pulse,stems.pressure].map(channels=>audioBuffer(context,channels,AUDIO.musicSampleRate));
    this.filter = context.createBiquadFilter(); this.filter.type='lowpass';
    this.filter.frequency.value=900; this.filter.Q.value=.4;
    this.level=context.createGain(); this.level.gain.value=0;
    this.duck=context.createGain(); this.duck.gain.value=1;
    this.filter.connect(this.level).connect(this.duck).connect(destination);
    this.layers=buffers.map(()=>context.createGain());
    this.sources=buffers.map((buffer,i)=>{
      const source=context.createBufferSource(); source.buffer=buffer; source.loop=true;
      this.layers[i]!.gain.value=AUDIO.music.regular[i]!;
      source.connect(this.layers[i]!).connect(this.filter); return source;
    });
    this.nodes=[...this.sources,...this.layers,this.filter,this.level,this.duck];
    const start=context.currentTime;
    for(const source of this.sources) source.start(start);
  }

  setState(state: string, at: number): void {
    if(this.state===state) return; this.state=state;
    target(this.level.gain,state==='PLAYING' ? 1 : state==='MENU' ? .65 : state==='GAME_OVER' ? .3 : 0,at,.18);
    this.apply(at);
  }
  setPacing(pacing: PacingState, at: number): void {
    if(this.pacing===pacing) return; this.pacing=pacing; this.apply(at);
  }
  private apply(at: number): void {
    const playing=this.state==='PLAYING';
    const mix=playing ? AUDIO.music[this.pacing] : [1,0,0];
    this.layers.forEach((layer,i)=>target(layer.gain,mix[i]!,at,AUDIO.music.fadeSeconds));
    target(this.filter.frequency,playing ? this.pacing==='recovery' ? 1500 : this.pacing==='high' ? 4200 : 3000 : 900,at,.45);
  }
  duckFor(major: boolean, at: number): void {
    target(this.duck.gain,major ? .22 : .58,at,.012);
    target(this.duck.gain,1,at+(major ? .8 : .18),major ? .55 : .24);
  }
  reset(at: number): void {
    target(this.duck.gain,1,at,.03); this.setPacing('regular',at);
  }
  dispose(): void {
    for(const source of this.sources) { source.stop(); source.buffer=null; }
    for(const node of this.nodes) node.disconnect();
  }
}
