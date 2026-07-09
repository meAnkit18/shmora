// The ONLY module in the app that touches window.speechSynthesis.
// Everything else goes through this controller.

type StateListener = (speaking: boolean) => void;

/** Fired as speech crosses word boundaries; charIndex is into the FULL text passed to speak(). */
export type WordBoundaryListener = (charIndex: number) => void;

const MAX_CHUNK_CHARS = 180;

/** Split text into sentence-ish chunks Chrome will reliably finish. */
function chunkText(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|\S[^.!?]*$/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (current && current.length + s.length + 1 > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text];
}

class TTSController {
  private listeners = new Set<StateListener>();
  private _volume = 1;
  private generation = 0; // bumped on every speak()/stop(); stale playback aborts itself
  private release: (() => void) | null = null; // stop() force-resolves the in-flight speak()

  get volume(): number {
    return this._volume;
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
  }

  get supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  get speaking(): boolean {
    return this.supported && window.speechSynthesis.speaking;
  }

  onStateChange(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(speaking: boolean): void {
    this.listeners.forEach((l) => l(speaking));
  }

  /**
   * Speak text; resolves when playback finishes (or is stopped/errors).
   * `onWord`, if given, fires as playback crosses each word with the character
   * index into `text` — used to sync board gestures to speech.
   *
   * GAP-FREE DESIGN:
   *  - cancel() (and its settle delay) is paid ONLY if something is actually
   *    playing or queued — back-to-back segments start instantly.
   *  - ALL chunks are queued into speechSynthesis at once, so the engine
   *    flows from chunk to chunk natively with no JS round-trip in between.
   */
  async speak(text: string, onWord?: WordBoundaryListener): Promise<void> {
    if (!this.supported || !text.trim()) return;
    const gen = ++this.generation;
    const synth = window.speechSynthesis;

    if (synth.speaking || synth.pending) {
      synth.cancel();
      await new Promise((r) => setTimeout(r, 50)); // let cancel() settle (Chrome quirk)
      if (gen !== this.generation) return;
    }

    this.emit(true);
    try {
      await new Promise<void>((resolve) => {
        this.release = resolve; // stop() resolves us instantly, no waiting on canceled utterances
        const chunks = chunkText(text);
        let remaining = chunks.length;
        if (!remaining) return resolve();
        let cursor = 0; // maps each chunk back to its offset in the full text
        for (const chunk of chunks) {
          const at = text.indexOf(chunk, cursor);
          const base = at >= 0 ? at : cursor;
          cursor = base + chunk.length;

          const utt = new SpeechSynthesisUtterance(chunk);
          utt.rate = 1;
          utt.pitch = 1;
          utt.volume = this._volume;
          if (onWord) {
            utt.onboundary = (e: SpeechSynthesisEvent) => {
              if (gen !== this.generation) return;
              if (typeof e.charIndex === 'number') onWord(base + e.charIndex);
            };
          }
          const done = () => {
            if (--remaining === 0) resolve();
          };
          utt.onend = done;
          utt.onerror = done;
          synth.speak(utt); // queue everything now; the engine plays them seamlessly
        }
      });
      // Chunking/boundary events may skip trailing words; flush pending gestures.
      if (onWord && gen === this.generation) onWord(text.length);
    } finally {
      this.release = null;
      if (gen === this.generation) this.emit(false);
    }
  }

  stop(): void {
    if (!this.supported) return;
    this.generation++; // any in-flight speak() aborts at its next generation check
    window.speechSynthesis.cancel();
    this.release?.(); // resolve the in-flight speak() immediately
    this.release = null;
    this.emit(false);
  }

  pause(): void {
    if (this.supported && this.speaking) window.speechSynthesis.pause();
  }

  resume(): void {
    if (this.supported) window.speechSynthesis.resume();
  }
}

export const tts = new TTSController();
