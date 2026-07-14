import { randomId } from '../builder/id';
import type { TimelineBlock, TimelineScene } from '@shared/timelineTypes';

export function newBlock(script = ''): TimelineBlock {
  return { id: randomId(), script, visuals: [] };
}

export function newScene(title = ''): TimelineScene {
  return { id: randomId(), title, blocks: [newBlock()] };
}

export function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function formatMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${String(sec).padStart(2, '0')}s` : `${sec}s`;
}
