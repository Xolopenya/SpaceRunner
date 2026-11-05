import { BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments } from 'three';
import type { Scene } from 'three';
import { WarpCorridor } from './warp-corridor.ts';
import type { BoundaryMode } from './warp-corridor.ts';
import { CONFIG } from '../config.ts';

const SIDES = [-1, 1, -2, 2] as const;
export const BOUNDARY = Object.freeze({ reach: 1.8, idleOpacity: .035, nearOpacity: .24, spacing: 16, count: 8, wingRoom: 1.3 });
/** Presentation-only scalar input. World coordinates remain fixed under Hybrid. */
export class ArenaBoundaries {
  readonly root = new Group();
  readonly warp = new WarpCorridor();
  mode: BoundaryMode = 'legacy';
  readonly sides: readonly LineSegments<BufferGeometry, LineBasicMaterial>[];
  constructor(scene: Scene) {
    this.root.name = 'arena-boundary-flow';
    this.sides = SIDES.map(side => {
      const horizontal = Math.abs(side) === 1, sign = Math.sign(side), points: number[] = [];
      for (let i = 0; i < BOUNDARY.count; i++) for (const lane of [-1, 1]) {
        const edge = sign * ((horizontal ? CONFIG.bounds.x : CONFIG.bounds.y) + BOUNDARY.wingRoom);
        const x = horizontal ? edge : lane * CONFIG.bounds.x * .75;
        const y = horizontal ? lane * CONFIG.bounds.y * .75 : edge;
        const z = -i * BOUNDARY.spacing - 8;
        points.push(x, y, z, x, y, z - 4);
      }
      const line = new LineSegments(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points, 3)),
        new LineBasicMaterial({ color: 0x4d9bb7, transparent: true, opacity: BOUNDARY.idleOpacity, depthWrite: false }));
      line.name = `arena-edge-${side}`; this.root.add(line); return line;
    });
    this.root.add(this.warp.root);this.setMode('legacy');
    scene.add(this.root);
  }
  setMode(mode: BoundaryMode): void { this.mode=mode;this.warp.root.visible=mode==='warp';for(const s of this.sides)s.visible=mode==='legacy'; }
  update(x: number, y: number, distance: number, reducedMotion=false): void {
    this.warp.update(x,y,distance,reducedMotion);
    for (let i = 0; i < this.sides.length; i++) {
      const side = SIDES[i]!, bound = Math.abs(side) === 1 ? CONFIG.bounds.x : CONFIG.bounds.y;
      const position = Math.abs(side) === 1 ? x : y;
      const approach = Math.max(0, Math.min(1, 1 - (bound - Math.sign(side) * position) / BOUNDARY.reach));
      this.sides[i]!.material.opacity = BOUNDARY.idleOpacity + (BOUNDARY.nearOpacity - BOUNDARY.idleOpacity) * approach * approach;
      this.sides[i]!.position.z = distance % BOUNDARY.spacing;
    }
  }
  reset(): void { this.update(0, 0, 0); }
  dispose(): void { this.warp.dispose();this.root.removeFromParent(); for (const line of this.sides) { line.geometry.dispose(); line.material.dispose(); } }
}
