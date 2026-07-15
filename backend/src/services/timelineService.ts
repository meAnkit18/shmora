import { randomUUID } from 'node:crypto';
import type { Course, CourseLesson } from '../../../shared/courseTypes.js';
import type {
  LessonTimeline,
  TimelineBlock,
  TimelineScene,
} from '../../../shared/timelineTypes.js';
import type {
  CanvasElement,
  CanvasFile,
  PointerSpec,
  SceneCanvas,
} from '../../../shared/canvasTypes.js';
import { courseStore } from '../state/courseStore.js';
import { getOwned, HttpError } from './courseService.js';
import { validateSegment } from '../ai/segmentParser.js';
import { chat } from '../ai/aiClient.js';
import { timelineGenSystemPrompt, timelineGenUserPrompt } from '../agents/prompts.js';

const MAX_SCENES = 30;
const MAX_BLOCKS_PER_SCENE = 40;
const MAX_HOLD_MS = 15_000;
const MAX_CANVAS_ELEMENTS = 500;
const MAX_CANVAS_FILES = 24;
const MAX_FILE_CHARS = 2_800_000;
const MAX_REVEAL_PER_BLOCK = 60;

export function findLesson(course: Course, lessonId: string): CourseLesson {
  for (const section of course.sections) {
    const lesson = section.lessons.find((l) => l.id === lessonId);
    if (lesson) return lesson;
  }
  throw new HttpError(404, 'Lesson not found in this course.');
}

function sanitizePointer(raw: unknown): PointerSpec | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as Record<string, unknown>;
  const out: PointerSpec = {};
  if (typeof p.elementId === 'string' && p.elementId) out.elementId = p.elementId.slice(0, 80);
  if (typeof p.x === 'number' && Number.isFinite(p.x)) out.x = p.x;
  if (typeof p.y === 'number' && Number.isFinite(p.y)) out.y = p.y;
  if (!out.elementId && (out.x === undefined || out.y === undefined)) return undefined;
  return out;
}

function sanitizeCanvas(raw: unknown): SceneCanvas | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const elements: CanvasElement[] = [];
  for (const e of (Array.isArray(c.elements) ? c.elements : []).slice(0, MAX_CANVAS_ELEMENTS)) {
    if (!e || typeof e !== 'object') continue;
    const el = e as CanvasElement;
    if (typeof el.id !== 'string' || !el.id || seen.has(el.id)) continue;
    if (el.isDeleted === true) continue;
    seen.add(el.id);
    elements.push(el);
  }
  if (!elements.length) return undefined;
  const files: Record<string, CanvasFile> = {};
  const filesRaw =
    c.files && typeof c.files === 'object' ? (c.files as Record<string, unknown>) : {};
  let count = 0;
  for (const [key, val] of Object.entries(filesRaw)) {
    if (count >= MAX_CANVAS_FILES) break;
    if (!val || typeof val !== 'object') continue;
    const f = val as Record<string, unknown>;
    if (typeof f.mimeType !== 'string' || !f.mimeType.startsWith('image/')) continue;
    if (typeof f.dataURL !== 'string' || !f.dataURL.startsWith('data:')) continue;
    if (f.dataURL.length > MAX_FILE_CHARS) continue;
    files[key.slice(0, 80)] = { mimeType: f.mimeType, dataURL: f.dataURL };
    count++;
  }
  return { elements, files };
}

function sanitizeBlock(raw: unknown, canvasIds: Set<string>): TimelineBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const speech = typeof b.script === 'string' ? b.script : b.speech;
  const seg = validateSegment({ id: b.id, visuals: b.visuals, speech }, randomUUID());
  if (!seg) return null;
  const script = seg.speech.slice(0, 600);
  const reveal = (Array.isArray(b.reveal) ? b.reveal : [])
    .filter((id): id is string => typeof id === 'string' && canvasIds.has(id))
    .slice(0, MAX_REVEAL_PER_BLOCK);
  const pointer = sanitizePointer(b.pointer);
  if (pointer?.elementId && !canvasIds.has(pointer.elementId)) delete pointer.elementId;
  const hasPointer = !!(pointer && (pointer.elementId || pointer.x !== undefined));
  if (!script.trim() && seg.visuals.length === 0 && reveal.length === 0 && !hasPointer) {
    return null;
  }
  const holdMs =
    typeof b.holdMs === 'number' && b.holdMs > 0
      ? Math.min(Math.round(b.holdMs), MAX_HOLD_MS)
      : undefined;
  return {
    id: seg.id,
    script,
    visuals: seg.visuals,
    ...(holdMs ? { holdMs } : {}),
    ...(reveal.length ? { reveal } : {}),
    ...(hasPointer ? { pointer } : {}),
  };
}

export function sanitizeTimeline(raw: unknown): LessonTimeline {
  const root = (raw ?? {}) as Record<string, unknown>;
  const scenesRaw = Array.isArray(raw) ? raw : Array.isArray(root.scenes) ? root.scenes : [];
  const scenes: TimelineScene[] = [];
  for (const s of scenesRaw.slice(0, MAX_SCENES)) {
    if (!s || typeof s !== 'object') continue;
    const sc = s as Record<string, unknown>;
    const canvas = sanitizeCanvas(sc.canvas);
    const canvasIds = new Set(canvas ? canvas.elements.map((e) => e.id) : []);
    const blocks: TimelineBlock[] = [];
    const blocksRaw = Array.isArray(sc.blocks) ? sc.blocks : [];
    for (const b of blocksRaw.slice(0, MAX_BLOCKS_PER_SCENE)) {
      const block = sanitizeBlock(b, canvasIds);
      if (block) blocks.push(block);
    }
    scenes.push({
      id: typeof sc.id === 'string' && sc.id ? sc.id : randomUUID(),
      title: typeof sc.title === 'string' ? sc.title.slice(0, 120) : '',
      blocks,
      ...(canvas ? { canvas } : {}),
      ...(sc.transition === 'fade' ? { transition: 'fade' as const } : {}),
    });
  }
  return { version: 2, scenes, updatedAt: Date.now() };
}

export function getTimeline(
  courseId: string,
  creatorId: string,
  lessonId: string,
): LessonTimeline {
  const course = getOwned(courseId, creatorId);
  const lesson = findLesson(course, lessonId);
  return lesson.timeline ?? { version: 2, scenes: [], updatedAt: 0 };
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
