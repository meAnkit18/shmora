// Single source of truth for types shared across backend and frontend (over the socket).

import type { CanvasBeat } from './canvasTypes.js';

// ---- Semantic visual language (the AI -> board contract) ----
// The AI NEVER emits coordinates. It describes WHAT to show; the frontend
// layout engine (frontend/src/canvas/layoutEngine.ts) decides WHERE.

/** A reference to an element the AI created earlier: its `id`, or `id.index` for a cell/item. */
export type ElementRef = string;

export type VisualIntent =
  | { kind: 'title'; text: string }
  | { kind: 'note'; id?: string; text: string }
  | { kind: 'array'; id: string; cells: string[]; caption?: string }
  | { kind: 'sequence'; id: string; items: string[]; caption?: string }
  | { kind: 'pointer'; to: ElementRef; label?: string }
  | { kind: 'highlight'; target: ElementRef; label?: string }
  | { kind: 'update'; target: ElementRef; text: string }
  // ---- teacher gestures (added) ----
  | { kind: 'circle'; target: ElementRef; label?: string }
  | { kind: 'underline'; target: ElementRef }
  | { kind: 'strike'; target: ElementRef }
  | { kind: 'mark'; target: ElementRef; symbol: 'check' | 'cross' }
  | { kind: 'connect'; from: ElementRef; to: ElementRef; label?: string }
  | { kind: 'erase'; target: ElementRef };

// ---- Turns: one generation of the teacher (a step, an answer, or the recap) ----
export type TurnKind = 'teach' | 'answer' | 'closing';

export interface TurnInfo {
  turnId: string;
  kind: TurnKind;
  stepIndex?: number; // set for 'teach' turns
  stepTitle?: string; // set for 'teach' turns
}

// ---- A teaching segment: one render+speak beat ----
export interface Segment {
  id: string;
  turnId: string; // which turn produced it (client drops segments from stale turns)
  seq: number; // per-session monotonically increasing (ordering + replay)
  visuals: VisualIntent[]; // rendered FIRST
  speech: string; // spoken only AFTER visuals are painted
  holdMs?: number; // authored pause after the speech finishes (scripted lessons)
  canvas?: CanvasBeat;
}

/** One turn plus every segment it produced — the unit of board replay on resume. */
export interface TurnRecord {
  turn: TurnInfo;
  segments: Segment[];
}

// ---- Conversation + state ----
export interface Message {
  role: 'teacher' | 'user';
  text: string;
  ts: number;
}

export interface SessionState {
  sessionId: string;
  topic: string;
  steps: string[]; // full ordered plan (titles)
  currentStep: number; // index into steps
  completedSteps: string[];
  pendingSteps: string[];
  paused: boolean;
  pausedReason?: string;
  completed: boolean; // true after the closing turn has run
  scripted?: boolean; // true when the lesson follows a creator-authored timeline
  conversationHistory: Message[];
}

// ---- Socket payloads (client -> server) ----
export interface CreateSessionPayload {
  topic: string;
  /** When both are set, the session replays the lesson's authored timeline. */
  courseId?: string;
  lessonId?: string;
}
export interface NextStepPayload {
  sessionId: string;
}
export interface InterruptPayload {
  sessionId: string;
  question: string;
}
export interface ResumeSessionPayload {
  sessionId: string;
}
export interface EndSessionPayload {
  sessionId: string;
}

// ---- Socket payloads (server -> client) ----
export interface TurnEndPayload {
  turnId: string;
  kind: TurnKind;
  state: SessionState;
}
export interface SessionResumedPayload {
  state: SessionState;
  log: TurnRecord[]; // full board history, replayed silently by the client
}
export interface ErrorPayload {
  message: string;
}

// ---- Typed socket event maps ----
export interface ClientToServerEvents {
  'session:create': (payload: CreateSessionPayload) => void;
  'session:resume': (payload: ResumeSessionPayload) => void;
  'lesson:next': (payload: NextStepPayload) => void;
  'user:interrupt': (payload: InterruptPayload) => void;
  'session:end': (payload: EndSessionPayload) => void;
}

export interface ServerToClientEvents {
  'session:created': (state: SessionState) => void;
  'session:resumed': (payload: SessionResumedPayload) => void;
  'turn:start': (turn: TurnInfo) => void;
  'lesson:segment': (segment: Segment) => void;
  'turn:end': (payload: TurnEndPayload) => void;
  'lesson:complete': (state: SessionState) => void;
  'state:update': (state: SessionState) => void;
  error: (payload: ErrorPayload) => void;
}
