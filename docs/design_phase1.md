# Infinite Teacher — Phase 1 MVP Design Document

Status: For review (no code written yet)
Date: 2026-06-18

This document is the agreed design before implementation. It covers architecture, folder
structure, shared TypeScript types, the socket contract, and the three hard parts:
**segment-level streaming + sync**, **interruption**, and **AI → tldraw command translation**.

---

## 1. Decisions locked in

| Area | Decision |
|---|---|
| AI provider | OpenCode Zen, OpenAI-compatible, `https://opencode.ai/zen/v1` |
| Model | `north-mini-code-free` (fast ~3.6s, clean JSON, SSE works). Swappable via `AI_MODEL` env. |
| Lesson plan | Generated **upfront** on session creation, then each step taught **on demand**. |
| Delivery | **Segment-level streaming** (see §6). |
| Drawing primitives | `text`, `rectangle`, `circle`, `arrow`, `line` only. Arrays = composites. |
| Repo | Monorepo: `frontend/`, `backend/`, `shared/`. |
| State | In-memory `Map<sessionId, SessionState>` behind a `SessionStore` interface (Redis later). |

**Model quirk:** north-mini emits `reasoning_content` deltas before `content` deltas. The AI
client strips `reasoning_content` and parses only `content`. Each AI output is schema-validated;
on parse failure we retry once with a "return valid JSON only" nudge.

---

## 2. High-level architecture

```
┌─────────────────────────── Browser (React) ───────────────────────────┐
│                                                                        │
│  SpeechRecognition ──▶ VoiceController ──┐                             │
│                                          │ socket: user:interrupt /    │
│                                          │         session:create      │
│  TTSController (speechSynthesis) ◀──┐    ▼                             │
│  TeachingCanvas (tldraw) ◀──┐       │  SocketClient ──────────────────┼──▶ to backend
│  LessonStatusPanel          │       │                                  │
│  TranscriptPanel            └── SegmentPlayer (orchestrator)           │
│                                  render visuals → confirm → speak       │
│                                  ◀── socket: lesson:segment, etc.       │
└────────────────────────────────────────────────────────────────────────┘
                                   │  Socket.IO
┌─────────────────────────────── Backend (Node) ─────────────────────────┐
│  routes ─▶ controllers ─▶ services ─▶ agents ─▶ AI client (zen)        │
│                              │                                          │
│                          SessionStore (in-memory)                       │
└────────────────────────────────────────────────────────────────────────┘
```

**Single Teacher Agent.** No planner/memory/avatar agents. The agent does two jobs:
1. `planLesson(topic)` → ordered step list (one call, on session create).
2. `teachStep(state)` / `answer(state, question)` → a stream of teaching segments.

---

## 3. Folder structure

```
shmora/
├── shared/
│   └── types.ts                 # single source of truth for types shared over the socket
├── backend/
│   ├── src/
│   │   ├── index.ts             # express + socket.io bootstrap
│   │   ├── config.ts            # env: PORT, AI_BASE_URL, AI_API_KEY, AI_MODEL
│   │   ├── routes/
│   │   │   └── health.ts
│   │   ├── socket/
│   │   │   └── gateway.ts        # registers socket handlers (transport layer only)
│   │   ├── controllers/
│   │   │   └── sessionController.ts   # socket event → service calls (no business logic)
│   │   ├── services/
│   │   │   ├── sessionService.ts      # create/get/end sessions, drive teach/answer flow
│   │   │   └── lessonFlow.ts          # step progression + pause/resume logic
│   │   ├── agents/
│   │   │   ├── teacherAgent.ts        # planLesson / teachStep / answer
│   │   │   └── prompts.ts             # system prompts + schema instructions
│   │   ├── ai/
│   │   │   ├── aiClient.ts            # OpenAI-compatible client, SSE streaming
│   │   │   └── segmentParser.ts       # incremental JSON → complete segments
│   │   ├── state/
│   │   │   ├── sessionStore.ts        # SessionStore interface
│   │   │   └── memoryStore.ts         # in-memory impl (Redis later)
│   │   └── types/                     # backend-only types (re-exports shared)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/SessionPage.tsx
│   │   ├── components/
│   │   │   ├── TeachingCanvas.tsx      # tldraw + command executor
│   │   │   ├── VoiceControls.tsx
│   │   │   ├── LessonStatusPanel.tsx
│   │   │   └── TranscriptPanel.tsx
│   │   ├── controllers/
│   │   │   ├── ttsController.ts        # the ONLY place speechSynthesis is touched
│   │   │   ├── voiceController.ts      # SpeechRecognition wrapper + interruption detect
│   │   │   └── segmentPlayer.ts        # render→confirm→speak orchestration
│   │   ├── canvas/
│   │   │   └── drawCommands.ts         # DrawCommand → tldraw shape translation
│   │   ├── socket/socketClient.ts
│   │   └── styles/index.css
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docs/design_phase1.md
└── .env                         # gitignored
```

Transport (socket/controllers) is kept free of business logic; logic lives in services/agents.

---

## 4. Shared types (`shared/types.ts`)

```ts
// ---- Drawing commands (the AI→canvas contract) ----
export type DrawCommand =
  | { type: 'text';      id: string; x: number; y: number; content: string }
  | { type: 'rectangle'; id: string; x: number; y: number; w: number; h: number; label?: string }
  | { type: 'circle';    id: string; x: number; y: number; r: number; label?: string }
  | { type: 'arrow';     id: string; x1: number; y1: number; x2: number; y2: number; label?: string }
  | { type: 'line';      id: string; x1: number; y1: number; x2: number; y2: number };

// ---- A teaching segment: one render+speak beat ----
export interface Segment {
  id: string;
  drawings: DrawCommand[];   // rendered FIRST
  speech: string;            // spoken only AFTER drawings confirmed rendered
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
  steps: string[];           // full ordered plan (titles)
  currentStep: number;       // index into steps
  completedSteps: string[];
  pendingSteps: string[];
  paused: boolean;
  pausedReason?: string;
  conversationHistory: Message[];
}

// ---- Socket payloads ----
export interface CreateSessionPayload { topic: string; }
export interface InterruptPayload { sessionId: string; question: string; }
export interface RenderConfirmPayload { sessionId: string; segmentId: string; }
```

---

## 5. Socket.IO contract

**Client → Server**
| Event | Payload | Meaning |
|---|---|---|
| `session:create` | `{ topic }` | Start a session; triggers planning + first step. |
| `lesson:next` | `{ sessionId }` | Advance to next step (sent after a step's segments finish). |
| `user:interrupt` | `{ sessionId, question }` | User spoke while teaching → pause + answer. |
| `render:confirm` | `{ sessionId, segmentId }` | Frontend finished rendering a segment's visuals. |
| `session:end` | `{ sessionId }` | Tear down session. |

**Server → Client**
| Event | Payload | Meaning |
|---|---|---|
| `session:created` | `SessionState` | Session + lesson plan ready. |
| `lesson:segment` | `Segment` | One teaching beat (render then speak). |
| `lesson:step_complete` | `{ sessionId, state }` | All segments of current step sent. |
| `state:update` | `SessionState` | Pushed whenever state changes (UI panels follow it). |
| `error` | `{ message }` | Recoverable error surfaced to UI. |

The server is authoritative for `SessionState`; the client never mutates it locally, it only
reflects `state:update`.

---

## 6. Streaming + Synchronization (the core mechanism)

The hard requirement: **audio must never start before its visuals are rendered.** We also want a
streaming feel. We reconcile both with **segment-level streaming**.

**Backend**
1. Teacher agent calls the AI with `stream:true`.
2. `aiClient` drops `reasoning_content`, accumulates `content`.
3. `segmentParser` watches the accumulating JSON (the model is instructed to emit a JSON array of
   segments). Each time a complete segment object closes, it's validated and emitted immediately
   as `lesson:segment` — so segments arrive progressively, not all-at-once.
4. After the last segment: emit `lesson:step_complete`.

**Frontend `segmentPlayer` (per segment, strictly sequential):**
```
receive lesson:segment
  → enqueue
  → for each segment in queue (one at a time):
       1. executeDrawCommands(segment.drawings)   // tldraw renders
       2. await canvas render-settled              // confirm visuals ready
       3. emit render:confirm                       // (telemetry / backend awareness)
       4. tts.speak(segment.speech)                 // audio starts ONLY now
       5. await tts.onend
       6. dequeue → next segment
```
Because each segment renders before it speaks, the visuals-before-audio invariant holds for every
beat, while the lesson still unfolds live. The queue guarantees ordering even if segments stream
in faster than they're spoken.

---

## 7. Interruption flow (most important feature)

```
While tts is speaking a segment:
  VoiceController (continuous SpeechRecognition) detects real user speech
        │
        ▼
  1. tts.stop()                    // immediate, local — no round trip
  2. segmentPlayer.pause()         // freeze the queue; remember position
  3. emit user:interrupt { sessionId, question }
        │
   Backend:
  4. sessionService: state.paused = true; pausedReason = question
  5. teacherAgent.answer(state, question) → streams answer segments
  6. answer segments play through the same segmentPlayer pipeline
  7. on answer complete: state.paused = false
  8. emit state:update; teaching resumes from the frozen position
```

Interruption detection guard: ignore empty/filler transcripts and ignore the recognizer hearing
the TTS itself (we pause recognition processing while TTS speaks, or filter by the known spoken
text) so the teacher doesn't interrupt itself.

The frozen position + server-side `SessionState` is what makes resume lossless.

---

## 8. AI client & agent

- `aiClient.streamChat({ messages, onContentDelta })` — POSTs to `/chat/completions` with
  `stream:true`, parses SSE, ignores `reasoning_content`, forwards `content` deltas.
- `teacherAgent`:
  - `planLesson(topic)` → non-streamed call, returns `string[]` of step titles (validated).
  - `teachStep(state)` → streamed; system prompt includes current step, completed/pending, and the
    strict segment schema; instructs "emit a JSON array of segments, drawings before speech".
  - `answer(state, question)` → streamed; same schema, scoped to answering then a one-line bridge
    back ("Now, back to where we were…").
- Prompts forbid prose and enforce the 5 drawing primitives with a coordinate space the canvas
  understands (e.g. 0–1000 logical units mapped to canvas).

---

## 9. Frontend controllers

- **`ttsController`** — wraps `speechSynthesis`. API: `speak(text)`, `stop()`, `pause()`,
  `resume()`, `onend`. The ONLY module that references `speechSynthesis`. Components never call it
  directly.
- **`voiceController`** — wraps `SpeechRecognition` with `continuous = true`; emits
  `onUserSpeech(transcript)`; coordinates with ttsController to avoid self-interruption.
- **`drawCommands`** — pure translation `DrawCommand[] → tldraw createShapes(...)`. No AI logic.
- **`segmentPlayer`** — the §6 orchestrator.

---

## 10. What is explicitly NOT built (Phase 1)

User accounts, persistent/cross-session memory, avatars, video, multi-agent, planner/memory
agents, quizzes/assessments, adaptive profiles, course generation. State dies with the session.

---

## 11. Open risk & mitigation

| Risk | Mitigation |
|---|---|
| Free model emits invalid JSON | Schema-validate every segment; retry once; skip a malformed segment rather than crash. |
| Model too weak for good teaching | AI layer is swappable via `AI_MODEL`; upgrade later with zero code change. |
| SpeechRecognition hears the TTS | Gate recognition processing during TTS / filter known spoken text. |
| Browser support (SpeechRecognition is Chromium-only) | Target Chrome for MVP; show a clear unsupported-browser notice. |

---

## Next step
On approval of this design, I produce the **Implementation Plan** (ordered build steps with
verification checkpoints), then implement inline.
