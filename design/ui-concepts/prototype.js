const params = new URLSearchParams(location.search);
const stage = document.querySelector('#stage');
const ui = document.querySelector('#interface');
const dialog = document.querySelector('#audio');
const conceptSelect = document.querySelector('#concept');
const screenSelect = document.querySelector('#screen');
const provenance = await fetch('./assets/capture-provenance.json').then(response => {
  if (!response.ok) throw new Error('Run node scripts/ui-capture-backgrounds.mjs before reviewing.');
  return response.json();
});
let concept = ['a', 'b', 'c'].includes(params.get('concept')) ? params.get('concept') : 'a';
let screen = [...screenSelect.options].some(option => option.value === params.get('state')) ? params.get('state') : 'menu';
let muted = false;
const touch = matchMedia('(max-width: 600px), (max-height: 520px)');
const stateNames = { menu: 'Main menu', playing: 'Gameplay HUD', paused: 'Pause', over: 'Game over', hit: 'Damage', loading: 'Loading', error: 'Load error' };
const data = () => provenance.captures.find(capture => capture.name === (innerWidth <= 600 ? 'portrait' : innerHeight <= 520 ? 'landscape' : 'desktop'));
const number = value => Math.floor(value).toLocaleString('en-US');
const action = (target, text, key) => `<button class="action" data-go="${target}"><span>${text}</span><span class="action-tail" aria-hidden="true">${key}</span></button>`;
const sound = () => '<button class="text-button" data-audio>Sound settings <span aria-hidden="true">↗</span></button>';
const controls = () => `<div class="controls"><p class="steer"><span class="desktop-control"><kbd>WASD</kbd> / <kbd>↑ ↓ ← →</kbd> &nbsp; Steer</span><span class="touch-control">Drag anywhere to steer</span></p><p><kbd>ESC / P</kbd> &nbsp; Pause &nbsp; <span class="divider">/</span> &nbsp; <kbd>M</kbd> &nbsp; Mute</p></div>`;
function hull(points) {
  return `<div class="hull" role="meter" aria-label="Hull points" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${points}"><span class="metric-label">HULL</span><div class="hull-segments" aria-hidden="true">${[0, 1, 2].map(i => `<i class="${i >= points ? 'lost' : ''}"></i>`).join('')}</div><span class="hull-count">${points}<small>/3</small></span></div>`;
}
function hud(capture) {
  return `<section class="hud" aria-label="Flight status">${hull(screen === 'hit' ? 2 : capture.hull)}<div class="distance"><span class="metric-label">DISTANCE</span><strong>${number(capture.score)}<small>m</small></strong></div></section><button class="pause-button" data-go="paused" aria-label="Pause flight"><span aria-hidden="true">Ⅱ</span><span>Pause</span></button><span class="flight-speed">${Math.round(capture.speed)} m/s</span>`;
}
function render(focus = false) {
  const capture = data();
  stage.dataset.concept = concept;
  stage.dataset.screen = screen;
  conceptSelect.value = concept;
  screenSelect.value = screen;
  document.querySelector('#concept-letter').textContent = concept.toUpperCase();
  document.title = `Space Runner — Concept ${concept.toUpperCase()} / ${stateNames[screen]}`;
  const background = ['menu', 'loading', 'error'].includes(screen) ? 'menu' : 'flight';
  document.querySelector('#scene-image').src = `./assets/desktop-${background}.png`;
  document.querySelector('#portrait-source').srcset = `./assets/portrait-${background}.png`;
  document.querySelector('#landscape-source').srcset = `./assets/landscape-${background}.png`;
  const score = `<strong class="result-number">${number(capture.score)}<small>m</small></strong>`;
  const record = `<div class="record"><span class="metric-label">PERSONAL BEST</span><strong>${screen === 'menu' ? '0' : number(capture.score)}<small>m</small></strong></div>`;
  if (screen === 'menu') {
    ui.innerHTML = `<section class="menu-layout"><div class="menu-copy"><span class="mode-label">ENDLESS FLIGHT</span><h1 class="game-title" aria-label="Space Runner"><span>SPACE</span><span>RUNNER<span class="title-cut" aria-hidden="true"></span></span></h1><p class="mission-line">Avoid debris. Fly further.</p><div class="menu-actions">${action('playing', 'Launch run', '↗')}${sound()}</div>${controls()}</div>${record}</section>`;
  } else if (screen === 'playing' || screen === 'hit') {
    ui.innerHTML = `${hud(capture)}${screen === 'hit' ? '<div class="damage" role="status"><strong>Hull hit</strong><span>Impact protection · 1.6 s</span></div>' : ''}<div class="first-hint">${touch.matches ? 'Drag to steer' : 'WASD / arrows to steer'} <span>·</span> Avoid the debris</div>`;
  } else if (screen === 'paused') {
    ui.innerHTML = `<section class="pause-layout"><div class="state-copy"><span class="state-label">FLIGHT PAUSED</span><h1 class="state-title">Hold<br /> position.</h1><p class="state-description">Your run is waiting.</p>${action('playing', 'Resume flight', '→')}${sound()}${controls()}</div><div class="paused-distance"><span class="metric-label">DISTANCE</span>${score}${hull(capture.hull)}</div></section>`;
  } else if (screen === 'over') {
    ui.innerHTML = `<section class="over-layout"><div class="state-copy"><span class="state-label">HULL DEPLETED</span><h1 class="state-title">End of<br /> flight.</h1><div class="result"><span class="metric-label">DISTANCE</span>${score}</div>${action('playing', 'Fly again', '↗')}<span class="route">Route ${capture.seed}</span></div>${record}</section>`;
  } else {
    ui.innerHTML = `<section class="loading-layout"><span class="mode-label">SPACE RUNNER</span><h1>${screen === 'error' ? 'Flight on hold.' : 'Preparing flight.'}</h1><p role="status">${screen === 'error' ? 'Required models could not load.' : 'Loading flight models…'}</p>${screen === 'error' ? action('menu', 'Retry loading', '↻') : ''}<span class="load-note">Design preview · use the screen selector to continue.</span></section>`;
  }
  for (const button of ui.querySelectorAll('[data-go]')) button.addEventListener('click', () => navigate(button.dataset.go));
  for (const button of ui.querySelectorAll('[data-audio]')) button.addEventListener('click', () => dialog.showModal());
  if (focus) (ui.querySelector('.action, .pause-button') ?? stage).focus({ preventScroll: true });
  stage.dataset.ready = 'true';
}
function navigate(next) {
  screen = next;
  params.set('concept', concept); params.set('state', screen);
  history.replaceState(null, '', `?${params}`);
  render(true);
}
function toggleMute() {
  muted = !muted;
  document.querySelector('#mute').setAttribute('aria-pressed', String(muted));
  document.querySelector('#mute').innerHTML = `${muted ? 'Unmute sound' : 'Mute sound'} <kbd>M</kbd>`;
  document.querySelector('#audio-status').textContent = muted ? 'Preview muted. No audio playback.' : 'Preview controls only. No audio playback.';
}
conceptSelect.addEventListener('change', () => { concept = conceptSelect.value; navigate(screen); });
screenSelect.addEventListener('change', () => navigate(screenSelect.value));
document.querySelector('#audio-close').addEventListener('click', () => dialog.close());
document.querySelector('#mute').addEventListener('click', toggleMute);
for (const key of ['master', 'music', 'sfx']) document.querySelector(`#${key}`).addEventListener('input', event => {
  document.querySelector(`#${key}-value`).value = `${event.target.value}%`;
});
document.addEventListener('keydown', event => {
  if (event.target.matches('input, select') || event.repeat) return;
  if (event.code === 'KeyM') { event.preventDefault(); toggleMute(); }
  if (dialog.open) return;
  if (event.code === 'Escape' || event.code === 'KeyP') {
    if (['playing', 'hit', 'paused'].includes(screen)) { event.preventDefault(); navigate(screen === 'paused' ? 'playing' : 'paused'); }
  }
});
let previousTier = data().name;
addEventListener('resize', () => { if (data().name !== previousTier) { previousTier = data().name; render(); } });
render();
if (params.has('audio')) dialog.showModal();
