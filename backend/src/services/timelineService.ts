import { randomUUID } from 'node:crypto';
import type { Course, CourseLesson } from '../../../shared/courseTypes.js';
import type {
  LessonTimeline,
  TimelineBlock,
  TimelineScene,
} from '../../../shared/timelineTypes.js';
import { courseStore } from '../state/courseStore.js';
import { getOwned, HttpError } from './courseService.js';
import { validateSegment } from '../ai/segmentParser.js';
import { chat } from '../ai/aiClient.js';
import { timelineGenSystemPrompt, timelineGenUserPrompt } from '../agents/prompts.js';

const MAX_SCENES = 30;
const MAX_BLOCKS_PER_SCENE = 40;
const MAX_HOLD_MS = 15_000;

export function findLesson(course: Course, lessonId: string): CourseLesson {
  for (const section of course.sections) {
    const lesson = section.lessons.find((l) => l.id === lessonId);
    if (lesson) return lesson;
  }
  throw new HttpError(404, 'Lesson not found in this course.');
}

function sanitizeBlock(raw: unknown): TimelineBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const speech = typeof b.script === 'string' ? b.script : b.speech;
  const seg = validateSegment({ id: b.id, visuals: b.visuals, speech }, randomUUID());
  if (!seg) return null;
  const script = seg.speech.slice(0, 600);
  if (!script.trim() && seg.visuals.length === 0) return null;
  const holdMs =
    typeof b.holdMs === 'number' && b.holdMs > 0
      ? Math.min(Math.round(b.holdMs), MAX_HOLD_MS)
      : undefined;
  return { id: seg.id, script, visuals: seg.visuals, ...(holdMs ? { holdMs } : {}) };
}

export function sanitizeTimeline(raw: unknown): LessonTimeline {
  const root = (raw ?? {}) as Record<string, unknown>;
  const scenesRaw = Array.isArray(raw) ? raw : Array.isArray(root.scenes) ? root.scenes : [];
  const scenes: TimelineScene[] = [];
  for (const s of scenesRaw.slice(0, MAX_SCENES)) {
    if (!s || typeof s !== 'object') continue;
    const sc = s as Record<string, unknown>;
    const blocks: TimelineBlock[] = [];
    const blocksRaw = Array.isArray(sc.blocks) ? sc.blocks : [];
    for (const b of blocksRaw.slice(0, MAX_BLOCKS_PER_SCENE)) {
      const block = sanitizeBlock(b);
      if (block) blocks.push(block);
    }
    scenes.push({
      id: typeof sc.id === 'string' && sc.id ? sc.id : randomUUID(),
      title: typeof sc.title === 'string' ? sc.title.slice(0, 120) : '',
      blocks,
    });
  }
  return { version: 1, scenes, updatedAt: Date.now() };
}

export function getTimeline(
  courseId: string,
  creatorId: string,
  lessonId: string,
): LessonTimeline {
  const course = getOwned(courseId, creatorId);
  const lesson = findLesson(course, lessonId);
  return lesson.timeline ?? { version: 1, scenes: [], updatedAt: 0 };
}

export function saveTimeline(
  courseId: string,
  creatorId: string,
  lessonId: string,
  raw: unknown,
): LessonTimeline {
  const course = getOwned(courseId, creatorId);
  if (course.status === 'archived') {
    throw new HttpError(409, 'Unarchive the course to edit it.');
  }
  const lesson = findLesson(course, lessonId);
  const timeline = sanitizeTimeline(raw);
  lesson.timeline = timeline;
  course.updatedAt = Date.now();
  courseStore.set(course);
  return timeline;
}

export async function generateTimeline(
  courseId: string,
  creatorId: string,
  lessonId: string,
): Promise<LessonTimeline> {
  const course = getOwned(courseId, creatorId);
  const lesson = findLesson(course, lessonId);

  const reply = await chat(
    [
      { role: 'system', content: timelineGenSystemPrompt() },
      { role: 'user', content: timelineGenUserPrompt(course, lesson) },
    ],
    { temperature: 0.5, maxTokens: 6000 },
  );

  const start = reply.indexOf('[');
  const end = reply.lastIndexOf(']');
  if (start === -1 || end <= start) {
    throw new HttpError(502, 'The AI returned an invalid timeline. Please try again.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    throw new HttpError(502, 'The AI returned an invalid timeline. Please try again.');
  }
  const timeline = sanitizeTimeline({ scenes: parsed });
  if (!timeline.scenes.some((s) => s.blocks.length > 0)) {
    throw new HttpError(502, 'The AI could not draft this lesson. Please try again.');
  }
  return timeline;
}
