import { recordedInputs } from './runtime-simulation.ts';
import type { InputHistory } from './runtime-simulation.ts';
export const FLOW_HISTORIES = ['neutral', 'horizontal', 'vertical', 'irregular', 'keyboard', 'touch',
  'left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
export type FlowHistory = typeof FLOW_HISTORIES[number];
export function flowInputs(seed: number, history: FlowHistory, ticks: number) {
  const fixed: Record<string, { x: number; y: number }> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: 1 }, bottom: { x: 0, y: -1 },
    'top-left': { x: -1, y: 1 }, 'top-right': { x: 1, y: 1 }, 'bottom-left': { x: -1, y: -1 }, 'bottom-right': { x: 1, y: -1 } };
  return fixed[history] ? Object.freeze(Array.from({ length: ticks }, () => Object.freeze({ ...fixed[history]! })))
    : recordedInputs(seed ^ 0x5a19, history as InputHistory, ticks);
}
