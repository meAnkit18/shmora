export type CanvasElement = Record<string, unknown> & { id: string };

export interface CanvasFile {
  mimeType: string;
  dataURL: string;
}

export interface SceneCanvas {
  elements: CanvasElement[];
  files: Record<string, CanvasFile>;
}

export interface PointerSpec {
  elementId?: string;
  x?: number;
  y?: number;
}

export type SceneTransition = 'cut' | 'fade';

export interface CanvasBeat {
  sceneId: string;
  sceneStart: boolean;
  transition: SceneTransition;
  elements?: CanvasElement[];
  files?: Record<string, CanvasFile>;
  initialHidden?: string[];
  reveal: string[];
  pointer?: PointerSpec;
}

export function elementLabel(el: CanvasElement): string | null {
  const custom = el.customData as { label?: unknown } | undefined;
  if (custom && typeof custom.label === 'string' && custom.label.trim()) {
    return custom.label.trim();
  }
  const text = (el as { text?: unknown }).text;
  if (typeof text === 'string' && text.trim()) return text.trim().slice(0, 48);
  return null;
}

export function collectHidden(blocks: { reveal?: string[] }[]): string[] {
  const out = new Set<string>();
  for (const b of blocks) for (const id of b.reveal ?? []) out.add(id);
  return [...out];
}
