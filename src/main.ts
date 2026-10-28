import './styles.css';
import { Game } from './game.ts';
import { AssetManager } from './assets/asset-manager.ts';
import type { ColliderDebugFactory } from './debug/types.ts';
import type { GameModel } from './core/game-model.ts';
import type { LargeStructureView } from './experiments/large-structure/view.ts';

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
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(location.search);
      if (params.get('debug') === 'field' && params.get('experiment') === 'moving-mine') {
        const { MineAssetManager } = await import('./experiments/moving-mine/assets.ts');
        if (disposed) return;
        assets.dispose(); assets = new MineAssetManager(import.meta.env.BASE_URL);
      }
    }
    await assets.preload((completed, total, label) => {
      if (!disposed) message.textContent = `LOADING FLIGHT MODELS ${completed}/${total} · ${label}`;
    });
    if (disposed) return;
    let debugFactory: ColliderDebugFactory | undefined;
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('debug') === 'colliders') {
      const { ColliderDebugger } = await import('./debug/collider-debugger.ts');
      if (disposed) return;
      debugFactory = scene => new ColliderDebugger(scene);
    }
    let developerModel: GameModel | undefined;
    let structureView: Pick<LargeStructureView, 'bind' | 'update' | 'dispose'> | undefined;
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('debug') === 'field') {
      const params = new URLSearchParams(location.search), experiment = params.get('experiment');
      if (experiment === 'moving-mine') {
        if (params.has('policy') || params.has('mode') || params.has('aperture')) throw new RangeError('Moving mine owns its scheduling policy');
        const { MovingMineGameModel } = await import('./experiments/moving-mine/model.ts');
        const { MovingMineView } = await import('./experiments/moving-mine/view.ts');
        const { MineAssetManager } = await import('./experiments/moving-mine/assets.ts');
        const { mineConfiguration, motionPolicy, configurations } = await import('./experiments/moving-mine/settings.ts');
        const configuration = mineConfiguration(params.get('mine')), motion = motionPolicy(params.get('motion'));
        if (configuration && !configurations(motion).includes(configuration)) throw new RangeError('Mine configuration does not match motion policy');
        if (!(assets instanceof MineAssetManager)) throw new Error('Missing mine asset owner');
        const mineAssets = assets;
        try {
          await mineAssets.loadMine();
          if (disposed) return;
          developerModel = new MovingMineGameModel(configuration, params.get('firstMine') === '1', motion);
          debugFactory = scene => { structureView = new MovingMineView(scene, mineAssets, params.get('colliders') === '1'); return structureView; };
        } catch (error) {
          console.warn('Moving mine asset unavailable; using certified mixed field', error);
          const { MixedFlowGameModel } = await import('./experiments/mixed-flow/model.ts');
          const { MixedFlowView } = await import('./experiments/mixed-flow/view.ts');
          if (disposed) return;
          developerModel = new MixedFlowGameModel();
          debugFactory = scene => { structureView = new MixedFlowView(scene, params.get('colliders') === '1'); return structureView; };
        }
      } else if (experiment === 'mixed-flow') {
        if (params.has('policy') || params.has('mode')) throw new RangeError('Mixed flow owns its scheduling policy');
        const { MixedFlowGameModel } = await import('./experiments/mixed-flow/model.ts');
        const { MixedFlowView } = await import('./experiments/mixed-flow/view.ts');
        const { apertureSelector } = await import('./experiments/structure-variants/profile.ts');
        if (disposed) return;
        developerModel = new MixedFlowGameModel(params.has('aperture') ? apertureSelector(params.get('aperture')) : undefined);
        debugFactory = scene => { structureView = new MixedFlowView(scene, params.get('colliders') === '1'); return structureView; };
      } else if (experiment === 'large-structure') {
        if (params.has('policy')) throw new RangeError('Select either policy or structure experiment');
        const { StructureVariantsGameModel } = await import('./experiments/structure-variants/model.ts');
        const { StructureVariantsView } = await import('./experiments/structure-variants/view.ts');
        const { apertureSelector, structureMode } = await import('./experiments/structure-variants/profile.ts');
        if (disposed) return;
        const aperture = apertureSelector(params.get('aperture')), mode = structureMode(params.get('mode'));
        developerModel = new StructureVariantsGameModel(aperture, mode);
        debugFactory = scene => { structureView = new StructureVariantsView(scene, aperture, mode, params.get('colliders') === '1'); return structureView; };
      } else if (experiment === 'large-structure-v1') {
        if (params.has('policy')) throw new RangeError('Select either a field policy or the large-structure experiment');
        const { LargeStructureGameModel } = await import('./experiments/large-structure/model.ts');
        const { LargeStructureView } = await import('./experiments/large-structure/view.ts');
        const { apertureSelector } = await import('./experiments/large-structure/encounter.ts');
        if (disposed) return;
        developerModel = new LargeStructureGameModel(apertureSelector(params.get('aperture')));
        debugFactory = scene => { structureView = new LargeStructureView(scene, params.get('colliders') === '1'); return structureView; };
      } else {
        if (experiment !== null) throw new RangeError(`Unknown development experiment: ${experiment}`);
        const { RuntimeGameModel } = await import('./debug/runtime-game-model.ts');
        const { fieldPolicy } = await import('./core/field-policy.ts');
        if (disposed) return;
        developerModel = new RuntimeGameModel(fieldPolicy(params.get('policy')));
      }
    }
    game = new Game(assets, undefined, debugFactory, developerModel);
    if (import.meta.env.DEV) structureView?.bind(game.world.hazards);
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
