// Single source of truth for types shared across backend and frontend (over the socket).

// ---- Drawing commands (the AI -> canvas contract) ----
// Coordinate space is logical 0..1000 on both axes; the canvas maps it to Excalidraw units.
export type DrawCommand =
  | { type: 'text'; id: string; x: number; y: number; content: string }
  | { type: 'rectangle'; id: string; x: number; y: number; w: number; h: number; label?: string }
  | { type: 'circle'; id: string; x: number; y: number; r: number; label?: string }
  | { type: 'arrow'; id: string; x1: number; y1: number; x2: number; y2: number; label?: string }
  | { type: 'line'; id: string; x1: number; y1: number; x2: number; y2: number };

export type DrawCommandType = DrawCommand['type'];

// ---- A teaching segment: one render+speak beat ----
export interface Segment {
  id: string;
  drawings: DrawCommand[]; // rendered FIRST
  speech: string; // spoken only AFTER drawings are confirmed rendered
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
  conversationHistory: Message[];
}

// ---- Socket payloads (client -> server) ----
export interface CreateSessionPayload {
  topic: string;
}
export interface NextStepPayload {
  sessionId: string;
}
export interface InterruptPayload {
  sessionId: string;
  question: string;
}
export interface RenderConfirmPayload {
  sessionId: string;
  segmentId: string;
}
export interface EndSessionPayload {
  sessionId: string;
}

// ---- Socket payloads (server -> client) ----
export interface StepCompletePayload {
  sessionId: string;
  state: SessionState;
}
export interface ErrorPayload {
  message: string;
}

// ---- Typed socket event maps ----
export interface ClientToServerEvents {
  'session:create': (payload: CreateSessionPayload) => void;
  'lesson:next': (payload: NextStepPayload) => void;
  'user:interrupt': (payload: InterruptPayload) => void;
  'render:confirm': (payload: RenderConfirmPayload) => void;
  'session:end': (payload: EndSessionPayload) => void;
}

export interface ServerToClientEvents {
  'session:created': (state: SessionState) => void;
  'lesson:segment': (segment: Segment) => void;
  'lesson:step_complete': (payload: StepCompletePayload) => void;
  'state:update': (state: SessionState) => void;
  error: (payload: ErrorPayload) => void;
}
