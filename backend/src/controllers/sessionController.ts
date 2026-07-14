import type { TeacherSocket } from '../socket/gateway.js';
import type {
  CreateSessionPayload,
  NextStepPayload,
  InterruptPayload,
  ResumeSessionPayload,
  EndSessionPayload,
} from '../../../shared/types.js';
import {
  createSession,
  createScriptedSession,
  nextStep,
  interrupt,
  resumeSession,
  endSession,
  type TurnEmitter,
} from '../services/sessionService.js';

function emitError(socket: TeacherSocket, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Unexpected error';
  console.error('[controller]', message);
  socket.emit('error', { message });
}

function emitterFor(socket: TeacherSocket): TurnEmitter {
  return {
    created: (state) => socket.emit('session:created', state),
    turnStart: (turn) => socket.emit('turn:start', turn),
    segment: (segment) => socket.emit('lesson:segment', segment),
    turnEnd: (turn, state) =>
      socket.emit('turn:end', { turnId: turn.turnId, kind: turn.kind, state }),
    stateUpdate: (state) => socket.emit('state:update', state),
    complete: (state) => socket.emit('lesson:complete', state),
  };
}

/** Registers all session-related socket handlers for one connection. */
export function registerSessionHandlers(socket: TeacherSocket): void {
  const emitter = emitterFor(socket);

  socket.on('session:create', async ({ topic, courseId, lessonId }: CreateSessionPayload) => {
    try {
      if (courseId && lessonId) await createScriptedSession(courseId, lessonId, emitter);
      else await createSession(topic, emitter);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('session:resume', ({ sessionId }: ResumeSessionPayload) => {
    try {
      const { state, log } = resumeSession(sessionId);
      socket.emit('session:resumed', { state, log });
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('lesson:next', async ({ sessionId }: NextStepPayload) => {
    try {
      await nextStep(sessionId, emitter);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('user:interrupt', async ({ sessionId, question }: InterruptPayload) => {
    try {
      await interrupt(sessionId, question, emitter);
    } catch (err) {
      emitError(socket, err);
    }
  });

  socket.on('session:end', ({ sessionId }: EndSessionPayload) => {
    endSession(sessionId);
  });
}
