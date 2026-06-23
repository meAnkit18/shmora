# Infinite Teacher — Phase 1 Implementation Plan

Status: For review (no code written yet)
Date: 2026-06-18
Companion to: `docs/design_phase1.md`

Build order is bottom-up: shared contract → AI proven in isolation → backend flow → frontend
shell → the two hard features (sync + interruption) last, on top of working pieces. Every step
has a **Verify** checkpoint; nothing is declared done without it (per `agent.md` §4).

Legend: 🔌 transport · 🧠 AI/logic · 🎨 UI · ✅ verification gate

---

## Step 0 — Repo scaffold & shared contract

**Do**
- Create monorepo: `frontend/`, `backend/`, `shared/`, root `.gitignore` (ignore `.env`, `node_modules`, `dist`).
- `shared/types.ts` — exactly the types from design §4 (`DrawCommand`, `Segment`, `Message`, `SessionState`, socket payloads).
- `.env` with `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL=north-mini-code-free`, `PORT=3001`.
- `.env.example` (no secret) committed.

**✅ Verify:** `shared/types.ts` compiles under `tsc --noEmit`. `.env` is gitignored.

---

## Step 1 — Backend skeleton (transport only, no AI yet)

**Do** 🔌
- `backend/`: `package.json`, `tsconfig.json`, deps (`express`, `socket.io`, `cors`, `dotenv`, `tsx`/`ts-node`, `typescript`).
- `config.ts` reads env (fail fast if `AI_API_KEY` missing).
- `index.ts`: Express + HTTP server + Socket.IO, CORS for Vite dev origin.
- `routes/health.ts`: `GET /health → { ok: true }`.
- `socket/gateway.ts`: connection log + `disconnect` log. No business events yet.

**✅ Verify:** `curl localhost:3001/health` → `{ok:true}`. A socket test client connects and logs.

---

## Step 2 — AI client + segment parser (proven standalone)

**Do** 🧠
- `ai/aiClient.ts`: `streamChat({ messages, onContentDelta })` — POST `/chat/completions` with
  `stream:true`, parse SSE lines, **drop `reasoning_content`**, forward only `content` deltas;
  also a non-streamed `chat()` for planning.
- `ai/segmentParser.ts`: accumulate `content`; detect each complete segment object in the streamed
  JSON array; validate against `Segment`/`DrawCommand`; emit complete segments; on invalid segment,
  skip it (don't crash).
- Tiny scratch script `backend/scripts/tryAi.ts` to exercise both against a fixed prompt.

**✅ Verify:** Run `tryAi.ts` → prints a valid step list (plan) and a stream of validated segments
with only the 5 allowed `DrawCommand` types. Bad JSON path is exercised and skipped gracefully.

---

## Step 3 — Teacher Agent + prompts

**Do** 🧠
- `agents/prompts.ts`: system prompt enforcing — no prose, JSON array of segments, drawings before
  speech, the 5 primitives only, the 0–1000 logical coordinate space, and `planLesson` schema.
- `agents/teacherAgent.ts`: `planLesson(topic) → string[]`; `teachStep(state) → stream<Segment>`;
  `answer(state, question) → stream<Segment>`. One retry on validation failure.

**✅ Verify:** Via `tryAi.ts`: `planLesson("Binary Search")` returns sensible ordered steps;
`teachStep` for step 0 streams segments whose drawings render a sorted-array-like layout.

---

## Step 4 — Session state + service flow (no frontend)

**Do** 🧠🔌
- `state/sessionStore.ts` (interface) + `state/memoryStore.ts` (`Map<sessionId,SessionState>`).
- `services/sessionService.ts`: `create(topic)` (plan → build `SessionState` → store), `get`, `end`.
- `services/lessonFlow.ts`: advance step, mark complete, pause/resume, set `pausedReason`.
- `controllers/sessionController.ts` + wire into `gateway.ts`:
  - `session:create` → `session:created` + stream first step's `lesson:segment`s → `lesson:step_complete`.
  - `lesson:next` → stream next step.
  - `user:interrupt` → pause, stream `answer`, resume, `state:update`.
  - `session:end` → cleanup.
- State pushed via `state:update` on every change. Server is authoritative.

**✅ Verify:** A scripted socket client runs the full happy path (create → step → next) and an
interrupt mid-step, printing segments + state transitions in correct order. No frontend needed.

---

## Step 5 — Frontend shell + tldraw canvas

**Do** 🎨
- `frontend/`: Vite + React + TS + Tailwind; tldraw installed; Excalifont wired in.
- `SessionPage.tsx` layout: canvas center, `LessonStatusPanel` + `TranscriptPanel` side, `VoiceControls` bottom. A topic input to start a session.
- `socket/socketClient.ts`: typed wrapper over the §5 events.
- `canvas/drawCommands.ts`: pure `DrawCommand[] → tldraw shapes`, all 5 primitives. `TeachingCanvas.tsx` exposes `executeDrawCommands()` + a render-settled signal.

**✅ Verify:** Hardcode a sample `Segment[]` and render it — all 5 primitives appear correctly on the tldraw board. Panels render with mock state.

---

## Step 6 — TTS controller + voice input

**Do** 🎨
- `controllers/ttsController.ts`: `speak/stop/pause/resume/onend` over `speechSynthesis` — the ONLY
  module touching it.
- `controllers/voiceController.ts`: `SpeechRecognition` (`continuous`), `onUserSpeech`, self-interruption guard (gate processing while TTS speaks).
- `VoiceControls.tsx`: mic toggle, speaking/listening indicators, stop.

**✅ Verify:** Button speaks a string and stop/pause/resume work. Mic transcribes speech to text in
the transcript panel. Speaking while TTS is active is captured without the teacher interrupting itself.

---

## Step 7 — Segment player (sync gate) — wire it all together

**Do** 🎨🔌
- `controllers/segmentPlayer.ts`: queue; per segment **render → await settled → `render:confirm` →
  `tts.speak` → await `onend` → next**. Strictly sequential.
- `SessionPage` subscribes to `lesson:segment`/`lesson:step_complete`/`state:update`; on step
  complete, emits `lesson:next`. Panels follow server state.

**✅ Verify (the core acceptance test):** Start "Teach me Binary Search" end-to-end. For every
segment, visuals appear **before** any audio. Lesson advances through steps; status panel tracks
completed/current/pending live.

---

## Step 8 — Interruption end-to-end

**Do** 🎨🧠
- VoiceController detects real speech mid-segment → `tts.stop()` (instant) → `segmentPlayer.pause()`
  (freeze position) → emit `user:interrupt`.
- Answer segments play through the same player; on completion, resume from frozen position; transcript shows Q&A.

**✅ Verify:** While the teacher is speaking, ask "Why must the array be sorted?" → TTS stops
immediately, answer plays (render-before-audio held), then the lesson resumes from the exact spot.
Status panel never loses the current step.

---

## Step 9 — Polish & hardening

**Do**
- `error` event surfaced as a non-blocking toast.
- Unsupported-browser notice (non-Chromium SpeechRecognition).
- `session:end` clears store + stops TTS/recognition.
- README: env setup + run (`backend`: dev server, `frontend`: Vite).

**✅ Verify:** Full run from a clean `.env`: create → teach → interrupt → resume → end, in Chrome,
no console errors.

---

## Build sequencing notes
- Steps 0–4 are backend/headless and independently verifiable before any UI exists.
- The two hard features (Step 7 sync, Step 8 interruption) come last, built on already-verified parts — smallest possible blast radius if something's wrong.
- Each step keeps a minimal diff; no speculative abstraction beyond the design (`agent.md` §2).

## Acceptance (Phase 1 done when)
Start a lesson → hear explanation with synchronized visuals (never audio-first) → interrupt naturally
→ get an answer → lesson resumes losslessly. State dies with the session. Chrome only.
