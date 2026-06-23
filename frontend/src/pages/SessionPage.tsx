import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SessionState } from '@shared/types';
import { createSocket, type TeacherClient } from '../socket/socketClient';
import { TeachingCanvas, type CanvasHandle } from '../components/TeachingCanvas';
import { LessonStatusPanel } from '../components/LessonStatusPanel';
import { TranscriptPanel } from '../components/TranscriptPanel';
import { VoiceControls } from '../components/VoiceControls';
import { Sidebar } from '../components/Sidebar';
import { SharpenerGlyph } from '../components/SharpenerGlyph';
import { SegmentPlayer } from '../controllers/segmentPlayer';
import { tts } from '../controllers/ttsController';
import { voice } from '../controllers/voiceController';
import { loadLessons, saveLesson, deleteLesson, type LessonEntry } from '../lib/lessonHistory';

const SUGGESTIONS = [
  'Binary search from scratch',
  'How neural networks learn',
  'The basics of music theory',
  'Why the sky is blue',
];

export function SessionPage() {
  const [searchParams] = useSearchParams();
  const [topic, setTopic] = useState(searchParams.get('topic') ?? '');
  const [state, setState] = useState<SessionState | null>(null);
  const [connected, setConnected] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [paused, setPaused] = useState(false);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [lessons, setLessons] = useState<LessonEntry[]>(() => loadLessons());
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const socketRef = useRef<TeacherClient | null>(null);
  const canvasRef = useRef<CanvasHandle>(null);
  const playerRef = useRef<SegmentPlayer | null>(null);
  const stateRef = useRef<SessionState | null>(null);
  const stepDoneRef = useRef(false);
  const interruptingRef = useRef(false);

  // keep a ref mirror of state for use inside stable callbacks
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    const player = new SegmentPlayer({
      execute: (d) => canvasRef.current?.execute(d) ?? Promise.resolve(),
      speak: (t) => tts.speak(t),
      stopSpeaking: () => tts.stop(),
      onConfirm: (segmentId) =>
        socket.emit('render:confirm', {
          sessionId: stateRef.current?.sessionId ?? '',
          segmentId,
        }),
      setSpokenText: (t) => voice.setSpokenText(t),
      onIdle: () => {
        if (interruptingRef.current) return; // waiting for answer/resume
        const s = stateRef.current;
        if (!s || !stepDoneRef.current) return;
        if (s.currentStep < s.steps.length - 1) {
          stepDoneRef.current = false;
          socket.emit('lesson:next', { sessionId: s.sessionId });
        }
      },
    });
    playerRef.current = player;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('session:created', (s) => {
      setError(null);
      setStarting(false);
      stepDoneRef.current = false;
      interruptingRef.current = false;
      canvasRef.current?.clear();
      player.reset();
      setState(s);
      setLessons(saveLesson({ id: s.sessionId, topic: s.topic, ts: Date.now() }));
    });

    socket.on('lesson:segment', (seg) => player.enqueue(seg));

    socket.on('lesson:step_complete', ({ state: s }) => {
      stepDoneRef.current = true;
      setState(s);
    });

    socket.on('state:update', (s) => {
      setState(s);
      // resume path: backend reports paused=false after answering
      if (!s.paused && interruptingRef.current) {
        interruptingRef.current = false;
        player.endInterruption();
      }
    });

    socket.on('error', ({ message }) => {
      setError(message);
      setStarting(false);
    });

    const offTts = tts.onStateChange((s) => {
      setSpeaking(s);
      if (!s) setPaused(false); // reset paused when TTS goes idle
    });

    return () => {
      offTts();
      voice.stop();
      tts.stop();
      socket.close();
    };
  }, []);

  const startSession = (override?: string) => {
    const t = (override ?? topic).trim();
    if (!t || !socketRef.current) return;
    setTopic(t);
    setStarting(true);
    socketRef.current.emit('session:create', { topic: t });
  };

  const newLesson = () => {
    voice.stop();
    setListening(false);
    tts.stop();
    playerRef.current?.reset();
    interruptingRef.current = false;
    stepDoneRef.current = false;
    setState(null);
    setTopic('');
    setError(null);
    setStarting(false);
  };

  const selectLesson = (entry: LessonEntry) => {
    if (entry.id === state?.sessionId || starting) return;
    newLesson();
    startSession(entry.topic);
  };

  const removeLesson = (id: string) => {
    setLessons(deleteLesson(id));
  };

  const askQuestion = (question: string) => {
    const s = stateRef.current;
    if (!s || !socketRef.current || interruptingRef.current) return;
    interruptingRef.current = true;
    playerRef.current?.beginInterruption();
    socketRef.current.emit('user:interrupt', { sessionId: s.sessionId, question });
  };

  const togglePause = () => {
    if (!speaking) return;
    if (paused) {
      tts.resume();
      setPaused(false);
    } else {
      tts.pause();
      setPaused(true);
    }
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    tts.setVolume(v);
  };

  const toggleMic = () => {
    if (listening) {
      voice.stop();
      setListening(false);
    } else {
      voice.start();
      setListening(voice.isListening);
    }
  };

  // wire voice -> interruption (once)
  useEffect(() => {
    const off = voice.onSpeech((transcript) => askQuestion(transcript));
    return off;
  }, []);

  return (
    <div className="flex h-full bg-canvas text-body">
      {sidebarOpen && (
        <Sidebar
          lessons={lessons}
          activeId={state?.sessionId ?? null}
          onNew={newLesson}
          onSelect={selectLesson}
          onDelete={removeLesson}
          onCollapse={() => setSidebarOpen(false)}
        />
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
            className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-white text-fg-muted shadow-sm transition-colors hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
        )}

        {error && (
          <div data-error-banner className="border-b border-error/20 bg-error/10 px-4 py-2 text-body-sm text-error">{error}</div>
        )}
        {!voice.supported && (
          <div className="border-b border-amber/20 bg-amber/10 px-4 py-2 text-caption text-amber">
            Voice input is unavailable in this browser. Use Chrome, or type questions to interrupt.
          </div>
        )}

        {!state ? (
          <EmptyState
            topic={topic}
            setTopic={setTopic}
            onStart={() => startSession()}
            starting={starting}
            connected={connected}
            sidebarOpen={sidebarOpen}
          />
        ) : (
          <>
            <header className={'flex h-[60px] shrink-0 items-center gap-3 border-b border-hairline bg-canvas/80 px-5 backdrop-blur-sm ' + (sidebarOpen ? '' : 'pl-14')}>
              <h1 className="truncate font-display text-title-lg text-ink">{state.topic}</h1>
              <span
                className={'h-2 w-2 shrink-0 rounded-pill ' + (connected ? 'bg-success' : 'bg-fg-soft/50')}
                title={connected ? 'connected' : 'disconnected'}
              />
              {starting && <span className="text-caption text-fg-soft">starting…</span>}
            </header>

            <main className="flex min-h-0 flex-1">
              <section className="min-h-0 flex-1 bg-white">
                <TeachingCanvas ref={canvasRef} />
              </section>
              <aside className="flex w-80 shrink-0 flex-col border-l border-hairline bg-surface-soft">
                <div className="border-b border-hairline">
                  <LessonStatusPanel state={state} />
                </div>
                <div className="min-h-0 flex-1">
                  <TranscriptPanel messages={state.conversationHistory} />
                </div>
              </aside>
            </main>

            <VoiceControls
              listening={listening}
              speaking={speaking}
              paused={paused}
              micSupported={voice.supported}
              volume={volume}
              onToggleMic={toggleMic}
              onTogglePause={togglePause}
              onVolumeChange={handleVolumeChange}
              onAskText={askQuestion}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ── Chat-first empty state ─────────────────────────────────────────────── */
interface EmptyStateProps {
  topic: string;
  setTopic: (t: string) => void;
  onStart: () => void;
  starting: boolean;
  connected: boolean;
  sidebarOpen: boolean;
}

function EmptyState({ topic, setTopic, onStart, starting, connected, sidebarOpen }: EmptyStateProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
      <div className={'w-full max-w-2xl ' + (sidebarOpen ? '' : 'pt-6')}>
        <div className="mb-8 flex flex-col items-center text-center">
          <SharpenerGlyph size={56} className="mb-5 text-brand" />
          <h1 className="font-display text-display-sm text-ink sm:text-display-md">
            What do you want to learn today?
          </h1>
          <p className="mt-3 text-body-md text-body">
            Type any topic and your AI teacher will explain it with voice and a live whiteboard.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 rounded-2xl border border-hairline bg-white p-2.5 shadow-[0_8px_30px_rgba(20,20,19,0.07)] transition-all focus-within:border-brand/60 focus-within:shadow-[0_12px_40px_rgba(255,122,0,0.14)] sm:flex-row sm:items-center">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onStart()}
            placeholder="Teach me Binary Search from scratch…"
            autoFocus
            className="h-12 flex-1 rounded-xl bg-transparent px-3 text-body-md text-ink placeholder:text-fg-soft focus:outline-none"
          />
          <button
            onClick={onStart}
            disabled={starting || !connected || !topic.trim()}
            className="group inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-[14px] bg-brand px-6 text-button text-white shadow-[0_4px_16px_rgba(255,122,0,0.3)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-brand-active disabled:translate-y-0 disabled:bg-brand-disabled disabled:shadow-none"
          >
            {starting ? 'Starting…' : 'Start Learning'}
            <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
          </button>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setTopic(s)}
              className="rounded-pill border border-hairline bg-surface-card px-4 py-2 text-body-sm text-body transition-colors hover:border-brand/40 hover:text-brand"
            >
              {s}
            </button>
          ))}
        </div>

        {!connected && (
          <p className="mt-6 text-center text-caption text-fg-soft">Connecting to your teacher…</p>
        )}
      </div>
    </div>
  );
}
