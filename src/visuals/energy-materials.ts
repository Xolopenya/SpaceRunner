import { AdditiveBlending, BufferAttribute, Color, FrontSide, ShaderMaterial, Vector3 } from 'three';
import type { BufferGeometry } from 'three';

const vertex = `uniform float age;varying vec3 vLocal,vNormal,vEye;
void main(){vLocal=normalize(position);vec4 p=modelViewMatrix*vec4(position,1.0);
vNormal=normalize(normalMatrix*normal);vEye=-p.xyz;gl_Position=projectionMatrix*p;}`;
const surface = `varying vec3 vLocal,vNormal,vEye;uniform float age,alpha,reduced;
uniform vec3 tint,heat;
float edge(){return pow(1.0-abs(dot(normalize(vNormal),normalize(vEye))),2.7);}
float flow(vec3 p){return .5+.22*sin(p.x*9.0+sin(p.z*8.0-age*3.0))+.18*sin(p.y*12.0+p.z*5.0+age*2.0);}
`;

/** Surface layers, not screen-space bloom. One shader variant per role, no textures. */
export function energySurface(role: 'core' | 'wave' | 'haze', tint = 0x70dfff, heat = 0xdcfaff): ShaderMaterial {
  const body = role === 'wave' ? `
    float f=flow(vLocal);float contour=sin(vLocal.y*17.0+vLocal.x*4.0+sin(vLocal.z*7.0-age*2.0));
    float line=smoothstep(.975,.998,contour)*smoothstep(.25,.60,f);
    float cut=smoothstep(.65,.90,.5+.5*sin(vLocal.x*13.0+vLocal.y*8.0+vLocal.z*6.0));
    float a=(pow(edge(),3.0)*(.5+.5*f)*cut+line*.32)*alpha;
    vec3 color=mix(tint*1.4,heat,line*.45);`
    : role === 'core' ? `
    float f=flow(vLocal*1.4);float cell=sin(vLocal.x*12.0+vLocal.y*7.0+sin(vLocal.z*11.0-age*5.0));
    float filaments=smoothstep(.5,.95,cell)*f;
    float a=(.12+edge()*.5+filaments*.6)*alpha;
    vec3 color=mix(tint,heat,filaments*.75)*1.8;`
      : `float f=flow(vLocal);float a=alpha*(1.0-edge())*.14*pow(max(0.0,f),2.0);
    vec3 color=mix(tint,heat,f*.32);`;
  return new ShaderMaterial({ transparent: true, depthWrite: false, side: FrontSide, blending: AdditiveBlending,
    uniforms: { age: { value: 0 }, alpha: { value: 0 }, reduced: { value: 0 }, tint: { value: new Color(tint) }, heat: { value: new Color(heat) } },
    vertexShader: vertex.replace('vec4 p=modelViewMatrix*vec4(position,1.0);',
      `vec3 warped=position*(1.0+${role === 'core' ? '.12' : '.005'}*sin(position.x*8.0+position.y*6.0+sin(position.z*7.0-age*2.0)));
       vec4 p=modelViewMatrix*vec4(warped,1.0);`), fragmentShader: surface + `void main(){${body}
      if(a<.002)discard;gl_FragColor=vec4(color,a);
      #include <colorspace_fragment>
    }`,
  });
}

export function protectionMaterial(): ShaderMaterial {
  return new ShaderMaterial({ transparent: true, depthWrite: false, side: FrontSide, blending: AdditiveBlending,
    uniforms: { age: { value: 10 }, time: { value: 0 }, alpha: { value: 0 }, reduced: { value: 0 }, direction: { value: new Vector3(0, 0, 1) } },
    vertexShader: vertex,
    fragmentShader: `varying vec3 vLocal,vNormal,vEye;uniform float age,time,alpha,reduced;uniform vec3 direction;
    void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vEye))),3.5);
      float angle=acos(clamp(dot(normalize(vLocal),direction),-1.0,1.0));
      float radius=age*7.0;float ripple=exp(-pow((angle-radius)*9.0,2.0))*exp(-age*9.0);
      float impact=exp(-angle*angle*9.0)*exp(-age*18.0);
      float strand=pow(.5+.5*sin(vLocal.y*24.0+sin(vLocal.z*5.0)-time*(1.0-reduced)*.7),12.0);
      float broken=.6+.4*smoothstep(-.4,.6,sin(vLocal.x*9.0+vLocal.z*7.0));
      float a=alpha*(rim*(.45+strand*.25)*broken+ripple*.8+impact*.55);
      if(a<.002)discard;gl_FragColor=vec4(mix(vec3(.10,.57,.73),vec3(.65,.94,1.0),ripple+impact),a);
      #include <colorspace_fragment>
    }`,
  });
}

/** Circular tapered sparks with stable per-particle size/lifetime variation. */
export function energySparks(geometry: BufferGeometry, count: number, tint = 0x89e8ff, size = .09): ShaderMaterial {
  geometry.setAttribute('sparkSeed', new BufferAttribute(Float32Array.from({ length: count }, (_, i) => ((i * 37) % count) / count), 1));
  return new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { tint: { value: new Color(tint) }, alpha: { value: 0 }, age: { value: 0 }, lifetime: { value: 1.4 }, size: { value: size } },
    vertexShader: `attribute float sparkSeed;uniform float size,age,lifetime;varying float fade;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;
      gl_PointSize=clamp(size*(.7+sparkSeed)*300.0/max(1.0,-p.z),1.0,12.0);
      fade=pow(max(0.0,1.0-age/(lifetime*(.35+.65*sparkSeed))),1.2);}`,
    fragmentShader: `uniform vec3 tint;uniform float alpha;varying float fade;
      void main(){float r=length(gl_PointCoord-.5);float a=(1.0-smoothstep(.08,.5,r))*alpha*fade;
      if(a<.002)discard;gl_FragColor=vec4(mix(tint,vec3(1.0),exp(-r*r*40.0)*.3),a);
      #include <colorspace_fragment>
    }`,
  });
}
