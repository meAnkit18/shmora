import type { VisualIntent } from '@shared/types';

// Local interface covering only the Excalidraw API methods we call.
export interface ExcalidrawAPI {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSceneElements(): readonly any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateScene(data: { elements?: any[] }): void;
  scrollToContent(target?: unknown, opts?: { fitToContent?: boolean; animate?: boolean }): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = Record<string, any>;

// ---- Layout constants (the ONLY place geometry policy lives) ----
const FRAME_X = 120;
const FRAME_W = 780;
const FRAME_PAD = 28;
const FRAME_GAP = 56;
const FIRST_FRAME_Y = 120;
const CONTENT_W = FRAME_W - FRAME_PAD * 2;
const BLOCK_GAP = 22;

const INK = '#1e1e2e';
const SOFT = '#868e96';
const FRAME_STROKE = '#d5d5de';
const ACCENT = '#e8590c';

const DIM_PREV = 45; // opacity of the previous frame
const DIM_OLD = 25; // opacity of older frames

// ---- Text measurement (deterministic; slightly generous so boxes never clip badly) ----
let measureCtx: CanvasRenderingContext2D | null = null;

function textWidth(text: string, fontSize: number): number {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  if (!measureCtx) return text.length * fontSize * 0.6;
  measureCtx.font = `${fontSize}px sans-serif`;
  // Excalidraw's hand-drawn font runs wider than sans-serif; pad by 15%.
  return measureCtx.measureText(text).width * 1.15;
}

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

// ---- Excalidraw element builders ----
function rand(): number {
  return Math.trunc(Math.random() * 2 ** 31);
}

function base(id: string): AnyEl {
  return {
    id,
    angle: 0,
    strokeColor: INK,
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
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
  };
}

interface RectOpts {
  stroke?: string;
  strokeWidth?: number;
}

function rectEl(id: string, x: number, y: number, w: number, h: number, opts: RectOpts = {}): AnyEl {
  return {
    ...base(id),
    type: 'rectangle',
    x,
    y,
    width: Math.max(1, w),
    height: Math.max(1, h),
    strokeColor: opts.stroke ?? INK,
    strokeWidth: opts.strokeWidth ?? 2,
  };
}

function textEl(id: string, x: number, y: number, text: string, fontSize: number, color = INK): AnyEl {
  const lines = text.split('\n');
  const width = Math.max(...lines.map((l) => textWidth(l, fontSize)), 1);
  const height = lines.length * fontSize * 1.25;
  return {
    ...base(id),
    type: 'text',
    x,
    y,
    width,
    height,
    text,
    originalText: text,
    fontSize,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    autoResize: false, // WE own the measured box; don't let Excalidraw re-measure it
    lineHeight: 1.25,
    strokeColor: color,
  };
}

function arrowEl(id: string, x1: number, y1: number, x2: number, y2: number, color = INK): AnyEl {
  return {
    ...base(id),
    type: 'arrow',
    x: x1,
    y: y1,
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: 'arrow',
    strokeColor: color,
  };
}

// ---- Registry + frames ----
interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RegEntry {
  ids: string[]; // every element belonging to this ref
  bbox: BBox;
  textId?: string; // the text element `update` should rewrite
  highlightId?: string; // current highlight rect (replaced on re-highlight)
}

interface Frame {
  key: string;
  title: string | null;
  y: number;
  cursorY: number; // next free y INSIDE the frame
  rectId: string; // the frame border rect (height grows with content)
  elementIds: string[]; // for dimming + camera focus
}

/**
 * BoardEngine — semantic intents in, deterministic geometry out.
 * One frame per turn, stacked vertically; content flows top-to-bottom
 * inside the active frame; overlap is impossible by construction.
 */
export class BoardEngine {
  private api: ExcalidrawAPI | null = null;
  private frames: Frame[] = [];
  private registry = new Map<string, RegEntry>();
  private frameCount = 0;
  private uid = 0;

  setApi(api: ExcalidrawAPI): void {
    this.api = api;
  }

  get ready(): boolean {
    return this.api !== null;
  }

  reset(): void {
    this.frames = [];
    this.registry.clear();
    this.frameCount = 0;
    this.api?.updateScene({ elements: [] });
  }

  /** Start a new frame for a turn. Dims all previous frames. */
  beginFrame(title: string | null): void {
    if (!this.api) return;
    this.dimExistingFrames();

    const prev = this.frames[this.frames.length - 1];
    const y = prev ? prev.cursorY + FRAME_PAD + FRAME_GAP : FIRST_FRAME_Y;
    const key = `frame-${++this.frameCount}`;

    const els: AnyEl[] = [];
    const border = rectEl(`${key}-box`, FRAME_X, y, FRAME_W, FRAME_PAD * 2 + 12, {
      stroke: FRAME_STROKE,
      strokeWidth: 1,
    });
    els.push(border);

    let cursorY = y + FRAME_PAD;
    if (title) {
      const t = textEl(`${key}-title`, FRAME_X + FRAME_PAD, cursorY, title, 24);
      els.push(t);
      cursorY += (t.height as number) + BLOCK_GAP;
    }

    const frame: Frame = {
      key,
      title,
      y,
      cursorY,
      rectId: border.id as string,
      elementIds: els.map((e) => e.id as string),
    };
    this.frames.push(frame);
    this.append(els);
    this.syncFrameHeight(frame);
  }

  /** Render a batch of semantic intents into the active frame. */
  apply(intents: VisualIntent[]): void {
    if (!this.api) return;
    if (!this.frames.length) this.beginFrame(null);
    const frame = this.frames[this.frames.length - 1];
    for (const intent of intents) {
      switch (intent.kind) {
        case 'title':
          this.renderTitle(frame, intent.text);
          break;
        case 'note':
          this.renderNote(frame, intent.text, intent.id);
          break;
        case 'array':
          this.renderRow(frame, intent.id, intent.cells, intent.caption, true);
          break;
        case 'sequence':
          this.renderRow(frame, intent.id, intent.items, intent.caption, false);
          break;
        case 'pointer':
          this.renderPointer(frame, intent.to, intent.label);
          break;
        case 'highlight':
          this.renderHighlight(frame, intent.target, intent.label);
          break;
        case 'update':
          this.renderUpdate(frame, intent.target, intent.text);
          break;
      }
    }
    this.syncFrameHeight(frame);
  }

  /** Camera policy: fit the ACTIVE frame only — never the whole ever-growing scene. */
  focusActiveFrame(): void {
    if (!this.api || !this.frames.length) return;
    const frame = this.frames[this.frames.length - 1];
    const ids = new Set(frame.elementIds);
    const els = this.api.getSceneElements().filter((e) => ids.has((e as AnyEl).id));
    if (els.length) {
      this.api.scrollToContent(els, { fitToContent: true, animate: true });
    }
  }

  // ---- intent renderers ----

  private renderTitle(frame: Frame, text: string): void {
    if (frame.title) {
      if (frame.title.trim().toLowerCase() === text.trim().toLowerCase()) return; // duplicate
      this.renderNote(frame, text); // secondary heading → subtitle
      return;
    }
    const t = textEl(this.id('title'), FRAME_X + FRAME_PAD, frame.cursorY, text, 24);
    frame.title = text;
    this.place(frame, [t], (t.height as number));
  }

  private renderNote(frame: Frame, text: string, ref?: string): void {
    const fontSize = 20;
    const lines = wrapText(text, fontSize, CONTENT_W);
    const t = textEl(this.id('note'), FRAME_X + FRAME_PAD, frame.cursorY, lines.join('\n'), fontSize);
    const bbox: BBox = { x: t.x, y: t.y, w: t.width, h: t.height };
    this.place(frame, [t], t.height as number);
    if (ref) this.registry.set(ref, { ids: [t.id as string], bbox, textId: t.id as string });
  }

  /** Shared renderer for `array` (adjacent boxes + index labels) and `sequence` (boxes + arrows). */
  private renderRow(
    frame: Frame,
    ref: string,
    labels: string[],
    caption: string | undefined,
    isArray: boolean,
  ): void {
    const n = labels.length;
    const cellH = 56;
    const gap = isArray ? 0 : 64;
    let fontSize = 18;

    let cellW = Math.max(
      isArray ? 56 : 90,
      ...labels.map((l) => textWidth(l, fontSize) + 24),
    );
    let total = n * cellW + (n - 1) * gap;
    if (total > CONTENT_W) {
      cellW = Math.max(40, Math.floor((CONTENT_W - (n - 1) * Math.min(gap, 36)) / n));
      total = n * cellW + (n - 1) * Math.min(gap, 36);
      fontSize = cellW < 60 ? 13 : 16;
    }
    const usedGap = total > CONTENT_W ? Math.min(gap, 36) : gap;

    const x0 = FRAME_X + FRAME_PAD;
    const y0 = frame.cursorY;
    const els: AnyEl[] = [];
    const allIds: string[] = [];

    for (let i = 0; i < n; i++) {
      const cx = x0 + i * (cellW + usedGap);
      const box = rectEl(this.id(`${ref}-c${i}`), cx, y0, cellW, cellH);
      const label = labels[i];
      const lw = Math.min(textWidth(label, fontSize), cellW - 8);
      const lx = cx + Math.max(4, (cellW - lw) / 2);
      const ly = y0 + (cellH - fontSize * 1.25) / 2;
      const txt = textEl(this.id(`${ref}-t${i}`), lx, ly, label, fontSize);
      els.push(box, txt);
      allIds.push(box.id as string, txt.id as string);

      if (isArray) {
        const idxTxt = textEl(this.id(`${ref}-i${i}`), cx + cellW / 2 - 5, y0 + cellH + 6, String(i), 12, SOFT);
        els.push(idxTxt);
        allIds.push(idxTxt.id as string);
      } else if (i < n - 1) {
        const ax1 = cx + cellW + 6;
        const ax2 = cx + cellW + usedGap - 6;
        const ay = y0 + cellH / 2;
        const arrow = arrowEl(this.id(`${ref}-a${i}`), ax1, ay, ax2, ay);
        els.push(arrow);
        allIds.push(arrow.id as string);
      }

      // Register each cell/item so highlight/update/pointer can target "ref.i".
      this.registry.set(`${ref}.${i}`, {
        ids: [box.id as string, txt.id as string],
        bbox: { x: cx, y: y0, w: cellW, h: cellH },
        textId: txt.id as string,
      });
    }

    let blockH = cellH + (isArray ? 24 : 0);
    if (caption) {
      const cap = textEl(this.id(`${ref}-cap`), x0, y0 + blockH + 8, caption, 16, SOFT);
      els.push(cap);
      allIds.push(cap.id as string);
      blockH += 8 + (cap.height as number);
    }

    this.registry.set(ref, {
      ids: allIds,
      bbox: { x: x0, y: y0, w: total, h: blockH },
    });
    this.place(frame, els, blockH);
  }

  private renderPointer(frame: Frame, to: string, label?: string): void {
    const target = this.registry.get(to);
    if (!target) {
      this.renderNote(frame, `→ ${label ?? to}`);
      return;
    }
    const cx = target.bbox.x + target.bbox.w / 2;
    const top = target.bbox.y;
    const els: AnyEl[] = [arrowEl(this.id('ptr'), cx + 42, top - 64, cx + 4, top - 8, ACCENT)];
    if (label) {
      els.push(textEl(this.id('ptrlbl'), cx + 48, top - 86, label, 16, ACCENT));
    }
    // Overlay: doesn't consume vertical space, but belongs to the active frame for dim/camera.
    frame.elementIds.push(...els.map((e) => e.id as string));
    this.append(els);
  }

  private renderHighlight(frame: Frame, targetRef: string, label?: string): void {
    const target = this.registry.get(targetRef);
    if (!target) {
      this.renderNote(frame, `★ ${label ?? targetRef}`);
      return;
    }
    // Re-highlighting replaces the previous highlight instead of stacking.
    if (target.highlightId) {
      this.removeElements([target.highlightId, `${target.highlightId}-lbl`]);
    }
    const pad = 6;
    const hid = this.id('hl');
    const els: AnyEl[] = [
      rectEl(hid, target.bbox.x - pad, target.bbox.y - pad, target.bbox.w + pad * 2, target.bbox.h + pad * 2, {
        stroke: ACCENT,
        strokeWidth: 3,
      }),
    ];
    if (label) {
      els.push(textEl(`${hid}-lbl`, target.bbox.x - pad, target.bbox.y - pad - 26, label, 16, ACCENT));
    }
    target.highlightId = hid;
    frame.elementIds.push(...els.map((e) => e.id as string));
    this.append(els);
  }

  private renderUpdate(frame: Frame, targetRef: string, text: string): void {
    const target = this.registry.get(targetRef);
    if (!target || !target.textId) {
      this.renderNote(frame, text);
      return;
    }
    const bbox = target.bbox;
    this.mutate(new Set([target.textId]), (el) => {
      const fontSize = (el.fontSize as number) ?? 16;
      const w = Math.min(textWidth(text, fontSize), bbox.w - 8);
      el.text = text;
      el.originalText = text;
      el.width = w;
      el.x = bbox.x + Math.max(4, (bbox.w - w) / 2); // re-center inside the cell
      return el;
    });
  }

  // ---- scene plumbing ----

  private id(prefix: string): string {
    return `${prefix}-${++this.uid}`;
  }

  /** Add a block at the frame cursor, advance the cursor, track ownership. */
  private place(frame: Frame, els: AnyEl[], blockHeight: number): void {
    frame.elementIds.push(...els.map((e) => e.id as string));
    frame.cursorY += blockHeight + BLOCK_GAP;
    this.append(els);
  }

  private append(els: AnyEl[]): void {
    if (!this.api || !els.length) return;
    const current = this.api.getSceneElements();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.api.updateScene({ elements: [...current, ...els] as any[] });
  }

  private mutate(ids: Set<string>, fn: (el: AnyEl) => AnyEl): void {
    if (!this.api) return;
    const next = this.api.getSceneElements().map((el) => {
      const e = el as AnyEl;
      if (!ids.has(e.id)) return el;
      const copy = fn({ ...e });
      copy.version = ((copy.version as number) ?? 1) + 1;
      copy.versionNonce = rand();
      copy.updated = Date.now();
      return copy;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.api.updateScene({ elements: next as any[] });
  }

  private removeElements(ids: string[]): void {
    if (!this.api) return;
    const drop = new Set(ids);
    const next = this.api.getSceneElements().filter((el) => !drop.has((el as AnyEl).id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.api.updateScene({ elements: next as any[] });
  }

  /** Grow the frame border to wrap its content. */
  private syncFrameHeight(frame: Frame): void {
    const height = Math.max(FRAME_PAD * 2 + 12, frame.cursorY - frame.y - BLOCK_GAP + FRAME_PAD);
    this.mutate(new Set([frame.rectId]), (el) => {
      el.height = height;
      return el;
    });
  }

  /** Previous frame → 45% opacity, older frames → 25%: attention is unambiguous. */
  private dimExistingFrames(): void {
    for (let i = 0; i < this.frames.length; i++) {
      const opacity = i === this.frames.length - 1 ? DIM_PREV : DIM_OLD;
      this.mutate(new Set(this.frames[i].elementIds), (el) => {
        el.opacity = opacity;
        return el;
      });
    }
  }
}
