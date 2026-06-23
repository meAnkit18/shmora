import type { SessionState } from '../../../shared/types.js';
import type { SessionStore } from './sessionStore.js';

class MemoryStore implements SessionStore {
  private sessions = new Map<string, SessionState>();

  set(state: SessionState): void {
    this.sessions.set(state.sessionId, state);
  }

  get(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

// Single shared instance for the process.
export const sessionStore: SessionStore = new MemoryStore();
