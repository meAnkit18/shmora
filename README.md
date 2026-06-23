# Infinite Teacher — Phase 1 MVP

A real-time AI tutor that **teaches** (not chats): it speaks a lesson, draws on a live
whiteboard, lets you interrupt at any moment with a question, answers it, and resumes the
lesson from exactly where it stopped.

> Design and build docs live in `docs/design_phase1.md` and `docs/implementation_plan_phase1.md`.

## Architecture

```
Browser (React + tldraw)                         Backend (Node + Socket.IO)
  SpeechRecognition ─ voiceController ─┐            controllers ─ services ─ agents ─ AI client
  speechSynthesis  ─ ttsController     │  socket    (single Teacher Agent, OpenAI-compatible)
  tldraw           ─ TeachingCanvas    ├──────────▶ in-memory SessionStore (Redis-ready)
  SegmentPlayer (render → confirm → speak)
```

- **Single Teacher Agent.** Plans the lesson upfront, then teaches each step on demand.
- **AI never touches the canvas.** It emits structured draw commands (`text`, `rectangle`,
  `circle`, `arrow`, `line`); the frontend renders them on tldraw.
- **Visuals before audio.** Each teaching *segment* is rendered, confirmed painted, and only
  then spoken — audio never precedes its visuals (`SegmentPlayer`).
- **Interruption.** Speaking/typing a question stops TTS instantly, pauses lesson state on the
  server, streams an answer, then resumes the stashed remainder of the step.

## Requirements

- Node 20+ (built on Node 24)
- A Chromium browser (SpeechRecognition is Chromium-only). Typed questions work in any browser.

## Setup

```bash
cp .env.example .env      # then put your AI_API_KEY in .env  (gitignored)
```

`.env` keys:

| key | meaning |
|---|---|
| `PORT` | backend port (default 3001) |
| `AI_BASE_URL` | OpenAI-compatible base URL (default `https://opencode.ai/zen/v1`) |
| `AI_API_KEY` | your key |
| `AI_MODEL` | model id (default `north-mini-code-free`) — swap to any stronger model, no code change |
| `CLIENT_ORIGIN` | frontend origin for CORS (default `http://localhost:5173`) |

## Run

```bash
# terminal 1 — backend
cd backend && npm install && npm run dev

# terminal 2 — frontend
cd frontend && npm install && npm run dev
```

Open http://localhost:5173, type a topic (e.g. "Binary Search"), and click **Start lesson**.
Click **Start listening** to interrupt by voice, or type a question in the bottom-right box.

## Backend dev scripts (headless, no frontend needed)

```bash
cd backend
npm run try:ai     # exercises planLesson + teachStep + parser resilience against the live model
npm run try:flow   # drives a full create → teach → interrupt → resume → next flow over the socket
                   # (needs `npm run dev` running in another terminal)
```

## Frontend verification

`frontend/scripts/verify.mjs` drives the app in a headless browser and asserts the
visuals-before-audio invariant plus the interruption flow. It relies on dev-only `window`
hooks that are stripped from production builds.

## Notes

- The default free model spends significant time on internal reasoning before output, so each
  turn takes ~15–30s. The AI layer is a swappable OpenAI-compatible client — point `AI_MODEL`
  at a faster/stronger model to improve latency and teaching quality with zero code changes.
- Phase 1 has **no** accounts, persistence, avatars, multi-agent, or assessments. Session state
  lives in memory and dies when the session ends.
