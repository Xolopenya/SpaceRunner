import { AdditiveBlending, BufferAttribute, BufferGeometry, Matrix4, Mesh, MeshStandardMaterial, Points, PointsMaterial } from 'three';
import type { Object3D } from 'three';
import { ResourceOwner } from '../assets/resources.ts';
import { DAMAGE_FX as F } from '../feedback/visual-settings.ts';
import type { VisualQuality } from './settings.ts';

const MASK = `
  vec2 p = vHullPosition.xz;
  vec2 port = p - vec2(.88 * hullSide, .65);
  vec2 starboard = p - vec2(-.90 * hullSide, .58);
  float grit = fract(sin(dot(floor(p * 61.0), vec2(127.1,311.7))) * 43758.5453);
  float first = 1.0 - smoothstep(hullRadius*.40,hullRadius,length(port * vec2(.82,1.0)) + grit*.055);
  float second = 1.0 - smoothstep(hullRadius*.35,hullRadius*1.25,length(starboard));
  float aft = 1.0 - smoothstep(.20,.62,length(p-vec2(.02,.94)));
  vec2 rearUV=vec2(vHullPosition.x-.18*hullSide,vHullPosition.y-.05);
  vec2 rearUV2=vec2(vHullPosition.x+.24*hullSide,vHullPosition.y+.05);
  float rear=smoothstep(.45,1.2,vHullPosition.z);
  float rearScorch=rear*(1.0-smoothstep(.08,.49,length(rearUV)+grit*.035));
  float rearScorch2=rear*(1.0-smoothstep(.1,.56,length(rearUV2)));
  first=max(first,rearScorch);second=max(second,rearScorch2);
  float severity = step(.5,hullStage);
  float critical = step(1.5,hullStage);
  float soot = severity * max(first, critical * max(second, aft));
  float fissure = 1.0-smoothstep(.012,.037,abs(port.x + .33*port.y + sin(port.y*29.0)*.024));
  float fissure2 = 1.0-smoothstep(.014,.038,abs(starboard.x-.5*starboard.y+sin(starboard.y*24.0)*.03));
  float scratch = 1.0-smoothstep(.007,.021,abs(port.y*.28+port.x+sin(port.x*10.0)*.018-.12));
  float cracks = severity * max(first*fissure, critical*second*fissure2);
  float rearCrack=1.0-smoothstep(.012,.03,abs(rearUV.x+.35*rearUV.y+sin(rearUV.y*34.0)*.025));
  float rearCrack2=1.0-smoothstep(.013,.032,abs(rearUV2.y-.4*rearUV2.x+sin(rearUV2.x*28.0)*.027));
  cracks=max(cracks,severity*max(rearScorch*rearCrack,critical*rearScorch2*rearCrack2));
  diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.025,.036,.049),soot*hullSoot);
  diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.46,.55,.61),scratch*first*severity*.55);
`;

/** Ship-only material instances. Marks are evaluated on actual GLB surfaces,
 * deterministic authored XZ zones; no fake exact localization or floating decals. */
export class HullDamage {
  readonly resources = new ResourceOwner();
  private readonly stageUniform = { value: 0 };
  private readonly timeUniform = { value: 0 };
  private readonly sideUniform = { value: 1 };
  private readonly overloadUniform = { value: 0 };
  private readonly motionUniform = { value: 1 };
  private readonly leaks: Points;
  private disposed = false;
  get stage(): number { return this.stageUniform.value; }
  get root(): Points { return this.leaks; }

  constructor(model: Object3D) {
    model.updateWorldMatrix(true, true);
    model.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const matrix = new Matrix4().copy(node.matrixWorld);
      const clone = (original: MeshStandardMaterial) => {
        const material = original.clone(); material.name = `${original.name}/hull-damage`;
        material.onBeforeCompile = shader => {
          Object.assign(shader.uniforms, { hullStage: this.stageUniform, hullTime: this.timeUniform, hullSide: this.sideUniform,
            hullOverload: this.overloadUniform, hullMotion: this.motionUniform, hullMatrix: { value: matrix },
            hullRadius: { value: F.hull.zoneRadius }, hullSoot: { value: F.hull.soot }, hullCrack: { value: F.hull.crack } });
          shader.vertexShader = `varying vec3 vHullPosition; uniform mat4 hullMatrix;\n${shader.vertexShader}`
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHullPosition=(hullMatrix*vec4(transformed,1.0)).xyz;');
          shader.fragmentShader = `varying vec3 vHullPosition; uniform float hullStage,hullTime,hullSide,hullOverload,hullMotion,hullRadius,hullSoot,hullCrack;\n${shader.fragmentShader}`
            .replace('#include <color_fragment>', '#include <color_fragment>\n' + MASK)
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.98,soot);')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
              float pulse=mix(1.0,.8+.2*sin(hullTime*9.0),hullMotion);
              totalEmissiveRadiance += cracks*vec3(.16,.82,1.0)*hullCrack*pulse;
              totalEmissiveRadiance += hullOverload*vec3(.42,.7,.88)*(.15+cracks);
            `);
        };
        material.customProgramCacheKey = () => 'ship-surface-damage-v1'; this.resources.materials.add(material); return material;
      };
      node.material = Array.isArray(node.material) ? node.material.map(m => m instanceof MeshStandardMaterial ? clone(m) : m)
        : node.material instanceof MeshStandardMaterial ? clone(node.material) : node.material;
    });
    const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(F.hull.leaks * 3), 3));
    this.leaks = new Points(geometry, new PointsMaterial({ color: 0x8bd7e8, size: .075, transparent: true,
      opacity: .45, depthWrite: false, blending: AdditiveBlending }));
    this.leaks.name = 'hull-electrical-leak'; this.leaks.visible = false; this.leaks.frustumCulled = false;
    model.parent!.add(this.leaks); this.resources.track(this.leaks);
  }

  setHP(hp: number, side?: number): void {
    const stage = Math.max(0, Math.min(3, 3 - hp));
    if (stage > 0 && this.stage === 0) this.sideUniform.value = side === undefined || side >= 0 ? 1 : -1;
    this.stageUniform.value = stage;
  }
  enginePower(reduced: boolean): number { return this.stage < 2 || reduced ? 1 : .84 + .16 * Math.sin(this.timeUniform.value * 13) ** 2; }
  update(time: number, quality: VisualQuality, overload = 0): void {
    if (this.disposed) return;
    this.timeUniform.value = time; this.motionUniform.value = quality.reducedMotion ? 0 : 1;
    this.overloadUniform.value = overload;
    this.leaks.visible = this.stage === 2 && !quality.reducedMotion;
    this.leaks.geometry.setDrawRange(0, quality.mobile ? F.hull.mobileLeaks : F.hull.leaks);
    if (this.leaks.visible) {
      const attr = this.leaks.geometry.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < F.hull.leaks; i++) {
        const t = (time * 1.6 + i / F.hull.leaks) % 1;
        attr.setXYZ(i, (i % 2 ? -.56 : .56) + Math.sin(i * 7 + t * 8) * t * .16, -.1 + t * .48, 1.0 + t * .5);
      }
      attr.needsUpdate = true;
    }
  }
  reset(): void { this.stageUniform.value = this.timeUniform.value = this.overloadUniform.value = 0; this.sideUniform.value = 1; this.leaks.visible = false; }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.leaks.removeFromParent(); this.resources.dispose(); }
}
