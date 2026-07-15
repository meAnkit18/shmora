import { randomUUID } from 'node:crypto';
import type {
  Segment,
  SessionState,
  TurnInfo,
  TurnKind,
  TurnRecord,
  VisualIntent,
} from '../../../shared/types.js';
import type {
  LessonTimeline,
  TimelineBlock,
  TimelineScene,
} from '../../../shared/timelineTypes.js';
import type { CanvasBeat, SceneCanvas } from '../../../shared/canvasTypes.js';
import { collectHidden, elementLabel } from '../../../shared/canvasTypes.js';
import { sessionStore } from '../state/memoryStore.js';
import { courseStore } from '../state/courseStore.js';
import { addMessage, advanceStep, pause, resume, isLessonComplete } from './lessonFlow.js';
import { Channel } from './channel.js';
import {
  planAndTeachFirstStep,
  planLesson,
  teachStep,
  answer,
  closing,
} from '../agents/teacherAgent.js';
import type { PromptContext } from '../agents/prompts.js';
import type { SegmentDraft } from '../ai/segmentParser.js';
import { isAbortError } from '../ai/aiClient.js';

// ---- The emitter interface the controller passes in (socket-agnostic) ----
export interface TurnEmitter {
  created(state: SessionState): void;
  turnStart(turn: TurnInfo): void;
  segment(segment: Segment): void;
  turnEnd(turn: TurnInfo, state: SessionState): void;
  stateUpdate(state: SessionState): void;
  complete(state: SessionState): void;
}

// ---- Per-session runtime ----
interface Prefetch {
  stepIndex: number;
  channel: Channel<SegmentDraft>;
  abort: AbortController;
}

interface Runtime {
  state: SessionState;
  seq: number; // per-session segment counter
  log: TurnRecord[]; // every turn + its segments (board replay on resume)
  registry: { turnId: string; lines: string[] }[]; // per-turn element lines (only recent turns survive)
  currentAbort: AbortController | null; // abort handle of the in-flight turn
  prefetch: Prefetch | null;
  script: LessonTimeline | null; // set for scripted sessions: the authored blueprint
  chain: Promise<unknown>; // single-flight op queue
  lastActive: number;
}

const runtimes = new Map<string, Runtime>();

const SESSION_TTL_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_TRANSCRIPT_MESSAGES = 12;
const MAX_REGISTRY_LINES = 40;
const KEPT_REGISTRY_TURNS = 2; // mirror of the frontend: only the current + previous frame exist on the board
const MAX_LOG_TURNS = 60;

// ---- TTL sweeper: abandoned sessions no longer leak until process death ----
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [id, rt] of runtimes) {
    if (now - rt.lastActive > SESSION_TTL_MS) destroyRuntime(id, rt);
  }
}, SWEEP_INTERVAL_MS);
sweeper.unref?.();

function destroyRuntime(sessionId: string, rt: Runtime): void {
  rt.currentAbort?.abort();
  rt.prefetch?.abort.abort();
  runtimes.delete(sessionId);
  sessionStore.delete(sessionId);
}

function getRuntime(sessionId: string): Runtime {
  const rt = runtimes.get(sessionId);
  if (!rt) throw new Error(`Unknown session: ${sessionId}`);
  rt.lastActive = Date.now();
  return rt;
}

/** Serialize operations per session (single-flight). Runs op after whatever is in flight. */
function enqueue<T>(rt: Runtime, op: () => Promise<T>): Promise<T> {
  const run = rt.chain.then(op, op);
  rt.chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function makeTurn(kind: TurnKind, state: SessionState): TurnInfo {
  if (kind === 'teach') {
    return {
      turnId: randomUUID(),
      kind,
      stepIndex: state.currentStep,
      stepTitle: state.steps[state.currentStep],
    };
  }
  return { turnId: randomUUID(), kind };
}

/** Registry lines describing an element, so future prompts can reference it by id. */
function registryLines(v: VisualIntent): string[] {
  switch (v.kind) {
    case 'array':
      return [
        `${v.id} — array [${v.cells.join(', ')}] (cell refs: ${v.id}.0 … ${v.id}.${v.cells.length - 1})`,
      ];
    case 'sequence':
      return [
        `${v.id} — sequence ${v.items.join(' → ')} (item refs: ${v.id}.0 … ${v.id}.${v.items.length - 1})`,
      ];
    case 'note':
      return v.id ? [`${v.id} — note: "${v.text.slice(0, 60)}"`] : [];
    default:
      return [];
  }
}

function promptContext(rt: Runtime): PromptContext {
  return {
    transcript: rt.state.conversationHistory.slice(-MAX_TRANSCRIPT_MESSAGES),
    registry: rt.registry.flatMap((b) => b.lines).slice(-MAX_REGISTRY_LINES),
  };
}

/** Stamp a draft with turnId + seq, record it in the log + registry, return the full segment. */
function stamp(rt: Runtime, turn: TurnInfo, draft: SegmentDraft): Segment {
  const seg: Segment = { ...draft, turnId: turn.turnId, seq: ++rt.seq };
  let record = rt.log[rt.log.length - 1];
  if (!record || record.turn.turnId !== turn.turnId) {
    record = { turn, segments: [] };
    rt.log.push(record);
    if (rt.log.length > MAX_LOG_TURNS) rt.log.shift();
  }
  record.segments.push(seg);
  let bucket = rt.registry[rt.registry.length - 1];
  if (!bucket || bucket.turnId !== turn.turnId) {
    bucket = { turnId: turn.turnId, lines: [] };
    rt.registry.push(bucket);
    // The frontend wipes frames older than the previous one; forget their refs
    // here too so the model is never offered ids that no longer exist.
    if (rt.registry.length > KEPT_REGISTRY_TURNS) rt.registry.shift();
  }
  for (const v of seg.visuals) bucket.lines.push(...registryLines(v));
  return seg;
}

/**
 * Speculatively generate the NEXT step into a channel. Called on the FIRST
 * segment of the current step, so generation overlaps almost the entire
 * current step's playback. Because the visual language is semantic (no
 * coordinates), prefetched content can never be spatially stale.
 */
function startPrefetch(rt: Runtime): void {
  if (rt.script) return; // scripted lessons replay authored blocks — nothing to prefetch
  const state = rt.state;
  const nextIdx = state.currentStep + 1;
  if (rt.prefetch || nextIdx >= state.steps.length) return;

  const finished = state.steps[state.currentStep];
  const nextState: SessionState = {
    ...state,
    currentStep: nextIdx,
    completedSteps:
      finished && !state.completedSteps.includes(finished)
        ? [...state.completedSteps, finished]
        : [...state.completedSteps],
    pendingSteps: state.steps.slice(nextIdx + 1),
    conversationHistory: [...state.conversationHistory],
  };

  const abort = new AbortController();
  const channel = new Channel<SegmentDraft>();
  rt.prefetch = { stepIndex: nextIdx, channel, abort };

  teachStep(nextState, promptContext(rt), {
    signal: abort.signal,
    onSegment: (d) => channel.push(d),
  })
    .then((n) =>
      channel.close(n === 0 ? new Error('The teacher could not generate this step.') : undefined),
    )
    .catch((err) => channel.close(isAbortError(err) ? undefined : err));
}

// ---- Create (fused plan + step 1) ----

export async function createSession(topic: string, emit: TurnEmitter): Promise<void> {
  const abort = new AbortController();
  const ctx: { rt: Runtime | null; turn: TurnInfo | null } = { rt: null, turn: null };
  const prePlanBuffer: SegmentDraft[] = [];
  const spoken: string[] = [];
  let delivered = 0;
  let releaseChain: (() => void) | null = null;

  const onPlan = (steps: string[]) => {
    if (ctx.rt) return; // ignore a second plan object
    const state: SessionState = {
      sessionId: randomUUID(),
      topic,
      steps,
      currentStep: 0,
      completedSteps: [],
      pendingSteps: steps.slice(1),
      paused: false,
      completed: false,
      conversationHistory: [],
    };
    sessionStore.set(state);
    // Gate the op queue until this create flow finishes, so lesson:next /
    // interrupts that arrive mid-create run strictly after it.
    const gate = new Promise<void>((res) => {
      releaseChain = res;
    });
    ctx.rt = {
      state,
      seq: 0,
      log: [],
      registry: [],
      currentAbort: abort,
      prefetch: null,
      script: null,
      chain: gate,
      lastActive: Date.now(),
    };
    runtimes.set(state.sessionId, ctx.rt);
    emit.created(state);
    ctx.turn = makeTurn('teach', state);
    emit.turnStart(ctx.turn);
    for (const d of prePlanBuffer.splice(0)) deliver(d);
  };

  const deliver = (draft: SegmentDraft) => {
    if (!ctx.rt || !ctx.turn) {
      prePlanBuffer.push(draft); // model emitted a segment before the plan; hold it
      return;
    }
    const seg = stamp(ctx.rt, ctx.turn, draft);
    spoken.push(seg.speech);
    emit.segment(seg);
    delivered++;
    if (delivered === 1) startPrefetch(ctx.rt); // prefetch step 2 from the FIRST segment
  };

  try {
    await planAndTeachFirstStep({ topic, signal: abort.signal, onPlan, onSegment: deliver });

    if (!ctx.rt) {
      // Fused stream never yielded a plan — fall back to the two-call path.
      const steps = await planLesson(topic, abort.signal);
      onPlan(steps);
      await teachStep(ctx.rt!.state, promptContext(ctx.rt!), {
        signal: abort.signal,
        onSegment: deliver,
      });
    }

    const rt = ctx.rt;
    const turn = ctx.turn;
    if (rt && turn) {
      if (spoken.length) addMessage(rt.state, 'teacher', spoken.join(' '));
      sessionStore.set(rt.state);
      if (rt.currentAbort === abort) rt.currentAbort = null;
      if (!abort.signal.aborted) {
        emit.turnEnd(turn, rt.state);
        startPrefetch(rt);
      }
    }
  } finally {
    (releaseChain as (() => void) | null)?.();
  }
}

// ---- Scripted sessions: the creator-authored timeline is the teaching blueprint ----

function canvasInventoryLines(canvas: SceneCanvas): string[] {
  const lines: string[] = [];
  for (const el of canvas.elements) {
    const label = elementLabel(el);
    if (!label) continue;
    lines.push(`${el.id} — on the prepared slide (${String(el.type ?? 'element')}): "${label}"`);
    if (lines.length >= 24) break;
  }
  return lines;
}

async function runScriptedTurn(rt: Runtime, emit: TurnEmitter): Promise<void> {
  const scene: TimelineScene | undefined = rt.script?.scenes[rt.state.currentStep];
  const turn = makeTurn('teach', rt.state);
  emit.turnStart(turn);
  const spoken: string[] = [];

  const canvas = scene?.canvas;
  if (scene && canvas && canvas.elements.length) {
    const transition = scene.transition ?? 'cut';
    const hidden = collectHidden(scene.blocks);
    const blocks: TimelineBlock[] = scene.blocks.length
      ? scene.blocks
      : [{ id: `${scene.id}-show`, script: '', visuals: [] }];
    blocks.forEach((block, i) => {
      const beat: CanvasBeat = {
        sceneId: scene.id,
        sceneStart: i === 0,
        transition,
        ...(i === 0
          ? { elements: canvas.elements, files: canvas.files, initialHidden: hidden }
          : {}),
        reveal: block.reveal ?? [],
        ...(block.pointer ? { pointer: block.pointer } : {}),
      };
      const seg = stamp(rt, turn, {
        id: block.id,
        visuals: [],
        speech: block.script,
        canvas: beat,
        ...(block.holdMs ? { holdMs: block.holdMs } : {}),
      });
      if (seg.speech.trim()) spoken.push(seg.speech);
      emit.segment(seg);
    });
    const bucket = rt.registry[rt.registry.length - 1];
    if (bucket && bucket.turnId === turn.turnId) {
      bucket.lines.push(...canvasInventoryLines(canvas));
    }
  } else {
    for (const block of scene?.blocks ?? []) {
      const seg = stamp(rt, turn, {
        id: block.id,
        visuals: block.visuals,
        speech: block.script,
        ...(block.holdMs ? { holdMs: block.holdMs } : {}),
      });
      spoken.push(seg.speech);
      emit.segment(seg);
    }
  }

  if (spoken.length) addMessage(rt.state, 'teacher', spoken.join(' '));
  sessionStore.set(rt.state);
  emit.turnEnd(turn, rt.state);
}

function upcomingScript(rt: Runtime): string | undefined {
  const scenes = rt.script?.scenes;
  if (!scenes) return undefined;
  const lines: string[] = [];
  const current = scenes[rt.state.currentStep];
  if (current) for (const b of current.blocks) lines.push(b.script);
  const next = scenes[rt.state.currentStep + 1];
  if (next?.blocks[0]) lines.push(next.blocks[0].script);
  const joined = lines.slice(0, 4).join(' ').trim();
  return joined || undefined;
}

export async function createScriptedSession(
  courseId: string,
  lessonId: string,
  emit: TurnEmitter,
): Promise<void> {
  const course = courseStore.get(courseId) ?? courseStore.getBySlug(courseId);
  if (!course) throw new Error('Course not found.');

  let lessonTitle = '';
  let timeline: LessonTimeline | undefined;
  for (const section of course.sections) {
    const lesson = section.lessons.find((l) => l.id === lessonId);
    if (lesson) {
      lessonTitle = lesson.title || 'Untitled lesson';
      timeline = lesson.timeline;
      break;
    }
  }
  if (!lessonTitle) throw new Error('Lesson not found in this course.');

  const scenes =
    timeline?.scenes.filter(
      (s) => s.blocks.length > 0 || (s.canvas?.elements.length ?? 0) > 0,
    ) ?? [];
  if (scenes.length === 0) {
    await createSession(`${course.title}: ${lessonTitle}`, emit);
    return;
  }

  const stepTitles = scenes.map((s, i) => s.title.trim() || `Part ${i + 1}`);
  const state: SessionState = {
    sessionId: randomUUID(),
    topic: `${course.title} — ${lessonTitle}`,
    steps: stepTitles,
    currentStep: 0,
    completedSteps: [],
    pendingSteps: stepTitles.slice(1),
    paused: false,
    completed: false,
    scripted: true,
    conversationHistory: [],
  };
  sessionStore.set(state);

  const rt: Runtime = {
    state,
    seq: 0,
    log: [],
    registry: [],
    currentAbort: null,
    prefetch: null,
    script: {
      version: timeline?.version ?? 1,
      scenes,
      updatedAt: timeline?.updatedAt ?? Date.now(),
    },
    chain: Promise.resolve(),
    lastActive: Date.now(),
  };
  runtimes.set(state.sessionId, rt);
  emit.created(state);
  await enqueue(rt, () => runScriptedTurn(rt, emit));
}

// ---- Teaching a step (consumes the prefetch channel if one exists) ----

async function runTeachTurn(rt: Runtime, emit: TurnEmitter): Promise<void> {
  const state = rt.state;
  const stepIndex = state.currentStep;
  const turn = makeTurn('teach', state);
  const abort = new AbortController();
  rt.currentAbort = abort;

  let channel: Channel<SegmentDraft>;
  const pf = rt.prefetch;
  if (pf && pf.stepIndex === stepIndex) {
    // Consume the speculative generation — buffered segments flow instantly,
    // in-flight ones stream as they arrive. No completion-blocking join.
    rt.prefetch = null;
    channel = pf.channel;
    abort.signal.addEventListener('abort', () => pf.abort.abort());
  } else {
    // Wrong-step or missing prefetch: drop it and generate live.
    rt.prefetch?.abort.abort();
    rt.prefetch = null;
    channel = new Channel<SegmentDraft>();
    teachStep(state, promptContext(rt), {
      signal: abort.signal,
      onSegment: (d) => channel.push(d),
    })
      .then((n) =>
        channel.close(
          n === 0 ? new Error('The teacher could not generate this step.') : undefined,
        ),
      )
      .catch((err) => channel.close(isAbortError(err) ? undefined : err));
  }

  emit.turnStart(turn);
  const spoken: string[] = [];
  let count = 0;
  let failed: unknown = null;

  try {
    for await (const draft of channel) {
      if (abort.signal.aborted) break;
      const seg = stamp(rt, turn, draft);
      spoken.push(seg.speech);
      emit.segment(seg);
      count++;
      if (count === 1) startPrefetch(rt); // overlap next-step generation with playback
    }
  } catch (err) {
    if (!isAbortError(err)) failed = err;
  }

  if (spoken.length) addMessage(state, 'teacher', spoken.join(' '));
  sessionStore.set(state);
  if (rt.currentAbort === abort) rt.currentAbort = null;

  if (failed) throw failed;
  if (!abort.signal.aborted) {
    emit.turnEnd(turn, state);
    startPrefetch(rt);
  }
}

// ---- Closing recap turn ----

async function runClosingTurn(rt: Runtime, emit: TurnEmitter): Promise<void> {
  const turn = makeTurn('closing', rt.state);
  const abort = new AbortController();
  rt.currentAbort = abort;
  emit.turnStart(turn);
  const spoken: string[] = [];
  try {
    await closing(rt.state, promptContext(rt), {
      signal: abort.signal,
      onSegment: (d) => {
        const seg = stamp(rt, turn, d);
        spoken.push(seg.speech);
        emit.segment(seg);
      },
    });
  } catch (err) {
    if (!isAbortError(err)) {
      console.error('[session] closing turn failed:', err);
    }
  }
  if (spoken.length) addMessage(rt.state, 'teacher', spoken.join(' '));
  if (rt.currentAbort === abort) rt.currentAbort = null;
  if (!abort.signal.aborted) emit.turnEnd(turn, rt.state);
}

// ---- Public operations (all single-flight per session) ----

/** Advance and teach the next step; runs the closing turn + complete after the last step. */
export function nextStep(sessionId: string, emit: TurnEmitter): Promise<void> {
  const rt = getRuntime(sessionId);
  return enqueue(rt, async () => {
    if (rt.state.completed) return;
    advanceStep(rt.state);
    sessionStore.set(rt.state);
    emit.stateUpdate(rt.state);

    if (isLessonComplete(rt.state)) {
      await runClosingTurn(rt, emit);
      rt.state.completed = true;
      sessionStore.set(rt.state);
      emit.complete(rt.state);
      return;
    }
    if (rt.script) await runScriptedTurn(rt, emit);
    else await runTeachTurn(rt, emit);
  });
}

/**
 * Interrupt: abort the in-flight generation IMMEDIATELY (outside the queue),
 * invalidate the now-stale prefetch, then answer and resume.
 */
export function interrupt(
  sessionId: string,
  question: string,
  emit: TurnEmitter,
): Promise<void> {
  const rt = getRuntime(sessionId);

  // Immediate effects — must not wait behind the (aborting) in-flight turn:
  rt.currentAbort?.abort(); // W9: stop generating the step the student just interrupted
  rt.prefetch?.abort.abort(); // W15: history is about to change; cached step is stale
  rt.prefetch = null;
  pause(rt.state, question);
  addMessage(rt.state, 'user', question);
  sessionStore.set(rt.state);
  emit.stateUpdate(rt.state);

  return enqueue(rt, async () => {
    const turn = makeTurn('answer', rt.state);
    const abort = new AbortController();
    rt.currentAbort = abort;
    emit.turnStart(turn);

    const spoken: string[] = [];
    let failed: unknown = null;
    try {
      await answer(
        rt.state,
        promptContext(rt),
        question,
        {
          signal: abort.signal,
          onSegment: (d) => {
            const seg = stamp(rt, turn, d);
            spoken.push(seg.speech);
            emit.segment(seg);
          },
        },
        upcomingScript(rt),
      );
    } catch (err) {
      if (!isAbortError(err)) failed = err;
    }

    if (spoken.length) addMessage(rt.state, 'teacher', spoken.join(' '));
    resume(rt.state); // never leave the lesson stuck in paused, even on failure
    sessionStore.set(rt.state);
    if (rt.currentAbort === abort) rt.currentAbort = null;
    emit.turnEnd(turn, rt.state);
    emit.stateUpdate(rt.state);
    startPrefetch(rt); // regenerate the next step WITH the Q&A now in history

    if (failed) throw failed;
  });
}

/** Re-attach after a refresh/reconnect: state + the full turn log for silent board replay. */
export function resumeSession(sessionId: string): {
  state: SessionState;
  log: TurnRecord[];
} {
  const rt = getRuntime(sessionId);
  return { state: rt.state, log: rt.log };
}

export function endSession(sessionId: string): void {
  const rt = runtimes.get(sessionId);
  if (rt) destroyRuntime(sessionId, rt);
  else sessionStore.delete(sessionId);
}
