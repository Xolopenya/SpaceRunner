import type { GameEvent, GameEventMap } from '../events/game-events.ts';
import { GameEvents } from '../events/game-events.ts';
import { FEEDBACK } from './settings.ts';
import type { FeedbackPreset, SoundCue } from './settings.ts';
import { visualDelta } from '../visuals/settings.ts';

export type ReactionEvent = Extract<GameEvent, { type: 'player.damage' | 'player.destroyed' | 'collectible.collected' }>;
export interface FeedbackPorts {
  reset(): void;
  contact(event: ReactionEvent, preset: FeedbackPreset): void;
  sound(cue: SoundCue): void;
  gameOver(delay: number): void;
  hud(event: GameEvent): void;
}
interface ActiveReaction { preset?: FeedbackPreset; age: number }
const presetFor = (event: ReactionEvent): FeedbackPreset => event.type === 'player.destroyed' ? FEEDBACK.destroyed
  : event.type === 'player.damage' ? FEEDBACK.damage : FEEDBACK.pickup;

/** One contact decision per completed step, no wall timers or animation queue.
 * HUD receives every fact; competing decorative channels use the strongest event. */
export class FeedbackOrchestrator {
  private readonly unsubscribe: () => void;
  private readonly ports: FeedbackPorts;
  private readonly active: ActiveReaction[] = Array.from({ length: FEEDBACK.maxActiveReactions }, () => ({ age: 0 }));
  private candidate?: ReactionEvent;
  private runId = 0;
  private disposed = false;
  failures = 0;

  constructor(events: GameEvents, ports: FeedbackPorts) {
    this.ports = ports;
    this.unsubscribe = events.subscribe(event => this.receive(event));
  }

  get phase(): 'idle' | 'contact' | 'aftermath' | 'recovery' {
    const reaction = this.active.find(slot => slot.preset);
    if (!reaction?.preset) return 'idle';
    return reaction.age < reaction.preset.contactSeconds ? 'contact'
      : reaction.age < reaction.preset.duration - reaction.preset.recoverySeconds ? 'aftermath' : 'recovery';
  }

  private safely(action: () => void): void { try { action(); } catch { this.failures++; } }

  private receive(event: GameEvent): void {
    if (event.type === 'run.started') {
      this.runId = event.payload.runId;
      this.reset();
    }
    if (event.payload.runId !== this.runId) return;
    this.safely(() => this.ports.hud(event));
    if (event.type !== 'player.damage' && event.type !== 'player.destroyed' && event.type !== 'collectible.collected') return;
    // Fatal damage has its own single Major contact; never double the hit sound/burst.
    if (event.type === 'player.damage' && event.payload.currentHP <= 0) return;
    if (!this.candidate || presetFor(event).priority >= presetFor(this.candidate).priority) this.candidate = event;
  }

  /** Call directly after events.flush(), before rendering or another simulation step. */
  flush(): void {
    if (this.disposed) return;
    const event = this.candidate; this.candidate = undefined;
    if (!event) return;
    const preset = presetFor(event);
    if (this.active.some(slot => slot.preset && slot.preset.priority > preset.priority)) return;
    if (this.active.some(slot => slot.preset && slot.preset.priority < preset.priority)) this.reset();
    const slot = this.active.find(item => item.preset === preset) ?? this.active.find(item => !item.preset);
    if (!slot) return; // Saturation affects presentation only.
    slot.preset = preset; slot.age = 0;
    this.safely(() => this.ports.contact(event, preset));
    this.safely(() => this.ports.sound(preset.sound));
    if (event.type === 'player.destroyed') this.safely(() => this.ports.gameOver(FEEDBACK.gameOverDelay));
  }

  update(state: string, dt: number): void {
    if (this.disposed) return;
    const delta = visualDelta(state, dt, true);
    for (const slot of this.active) if (slot.preset) {
      slot.age += delta;
      if (slot.age >= slot.preset.duration) slot.preset = undefined;
    }
  }

  reset(): void {
    this.candidate = undefined;
    for (const slot of this.active) { slot.preset = undefined; slot.age = 0; }
    this.safely(() => this.ports.reset());
  }

  dispose(): void { if (this.disposed) return; this.unsubscribe(); this.reset(); this.disposed = true; }
}

export type PickupEvent = GameEventMap['collectible.collected'];
