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

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

class TTSController {
  private listeners = new Set<StateListener>();
  private _volume = 1;
  private generation = 0; // bumped on every speak()/stop(); stale playback aborts itself

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

  private speakChunk(
    text: string,
    gen: number,
    baseOffset: number,
    onWord?: WordBoundaryListener,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      if (gen !== this.generation) return resolve();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1;
      utt.pitch = 1;
      utt.volume = this._volume;
      if (onWord) {
        utt.onboundary = (e: SpeechSynthesisEvent) => {
          if (gen !== this.generation) return;
          if (typeof e.charIndex === 'number') onWord(baseOffset + e.charIndex);
        };
      }
      const finish = () => resolve();
      utt.onend = finish;
      utt.onerror = finish;
      window.speechSynthesis.speak(utt);
    });
  }

  /**
   * Speak text; resolves when playback finishes (or is stopped/errors).
   * `onWord`, if given, fires as playback crosses each word with the character
   * index into `text` — used to sync board gestures to speech.
   */
  async speak(text: string, onWord?: WordBoundaryListener): Promise<void> {
    if (!this.supported || !text.trim()) return;
    const gen = ++this.generation;
    window.speechSynthesis.cancel();
    await delay(60); // let cancel() settle (Chrome swallows immediate re-speak)
    if (gen !== this.generation) return;

    this.emit(true);
    try {
      let cursor = 0; // maps each chunk back to its offset in the full text
      for (const chunk of chunkText(text)) {
        if (gen !== this.generation) break;
        const at = text.indexOf(chunk, cursor);
        const baseOffset = at >= 0 ? at : cursor;
        cursor = baseOffset + chunk.length;
        await this.speakChunk(chunk, gen, baseOffset, onWord);
      }
      // Chunking may skip trailing words; make sure every pending gesture fires.
      if (onWord && gen === this.generation) onWord(text.length);
    } finally {
      if (gen === this.generation) this.emit(false);
    }
  }

  stop(): void {
    if (!this.supported) return;
    this.generation++; // any in-flight speak() loop exits at its next check
    window.speechSynthesis.cancel();
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
