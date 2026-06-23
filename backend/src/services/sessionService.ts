import { randomUUID } from 'node:crypto';
import type { SessionState, Segment } from '../../../shared/types.js';
import { sessionStore } from '../state/memoryStore.js';
import { planLesson, teachStep, answer } from '../agents/teacherAgent.js';
import { addMessage, advanceStep, pause, resume, isLessonComplete } from './lessonFlow.js';

// Keyed by `${sessionId}:${stepIndex}`. Stores in-flight or resolved promises so
// lesson:next can await an already-running prefetch instead of starting a new AI call.
const prefetchCache = new Map<string, Promise<Segment[]>>();

function prefetchKey(sessionId: string, stepIndex: number): string {
  return `${sessionId}:${stepIndex}`;
}

/**
 * Kick off background generation of the next step so segments are ready before
 * the user finishes the current step. State passed here already has the current
 * step's speech in conversationHistory (called after teachCurrentStep updates it).
 */
function startPrefetch(state: SessionState): void {
  const nextIdx = state.currentStep + 1;
  if (nextIdx >= state.steps.length) return;
  const key = prefetchKey(state.sessionId, nextIdx);
  if (prefetchCache.has(key)) return;
  const finished = state.steps[state.currentStep];
  const nextState: SessionState = {
    ...state,
    currentStep: nextIdx,
    completedSteps:
      finished && !state.completedSteps.includes(finished)
        ? [...state.completedSteps, finished]
        : [...state.completedSteps],
    pendingSteps: state.steps.slice(nextIdx + 1),
  };
  const segments: Segment[] = [];
  prefetchCache.set(
    key,
    teachStep(nextState, (seg) => segments.push(seg)).then(() => segments),
  );
}

/** Create a session: plan the lesson, build and store the initial state. */
export async function createSession(topic: string): Promise<SessionState> {
  const steps = await planLesson(topic);
  const state: SessionState = {
    sessionId: randomUUID(),
    topic,
    steps,
    currentStep: 0,
    completedSteps: [],
    pendingSteps: steps.slice(1),
    paused: false,
    conversationHistory: [],
  };
  sessionStore.set(state);
  return state;
}

export function getSession(sessionId: string): SessionState {
  const state = sessionStore.get(sessionId);
  if (!state) throw new Error(`Unknown session: ${sessionId}`);
  return state;
}

export function endSession(sessionId: string): void {
  sessionStore.delete(sessionId);
  for (const key of prefetchCache.keys()) {
    if (key.startsWith(`${sessionId}:`)) prefetchCache.delete(key);
  }
}

/** Teach the current step. Uses a pre-generated cache if available; otherwise calls the AI live. */
export async function teachCurrentStep(
  sessionId: string,
  onSegment: (segment: Segment) => void,
): Promise<SessionState> {
  const state = getSession(sessionId);
  if (isLessonComplete(state)) return state;

  const key = prefetchKey(sessionId, state.currentStep);
  const cached = prefetchCache.get(key);

  if (cached) {
    prefetchCache.delete(key);
    let segments: Segment[] | null = null;
    try {
      segments = await cached;
    } catch {
      // prefetch failed — fall through to live AI call
    }
    if (segments !== null) {
      for (const seg of segments) onSegment(seg);
      if (segments.length) addMessage(state, 'teacher', segments.map((s) => s.speech).join(' '));
      sessionStore.set(state);
      startPrefetch(state);
      return state;
    }
  }

  // Live AI call (first step, cache miss, or prefetch failure).
  const spoken: string[] = [];
  await teachStep(state, (seg) => {
    spoken.push(seg.speech);
    onSegment(seg);
  });
  if (spoken.length) addMessage(state, 'teacher', spoken.join(' '));
  sessionStore.set(state);
  startPrefetch(state);
  return state;
}

/** Advance to the next step (marks current complete). Returns updated state. */
export function advanceToNextStep(sessionId: string): SessionState {
  const state = getSession(sessionId);
  advanceStep(state);
  sessionStore.set(state);
  return state;
}

/** Pause the lesson for an interruption and record the question. */
export function pauseForInterrupt(sessionId: string, question: string): SessionState {
  const state = getSession(sessionId);
  pause(state, question);
  addMessage(state, 'user', question);
  sessionStore.set(state);
  return state;
}

/** Answer the captured question (streaming segments), then resume the lesson. */
export async function answerAndResume(
  sessionId: string,
  question: string,
  onSegment: (segment: Segment) => void,
): Promise<SessionState> {
  const state = getSession(sessionId);
  const spoken: string[] = [];
  await answer(state, question, (seg) => {
    spoken.push(seg.speech);
    onSegment(seg);
  });
  if (spoken.length) addMessage(state, 'teacher', spoken.join(' '));
  resume(state);
  sessionStore.set(state);
  return state;
}
