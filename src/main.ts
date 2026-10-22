import './styles.css';
import { Game } from './game.ts';

declare global {
  interface Window { spaceRunner?: Game }
}

let game: Game | undefined;

try {
  game = new Game();
  // Opt-in test inspection only; omitted from the production build by Vite.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) window.spaceRunner = game;
} catch (error) {
  console.error('Space Runner could not start:', error);
  const status = document.getElementById('loading');
  if (status) status.textContent = 'Flight systems could not start. Enable WebGL 2 in a modern browser, then reload.';
}

if (import.meta.hot) import.meta.hot.dispose(() => { game?.dispose(); delete window.spaceRunner; });
