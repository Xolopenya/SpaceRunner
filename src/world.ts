import * as THREE from 'three';
import { CONFIG } from './config.ts';
import { GameModel } from './core/game-model.ts';
import { Random } from './core/random.ts';

function outline(width: number, height: number, color: number, opacity: number): THREE.LineLoop {
  const points = [
    new THREE.Vector3(-width / 2, -height / 2, 0), new THREE.Vector3(width / 2, -height / 2, 0),
    new THREE.Vector3(width / 2, height / 2, 0), new THREE.Vector3(-width / 2, height / 2, 0),
  ];
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 260);
  private readonly ship = new THREE.Group();
  private readonly flames: THREE.Mesh[] = [];
  private readonly hazards: THREE.Group[] = [];
  private readonly gates: THREE.LineLoop[] = [];
  private readonly frames: THREE.LineLoop[] = [];
  private readonly stars: THREE.Points;
  private readonly originalStars: Float32Array;
  private readonly burst: THREE.Points;
  private readonly burstDirections: Float32Array;
  private hitSerial = 0;
  private burstLife = 0;
  private cameraZ = 14;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(CONFIG.render.background);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.fog = new THREE.Fog(CONFIG.render.background, 70, 190);
    this.scene.add(new THREE.HemisphereLight(0xadcfff, 0x333354, 2.6));
    const key = new THREE.DirectionalLight(0xffdfbf, 3.2);
    key.position.set(-12, 18, 10);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x5ae2ff, 2);
    rim.position.set(10, -4, -8);
    this.scene.add(rim);

    this.createShip();
    this.scene.add(this.ship);

    // Graybox meshes share geometry/material; every hazard slot is allocated once.
    const geometries = [new THREE.IcosahedronGeometry(1, 0), new THREE.BoxGeometry(1.25, 1.25, 1.25), new THREE.DodecahedronGeometry(1, 0)];
    const materials = [0x8b829b, 0xc08d6e, 0x6c8fa2].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }));
    for (let i = 0; i < CONFIG.hazards.capacity; i++) {
      const group = new THREE.Group();
      for (let kind = 0; kind < geometries.length; kind++) {
        const mesh = new THREE.Mesh(geometries[kind], materials[kind]);
        group.add(mesh);
      }
      group.visible = false;
      this.hazards.push(group);
      this.scene.add(group);
    }
    for (let i = 0; i < CONFIG.waves.capacity; i++) {
      const gate = outline(CONFIG.waves.safeHalfWidth * 2, CONFIG.bounds.y * 2 + 0.8, 0x69f4d3, 0.46);
      gate.visible = false;
      this.gates.push(gate);
      this.scene.add(gate);
    }
    for (let i = 0; i < 9; i++) {
      const frame = outline(14.2, 9.2, 0x376583, 0.19);
      this.frames.push(frame);
      this.scene.add(frame);
    }

    const random = new Random(23987);
    this.originalStars = new Float32Array(1100 * 3);
    for (let i = 0; i < this.originalStars.length; i += 3) {
      this.originalStars[i] = random.between(-95, 95);
      this.originalStars[i + 1] = random.between(-65, 65);
      this.originalStars[i + 2] = random.between(-190, 12);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(this.originalStars.slice(), 3));
    this.stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xb8cee8, size: 0.12, transparent: true, opacity: 0.8, sizeAttenuation: true }));
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    const planet = new THREE.Mesh(new THREE.SphereGeometry(17, 28, 20), new THREE.MeshStandardMaterial({ color: 0x233251, roughness: 1 }));
    planet.position.set(37, 19, -132);
    const ring = new THREE.Mesh(new THREE.RingGeometry(21, 21.5, 80), new THREE.MeshBasicMaterial({ color: 0x627b99, side: THREE.DoubleSide, transparent: true, opacity: 0.34 }));
    ring.rotation.set(0.8, 0.25, -0.35);
    planet.add(ring);
    this.scene.add(planet);

    this.burstDirections = new Float32Array(36 * 3);
    for (let i = 0; i < this.burstDirections.length; i++) this.burstDirections[i] = random.between(-1, 1) * 8;
    const burstGeometry = new THREE.BufferGeometry();
    burstGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.burstDirections.length), 3));
    this.burst = new THREE.Points(burstGeometry, new THREE.PointsMaterial({ color: 0xffae74, size: 0.12, transparent: true, opacity: 0, depthWrite: false }));
    this.burst.frustumCulled = false;
    this.scene.add(this.burst);
  }

  private createShip(): void {
    const hull = new THREE.MeshStandardMaterial({ color: 0xd8e4ec, roughness: 0.4, metalness: 0.35, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x19344b, roughness: 0.5, metalness: 0.45 });
    const mint = new THREE.MeshBasicMaterial({ color: 0x70ffe0 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.4, 4), hull);
    body.rotation.x = -Math.PI / 2;
    body.scale.z = 0.62;
    this.ship.add(body);
    const shape = new THREE.Shape();
    shape.moveTo(-1.55, 0.72);
    shape.lineTo(-0.3, -0.75);
    shape.lineTo(0.3, -0.75);
    shape.lineTo(1.55, 0.72);
    shape.lineTo(0.35, 0.34);
    shape.lineTo(-0.35, 0.34);
    shape.closePath();
    const wings = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false }), hull);
    wings.rotation.x = Math.PI / 2;
    this.ship.add(wings);
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.7), dark);
    cockpit.position.set(0, 0.25, -0.15);
    this.ship.add(cockpit);
    for (const x of [-0.62, 0.62]) {
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.75, 8), dark);
      engine.rotation.x = Math.PI / 2;
      engine.position.set(x, -0.04, 0.55);
      this.ship.add(engine);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12), mint);
      glow.position.set(x, -0.04, 0.94);
      this.ship.add(glow);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.15, 8), new THREE.MeshBasicMaterial({ color: 0x57e8ef, transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending, depthWrite: false }));
      flame.rotation.x = Math.PI / 2;
      flame.position.set(x, -0.04, 1.4);
      this.flames.push(flame);
      this.ship.add(flame);
    }
  }

  resize(width: number, height: number): void {
    const cap = width < 700 ? CONFIG.render.mobilePixelRatio : CONFIG.render.maxPixelRatio;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.cameraZ = Math.max(13, 7 / Math.tan(THREE.MathUtils.degToRad(29)) / this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  reset(): void {
    this.hitSerial = 0;
    this.burstLife = 0;
    this.ship.rotation.set(0, 0, 0);
    this.camera.position.set(0, 2.4, this.cameraZ);
  }

  render(model: GameModel, dt: number): void {
    if (this.disposed) return;
    const blend = 1 - Math.exp(-dt * 8);
    this.ship.position.set(model.ship.x, model.ship.y, 0);
    this.ship.rotation.z = THREE.MathUtils.lerp(this.ship.rotation.z, -model.ship.vx * 0.045, blend);
    this.ship.rotation.x = THREE.MathUtils.lerp(this.ship.rotation.x, model.ship.vy * 0.025, blend);
    this.ship.visible = model.invulnerability <= 0 || Math.floor(model.elapsed * 12) % 2 === 0;
    for (const flame of this.flames) flame.scale.y = 0.85 + Math.sin(model.elapsed * 30) * 0.15;

    for (let i = 0; i < model.field.hazards.length; i++) {
      const hazard = model.field.hazards[i]!;
      const group = this.hazards[i]!;
      group.visible = hazard.active;
      if (!hazard.active) continue;
      group.position.set(hazard.x, hazard.y, hazard.z);
      group.scale.setScalar(hazard.radius);
      group.rotation.set(model.elapsed * hazard.spin + hazard.phase, model.elapsed * hazard.spin * 0.7, hazard.phase);
      group.children.forEach((mesh, kind) => { mesh.visible = hazard.kind === kind; });
    }
    for (let i = 0; i < this.gates.length; i++) {
      const wave = model.field.waves[i]!;
      const gate = this.gates[i]!;
      gate.visible = wave.active && wave.z < 1;
      gate.position.set(wave.safeX, 0, wave.z);
    }
    for (let i = 0; i < this.frames.length; i++) this.frames[i]!.position.z = -i * 18 + model.distance % 18 - 5;
    const positions = this.stars.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 2; i < this.originalStars.length; i += 3) {
      positions.array[i] = ((this.originalStars[i]! + model.distance * 0.65 + 190) % 202) - 190;
    }
    positions.needsUpdate = true;

    if (model.hitSerial !== this.hitSerial) {
      this.hitSerial = model.hitSerial;
      this.burstLife = 0.55;
      this.burst.position.copy(this.ship.position);
    }
    if (model.state === 'PLAYING' || model.state === 'GAME_OVER') this.burstLife = Math.max(0, this.burstLife - dt);
    const burstMaterial = this.burst.material as THREE.PointsMaterial;
    burstMaterial.opacity = this.burstLife / 0.55;
    this.burst.visible = this.burstLife > 0;
    if (this.burst.visible) {
      const particles = this.burst.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.burstDirections.length; i++) particles.array[i] = this.burstDirections[i]! * (0.55 - this.burstLife);
      particles.needsUpdate = true;
    }
    const shake = model.state === 'PLAYING' ? this.burstLife * 0.08 : 0;
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, model.ship.x * 0.12, blend) + Math.sin(model.elapsed * 80) * shake;
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 2.4 + model.ship.y * 0.12, blend);
    this.camera.position.z = this.cameraZ;
    this.camera.lookAt(0, 0, -28);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse(node => {
      if (node instanceof THREE.Mesh || node instanceof THREE.Points || node instanceof THREE.Line) {
        geometries.add(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    this.renderer.dispose();
  }
}
