import {AUDIO} from './settings.ts';
import type {Sound} from './synthesis.ts';
import {SAMPLED_AUDIO as S} from './sample-settings.ts';

export const SAMPLE_FILES=['rock-a','rock-b','metal-a','metal-b','station-a','station-b','mine-a','mine-b'] as const;
const alias=(kind:Sound):string|undefined=>/^(rock|metal|station|mine)[123]$/.test(kind)?kind.slice(0,-1)+'-'+(kind.endsWith('2')?'b':'a'):undefined;

/** A physical transient/texture plus a restrained original hull/energy layer.
 * Linear high-pass removes sub-bass; no global echo or distortion. */
export function collisionMix(context:BaseAudioContext,sample:AudioBuffer,hull:AudioBuffer,family:string,companion?:AudioBuffer,blend=0):AudioBuffer {
  const settings=S[family as 'rock'|'metal'|'station'|'mine'];
  const rate=S.rate,length=Math.max(Math.ceil(Math.max(sample.duration,companion?.duration??0)*rate),hull.length),out=context.createBuffer(1,length,rate),data=out.getChannelData(0),body=hull.getChannelData(0);
  const cutoff=settings.highpass;
  const coefficient=1-Math.exp(-Math.PI*2*cutoff/rate);let low=0,peak=0;
  const channels=Array.from({length:sample.numberOfChannels},(_,c)=>sample.getChannelData(c));
  const texture=companion?Array.from({length:companion.numberOfChannels},(_,c)=>companion.getChannelData(c)):[];
  for(let i=0;i<length;i++) {
    const position=i*sample.sampleRate/rate,at=Math.floor(position),fraction=position-at;let value=0;
    if(at<sample.length)for(const channel of channels)value+=(channel[at]!*(1-fraction)+(channel[at+1]??0)*fraction)/sample.numberOfChannels;
    if(companion){const position=i*companion.sampleRate/rate,j=Math.floor(position),f=position-j;if(j<companion.length)for(const channel of texture)value+=blend*(channel[j]!*(1-f)+(channel[j+1]??0)*f)/companion.numberOfChannels;}
    low+=coefficient*(value-low);
    data[i]=(value-low)+(body[i]??0)*settings.hull;
    data[i]!*=Math.min(1,i/(rate*S.attack),(length-1-i)/(rate*S.release));peak=Math.max(peak,Math.abs(data[i]!));
  }
  if(!Number.isFinite(peak)||peak<.001)throw Error('Invalid optional impact sample');
  for(let i=0;i<length;i++)data[i]!*=AUDIO.voicePeak/peak;
  return out;
}

export class CollisionSamples {
  readonly buffers=new Map<string,AudioBuffer>();
  readonly stats={loaded:0,failed:0,bytes:0,pcmBytes:0,loadMs:0,layerFallbacks:0};
  readonly ready:Promise<void>;
  private readonly abort=new AbortController();private disposed=false;
  constructor(context:BaseAudioContext,fallback:ReadonlyMap<Sound,AudioBuffer>) {
    if(typeof context.decodeAudioData!=='function'){this.ready=Promise.resolve();return;}
    const started=performance.now(),timeout=setTimeout(()=>this.abort.abort(),S.timeoutMs),decodedSources=new Map<string,AudioBuffer>();
    const base=import.meta.env?.BASE_URL??'/';
    this.ready=Promise.all(SAMPLE_FILES.map(async id=>{
      try {
        const response=await fetch(base+S.path+id+'.wav',{signal:this.abort.signal});
        if(!response.ok)throw Error('Optional sample '+response.status);
        const bytes=await response.arrayBuffer(),downloadBytes=bytes.byteLength,decoded=await context.decodeAudioData(bytes);
        if(this.disposed)return;
        const family=id.split('-')[0]!,sound=(family+(id.endsWith('b')?'2':'1')) as Sound;
        const mixed=collisionMix(context,decoded,fallback.get(sound)!,family);
        decodedSources.set(id,decoded);
        this.buffers.set(id,mixed);this.stats.loaded++;this.stats.bytes+=downloadBytes;this.stats.pcmBytes+=mixed.length*mixed.numberOfChannels*4;
      }catch{if(!this.disposed)this.stats.failed++;}
    })).then(()=>{
      if(!this.disposed&&decodedSources.has('rock-a')&&decodedSources.has('rock-b'))for(const id of ['rock-a','rock-b']){
        try {
          const first=id==='rock-a',old=this.buffers.get(id)!;
          const mixed=collisionMix(context,decodedSources.get(id)!,fallback.get(first?'rock1':'rock2')!,'rock',decodedSources.get(first?'rock-b':'rock-a'),first?S.rockContactTexture:S.rockFractureContact);
          this.buffers.set(id,mixed);this.stats.pcmBytes+=(mixed.length-old.length)*4;
        }catch{this.stats.layerFallbacks++;} // Keep the already valid physical/hull mix.
      }
      decodedSources.clear();clearTimeout(timeout);this.stats.loadMs=performance.now()-started;
    });
  }
  get(kind:Sound):AudioBuffer|undefined {const id=alias(kind);return id?this.buffers.get(id):undefined;}
  dispose():void {this.disposed=true;this.abort.abort();this.buffers.clear();this.stats.pcmBytes=0;}
}
