import type { DrawCommand, Segment } from '@shared/types';

export interface PlayerDeps {
  // Render drawings and resolve once painted (the sync confirmation).
  execute: (drawings: DrawCommand[]) => Promise<void>;
  // Speak text and resolve when finished or stopped.
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  // Emit render:confirm for telemetry / backend awareness.
  onConfirm: (segmentId: string) => void;
  // Tell the voice controller what is being said (echo guard).
  setSpokenText: (text: string) => void;
  // Called when the queue drains to empty (a teaching/answer turn finished playing).
  onIdle?: () => void;
}

/**
 * Plays teaching segments strictly one at a time, enforcing the invariant:
 * render visuals -> confirm rendered -> speak. Audio never precedes visuals.
 *
 * Interruption: beginInterruption() stops audio and stashes the remaining
 * (not-yet-played) segments; answer segments then play; endInterruption()
 * re-queues the stashed segments so the lesson resumes where it stopped.
 */
export class SegmentPlayer {
  private queue: Segment[] = [];
  private stash: Segment[] = [];
  private running = false;

  constructor(private readonly deps: PlayerDeps) {}

  enqueue(segment: Segment): void {
    this.queue.push(segment);
    void this.drain();
  }

  /** User interrupted: stop audio, set aside remaining segments. */
  beginInterruption(): void {
    this.deps.stopSpeaking(); // resolves the in-flight speak()
    this.stash = [...this.queue];
    this.queue = [];
    // The partially-spoken segment is dropped; its visuals remain on the board.
  }

  /** Answer finished: resume the lesson from where it was paused. */
  endInterruption(): void {
    if (this.stash.length) {
      this.queue.push(...this.stash);
      this.stash = [];
    }
    void this.drain();
  }

  /** Hard reset (new session / step). */
  reset(): void {
    this.deps.stopSpeaking();
    this.queue = [];
    this.stash = [];
    this.deps.setSpokenText('');
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const seg = this.queue.shift()!;
        await this.deps.execute(seg.drawings); // 1. render
        this.deps.onConfirm(seg.id); // 2. confirm rendered
        this.deps.setSpokenText(seg.speech); // 3. arm echo guard
        await this.deps.speak(seg.speech); // 4. audio (only now)
        this.deps.setSpokenText('');
      }
    } finally {
      this.running = false;
    }
    this.deps.onIdle?.();
  }
}
