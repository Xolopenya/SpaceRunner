import { BufferGeometry, Color, Float32BufferAttribute, Matrix3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { Object3D } from 'three';

export interface HullSection { geometry: BufferGeometry; center: Vector3; name: string }
/** Original GLB triangles, partitioned once in normalized ship coordinates. No
 * runtime booleans, borrowed geometry mutation, or unrelated replacement model. */
export function hullSections(model: Object3D): HullSection[] {
  const bins = Array.from({ length: 6 }, () => ({ p: [] as number[], n: [] as number[], c: [] as number[] }));
  model.updateWorldMatrix(true, true);
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), normal = new Vector3(), color = new Color();
  model.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const g: BufferGeometry = node.geometry, position = g.getAttribute('position'), normals = g.getAttribute('normal'), index = g.index;
    const count = index?.count ?? position.count, nmat = new Matrix3().getNormalMatrix(node.matrixWorld);
    for (let triangle = 0; triangle < count; triangle += 3) {
      const ids = [0, 1, 2].map(offset => index ? index.getX(triangle + offset) : triangle + offset);
      a.fromBufferAttribute(position, ids[0]!).applyMatrix4(node.matrixWorld);
      b.fromBufferAttribute(position, ids[1]!).applyMatrix4(node.matrixWorld);
      c.fromBufferAttribute(position, ids[2]!).applyMatrix4(node.matrixWorld);
      const x = (a.x + b.x + c.x) / 3, z = (a.z + b.z + c.z) / 3;
      const bin = bins[x < -.55 ? 0 : x > .55 ? 1 : z < -.55 ? 2 : z > .65 ? 3 : (a.y + b.y + c.y) > .3 ? 4 : 5]!;
      const material = Array.isArray(node.material) ? node.material[g.groups.find(group => triangle >= group.start && triangle < group.start + group.count)?.materialIndex ?? 0] : node.material;
      color.copy(material instanceof MeshStandardMaterial ? material.color : new Color(0xa3b2be));
      for (const [offset, p] of [a, b, c].entries()) {
        bin.p.push(p.x, p.y, p.z);
        if (normals) normal.fromBufferAttribute(normals, ids[offset]!).applyMatrix3(nmat).normalize();
        else normal.subVectors(b, a).cross(c.clone().sub(a)).normalize();
        bin.n.push(normal.x, normal.y, normal.z); bin.c.push(color.r, color.g, color.b);
      }
    }
  });
  const names = ['port-wing', 'starboard-wing', 'nose', 'engine-bay', 'cockpit', 'keel'];
  return bins.flatMap((bin, index) => {
    if (!bin.p.length) return [];
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(bin.p, 3))
      .setAttribute('normal', new Float32BufferAttribute(bin.n, 3)).setAttribute('color', new Float32BufferAttribute(bin.c, 3));
    geometry.computeBoundingBox(); const center = geometry.boundingBox!.getCenter(new Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
    return [{ geometry, center, name: names[index]! }];
  });
}
