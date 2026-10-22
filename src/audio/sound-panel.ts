import { element } from '../ui.ts';
import type { AudioManager, AudioStatus } from './audio-manager.ts';
import type { AudioSettings } from './settings.ts';

/** Native dialog supplies focus trapping; controls live outside flight input. */
export class SoundPanel {
  private readonly dialog = element<HTMLDialogElement>('sound-settings');
  private readonly mute = element<HTMLButtonElement>('sound-mute');
  private readonly status = element('sound-status');
  private readonly events = new AbortController();
  private readonly audio: AudioManager;
  private lastStatus?: AudioStatus;
  private lastSettings?: Readonly<AudioSettings>;

  constructor(audio: AudioManager) {
    this.audio = audio;
    const options = { signal: this.events.signal };
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-sound-open]')) button.addEventListener('click', () => {
      this.dialog.showModal();
      this.audio.activate();
      this.update();
    }, options);
    element('sound-close').addEventListener('click', () => { this.audio.activate(); this.dialog.close(); }, options);
    this.dialog.addEventListener('keydown', event => {
      if (event.code === 'Escape') { event.preventDefault(); event.stopPropagation(); this.dialog.close(); }
      if (event.code === 'KeyP') event.stopPropagation();
    }, options);
    this.mute.addEventListener('click', () => {
      this.audio.setSettings({ muted: !this.audio.settings.muted });
      this.audio.activate();
      this.update();
    }, options);
    for (const key of ['master', 'music', 'sfx'] as const) {
      const input = element<HTMLInputElement>(`sound-${key}`);
      input.addEventListener('input', () => {
        this.audio.setSettings({ [key]: Number(input.value) / 100 });
        this.update();
      }, options);
      input.addEventListener('change', () => this.audio.activate(), options);
    }
    this.update();
  }

  update(): void {
    const settings = this.audio.settings;
    const status = this.audio.status;
    if (this.lastSettings === settings && this.lastStatus === status) return;
    this.lastSettings = settings;
    this.lastStatus = status;
    const states = {
      locked: 'Sound starts after Launch or a sound control.', running: 'Audio enabled.',
      muted: 'Sound muted.', blocked: 'Audio blocked. Use a sound control or Resume.',
      unavailable: 'Audio unavailable. Silent flight remains ready.', suspended: 'Audio suspended. Use a sound control or Resume.', disposed: 'Audio stopped.',
    };
    const message = states[status];
    if (this.status.textContent !== message) this.status.textContent = message;
    this.mute.textContent = settings.muted ? 'Unmute sound' : 'Mute sound';
    this.mute.setAttribute('aria-pressed', String(settings.muted));
    for (const key of ['master', 'music', 'sfx'] as const) {
      const percent = String(Math.round(settings[key] * 100));
      const input = element<HTMLInputElement>(`sound-${key}`);
      if (input.value !== percent) input.value = percent;
      const output = element<HTMLOutputElement>(`sound-${key}-value`);
      if (output.value !== `${percent}%`) output.value = `${percent}%`;
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-sound-open]')) {
      const label = settings.muted ? 'Sound settings · muted' : 'Sound settings';
      if (button.textContent !== label) button.textContent = label;
    }
  }

  dispose(): void { this.events.abort(); if (this.dialog.open) this.dialog.close(); }
}
