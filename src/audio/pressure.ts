import type { PacingState } from '../core/field-director.ts';
import type { PlanningOutcome } from '../core/field-scheduler.ts';
import { DIRECTOR_SETTINGS } from '../core/field-director-settings.ts';
import { FIELD_LIMITS } from '../core/field-settings.ts';

/** Read-only presentation ledger. Runtime phaseChanged means publication, often
 * far ahead of the ship. Keep bounded section metadata and activate by distance.
 * Omitted/expired sections return to recovery; never publish or validate here. */
export class AudioPressure {
  private readonly sections: { id: string; start: number; end: number; pacing: PacingState }[] = [];
  private observed?: string;
  current: PacingState = 'regular';
  update(distance: number, field?: unknown): PacingState {
    const outcome=(field as { readonly lastOutcome?: PlanningOutcome } | undefined)?.lastOutcome;
    if(outcome && outcome.section.id!==this.observed) {
      this.observed=outcome.section.id;
      const s=outcome.section;
      this.sections.push({ id:s.id,start:s.startDistance,end:s.endDistance,pacing:outcome.status==='committed' ? s.pacing : 'recovery' });
      if(this.sections.length>16) this.sections.shift();
    }
    while(this.sections.length && this.sections[0]!.end<=distance) this.sections.shift();
    const active=this.sections.find(s=>distance>=s.start && distance<s.end);
    this.current=active?.pacing ?? (distance<DIRECTOR_SETTINGS.firstCell*FIELD_LIMITS.cellSize ? 'regular' : 'recovery');
    return this.current;
  }
  reset(): void { this.sections.length=0; this.observed=undefined; this.current='regular'; }
}
