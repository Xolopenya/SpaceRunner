import type { Axis } from './core/ship.ts';

const MOVEMENT = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

export class InputManager {
  private readonly events = new AbortController();
  private readonly keys = new Set<string>();
  private readonly touch: Axis = { x: 0, y: 0 };
  private pointer: number | null = null;
  private origin = { x: 0, y: 0 };
  private canvas: HTMLCanvasElement;
  private stick: HTMLElement;

  constructor(canvas: HTMLCanvasElement, stick: HTMLElement, playing: () => boolean, pause: () => void) {
    this.canvas = canvas;
    this.stick = stick;
    const options = { signal: this.events.signal };
    window.addEventListener('keydown', event => {
      if (MOVEMENT.has(event.code)) {
        if (playing()) event.preventDefault();
        this.keys.add(event.code);
      }
      if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) {
        event.preventDefault();
        pause();
      }
    }, options);
    window.addEventListener('keyup', event => { this.keys.delete(event.code); }, options);
    canvas.addEventListener('pointerdown', event => {
      if (!playing() || this.pointer !== null || event.button !== 0) return;
      event.preventDefault();
      this.pointer = event.pointerId;
      this.origin = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
      const rect = canvas.getBoundingClientRect();
      stick.style.left = `${event.clientX - rect.left}px`;
      stick.style.top = `${event.clientY - rect.top}px`;
      stick.hidden = false;
    }, options);
    canvas.addEventListener('pointermove', event => {
      if (event.pointerId !== this.pointer) return;
      const radius = Math.max(55, Math.min(90, canvas.clientWidth * 0.16));
      const x = (event.clientX - this.origin.x) / radius;
      const y = (this.origin.y - event.clientY) / radius;
      const scale = Math.max(1, Math.hypot(x, y));
      this.touch.x = x / scale;
      this.touch.y = y / scale;
      stick.style.setProperty('--stick-x', `${this.touch.x * 24}px`);
      stick.style.setProperty('--stick-y', `${-this.touch.y * 24}px`);
    }, options);
    const release = (event: PointerEvent) => { if (event.pointerId === this.pointer) this.clear(); };
    canvas.addEventListener('pointerup', release, options);
    canvas.addEventListener('pointercancel', release, options);
    canvas.addEventListener('lostpointercapture', release, options);
  }

  get axis(): Axis {
    const down = (a: string, b: string) => Number(this.keys.has(a) || this.keys.has(b));
    return {
      x: down('KeyD', 'ArrowRight') - down('KeyA', 'ArrowLeft') + this.touch.x,
      y: down('KeyW', 'ArrowUp') - down('KeyS', 'ArrowDown') + this.touch.y,
    };
  }

  clear(): void {
    const captured = this.pointer;
    this.pointer = null;
    this.keys.clear();
    this.touch.x = this.touch.y = 0;
    this.stick.hidden = true;
    this.stick.style.setProperty('--stick-x', '0px');
    this.stick.style.setProperty('--stick-y', '0px');
    if (captured !== null && this.canvas.hasPointerCapture(captured)) this.canvas.releasePointerCapture(captured);
  }

  dispose(): void { this.clear(); this.events.abort(); }
}
