import { CAMERA_MODES } from '../camera/flight-camera.ts';
import type { CameraMode, FlightCamera } from '../camera/flight-camera.ts';

/** Only dynamically imported by DEV debug=camera. No keyboard/input bindings. */
export class CameraSelector {
  private readonly root = document.createElement('aside');
  private readonly events = new AbortController();

  constructor(camera: FlightCamera, initial: string | null) {
    this.root.id = 'camera-research';
    this.root.setAttribute('aria-label', 'DEV camera comparison');
    this.root.style.cssText = 'position:absolute;z-index:12;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));max-width:calc(100% - 24px);padding:8px;background:#08111fed;border:1px solid #8cdeeb88;color:#edf4f5;font:11px monospace;pointer-events:auto';
    const label = document.createElement('div');
    label.textContent = 'DEV CAMERA · snap · same simulation';
    label.style.marginBottom = '6px';
    this.root.append(label);
    const names = ['A · Current', 'B · Full Chase', 'C · Hybrid .80'];
    const buttons = CAMERA_MODES.map((mode, i) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = names[i]!; button.dataset.camera = mode;
      button.style.cssText = 'font:inherit;min-height:36px;padding:6px;margin:0 3px 0 0;border:1px solid #8cdeeb;color:#edf4f5;background:#162837;cursor:pointer';
      button.addEventListener('click', () => select(mode), { signal: this.events.signal });
      this.root.append(button); return button;
    });
    const select = (mode: CameraMode) => {
      camera.setMode(mode);
      this.root.dataset.mode = mode;
      for (const button of buttons) {
        const active = button.dataset.camera === mode;
        button.setAttribute('aria-pressed', String(active));
        button.style.background = active ? '#276071' : '#162837';
      }
    };
    select(CAMERA_MODES.includes(initial as CameraMode) ? initial as CameraMode : 'baseline');
    const colliderText = document.getElementById('collider-debug-info');
    if (colliderText) {
      // The inherited large legend covers the left-boundary ship in A. Keep all
      // wires visible and let the owner expand its text explicitly.
      colliderText.hidden = true;
      const toggle = document.createElement('button');
      toggle.type = 'button'; toggle.textContent = 'Collider text';
      toggle.style.cssText = 'font:inherit;color:#8cdeeb;background:transparent;border:0;padding:3px 0;cursor:pointer';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', () => {
        colliderText.hidden = !colliderText.hidden;
        toggle.setAttribute('aria-expanded', String(!colliderText.hidden));
      }, { signal: this.events.signal });
      this.root.append(document.createElement('br'), toggle);
    }
    document.getElementById('game')!.append(this.root);
  }

  dispose(): void { this.events.abort(); this.root.remove(); }
}
