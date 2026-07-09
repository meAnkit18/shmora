import type { SessionState } from '../../../shared/types.js';
import { chat, streamChat, isAbortError } from '../ai/aiClient.js';
import { SegmentExtractor, type SegmentDraft } from '../ai/segmentParser.js';
import {
  planAndTeachSystemPrompt,
  planAndTeachUserPrompt,
  planSystemPrompt,
  planUserPrompt,
  teachSystemPrompt,
  teachUserPrompt,
  answerSystemPrompt,
  answerUserPrompt,
  closingSystemPrompt,
  closingUserPrompt,
  type PromptContext,
} from './prompts.js';

export interface GenOptions {
  signal?: AbortSignal;
  onSegment: (segment: SegmentDraft) => void;
}

/** Extract the first JSON array of strings from a possibly-fenced model reply. */
function parseStepList(raw: string): string[] | null {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;
    const steps = parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    return steps.length > 0 ? steps : null;
  } catch {
    return null;
  }
}

/** Fallback: plan-only call. Retries once on failure. */
export async function planLesson(topic: string, signal?: AbortSignal): Promise<string[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await chat(
      [
        { role: 'system', content: planSystemPrompt() },
        { role: 'user', content: planUserPrompt(topic) },
      ],
      { signal },
    );
    const steps = parseStepList(reply);
    if (steps) return steps;
  }
  throw new Error(`Failed to plan a lesson for topic: ${topic}`);
}

interface StreamSegmentsArgs {
  system: string;
  user: string;
  signal?: AbortSignal;
  onSegment: (segment: SegmentDraft) => void;
  onPlan?: (steps: string[]) => void;
}

/**
 * Streams segments through the SegmentExtractor. If the stream yields zero
 * valid segments (and was NOT aborted), retries once with a stricter nudge.
 */
async function streamSegments({
  system,
  user,
  signal,
  onSegment,
  onPlan,
}: StreamSegmentsArgs): Promise<number> {
  let emitted = 0;
  const run = async (extraNudge?: string) => {
    const extractor = new SegmentExtractor({
      onSegment: (seg) => {
        emitted++;
        onSegment(seg);
      },
      ...(onPlan ? { onPlan } : {}),
    });
    await streamChat({
      messages: [
        { role: 'system', content: system + (extraNudge ? `\n${extraNudge}` : '') },
        { role: 'user', content: user },
      ],
      // Reasoning models spend many tokens before content; budget for it.
      maxTokens: 6000,
      signal,
      onContentDelta: (delta) => extractor.push(delta),
    });
    extractor.end();
  };

  try {
    await run();
  } catch (err) {
    if (isAbortError(err)) return emitted; // deliberate cancellation, not a failure
    throw err;
  }
  if (emitted === 0 && !signal?.aborted) {
    await run('Your previous reply was invalid. Return ONLY a valid JSON array of segments.');
  }
  return emitted;
}

/**
 * Fused cold start: one streamed call that yields the plan first, then the
 * segments of step 1. onPlan fires as soon as the plan object closes — the
 * caller creates the session at that moment, long before generation finishes.
 */
export function planAndTeachFirstStep(args: {
  topic: string;
  signal?: AbortSignal;
  onPlan: (steps: string[]) => void;
  onSegment: (segment: SegmentDraft) => void;
}): Promise<number> {
  return streamSegments({
    system: planAndTeachSystemPrompt(),
    user: planAndTeachUserPrompt(args.topic),
    signal: args.signal,
    onSegment: args.onSegment,
    onPlan: args.onPlan,
  });
}

export function teachStep(
  state: SessionState,
  ctx: PromptContext,
  opts: GenOptions,
): Promise<number> {
  return streamSegments({
    system: teachSystemPrompt(),
    user: teachUserPrompt(state, ctx),
    signal: opts.signal,
    onSegment: opts.onSegment,
  });
}

export function answer(
  state: SessionState,
  ctx: PromptContext,
  question: string,
  opts: GenOptions,
): Promise<number> {
  return streamSegments({
    system: answerSystemPrompt(),
    user: answerUserPrompt(state, ctx, question),
    signal: opts.signal,
    onSegment: opts.onSegment,
  });
}

export function closing(
  state: SessionState,
  ctx: PromptContext,
  opts: GenOptions,
): Promise<number> {
  return streamSegments({
    system: closingSystemPrompt(),
    user: closingUserPrompt(state, ctx),
    signal: opts.signal,
    onSegment: opts.onSegment,
  });
}
