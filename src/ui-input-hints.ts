/** Presentation only; never consumes, prevents or changes gameplay input. */
export class InputHints {
  private readonly events = new AbortController();
  private readonly coarse = matchMedia('(pointer: coarse)');
  constructor(private readonly root: HTMLElement) {
    const options = { signal: this.events.signal };
    const capability = () => this.set(this.coarse.matches ? 'touch' : 'desktop');
    capability();
    this.coarse.addEventListener('change', capability, options);
    window.addEventListener('pointerdown', event => this.set(event.pointerType === 'touch' ? 'touch' : 'desktop'), options);
    window.addEventListener('keydown', event => {
      if (!event.ctrlKey && !event.metaKey && !event.altKey && /^(Key[WASDPM]|Arrow|Escape)/.test(event.code)) this.set('desktop');
    }, options);
  }
  private set(mode: string): void {
    if (this.root.dataset.input !== mode) this.root.dataset.input = mode;
  }
  dispose(): void { this.events.abort(); }
}
