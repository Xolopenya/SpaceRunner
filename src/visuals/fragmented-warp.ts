import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Group, Mesh, ShaderMaterial } from 'three';
import { CONFIG } from '../config.ts';
import { isWreck, wreckProfile, WRECK } from '../experiments/structure-variants/profile.ts';
import { ARENA_SIDES, boundaryProximity } from './warp-corridor.ts';

export const FIELD_MODES = ['fragmented-arcs', 'flowing-filaments', 'fragmented-warp'] as const;
export type FieldMode = typeof FIELD_MODES[number];
export const FIELD = Object.freeze({ period: 256, behind: 32, steps: 24, arcsPerSide: 5, filamentsPerSide: 7,
  streaksPerSide: 2, feather: 1.6, padding: .10, base: .30, boost: .65, near: -8, clearNear: 8, clearFar: 150, far: 208 });
export interface FieldStation { readonly kind: number; readonly x: number; readonly y: number; readonly z: number; readonly planned?: unknown }
interface Fragment { readonly side: number; readonly kind: number; readonly ordinal: number; readonly depth: number; readonly length: number }
interface Exclusion { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const QUAD = [0, 1, 2, 2, 1, 3] as const;
export function fieldDepth(depth: number, distance: number): number {
  return ((depth - distance + FIELD.behind) % FIELD.period + FIELD.period) % FIELD.period - FIELD.behind;
}
export function fieldEnvelope(depth: number): number {
  return smooth((depth - FIELD.near) / (FIELD.clearNear - FIELD.near)) * (1 - smooth((depth - FIELD.clearFar) / (FIELD.far - FIELD.clearFar)));
}
const vertex = `attribute float origin;attribute float fade;attribute float category;attribute float ordinal;attribute float edge;
uniform float travel;uniform vec4 proximity;uniform float policy;uniform float reduced;
varying vec2 ribbon;varying float light;varying float depth;
void main(){
 vec3 p=position;depth=mod(origin-travel+${FIELD.behind.toFixed(1)},${FIELD.period.toFixed(1)})-${FIELD.behind.toFixed(1)}+position.z;p.z=-depth;
 float selected=policy<0.5?float(category<0.5):policy<1.5?float(category>0.5&&category<1.5):float((category<0.5&&ordinal<3.0)||(category>0.5&&category<1.5&&ordinal<4.0)||category>1.5);
 if(reduced>0.5&&category>1.5)selected=0.0;
 float approach=edge<0.5?proximity.x:edge<1.5?proximity.y:edge<2.5?proximity.z:proximity.w;
 light=fade*selected*(${FIELD.base.toFixed(2)}+${FIELD.boost.toFixed(2)}*approach);ribbon=uv;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}`;
const fragment = `uniform vec3 tint;varying vec2 ribbon;varying float light;varying float depth;
void main(){
 float endFade=smoothstep(0.0,0.20,ribbon.x)*(1.0-smoothstep(0.78,1.0,ribbon.x));
 float across=abs(ribbon.y*2.0-1.0);float core=exp(-across*across*22.0);float halo=exp(-across*across*3.0)*0.24;
 float envelope=smoothstep(${FIELD.near.toFixed(1)},${FIELD.clearNear.toFixed(1)},depth)*(1.0-smoothstep(${FIELD.clearFar.toFixed(1)},${FIELD.far.toFixed(1)},depth));
 float alpha=light*endFade*(core+halo)*envelope;if(alpha<0.001)discard;
 gl_FragColor=vec4(tint,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

/** A single reusable ribbon batch. Shader moves fixed vertices; the CPU removes
 * links intersecting accepted station solids AND reserves their open apertures.
 * Only changed exclusion indices/fades are uploaded. No gameplay RNG or writes. */
export class FragmentedWarpField {
  readonly root = new Group();
  readonly geometry = new BufferGeometry();
  readonly material: ShaderMaterial;
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  readonly fragments: readonly Fragment[];
  mode: FieldMode = 'fragmented-warp';
  activeSegments = 0;
  excludedLinks = 0;
  private readonly exclusions: Exclusion[] = Array.from({ length: 40 }, () => ({ x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 }));
  private exclusionCount = 0;
  private readonly index: BufferAttribute;
  private readonly fades: BufferAttribute;
  private readonly positions: Float32Array;
  private disposed = false;

  constructor() {
    this.root.name = 'fragmented-warp-field';
    let seed = 0x600d;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const fragments: Fragment[] = [], pos: number[] = [], uv: number[] = [], origin: number[] = [], categories: number[] = [], ordinals: number[] = [], edges: number[] = [], indices: number[] = [];
    for (const [edge, side] of ARENA_SIDES.entries()) for (let kind = 0; kind < 3; kind++) {
      const count = kind === 0 ? FIELD.arcsPerSide : kind === 1 ? FIELD.filamentsPerSide : FIELD.streaksPerSide;
      for (let ordinal = 0; ordinal < count; ordinal++) {
        const horizontal = Math.abs(side) === 1, half = horizontal ? CONFIG.bounds.y : CONFIG.bounds.x;
        const length = kind === 0 ? .9 + random() * 1.5 : kind === 1 ? 5 + random() * 11 : 1 + random() * 1.8;
        const center = (random() * 2 - 1) * (half - (kind === 0 ? length / 2 + .25 : .7));
        const depth = ((ordinal * .61803398875 + edge * .217 + kind * .331 + random() * .12) % 1) * FIELD.period - FIELD.behind;
        const bend = (random() * 2 - 1) * (kind === 0 ? 1.4 : .48);
        const width = kind === 0 ? .12 : kind === 1 ? .10 : .07;
        fragments.push({ side, kind, ordinal, depth, length });
        for (let j = 0; j <= FIELD.steps; j++) {
          const t = j / FIELD.steps, curve = Math.sin(t * Math.PI);
          const lateral = center + (kind === 0 ? (t - .5) * length : bend * Math.sin(t * Math.PI * 1.3));
          const d = kind === 0 ? bend * curve : (t - .5) * length;
          for (const sign of [-1, 1]) {
            // Thin strips lie ON the true side plane, never through the center.
            const a = lateral + (kind === 0 ? 0 : sign * width), z = d + (kind === 0 ? sign * width : 0);
            pos.push(horizontal ? Math.sign(side) * CONFIG.bounds.x : a, horizontal ? a : Math.sign(side) * CONFIG.bounds.y, z);
            uv.push(t, (sign + 1) / 2);origin.push(depth);categories.push(kind);ordinals.push(ordinal);edges.push(edge);
          }
          if (j < FIELD.steps) { const a = (fragments.length - 1) * (FIELD.steps + 1) * 2 + j * 2;indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
        }
      }
    }
    this.fragments = fragments;this.positions = new Float32Array(pos);
    this.index = new BufferAttribute(new Uint16Array(indices), 1).setUsage(DynamicDrawUsage);
    this.fades = new BufferAttribute(new Float32Array(origin.length).fill(1), 1).setUsage(DynamicDrawUsage);
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    for (const [name, values] of Object.entries({ origin, category: categories, ordinal: ordinals, edge: edges })) this.geometry.setAttribute(name, new BufferAttribute(new Float32Array(values), 1));
    this.geometry.setAttribute('fade', this.fades);this.geometry.setIndex(this.index);
    this.material = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment,
      uniforms: { tint: { value: new Color(0x5aaabc) }, travel: { value: 0 }, proximity: { value: [0, 0, 0, 0] }, policy: { value: 2 }, reduced: { value: 0 } },
      transparent: true, depthTest: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    this.mesh = new Mesh(this.geometry, this.material);this.mesh.name = 'warp-fragment-batch';this.mesh.frustumCulled = false;this.root.add(this.mesh);
  }
  setMode(mode: FieldMode): void { this.mode = mode;this.material.uniforms.policy!.value = FIELD_MODES.indexOf(mode); }

  private collect(slots: readonly FieldStation[]): void {
    this.exclusionCount = 0;let stations = 0;
    for (const h of slots) {
      if (!isWreck(h) || !h.planned || h.z > CONFIG.hazards.despawnZ || h.z < -FIELD.period - 16) continue;
      if (stations++ === 8) break;
      const p = wreckProfile(h);
      for (const b of p.boxes) {
        const e = this.exclusions[this.exclusionCount++]!;
        e.x0 = h.x + b.center.x - b.half.x; e.x1 = h.x + b.center.x + b.half.x;
        e.y0 = h.y + b.center.y - b.half.y; e.y1 = h.y + b.center.y + b.half.y;
        e.z0 = h.z + b.center.z - b.half.z; e.z1 = h.z + b.center.z + b.half.z;
      }
      // Reserve the actual traversable hole, including its inner rim. No light
      // bridge through an offset upper/lower/left/right aperture at station depth.
      const e = this.exclusions[this.exclusionCount++]!;
      e.x0 = h.x + p.aperture.x - WRECK.apertureX; e.x1 = h.x + p.aperture.x + WRECK.apertureX;
      e.y0 = h.y + p.aperture.y - WRECK.apertureY; e.y1 = h.y + p.aperture.y + WRECK.apertureY;
      e.z0 = h.z - WRECK.axial; e.z1 = h.z + WRECK.axial;
    }
  }
  update(x: number, y: number, distance: number, reducedMotion: boolean, slots: readonly FieldStation[]): void {
    const travel = distance % FIELD.period;
    this.material.uniforms.travel!.value = travel;this.material.uniforms.reduced!.value = reducedMotion ? 1 : 0;
    const proximity = this.material.uniforms.proximity!.value as number[];
    ARENA_SIDES.forEach((s, i) => { proximity[i] = boundaryProximity(s, x, y); });
    this.collect(slots);let indexChanged = false, fadeChanged = false, excluded = 0, active = 0;
    for (let f = 0; f < this.fragments.length; f++) {
      const fragment = this.fragments[f]!, base = f * (FIELD.steps + 1) * 2, depth = fieldDepth(fragment.depth, travel);
      const selected = this.mode === 'fragmented-arcs' ? fragment.kind === 0 : this.mode === 'flowing-filaments' ? fragment.kind === 1 : fragment.kind === 0 ? fragment.ordinal < 3 : fragment.kind === 1 ? fragment.ordinal < 4 : !reducedMotion;
      if (selected && fieldEnvelope(depth) > 0) active++;
      for (let j = 0; j <= FIELD.steps; j++) {
        const a = (base + j * 2) * 3, b = a + 3;
        const px = (this.positions[a]! + this.positions[b]!) / 2, py = (this.positions[a + 1]! + this.positions[b + 1]!) / 2;
        const pz = -(depth + (this.positions[a + 2]! + this.positions[b + 2]!) / 2);
        let clearance = 1;
        for (let n = 0; n < this.exclusionCount; n++) {
          const e = this.exclusions[n]!;
          const gap = Math.max(e.x0 - px, px - e.x1, e.y0 - py, py - e.y1, e.z0 - pz, pz - e.z1) - FIELD.padding;
          clearance = Math.min(clearance, smooth(gap / FIELD.feather));
        }
        // Quantized only cosmetic alpha; avoids uploads for subpixel float noise.
        clearance = Math.round(clearance * 1024) / 1024;
        for (let k = 0; k < 2; k++) if (this.fades.getX(base + j * 2 + k) !== clearance) { this.fades.setX(base + j * 2 + k, clearance);fadeChanged = true; }
        if (j === FIELD.steps) continue;
        const next = a + 6, last = next + 3;
        const x0 = Math.min(this.positions[a]!, this.positions[b]!, this.positions[next]!, this.positions[last]!);
        const x1 = Math.max(this.positions[a]!, this.positions[b]!, this.positions[next]!, this.positions[last]!);
        const y0 = Math.min(this.positions[a + 1]!, this.positions[b + 1]!, this.positions[next + 1]!, this.positions[last + 1]!);
        const y1 = Math.max(this.positions[a + 1]!, this.positions[b + 1]!, this.positions[next + 1]!, this.positions[last + 1]!);
        const z0 = -depth - Math.max(this.positions[a + 2]!, this.positions[b + 2]!, this.positions[next + 2]!, this.positions[last + 2]!);
        const z1 = -depth - Math.min(this.positions[a + 2]!, this.positions[b + 2]!, this.positions[next + 2]!, this.positions[last + 2]!);
        let hidden = false;
        for (let n = 0; n < this.exclusionCount; n++) {
          const e = this.exclusions[n]!, p = FIELD.padding;
          if (x1 >= e.x0 - p && x0 <= e.x1 + p && y1 >= e.y0 - p && y0 <= e.y1 + p && z1 >= e.z0 - p && z0 <= e.z1 + p) { hidden = true;break; }
        }
        if (hidden) excluded++;
        const v = base + j * 2, offset = (f * FIELD.steps + j) * 6;
        for (let k = 0; k < 6; k++) {
          const value = hidden ? v : v + QUAD[k]!;
          if (this.index.getX(offset + k) !== value) { this.index.setX(offset + k, value);indexChanged = true; }
        }
      }
    }
    this.excludedLinks = excluded;this.activeSegments = active;
    if (indexChanged) this.index.needsUpdate = true;if (fadeChanged) this.fades.needsUpdate = true;
  }
  reset(): void { this.update(0, 0, 0, false, []); }
  dispose(): void { if (this.disposed) return;this.disposed = true;this.root.removeFromParent();this.geometry.dispose();this.material.dispose(); }
}
