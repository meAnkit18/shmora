// The ONLY module in the app that touches window.speechSynthesis.
// Everything else goes through this controller.

type StateListener = (speaking: boolean) => void;

class TTSController {
  private current: SpeechSynthesisUtterance | null = null;
  private listeners = new Set<StateListener>();
  private _volume = 1;

  get volume(): number { return this._volume; }

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

  /** Speak text; resolves when playback finishes (or is stopped/errors). */
  speak(text: string): Promise<void> {
    if (!this.supported || !text.trim()) return Promise.resolve();
    // Cancel anything still queued before starting the next utterance.
    window.speechSynthesis.cancel();

    return new Promise<void>((resolve) => {
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1;
      utt.pitch = 1;
      utt.volume = this._volume;
      const finish = () => {
        if (this.current === utt) this.current = null;
        this.emit(false);
        resolve();
      };
      utt.onend = finish;
      utt.onerror = finish;
      this.current = utt;
      this.emit(true);
      window.speechSynthesis.speak(utt);
    });
  }

  stop(): void {
    if (!this.supported) return;
    window.speechSynthesis.cancel();
    this.current = null;
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
