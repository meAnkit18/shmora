import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { HomeFeed } from '../components/HomeFeed';
import { SuggestedCourses } from '../components/courses/SuggestedCourses';
import type { SessionState, TurnInfo } from '@shared/types';
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
import { parseSpeechMarks, stripSpeechMarks } from '../lib/speechMarks';

const SUGGESTIONS: string[] = [];

// ---- Session persistence (survives page refresh; resumes via session:resume) ----
const STORAGE_KEY = 'shmora.activeSession';

interface StoredSession {
  sessionId: string;
  topic: string;
}

function loadStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function storeSession(s: StoredSession | null): void {
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — resume simply won't work */
  }
}

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


  const socketRef = useRef<TeacherClient | null>(null);
  const canvasRef = useRef<CanvasHandle>(null);
  const playerRef = useRef<SegmentPlayer | null>(null);
  const stateRef = useRef<SessionState | null>(null);
  const stepDoneRef = useRef(false); // current teach turn's generation finished
  const interruptingRef = useRef(false); // waiting for the answer turn
  const completedRef = useRef(false); // lesson finished (closing turn done)
  const resumingRef = useRef(false); // session:resume in flight
  const currentTurnRef = useRef<TurnInfo | null>(null); // only its segments play

  // keep a ref mirror of state for use inside stable callbacks
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    // Advance to the next step when the current one has both finished
    // generating (stepDone) AND finished playing (player idle).
    const maybeAdvance = () => {
      if (interruptingRef.current || completedRef.current) return;
      const s = stateRef.current;
      if (!s || !stepDoneRef.current) return;
      stepDoneRef.current = false;
      // No `< steps.length - 1` guard anymore: after the last step the
      // server responds with a closing turn, then lesson:complete.
      socket.emit('lesson:next', { sessionId: s.sessionId });
    };

    const player = new SegmentPlayer({
      execute: (seg) => canvasRef.current?.execute(seg) ?? Promise.resolve(),
      // Strip inline {point:ref} marks before speaking, and fire each gesture
      // on the board at the exact word where its mark sat.
      speak: (t) => {
        const { clean, marks } = parseSpeechMarks(t);
        let next = 0;
        return tts.speak(clean, (charIndex) => {
          while (next < marks.length && marks[next].at <= charIndex + 1) {
            canvasRef.current?.gesture(marks[next].action, marks[next].ref);
            next++;
          }
        });
      },
      stopSpeaking: () => tts.stop(),
      setSpokenText: (t) => voice.setSpokenText(stripSpeechMarks(t)),
      onIdle: maybeAdvance,
    });
    playerRef.current = player;

    socket.on('connect', () => {
      setConnected(true);
      // Page was refreshed mid-lesson: re-attach to the live session.
      const stored = loadStoredSession();
      if (stored && !stateRef.current && !resumingRef.current) {
        resumingRef.current = true;
        socket.emit('session:resume', { sessionId: stored.sessionId });
      }
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('session:created', (s) => {
      setError(null);
      setStarting(false);
      stepDoneRef.current = false;
      interruptingRef.current = false;
      completedRef.current = false;
      currentTurnRef.current = null;
      canvasRef.current?.clear();
      player.reset();
      setState(s);
      storeSession({ sessionId: s.sessionId, topic: s.topic });
      setLessons(saveLesson({ id: s.sessionId, topic: s.topic, ts: Date.now() }));
    });

    socket.on('session:resumed', ({ state: s, log }) => {
      resumingRef.current = false;
      setError(null);
      setStarting(false);
      stepDoneRef.current = false;
      interruptingRef.current = false;
      completedRef.current = s.completed;
      currentTurnRef.current = null;
      player.reset();
      setState(s);
      setTopic(s.topic);
      // Rebuild the board silently from the turn log, then continue the
      // lesson from the next step. (Anything unheard from the step that was
      // playing at refresh time is skipped — its visuals are replayed.)
      void canvasRef.current?.hydrate(log).then(() => {
        if (!s.completed) {
          socket.emit('lesson:next', { sessionId: s.sessionId });
        }
      });
    });

    socket.on('turn:start', (turn) => {
      currentTurnRef.current = turn;
      canvasRef.current?.beginTurn(turn);
    });

    socket.on('lesson:segment', (seg) => {
      // Drop segments from stale (aborted) turns — leftovers from an
      // interrupted step can no longer play as if they were the answer.
      if (seg.turnId !== currentTurnRef.current?.turnId) return;
      player.enqueue(seg);
    });

    socket.on('turn:end', ({ kind, state: s }) => {
      setState(s);
      if (kind === 'teach') {
        stepDoneRef.current = true;
        // Generation can outlast playback: if the audio already finished
        // (player idle), onIdle has come and gone — advance now.
        if (player.idle) maybeAdvance();
      } else if (kind === 'answer') {
        interruptingRef.current = false;
        player.endInterruption(); // resume stashed lesson segments
      } else if (kind === 'closing') {
        stepDoneRef.current = false;
      }
    });

    socket.on('lesson:complete', (s) => {
      setState(s);
      completedRef.current = true;
      stepDoneRef.current = false;
    });

    socket.on('state:update', (s) => setState(s));

    socket.on('error', ({ message }) => {
      if (resumingRef.current) {
        // Stored session no longer exists on the server (restart / TTL):
        // clear it quietly and show the empty state, not a scary banner.
        resumingRef.current = false;
        storeSession(null);
        setStarting(false);
        return;
      }
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
    const courseId = searchParams.get('courseId') ?? undefined;
    const lessonId = searchParams.get('lessonId') ?? undefined;
    const scripted = Boolean(courseId && lessonId);
    if ((!t && !scripted) || !socketRef.current) return;
    setTopic(t);
    setStarting(true);
    socketRef.current.emit('session:create', {
      topic: t,
      ...(scripted ? { courseId, lessonId } : {}),
    });
  };

  const newLesson = () => {
    const s = stateRef.current;
    if (s) socketRef.current?.emit('session:end', { sessionId: s.sessionId });
    storeSession(null);
    voice.stop();
    setListening(false);
    tts.stop();
    playerRef.current?.reset();
    interruptingRef.current = false;
    stepDoneRef.current = false;
    completedRef.current = false;
    currentTurnRef.current = null;
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
    if (completedRef.current) return; // lesson is over
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
    <div className="flex h-full w-full overflow-x-hidden bg-canvas text-body">
      <Sidebar
        lessons={lessons}
        activeId={state?.sessionId ?? null}
        onNew={newLesson}
        onSelect={selectLesson}
        onDelete={removeLesson}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">


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
          />
        ) : (
          <>
            <header className="flex h-[60px] min-w-0 shrink-0 items-center gap-3 border-b border-hairline bg-canvas px-5">
              <h1 className="truncate font-display text-title-lg text-ink">{state.topic}</h1>
              <span
                className={'h-2 w-2 shrink-0 rounded-pill ' + (connected ? 'bg-success' : 'bg-fg-soft/50')}
                title={connected ? 'connected' : 'disconnected'}
              />
              {starting && <span className="text-caption text-fg-soft">starting…</span>}
              {state.completed && (
                <span className="text-caption text-fg-soft">lesson complete</span>
              )}
            </header>

            <main className="flex min-h-0 min-w-0 flex-1 gap-3 bg-canvas p-3">
              <section className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-hairline bg-white">
                <TeachingCanvas ref={canvasRef} />
              </section>
              <aside className="flex w-80 min-w-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas">
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
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Breakfast and Learn';
  if (h < 17) return 'Lunch and Learn';
  if (h < 21) return 'Dinner and Learn';
  return 'Nightcap and Learn';
}

function EmptyState({ topic, setTopic, onStart, starting, connected }: EmptyStateProps) {
  const canStart = connected && !starting && topic.trim().length > 0;
  const label = greeting();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col items-center px-6 pb-12 pt-14 sm:pt-20">
        <div className="w-full max-w-2xl">
          <div className="mb-8 flex items-baseline justify-center gap-3">
            <SharpenerGlyph size={44} className="shrink-0 text-brand" />
            <h1 className="font-display text-display-sm text-ink sm:text-display-md">
              {label} :)
            </h1>
          </div>

          <div className="relative rounded-[18px] border border-hairline bg-white p-2 transition-all duration-200 ease-out focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/15 motion-reduce:transition-none">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canStart && onStart()}
              placeholder="Teach me Binary Search from scratch…"
              autoFocus
              className="h-12 w-full rounded-[14px] bg-transparent pl-4 pr-14 text-body-md text-ink placeholder:text-fg-soft focus:outline-none"
            />
            <button
              type="button"
              onClick={() => canStart && onStart()}
              aria-disabled={!canStart}
              title={canStart ? 'Start lesson' : 'Type a topic to begin'}
              className={
                'absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-brand bg-brand text-white transition-all duration-200 ease-out motion-reduce:transition-none ' +
                (canStart
                  ? 'cursor-pointer hover:bg-brand-active active:scale-95'
                  : 'cursor-not-allowed')
              }
            >
              {starting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <ArrowUp size={18} strokeWidth={2.25} />
              )}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setTopic(s)}
                className="rounded-pill border border-hairline bg-surface-card px-4 py-2 text-body-sm text-body transition-colors duration-200 ease-out hover:border-brand/40 hover:text-brand motion-reduce:transition-none"
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

      <SuggestedCourses />

      <HomeFeed />
    </div>
  );
}
