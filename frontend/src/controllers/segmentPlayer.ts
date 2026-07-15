import type { Segment } from '@shared/types';

export interface PlayerDeps {
  // Render a segment's visuals and resolve once painted (the sync confirmation).
  execute: (segment: Segment) => Promise<void>;
  // Speak text and resolve when finished or stopped.
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  // Tell the voice controller what is being said (echo guard).
  setSpokenText: (text: string) => void;
  // Called when the queue drains to empty (a teaching/answer turn finished playing).
  onIdle?: () => void;
}

/**
 * Plays teaching segments one at a time, enforcing the invariant:
 * a segment's visuals are painted BEFORE its speech starts.
 *
 * PIPELINING (kills the pause between beats): while segment N is being
 * SPOKEN, segment N+1's visuals are drawn in parallel. When N's speech
 * ends, N+1's board is already painted, so its speech starts immediately.
 * The invariant still holds — audio never precedes its own visuals; visuals
 * merely arrive early, exactly like a teacher writing the next thing while
 * finishing a sentence.
 *
 * A rendered-set guarantees each segment's visuals are drawn at most once
 * (matters when an interruption stashes an already-prerendered segment:
 * on resume we only speak it, we don't draw it twice).
 *
 * Interruption: beginInterruption() stops audio and stashes the remaining
 * (not-yet-spoken) segments; answer segments then play; endInterruption()
 * re-queues the stashed segments so the lesson resumes where it stopped.
 */
export class SegmentPlayer {
  private queue: Segment[] = [];
  private stash: Segment[] = [];
  private running = false;
  private rendered = new Set<string>(); // `${turnId}:${seq}` of segments already drawn

  constructor(private readonly deps: PlayerDeps) {}

  /** True when nothing is queued, stashed, or playing. */
  get idle(): boolean {
    return !this.running && this.queue.length === 0 && this.stash.length === 0;
  }

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

  /** Hard reset (new session). */
  reset(): void {
    this.deps.stopSpeaking();
    this.queue = [];
    this.stash = [];
    this.rendered.clear();
    this.deps.setSpokenText('');
  }

  private key(seg: Segment): string {
    return `${seg.turnId}:${seg.seq}`;
  }

  /** Draw a segment's visuals exactly once. */
  private async render(seg: Segment): Promise<void> {
    const k = this.key(seg);
    if (this.rendered.has(k)) return;
    this.rendered.add(k);
    await this.deps.execute(seg);
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const seg = this.queue.shift()!;
        await this.render(seg); // instant no-op if prerendered during the last speech
        this.deps.setSpokenText(seg.speech); // arm echo guard
        const speech = seg.speech.trim() ? this.deps.speak(seg.speech) : Promise.resolve();
        // Overlap: draw the NEXT segment's visuals while this one is spoken.
        const next: Segment | undefined = this.queue[0];
        if (next) {
          await Promise.all([speech, this.render(next)]);
        } else {
          await speech;
        }
        const pauseMs = seg.holdMs ?? (seg.speech.trim() ? 0 : 900);
        if (pauseMs) {
          await new Promise((resolve) => setTimeout(resolve, pauseMs));
        }
        this.deps.setSpokenText('');
      }
    } finally {
      this.running = false;
    }
    this.deps.onIdle?.();
  }
}
