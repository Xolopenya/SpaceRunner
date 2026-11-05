import type { Scene } from 'three';
import type { ObjectReveal } from '../visuals/object-reveal.ts';
import type { GameModel } from '../core/game-model.ts';

export interface ColliderDebugView {
  setReveal?(reveal: ObjectReveal): void;
  update(model: GameModel): void;
  dispose(): void;
}
export type ColliderDebugFactory = (scene: Scene) => ColliderDebugView;
