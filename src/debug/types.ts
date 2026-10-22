import type { Scene } from 'three';
import type { GameModel } from '../core/game-model.ts';

export interface ColliderDebugView {
  update(model: GameModel): void;
  dispose(): void;
}
export type ColliderDebugFactory = (scene: Scene) => ColliderDebugView;
