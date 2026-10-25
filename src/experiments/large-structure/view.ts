import { BoxGeometry, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry, WireframeGeometry } from 'three';
import type { Scene } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ResourceOwner } from '../../assets/resources.ts';
import { CONFIG } from '../../config.ts';
import type { GameModel } from '../../core/game-model.ts';
import type { ColliderDebugView } from '../../debug/types.ts';
import type { RuntimeObstacleField } from '../../debug/runtime-field.ts';
import { BULKHEAD as B, BULKHEAD_BOXES, isBulkhead } from './profile.ts';

/** Original model source: four joined structural solids, orange aperture lining,
 * flush face markings. No imported mesh, texture, runtime download or GLB.
 */
export function bulkheadModel(): Group {
  const root = new Group(); root.name = 'abandoned-docking-bulkhead-v1';
  const shell = new MeshStandardMaterial({ color: 0x647d91, roughness: .82, metalness: .25 });
  const edge = new MeshStandardMaterial({ color: 0x283746, roughness: .86, metalness: .2 });
  const lining = new MeshStandardMaterial({ color: 0xe9a84c, emissive: 0x5a2e08, emissiveIntensity: .35, roughness: .8, metalness: .15,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (const box of BULKHEAD_BOXES) {
    const mesh = new Mesh(new BoxGeometry(box.half.x * 2, box.half.y * 2, box.half.z * 2), shell);
    mesh.name = box.name; mesh.position.set(box.center.x, box.center.y, box.center.z); root.add(mesh);
  }
  const marking = new MeshStandardMaterial({ color: 0xffc46c, emissive: 0x7a390d, emissiveIntensity: .4,
    roughness: .9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  // Coplanar markings stay ON the four solids; no protrusions and no false gaps.
  const plane = new PlaneGeometry(1, 1);
  edge.polygonOffset = true; edge.polygonOffsetFactor = -1; edge.polygonOffsetUnits = -1;
  const batches = { lining: [] as PlaneGeometry[], marking: [] as PlaneGeometry[], panel: [] as PlaneGeometry[] };
  function paint(batch: keyof typeof batches, x: number, y: number, z: number, width: number, height: number, rx = 0, ry = 0): void {
    const piece = plane.clone(); piece.scale(width, height, 1); piece.rotateX(rx); piece.rotateY(ry); piece.translate(x, y, z); batches[batch].push(piece);
  }
  paint('lining', -B.apertureX, 0, 0, B.halfZ * 2, B.apertureY * 2, 0, Math.PI / 2);
  paint('lining', B.apertureX, 0, 0, B.halfZ * 2, B.apertureY * 2, 0, -Math.PI / 2);
  paint('lining', 0, B.apertureY, 0, B.apertureX * 2, B.halfZ * 2, Math.PI / 2);
  paint('lining', 0, -B.apertureY, 0, B.apertureX * 2, B.halfZ * 2, -Math.PI / 2);
  for (const z of [-B.halfZ, B.halfZ]) {
    for (const x of [-B.apertureX - .14, B.apertureX + .14]) {
      paint('marking', x, 0, z, .28, B.apertureY * 2 + .56, 0, z < 0 ? Math.PI : 0);
    }
    for (const y of [-B.apertureY - .14, B.apertureY + .14]) {
      paint('marking', 0, y, z, B.apertureX * 2, .28, 0, z < 0 ? Math.PI : 0);
    }
    // Recess/repair-panel markings use painted surfaces, never non-colliding gaps.
    for (const x of [-7.4, 7.4]) for (const y of [-4.5, 4.5]) {
      paint('panel', x, y, z, 2.7, .3, 0, z < 0 ? Math.PI : 0);
    }
  }
  for (const [name, pieces] of Object.entries(batches)) {
    const mesh = new Mesh(mergeGeometries(pieces), name === 'lining' ? lining : name === 'marking' ? marking : edge);
    mesh.name = `paint-${name}`; root.add(mesh); for (const piece of pieces) piece.dispose();
  }
  plane.dispose();
  return root;
}

export class LargeStructureView implements ColliderDebugView {
  readonly root = new Group();
  readonly model = bulkheadModel();
  private readonly wires = new Group();
  private readonly instances: Group[] = [];
  private readonly player: LineSegments;
  private readonly resources = new ResourceOwner();
  private borrowedSlots: readonly Group[] = [];
  private readonly info = document.createElement('aside');
  private disposed = false;

  constructor(scene: Scene, colliders: boolean) {
    this.root.name = 'large-structure-dev-root';
    const wireMaterial = new LineBasicMaterial({ color: 0x69f4d3, depthTest: false, transparent: true, opacity: .9 });
    for (const box of BULKHEAD_BOXES) {
      const source = new BoxGeometry(box.half.x * 2, box.half.y * 2, box.half.z * 2), edges = new EdgesGeometry(source); source.dispose();
      const wire = new LineSegments(edges, wireMaterial); wire.position.set(box.center.x, box.center.y, box.center.z); this.wires.add(wire);
    }
    this.wires.visible = colliders;
    const first = new Group(); first.add(this.model, this.wires); this.root.add(first); this.instances.push(first);
    // Hard capacity32 primitives / four per structure. Clones share ALL model
    // and wire resources; no future committed object may use a small GLB proxy.
    for (let i = 1; i < 8; i++) { const instance = first.clone(true); this.root.add(instance); this.instances.push(instance); }
    const sphere = new SphereGeometry(CONFIG.ship.radius, 16, 10);
    this.player = new LineSegments(new WireframeGeometry(sphere), new LineBasicMaterial({ color: 0xff83d1, depthTest: false })); sphere.dispose();
    this.player.visible = colliders; scene.add(this.root, this.player);
    this.resources.track(this.root); this.resources.track(this.player);
    this.info.id = 'large-structure-debug-info';
    Object.assign(this.info.style, { position: 'absolute', left: '12px', bottom: '42px', maxWidth: '90%', zIndex: '5',
      color: '#dbe5ef', background: '#050b19dd', padding: '5px 8px', font: '10px/1.5 monospace', whiteSpace: 'pre-line', pointerEvents: 'none' });
    this.info.textContent = `DEV · LARGE STRUCTURE v1 · aperture 5.6 × 4.4 · depth 6\n4 solid boxes · ${colliders ? 'mint colliders / pink ship' : 'add &colliders=1 for collision view'}`;
    document.getElementById('game')!.append(this.info);
  }
  /** Borrow transforms only; World/AssetManager retain ownership of pooled GLBs. */
  bind(slots: readonly Group[]): void { this.borrowedSlots = slots; }
  update(model: GameModel): void {
    if (this.disposed) return;
    // Damage deactivates the inherited gameplay slot. Keep this substantial
    // static mesh visible through the impact/exit; logical ownership also stays.
    let count = 0;
    for (const [index, h] of (model.field as RuntimeObstacleField).slots.entries()) {
      if (!isBulkhead(h)) continue;
      const borrowed = this.borrowedSlots[index]; if (borrowed) borrowed.visible = false;
      if (h.planned && h.z <= CONFIG.hazards.despawnZ) {
        const instance = this.instances[count++];
        if (instance) { instance.visible = true; instance.position.set(h.x, h.y, h.z); }
      }
    }
    this.root.visible = count > 0;
    for (let i = count; i < this.instances.length; i++) this.instances[i]!.visible = false;
    this.player.position.set(model.ship.x, model.ship.y, 0);
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.root.removeFromParent(); this.player.removeFromParent(); this.info.remove(); this.resources.dispose(); this.borrowedSlots = [];
  }
}
