import type { DrawCommand } from '@shared/types';

// Local interface covering only the Excalidraw API methods we actually call.
// Avoids fragile deep-path type imports from @excalidraw/excalidraw internals.
export interface ExcalidrawAPI {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSceneElements(): readonly any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateScene(data: { elements?: any[] }): void;
  scrollToContent(target?: unknown, opts?: { fitToContent?: boolean; animate?: boolean }): void;
}

// Logical coordinate space from the AI is 0..1000 on both axes.
// We pass those coordinates directly to Excalidraw and let scrollToContent fit them.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = Record<string, any>;

function base(id: string): AnyEl {
  return {
    id,
    angle: 0,
    strokeColor: '#1e1e2e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: Math.trunc(Math.random() * 2 ** 31),
    version: 1,
    versionNonce: Math.trunc(Math.random() * 2 ** 31),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    index: null,
  };
}

function textEl(id: string, x: number, y: number, text: string, fontSize = 20): AnyEl {
  return {
    ...base(id),
    type: 'text',
    x,
    y,
    width: 200,
    height: fontSize * 1.5,
    text,
    originalText: text,
    fontSize,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    autoResize: true,
    lineHeight: 1.25,
  };
}

function buildElement(cmd: DrawCommand): AnyEl[] {
  switch (cmd.type) {
    case 'text':
      return [textEl(cmd.id, cmd.x, cmd.y, cmd.content)];

    case 'rectangle': {
      const els: AnyEl[] = [{ ...base(cmd.id), type: 'rectangle', x: cmd.x, y: cmd.y, width: Math.max(1, cmd.w), height: Math.max(1, cmd.h) }];
      if (cmd.label) els.push(textEl(`${cmd.id}_lbl`, cmd.x + cmd.w / 2 - 50, cmd.y + cmd.h / 2 - 10, cmd.label, 16));
      return els;
    }

    case 'circle': {
      const els: AnyEl[] = [{ ...base(cmd.id), type: 'ellipse', x: cmd.x - cmd.r, y: cmd.y - cmd.r, width: Math.max(1, cmd.r * 2), height: Math.max(1, cmd.r * 2) }];
      if (cmd.label) els.push(textEl(`${cmd.id}_lbl`, cmd.x - 50, cmd.y - 10, cmd.label, 16));
      return els;
    }

    case 'arrow': {
      const els: AnyEl[] = [{
        ...base(cmd.id),
        type: 'arrow',
        x: cmd.x1,
        y: cmd.y1,
        width: Math.abs(cmd.x2 - cmd.x1),
        height: Math.abs(cmd.y2 - cmd.y1),
        points: [[0, 0], [cmd.x2 - cmd.x1, cmd.y2 - cmd.y1]],
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: 'arrow',
      }];
      if (cmd.label) els.push(textEl(`${cmd.id}_lbl`, (cmd.x1 + cmd.x2) / 2 - 50, (cmd.y1 + cmd.y2) / 2 - 10, cmd.label, 16));
      return els;
    }

    case 'line':
      return [{
        ...base(cmd.id),
        type: 'line',
        x: cmd.x1,
        y: cmd.y1,
        width: Math.abs(cmd.x2 - cmd.x1),
        height: Math.abs(cmd.y2 - cmd.y1),
        points: [[0, 0], [cmd.x2 - cmd.x1, cmd.y2 - cmd.y1]],
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: null,
      }];

    default:
      return [];
  }
}

/** Render a batch of draw commands onto the Excalidraw canvas, then fit to content. */
export function executeDrawCommands(api: ExcalidrawAPI, commands: DrawCommand[]): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newEls = commands.flatMap(buildElement) as any[];
  if (newEls.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = api.getSceneElements() as any[];
  api.updateScene({ elements: [...current, ...newEls] });
  api.scrollToContent(undefined, { fitToContent: true, animate: true });
}

/** Clear every shape on the canvas (used when starting a new lesson). */
export function clearCanvas(api: ExcalidrawAPI): void {
  api.updateScene({ elements: [] });
}
