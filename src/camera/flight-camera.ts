import { MathUtils, PerspectiveCamera } from 'three';

export const CAMERA = Object.freeze({
  fov: 58, near: 0.1, far: 260,
  height: 2.4, lookZ: -28, minimumZ: 13, arenaHalfWidth: 7,
  baselineFollow: 0.12, baselineDamping: 8,
  hybridFollowX: 0.80, hybridFollowY: 0.80,
});
export type CameraMode = 'baseline' | 'full-chase' | 'hybrid-chase';
export const CAMERA_MODES: readonly CameraMode[] = ['baseline', 'full-chase', 'hybrid-chase'];

/** Presentation only. Receives scalar snapshots; never owns or changes simulation. */
export class FlightCamera {
  readonly camera: PerspectiveCamera;
  private selected: CameraMode = 'baseline';
  private rearZ = 14;
  private snapBaseline = false;

  constructor(camera: PerspectiveCamera) { this.camera = camera; }
  get mode(): CameraMode { return this.selected; }

  setMode(mode: CameraMode): void {
    if (!CAMERA_MODES.includes(mode)) throw new RangeError(`Unknown camera mode: ${mode}`);
    // Explicit snap on the next render. No residual spring/transition to accumulate.
    if (mode !== this.selected) this.snapBaseline = mode === 'baseline';
    this.selected = mode;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.rearZ = Math.max(CAMERA.minimumZ, CAMERA.arenaHalfWidth / Math.tan(MathUtils.degToRad(29)) / this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  reset(): void {
    // Keep the owner's selected policy across runs; reset all positional history.
    this.camera.position.set(0, CAMERA.height, this.rearZ);
    this.snapBaseline = false;
  }

  update(x: number, y: number, elapsed: number, shake: number, dt: number): void {
    const camera = this.camera;
    if (this.selected === 'baseline') {
      // A live return from another policy has one explicit entry pose, then the
      // unchanged baseline recurrence resumes. Ordinary baseline never uses it.
      if (this.snapBaseline) {
        camera.position.set(x * CAMERA.baselineFollow, CAMERA.height + y * CAMERA.baselineFollow, this.rearZ);
        this.snapBaseline = false;
      }
      // Exact 004B operations, including its fixed target and accumulated shake.
      const blend = 1 - Math.exp(-dt * CAMERA.baselineDamping);
      camera.position.x = MathUtils.lerp(camera.position.x, x * CAMERA.baselineFollow, blend) + Math.sin(elapsed * 80) * shake;
      camera.position.y = MathUtils.lerp(camera.position.y, CAMERA.height + y * CAMERA.baselineFollow, blend);
      camera.position.z = this.rearZ;
      camera.lookAt(0, 0, CAMERA.lookZ);
      return;
    }
    const followX = this.selected === 'full-chase' ? 1 : CAMERA.hybridFollowX;
    const followY = this.selected === 'full-chase' ? 1 : CAMERA.hybridFollowY;
    const anchorX = x * followX + Math.sin(elapsed * 80) * shake;
    const anchorY = y * followY;
    // Translate BOTH endpoints, including impact displacement. Zero follow lag,
    // stable forward direction, no bank coupling or allocation inside this path.
    camera.position.set(anchorX, CAMERA.height + anchorY, this.rearZ);
    camera.lookAt(anchorX, anchorY, CAMERA.lookZ);
  }
}
