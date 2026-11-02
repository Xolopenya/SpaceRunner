import { difficulty } from '../config.ts';
export const RELEASE = Object.freeze({ phase2Distance:500, phase2SpeedMultiplier:1.08, phase1ExtraCells:2, cellSize:24, minesEnabled:false });
export function flightSpeed(elapsed:number,distance:number,release?:boolean):number {
 return difficulty(elapsed).speed*(release&&distance>=RELEASE.phase2Distance?RELEASE.phase2SpeedMultiplier:1);
}
