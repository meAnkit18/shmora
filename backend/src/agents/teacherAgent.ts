import type { SessionState, Segment } from '../../../shared/types.js';
import { chat, streamChat } from '../ai/aiClient.js';
import { SegmentExtractor } from '../ai/segmentParser.js';
import {
  planSystemPrompt,
  planUserPrompt,
  teachSystemPrompt,
  teachUserPrompt,
  answerSystemPrompt,
  answerUserPrompt,
} from './prompts.js';

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

/** Plan an ordered lesson step list for a topic. Retries once on failure. */
export async function planLesson(topic: string): Promise<string[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await chat([
      { role: 'system', content: planSystemPrompt() },
      { role: 'user', content: planUserPrompt(topic) },
    ]);
    const steps = parseStepList(reply);
    if (steps) return steps;
  }
  throw new Error(`Failed to plan a lesson for topic: ${topic}`);
}

interface StreamSegments {
  system: string;
  user: string;
  onSegment: (segment: Segment) => void;
}

/**
 * Streams teaching segments through the SegmentExtractor. If the stream yields
 * zero valid segments, retries once with a stricter nudge.
 */
async function streamSegments({ system, user, onSegment }: StreamSegments): Promise<number> {
  let emitted = 0;
  const run = async (extraNudge?: string) => {
    const extractor = new SegmentExtractor((seg) => {
      emitted++;
      onSegment(seg);
    });
    await streamChat({
      messages: [
        { role: 'system', content: system + (extraNudge ? `\n${extraNudge}` : '') },
        { role: 'user', content: user },
      ],
      // This model spends many tokens on reasoning before content; budget for it.
      maxTokens: 4000,
      onContentDelta: (delta) => extractor.push(delta),
    });
    extractor.end();
  };

  await run();
  if (emitted === 0) {
    await run('Your previous reply was invalid. Return ONLY a valid JSON array of segments.');
  }
  return emitted;
}

export function teachStep(
  state: SessionState,
  onSegment: (segment: Segment) => void,
): Promise<number> {
  return streamSegments({
    system: teachSystemPrompt(),
    user: teachUserPrompt(state),
    onSegment,
  });
}

export function answer(
  state: SessionState,
  question: string,
  onSegment: (segment: Segment) => void,
): Promise<number> {
  return streamSegments({
    system: answerSystemPrompt(),
    user: answerUserPrompt(state, question),
    onSegment,
  });
}
