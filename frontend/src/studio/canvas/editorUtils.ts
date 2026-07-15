import { randomId } from '../builder/id';
import type { TimelineBlock, TimelineScene } from '@shared/timelineTypes';

export type AnyEl = Record<string, any>;

export function newBeat(script = ''): TimelineBlock {
  return { id: randomId(), script, visuals: [] };
}

export function newScene(title = ''): TimelineScene {
  return { id: randomId(), title, blocks: [newBeat()], transition: 'cut' };
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

export function displayLabel(el: AnyEl): string {
  const custom = el.customData as { label?: unknown } | undefined;
  if (custom && typeof custom.label === 'string' && custom.label.trim()) {
    return custom.label.trim();
  }
  if (typeof el.text === 'string' && el.text.trim()) return el.text.trim().slice(0, 32);
  return String(el.type ?? 'element');
}

function rand(): number {
  return Math.trunc(Math.random() * 2 ** 31);
}

export function imageElement(
  fileId: string,
  x: number,
  y: number,
  w: number,
  h: number,
): AnyEl {
  return {
    id: randomId(),
    type: 'image',
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: 'transparent',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: rand(),
    version: 1,
    versionNonce: rand(),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    index: null,
    fileId,
    status: 'saved',
    scale: [1, 1],
    crop: null,
  };
}
