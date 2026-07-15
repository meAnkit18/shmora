import type { VisualIntent } from './types.js';
import type { PointerSpec, SceneCanvas, SceneTransition } from './canvasTypes.js';

export interface TimelineBlock {
  id: string;
  script: string;
  visuals: VisualIntent[];
  holdMs?: number;
  reveal?: string[];
  pointer?: PointerSpec;
}

export interface TimelineScene {
  id: string;
  title: string;
  blocks: TimelineBlock[];
  canvas?: SceneCanvas;
  transition?: SceneTransition;
}

export interface LessonTimeline {
  version: 1 | 2;
  scenes: TimelineScene[];
  updatedAt: number;
}

export function emptyTimeline(): LessonTimeline {
  return { version: 2, scenes: [], updatedAt: 0 };
}

const WORDS_PER_MINUTE = 150;
const VISUAL_MS = 1100;
const MIN_BLOCK_MS = 1500;

const INLINE_MARK_RE = /\{(?:point|highlight|circle|underline):[^}]+\}/g;

export function stripInlineMarks(script: string): string {
  return script.replace(INLINE_MARK_RE, '');
}

export function estimateBlockMs(block: TimelineBlock): number {
  const words = stripInlineMarks(block.script).trim().split(/\s+/).filter(Boolean).length;
  const speechMs = (words / WORDS_PER_MINUTE) * 60_000;
  return Math.max(
    MIN_BLOCK_MS,
    Math.round(
      speechMs +
        block.visuals.length * VISUAL_MS +
        (block.reveal?.length ?? 0) * 600 +
        (block.holdMs ?? 0),
    ),
  );
}

export function estimateSceneMs(scene: TimelineScene): number {
  return scene.blocks.reduce((total, b) => total + estimateBlockMs(b), 0);
}

export function estimateTimelineMs(timeline: LessonTimeline): number {
  return timeline.scenes.reduce((total, s) => total + estimateSceneMs(s), 0);
}
