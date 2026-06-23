import type { SessionState } from '../../../shared/types.js';

// Abstraction so the in-memory store can be swapped for Redis later.
export interface SessionStore {
  set(state: SessionState): void;
  get(sessionId: string): SessionState | undefined;
  delete(sessionId: string): void;
}
