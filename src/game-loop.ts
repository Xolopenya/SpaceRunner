import { CONFIG } from './config.ts';

export class GameLoop {
  private frameId = 0;
  private previous = 0;
  private accumulator = 0;
  private update: (dt: number) => void;
  private render: (dt: number) => void;

  constructor(update: (dt: number) => void, render: (dt: number) => void) {
    this.update = update;
    this.render = render;
  }

  start(): void {
    this.previous = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop(): void { cancelAnimationFrame(this.frameId); }

  private frame = (now: number): void => {
    const dt = Math.min(CONFIG.maxFrameDelta, Math.max(0, (now - this.previous) / 1000));
    this.previous = now;
    this.accumulator += dt;
    while (this.accumulator >= CONFIG.step) {
      this.update(CONFIG.step);
      this.accumulator -= CONFIG.step;
    }
    this.render(dt);
    this.frameId = requestAnimationFrame(this.frame);
  };
}
