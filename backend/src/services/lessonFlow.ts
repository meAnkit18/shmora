import type { SessionState, Message } from '../../../shared/types.js';

/** Pure state transitions over SessionState. No I/O, no AI calls. */

export function addMessage(state: SessionState, role: Message['role'], text: string): void {
  state.conversationHistory.push({ role, text, ts: Date.now() });
}

export function pause(state: SessionState, reason: string): void {
  state.paused = true;
  state.pausedReason = reason;
}

export function resume(state: SessionState): void {
  state.paused = false;
  state.pausedReason = undefined;
}

export function isLessonComplete(state: SessionState): boolean {
  return state.currentStep >= state.steps.length;
}

/**
 * Mark the current step completed and move to the next.
 * Keeps completedSteps / pendingSteps in sync with currentStep.
 */
export function advanceStep(state: SessionState): void {
  if (isLessonComplete(state)) return;
  const finished = state.steps[state.currentStep];
  if (finished && !state.completedSteps.includes(finished)) {
    state.completedSteps.push(finished);
  }
  state.currentStep += 1;
  state.pendingSteps = state.steps.slice(state.currentStep + 1);
}
