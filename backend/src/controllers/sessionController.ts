import type { TeacherSocket } from '../socket/gateway.js';
import type {
  CreateSessionPayload,
  NextStepPayload,
  InterruptPayload,
  EndSessionPayload,
} from '../../../shared/types.js';
import {
  createSession,
  teachCurrentStep,
  advanceToNextStep,
  pauseForInterrupt,
  answerAndResume,
  endSession,
  getSession,
} from '../services/sessionService.js';
import { isLessonComplete } from '../services/lessonFlow.js';

function emitError(socket: TeacherSocket, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Unexpected error';
  console.error('[controller]', message);
  socket.emit('error', { message });
}

/** Registers all session-related socket handlers for one connection. */
export function registerSessionHandlers(socket: TeacherSocket): void {
  socket.on('session:create', async ({ topic }: CreateSessionPayload) => {
    try {
      const state = await createSession(topic);
      socket.emit('session:created', state);
      await teachCurrentStep(state.sessionId, (seg) => socket.emit('lesson:segment', seg));
      const after = getSession(state.sessionId);
      socket.emit('lesson:step_complete', { sessionId: after.sessionId, state: after });
      socket.emit('state:update', after);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('lesson:next', async ({ sessionId }: NextStepPayload) => {
    try {
      const state = advanceToNextStep(sessionId);
      socket.emit('state:update', state);
      if (isLessonComplete(state)) {
        socket.emit('lesson:step_complete', { sessionId, state });
        return;
      }
      await teachCurrentStep(sessionId, (seg) => socket.emit('lesson:segment', seg));
      const after = getSession(sessionId);
      socket.emit('lesson:step_complete', { sessionId, state: after });
      socket.emit('state:update', after);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('user:interrupt', async ({ sessionId, question }: InterruptPayload) => {
    try {
      const paused = pauseForInterrupt(sessionId, question);
      socket.emit('state:update', paused); // UI shows paused=true immediately
      const resumed = await answerAndResume(sessionId, question, (seg) =>
        socket.emit('lesson:segment', seg),
      );
      socket.emit('state:update', resumed); // paused=false after answer
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('session:end', ({ sessionId }: EndSessionPayload) => {
    endSession(sessionId);
  });
}
