import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from 'three';
export function energyGlow(): ShaderMaterial {
  return new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
    uniforms: { tint: { value: new Color(0x8ceaff) }, alpha: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv;uniform vec3 tint;uniform float alpha;
      void main(){float r=length(vUv-.5)*2.0;float a=pow(max(0.0,1.0-r),2.0);
      gl_FragColor=vec4(tint,a*alpha);
      #include <colorspace_fragment>
      }`,
  });
}
