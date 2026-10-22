export const MODEL_ASSETS = [
  { id: 'ship', file: 'craft_speederA.glb', label: 'Speeder A', rotationY: 0, width: 2.8 },
  { id: 'meteor', file: 'meteor.glb', label: 'Meteor', rotationY: 0 },
  { id: 'meteor-detailed', file: 'meteor_detailed.glb', label: 'Detailed meteor', rotationY: 0 },
  { id: 'meteor-half', file: 'meteor_half.glb', label: 'Half meteor', rotationY: 0 },
  { id: 'barrel', file: 'barrel.glb', label: 'Cargo barrel', rotationY: 0 },
  { id: 'generator', file: 'machine_generator.glb', label: 'Generator debris', rotationY: 0 },
] as const;

export type ModelId = typeof MODEL_ASSETS[number]['id'];
export type ModelSpec = typeof MODEL_ASSETS[number];
export const HAZARD_MODELS: readonly ModelId[] = ['meteor', 'meteor-detailed', 'meteor-half', 'barrel', 'generator'];

export { hazardVariant } from '../core/hazard-profile.ts';
