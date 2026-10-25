import { BoxGeometry, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry, WireframeGeometry } from 'three';
import type { Scene } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ResourceOwner } from '../../assets/resources.ts';
import { CONFIG } from '../../config.ts';
import type { GameModel } from '../../core/game-model.ts';
import type { RuntimeObstacleField } from '../../debug/runtime-field.ts';
import type { ColliderDebugView } from '../../debug/types.ts';
import { APERTURE_NAMES, PROFILES, WRECK as W, isWreck } from './profile.ts';
import type { Aperture, StructureMode } from './profile.ts';

/** Original authored wreck: four connected steel members with stepped outline,
 * different depths, old paint panels, exposed aperture lining and scorch marks.
 * All paint is flush on real solids; chips in paint are not holes in collision.
 */
export function wreckModel(index: number, colliders = false): Group {
  const p = PROFILES[index]!; const root = new Group(); root.name = `station-wreck-v2:${p.name}`;
  const colors = [0x304859, 0xa0acae, 0x89584b, 0x536776];
  const palette = [0xc6c7b6, 0xd99643, 0x263541, 0x593f36, 0x769092];
  const paint = Array.from({length:4},(_,layer)=>palette.map(color => new MeshStandardMaterial({ color, metalness: .25, roughness: .88,
    polygonOffset: true, polygonOffsetFactor: -2 * (layer + 1), polygonOffsetUnits: -2 * (layer + 1) }))).flat();
  const batches: PlaneGeometry[][] = paint.map(() => []), plane = new PlaneGeometry(1, 1);
  function mark(material: number, x: number, y: number, z: number, width: number, height: number, rz = 0, rx = 0, ry = 0, layer = 2): void {
    const g = plane.clone(); g.scale(width, height, 1); g.rotateZ(rz); g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z); batches[material + layer * 5]!.push(g);
  }
  for (const [i, box] of p.boxes.entries()) {
    const body = new Mesh(new BoxGeometry(box.half.x * 2, box.half.y * 2, box.half.z * 2), new MeshStandardMaterial({ color: colors[i], metalness: .3, roughness: .84 }));
    body.name = box.name; body.position.set(box.center.x, box.center.y, box.center.z); root.add(body);
    for (const side of [-1, 1]) {
      const z = box.center.z + box.half.z * side, ry = side < 0 ? Math.PI : 0;
      const width = box.half.x * 2, height = box.half.y * 2;
      // Salvaged plating, seams and worn paint keep substantial solid surfaces readable.
      const columns = i < 2 ? 1 : Math.max(1, Math.floor(width / 3)), rows = Math.max(1, Math.floor(height / 3.2));
      for (let c = 0; c < columns; c++) for (let r = 0; r < rows; r++) {
        const x = box.center.x - box.half.x + (c + .5) * width / columns;
        const y = box.center.y - box.half.y + (r + .5) * height / rows;
        const plate = i === 0 ? (r === rows - 1 ? 4 : 2) : i === 1 ? 4 : i === 2 ? 3 : 0;
        mark(plate, x, y, z, width / columns - .25, height / rows - .25, 0, 0, ry, 0);
        if ((c + 2 * r + i) % 2 === 0) mark(3, x, y, z, .12, Math.min(1.25, height / rows * .65), -.4, 0, ry, 1);
        for (const dx of [-.18, .18]) mark(2, x + dx, y, z, .035, Math.min(.7, height / rows * .4), .3, 0, ry, 3);
      }
      // Uneven repair straps and clipped hazard paint distinguish this from a tiled wall.
      const stripeY = box.center.y + (i % 2 ? .25 : -.25) * height;
      mark(1, box.center.x, stripeY, z, Math.max(.2, width - .6), .16, 0, 0, ry);
      if (i === 0) {
        // A simple original seven stencil, no font/texture dependency.
        const x = box.center.x, y = box.center.y + Math.min(2, height * .3);
        mark(0, x, y, z, Math.min(1.35, width * .5), .2, 0, 0, ry);
        mark(0, x + .22, y - .55, z, .2, 1.1, -.32, 0, ry);
      }
    }
  }
  const a = p.aperture, l = a.x - W.apertureX, r = a.x + W.apertureX, b = a.y - W.apertureY, t = a.y + W.apertureY;
  // Real inner faces, with different member depths; no painted fake passage.
  for (const [i, box] of p.boxes.entries()) {
    if (i < 2) mark(1, i ? r : l, a.y, box.center.z, box.half.z * 2, W.apertureY * 2, 0, 0, i ? -Math.PI / 2 : Math.PI / 2);
    else mark(1, a.x, i === 2 ? t : b, box.center.z, W.apertureX * 2, box.half.z * 2, 0, i === 2 ? Math.PI / 2 : -Math.PI / 2);
    for (const side of [-1, 1]) {
      const z = box.center.z + box.half.z * side, ry = side < 0 ? Math.PI : 0;
      if (i < 2) mark(1, (i ? r + .12 : l - .12), a.y, z, .24, W.apertureY * 2 + .35, 0, 0, ry);
      else mark(1, a.x, i === 2 ? t + .12 : b - .12, z, W.apertureX * 2, .24, 0, 0, ry);
    }
  }
  for (const [i, pieces] of batches.entries()) {
    if (pieces.length) { const m = new Mesh(mergeGeometries(pieces), paint[i]); m.name = `surface-paint-${i}`; root.add(m); }
    else paint[i]!.dispose();
    for (const piece of pieces) piece.dispose();
  }
  plane.dispose();
  const wires = new Group(); wires.name = 'colliders'; wires.visible = colliders;
  const material = new LineBasicMaterial({ color: 0x69f4d3, depthTest: false });
  for (const box of p.boxes) {
    const source = new BoxGeometry(box.half.x * 2, box.half.y * 2, box.half.z * 2), wire = new LineSegments(new EdgesGeometry(source), material); source.dispose();
    wire.position.set(box.center.x, box.center.y, box.center.z); wires.add(wire);
  }
  root.add(wires); return root;
}

export class StructureVariantsView implements ColliderDebugView {
  readonly root = new Group();
  readonly resources = new ResourceOwner();
  private readonly instances: Group[] = [];
  private slots: readonly Group[] = [];
  private readonly player: LineSegments;
  private readonly info = document.createElement('aside');
  private readonly aperture: Aperture;
  private readonly mode: StructureMode;
  private disposed = false;
  constructor(scene: Scene, aperture: Aperture, mode: StructureMode, colliders: boolean) {
    this.aperture = aperture; this.mode = mode; this.root.name = 'structure-variants-dev-root';
    const templates = APERTURE_NAMES.map((_, i) => wreckModel(i, colliders));
    for (let i = 0; i < 8; i++) { const group = new Group(); for (const t of templates) group.add(i ? t.clone(true) : t); this.root.add(group); this.instances.push(group); }
    const sphere = new SphereGeometry(CONFIG.ship.radius, 12, 8);
    this.player = new LineSegments(new WireframeGeometry(sphere), new LineBasicMaterial({ color: 0xff83d1, depthTest: false })); sphere.dispose(); this.player.visible = colliders;
    scene.add(this.root, this.player); this.resources.track(this.root); this.resources.track(this.player);
    this.info.id = 'structure-variants-debug-info';
    Object.assign(this.info.style, { position: 'absolute', left: '12px', bottom: '42px', maxWidth: '94%', zIndex: '5', color: '#e5ecee',
      background: '#07111ee8', padding: '7px 10px', font: '11px/1.5 monospace', whiteSpace: 'pre-line', pointerEvents: 'none' });
    document.getElementById('game')!.append(this.info);
  }
  bind(slots: readonly Group[]): void { this.slots = slots; }
  update(model: GameModel): void {
    if (this.disposed) return;
    let count = 0, ordinary = 0;
    for (const [i, h] of (model.field as RuntimeObstacleField).slots.entries()) {
      if (!isWreck(h)) { if (h.active) ordinary++; continue; }
      if (this.slots[i]) this.slots[i]!.visible = false;
      if (!h.planned || h.z > CONFIG.hazards.despawnZ) continue;
      const group = this.instances[count++]; if (!group) continue;
      group.visible = true; group.position.set(h.x, h.y, h.z);
      for (let variant = 0; variant < 5; variant++) group.children[variant]!.visible = variant === h.kind - 4;
    }
    for (let i = count; i < 8; i++) this.instances[i]!.visible = false;
    this.player.position.set(model.ship.x, model.ship.y, 0);
    const p = PROFILES[APERTURE_NAMES.indexOf(this.aperture)]!.aperture;
    this.info.textContent = `DEV v2 · ${this.mode.toUpperCase()} · APERTURE ${this.aperture.toUpperCase()}\nFixed hull (0,0) · opening (${p.x}, ${p.y}) · 5.6 × 4.4\n${count} structures / ${ordinary} ordinary hazards · 4 boxes per structure`;
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.root.removeFromParent(); this.player.removeFromParent(); this.info.remove(); this.resources.dispose(); this.slots = []; }
}
