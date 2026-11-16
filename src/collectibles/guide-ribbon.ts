import * as T from 'three';

/** Fixed-capacity screen-width ribbons. One draw, soft transverse edge, depth test.
 * Positions are supplied in gameplay coordinates, never camera/screen guesses. */
export class GuideRibbon {
  readonly geometry=new T.BufferGeometry();
  readonly material:T.ShaderMaterial;
  readonly mesh:T.Mesh;
  private readonly starts:Float32Array;
  private readonly ends:Float32Array;
  private readonly fades:Float32Array;
  constructor(capacity:number,color:number,pixels:number,opacity:number) {
    this.starts=new Float32Array(capacity*12);this.ends=new Float32Array(capacity*12);this.fades=new Float32Array(capacity*4);
    const corners=new Float32Array(capacity*8),indices:number[]=[];
    for(let i=0;i<capacity;i++) {
      corners.set([0,-1,0,1,1,-1,1,1],i*8);const b=i*4;indices.push(b,b+2,b+1,b+1,b+2,b+3);
    }
    this.geometry.setAttribute('position',new T.BufferAttribute(this.starts,3).setUsage(T.DynamicDrawUsage));
    this.geometry.setAttribute('finish',new T.BufferAttribute(this.ends,3).setUsage(T.DynamicDrawUsage));
    this.geometry.setAttribute('corner',new T.BufferAttribute(corners,2));
    this.geometry.setAttribute('fade',new T.BufferAttribute(this.fades,1).setUsage(T.DynamicDrawUsage));
    this.geometry.setIndex(indices);
    this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,blending:T.AdditiveBlending,
      uniforms:{resolution:{value:new T.Vector2(1280,800)},pixels:{value:pixels},tint:{value:new T.Color(color)},opacity:{value:opacity}},
      vertexShader:`attribute vec3 finish;attribute vec2 corner;attribute float fade;
        uniform vec2 resolution;uniform float pixels;varying float side,energy;
        void main(){vec4 a=projectionMatrix*modelViewMatrix*vec4(position,1.),b=projectionMatrix*modelViewMatrix*vec4(finish,1.);
        vec2 delta=(b.xy/max(.001,b.w)-a.xy/max(.001,a.w))*resolution;
        vec2 normal=vec2(-delta.y,delta.x)/max(.001,length(delta));
        vec4 p=mix(a,b,corner.x);p.xy+=normal*corner.y*pixels/resolution*p.w;
        gl_Position=p;side=corner.y;energy=fade*step(.01,a.w)*step(.01,b.w);}`,
      fragmentShader:`uniform vec3 tint;uniform float opacity;varying float side,energy;
        void main(){float a=pow(max(0.,1.-abs(side)),1.4)*energy*opacity;if(a<.002)discard;
        gl_FragColor=vec4(tint,a);#include <colorspace_fragment>}`.replace(';#include',';\n#include'),
    });
    this.mesh=new T.Mesh(this.geometry,this.material);this.mesh.frustumCulled=false;
  }
  segment(index:number,ax:number,ay:number,az:number,bx:number,by:number,bz:number,fade:number):void {
    for(let k=0;k<4;k++){const at=index*12+k*3;this.starts[at]=ax;this.starts[at+1]=ay;this.starts[at+2]=az;this.ends[at]=bx;this.ends[at+1]=by;this.ends[at+2]=bz;this.fades[index*4+k]=fade;}
  }
  commit(count:number):void {
    this.geometry.setDrawRange(0,count*6);
    for(const name of ['position','finish','fade'])this.geometry.getAttribute(name).needsUpdate=true;
  }
  dispose():void {this.geometry.dispose();this.material.dispose();}
}
