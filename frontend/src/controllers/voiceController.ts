// Wraps the browser SpeechRecognition API for continuous listening + interruption
// detection. Stays listening DURING TTS so genuine interruptions are caught, but
// filters out transcripts that echo what the teacher is currently saying.

type SpeechListener = (transcript: string) => void;

function getRecognitionCtor(): (new () => SpeechRecognition) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

/** True if `transcript` looks like the recognizer hearing the teacher's own speech. */
function isEcho(transcript: string, spokenText: string): boolean {
  const t = words(transcript);
  if (t.length === 0) return true;
  const spoken = new Set(words(spokenText));
  if (spoken.size === 0) return false;
  const overlap = t.filter((w) => spoken.has(w)).length;
  return overlap / t.length >= 0.6;
}

class VoiceController {
  private recognition: SpeechRecognition | null = null;
  private listeners = new Set<SpeechListener>();
  private spokenText = '';
  private listening = false;
  private wantListening = false;

  get supported(): boolean {
    return getRecognitionCtor() !== null;
  }

  get isListening(): boolean {
    return this.listening;
  }

  onSpeech(listener: SpeechListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Tell the controller what the teacher is currently saying (for echo filtering). */
  setSpokenText(text: string): void {
    this.spokenText = text;
  }

  start(): void {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    this.wantListening = true;
    if (this.recognition) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      if (!result.isFinal) return;
      const transcript = result[0].transcript.trim();
      if (!transcript) return;
      if (isEcho(transcript, this.spokenText)) return;
      this.listeners.forEach((l) => l(transcript));
    };

    rec.onend = () => {
      this.listening = false;
      // Chrome stops recognition periodically; restart if we still want to listen.
      if (this.wantListening) {
        try {
          rec.start();
          this.listening = true;
        } catch {
          /* already starting */
        }
      }
    };

    this.recognition = rec;
    try {
      rec.start();
      this.listening = true;
    } catch {
      /* already started */
    }
  }

  stop(): void {
    this.wantListening = false;
    if (this.recognition) {
      this.recognition.onend = null;
      this.recognition.stop();
      this.recognition = null;
    }
    this.listening = false;
  }
}

export const voice = new VoiceController();
