import { AdditiveBlending, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, ShaderMaterial } from 'three';
import { CONFIG } from '../config.ts';

export type BoundaryMode = 'legacy' | 'warp';
export const WARP = Object.freeze({ reach: 2.4, depth: 180, nearFade: 4, farFade: 115, spacing: 23, base: .10, boost: .90 });
export const ARENA_SIDES = [-1, 1, -2, 2] as const;
export function boundaryProximity(side: number, x: number, y: number): number {
  const horizontal = Math.abs(side) === 1, bound = horizontal ? CONFIG.bounds.x : CONFIG.bounds.y;
  const t = Math.max(0, Math.min(1, 1 - (bound - Math.sign(side) * (horizontal ? x : y)) / WARP.reach));
  return t * t * (3 - 2 * t);
}
const vertex = `varying float across; varying float depth;
void main(){across=uv.x*2.0-1.0;depth=-position.z;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragment = `uniform vec3 tint;uniform float strength;uniform float travel;uniform float motion;uniform float offset;
varying float across;varying float depth;
void main(){
 float envelope=smoothstep(${WARP.nearFade.toFixed(1)},20.0,depth)*(1.0-smoothstep(${WARP.farFade.toFixed(1)},${WARP.depth.toFixed(1)},depth));
 // Two thin separated energy threads: gaps at corners avoid a bright rectangle.
 float aa=max(0.004,fwidth(across));
 float thread=1.0-smoothstep(0.0,aa,abs(abs(across)-0.56));
 float halo=exp(-pow((abs(across)-0.56)*12.0,2.0));
 float width=max(0.010,aa);
 float lane=exp(-pow((across-0.22)/width,2.0))+exp(-pow((across+0.73)/width,2.0));
 float pulse=pow(max(0.0,1.0-abs(fract((depth+travel)/${WARP.spacing.toFixed(1)}+offset)-0.5)*2.0),12.0);
 float veil=pow(max(0.0,1.0-abs(across)),3.0)*0.018;
 float alpha=envelope*strength*(thread*0.55+halo*0.12+lane*pulse*motion*0.70+veil);
 gl_FragColor=vec4(tint,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

/** Four fixed world-space surfaces. Only scalar uniforms change, never vertices
 * or a particle pool; periodic flow fades before either visible end of the strip.
 */
export class WarpCorridor {
  readonly root = new Group();
  readonly sides: readonly Mesh<BufferGeometry, ShaderMaterial>[];
  constructor() {
    this.root.name = 'warp-corridor';
    this.sides = ARENA_SIDES.map((side, index) => {
      const horizontal = Math.abs(side) === 1, edge = Math.sign(side) * (horizontal ? CONFIG.bounds.x : CONFIG.bounds.y);
      const half = horizontal ? CONFIG.bounds.y : CONFIG.bounds.x;
      const points: number[] = [];
      for (const [a, z] of [[-half, 5], [half, 5], [-half, -WARP.depth], [half, -WARP.depth]]) points.push(horizontal ? edge : a!, horizontal ? a! : edge, z!);
      const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points, 3))
        .setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
      geometry.setIndex([0, 1, 2, 2, 1, 3]);
      const material = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment,
        uniforms: { tint: { value: new Color(0x438ba5) }, strength: { value: WARP.base }, travel: { value: 0 }, motion: { value: 1 }, offset: { value: index * .173 } },
        transparent: true, depthTest: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
      const mesh = new Mesh(geometry, material); mesh.name = `warp-side-${side}`; this.root.add(mesh); return mesh;
    });
  }
  update(x: number, y: number, distance: number, reducedMotion: boolean): void {
    for (let i = 0; i < this.sides.length; i++) {
      const u = this.sides[i]!.material.uniforms;
      u.strength!.value = WARP.base + WARP.boost * boundaryProximity(ARENA_SIDES[i]!, x, y);
      // Bounded phase avoids shader float precision loss on long survival runs.
      u.travel!.value = distance % WARP.spacing; u.motion!.value = reducedMotion ? 0 : 1;
    }
  }
  dispose(): void { this.root.removeFromParent(); for (const s of this.sides) { s.geometry.dispose(); s.material.dispose(); } }
}
