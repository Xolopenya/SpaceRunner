import './styles.css';
import { Game } from './game.ts';
import { AssetManager } from './assets/asset-manager.ts';

declare global {
  interface Window { spaceRunner?: Game }
}

let game: Game | undefined;
let assets: AssetManager | undefined;
let disposed = false;
let loading = false;
const events = new AbortController();
const retry = document.getElementById('retry') as HTMLButtonElement;
const message = document.getElementById('loading-message')!;

async function boot(): Promise<void> {
  if (loading || disposed || game) return;
  loading = true;
  retry.hidden = true;
  assets = new AssetManager(import.meta.env.BASE_URL);
  try {
    await assets.preload((completed, total, label) => {
      if (!disposed) message.textContent = `LOADING FLIGHT MODELS ${completed}/${total} · ${label}`;
    });
    if (disposed) return;
    game = new Game(assets);
    // Opt-in test inspection only; omitted from the production build by Vite.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) window.spaceRunner = game;
  } catch (error) {
    assets.dispose();
    if (disposed) return;
    console.error('Space Runner could not start:', error);
    message.textContent = error instanceof AggregateError
      ? error.message
      : 'Flight systems could not start. Check WebGL 2 support and retry.';
    retry.hidden = false;
  } finally {
    loading = false;
  }
}

retry.addEventListener('click', () => { void boot(); }, { signal: events.signal });
void boot();

if (import.meta.hot) import.meta.hot.dispose(() => {
  disposed = true;
  events.abort();
  game?.dispose();
  assets?.dispose();
  delete window.spaceRunner;
});
