import { Material, Mesh } from 'three';
import type { Object3D } from 'three';
import { REVEAL, revealCoverage } from './reveal-settings.ts';
import type { RevealFamily, RevealMode } from './reveal-settings.ts';

interface MaterialEntry { readonly mesh: Mesh; readonly original: Material | Material[]; readonly variants: (Material | Material[])[] }
interface Bank { birth: number; readonly age: { value: number } }
export interface RevealTarget {
  readonly root: Object3D; readonly family: RevealFamily; readonly entries: MaterialEntry[];
  id?: string; birth: number; bank: number; applied: number; depth: number; fallback: boolean;
}
const FOG = `
#ifdef USE_FOG
  float spatialReveal = 1.0 - smoothstep( revealClear, revealFar, revealWorldDepth );
  float birthReveal = smoothstep( 0.0, revealSeconds, revealAge );
  float coverage = spatialReveal * birthReveal;
  // Stable screen-space coverage: opaque depth ordering, no transparent ghost.
  float threshold = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (coverage <= threshold) discard;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, (1.0 - spatialReveal) * revealHaze);
#endif
`;

/** Two publication cohorts share material variants. Geometry/textures are always
 * borrowed; never one cloned material per pooled object or a per-frame traversal.
 */
export class ObjectReveal {
  mode: RevealMode = 'seamless';
  readonly targets: RevealTarget[] = [];
  readonly banks: Bank[] = Array.from({ length: REVEAL.banks }, () => ({ birth: -Infinity, age: { value: 1e6 } }));
  readonly materials = new Set<Material>();
  fallbackCount = 0;
  private readonly cache = new Map<Material, Map<RevealFamily, Material[]>>();
  private readonly fullAge = { value: 1e6 };
  private elapsed = 0;

  register(root: Object3D, family: RevealFamily): RevealTarget {
    const entries: MaterialEntry[] = [];
    root.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const original = node.material as Material | Material[];
      const variants = Array.from({ length: REVEAL.banks + 1 }, (_, index) => Array.isArray(original)
        ? original.map(m => this.variant(m, family, index)) : this.variant(original, family, index));
      entries.push({ mesh: node, original, variants });
    });
    const target: RevealTarget = { root, family, entries, birth: -Infinity, bank: REVEAL.banks, applied: -1, depth: 0, fallback: false };
    this.targets.push(target); return target;
  }
  private variant(original: Material, family: RevealFamily, index: number): Material {
    let families = this.cache.get(original);
    if (!families) { families = new Map(); this.cache.set(original, families); }
    let variants = families.get(family);
    if (!variants) { variants = []; families.set(family, variants); }
    if (variants[index]) return variants[index]!;
    const m = original.clone(), settings = REVEAL[family], age = this.banks[index]?.age ?? this.fullAge;
    m.name = `${original.name}/reveal-${family}-${index}`;
    m.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { revealAge: age, revealSeconds: { value: settings.birth }, revealClear: { value: settings.clear }, revealFar: { value: settings.far }, revealHaze: { value: settings.haze } });
      shader.vertexShader = shader.vertexShader.replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nvarying float revealWorldDepth;').replace('#include <fog_vertex>', '#include <fog_vertex>\nrevealWorldDepth = -(modelMatrix * vec4(transformed,1.0)).z;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <fog_pars_fragment>', '#include <fog_pars_fragment>\nvarying float revealWorldDepth;\nuniform float revealAge;\nuniform float revealSeconds;\nuniform float revealClear;\nuniform float revealFar;\nuniform float revealHaze;')
        .replace('#include <fog_fragment>', FOG);
    };
    m.customProgramCacheKey = () => 'certified-object-reveal-v1';
    variants[index] = m; this.materials.add(m); return m;
  }
  beginFrame(elapsed: number): void {
    this.elapsed = elapsed;
    for (const bank of this.banks) bank.age.value = Math.max(0, elapsed - bank.birth);
  }
  apply(target: RevealTarget, id: string | undefined, birth: number, depth: number): void {
    if (id !== target.id) {
      target.id = id; target.birth = birth; target.bank = REVEAL.banks; target.fallback = false;
      if (id && this.elapsed - birth < REVEAL[target.family].birth) {
        let index = this.banks.findIndex(b => Math.abs(b.birth - birth) < 1e-6);
        if (index < 0) index = this.banks.findIndex(b => this.elapsed - b.birth >= REVEAL.maximumBirthSeconds);
        if (index >= 0) { const bank = this.banks[index]!; bank.birth = birth; bank.age.value = Math.max(0, this.elapsed - birth); target.bank = index; }
        else { target.fallback = true; this.fallbackCount++; } // Fail open: never hide a late safety-critical hazard.
      }
    }
    target.depth = depth;
    const index = this.mode === 'legacy' || !id ? -1 : this.elapsed - birth >= REVEAL[target.family].birth ? REVEAL.banks : target.bank;
    this.assign(target, index);
  }
  private assign(target: RevealTarget, index: number): void {
    if (target.applied === index) return;
    for (const entry of target.entries) entry.mesh.material = index < 0 ? entry.original : entry.variants[index]!;
    target.applied = index;
  }
  setMode(mode: RevealMode): void {
    this.mode = mode;
    for (const t of this.targets) { t.applied = -2; this.apply(t, t.id, t.birth, t.depth); }
  }
  diagnostic(id: string): object | undefined {
    const t = this.targets.find(t => t.id === id && t.root.visible); if (!t) return;
    return { mode: this.mode, family: t.family, age: this.elapsed - t.birth, depth: t.depth, bank: t.bank, fallback: t.fallback,
      coverage: this.mode === 'legacy' ? 1 : revealCoverage(t.family, t.depth, t.fallback ? 1e6 : this.elapsed - t.birth) };
  }
  reset(): void {
    this.elapsed = this.fallbackCount = 0;
    for (const b of this.banks) { b.birth = -Infinity; b.age.value = 1e6; }
    for (const t of this.targets) { t.id = undefined; t.birth = -Infinity; t.bank = REVEAL.banks; t.fallback = false; this.assign(t, -1); }
  }
  dispose(): void {
    for (const t of this.targets) this.assign(t, -1);
    for (const m of this.materials) m.dispose(); this.materials.clear(); this.cache.clear(); this.targets.length = 0;
  }
}

/** Read only, once on a new ID. Uses existing successful publication receipts. */
export function publicationElapsed(model: { elapsed: number; field: object }, id: string): number {
  const events = (model.field as { events?: readonly { ids: readonly string[]; elapsed: number }[] }).events;
  if (events) for (let i = events.length - 1; i >= 0; i--) if (events[i]!.ids.includes(id)) return events[i]!.elapsed;
  return model.elapsed;
}
