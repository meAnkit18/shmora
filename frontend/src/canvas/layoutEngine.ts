import type { VisualIntent } from '@shared/types';
import type { GestureAction } from '../lib/speechMarks';
import { TeacherPointer } from './teacherPointer';

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
const GOOD = '#2f9e44';
const BAD = '#e03131';

const ROUGHNESS = 1.4; // hand-drawn feel for content (frames stay clean)

const DIM_PREV = 45; // opacity of the previous frame
const DIM_OLD = 25; // opacity of older frames

// ---- Animation timing ----
const REVEAL_MS = 220; // fade-in of one reveal group
const REVEAL_STAGGER_MS = 90; // delay between reveal groups (cell-by-cell feel)
const ERASE_MS = 320;
const LABEL_LINGER_MS = 1600;
const KEEP_FRAMES = 2; // active + previous frame only; older frames are wiped (teacher erases the board)

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
    roughness: ROUGHNESS,
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
  roughness?: number;
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
    roughness: opts.roughness ?? ROUGHNESS,
  };
}

function ellipseEl(id: string, x: number, y: number, w: number, h: number, stroke = INK, strokeWidth = 2): AnyEl {
  return {
    ...base(id),
    type: 'ellipse',
    x,
    y,
    width: Math.max(1, w),
    height: Math.max(1, h),
    strokeColor: stroke,
    strokeWidth,
    roughness: Math.min(2, ROUGHNESS + 0.4), // circles look best extra sketchy
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
    roughness: 0,
  };
}

function lineEl(id: string, x1: number, y1: number, x2: number, y2: number, color = INK, strokeWidth = 2): AnyEl {
  return {
    ...base(id),
    type: 'line',
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
    endArrowhead: null,
    strokeColor: color,
    strokeWidth,
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

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
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
 *
 * Two rendering paths:
 *  - apply(intents)          synchronous, instant (used for silent replay/hydrate)
 *  - applyAnimated(intents)  progressive: elements fade in group-by-group, the
 *                            teacher pointer glides, erases fade out (live teaching)
 */
export class BoardEngine {
  private api: ExcalidrawAPI | null = null;
  private frames: Frame[] = [];
  private registry = new Map<string, RegEntry>();
  private frameCount = 0;
  private uid = 0;

  private pointer = new TeacherPointer();
  private animMode = false; // while true, append() adds elements at opacity 0
  private newIds: string[] = []; // ids appended during the current animated intent

  setApi(api: ExcalidrawAPI): void {
    this.api = api;
    this.pointer.setApi(api);
  }

  get ready(): boolean {
    return this.api !== null;
  }

  reset(): void {
    this.frames = [];
    this.registry.clear();
    this.frameCount = 0;
    this.pointer.reset();
    this.api?.updateScene({ elements: [] });
  }

  /** Start a new frame for a turn. Wipes old frames, dims the previous one. */
  beginFrame(title: string | null): void {
    if (!this.api) return;
    this.pruneOldFrames();
    this.dimExistingFrames();

    const prev = this.frames[this.frames.length - 1];
    const y = prev ? prev.cursorY + FRAME_PAD + FRAME_GAP : FIRST_FRAME_Y;
    const key = `frame-${++this.frameCount}`;

    const els: AnyEl[] = [];
    const border = rectEl(`${key}-box`, FRAME_X, y, FRAME_W, FRAME_PAD * 2 + 12, {
      stroke: FRAME_STROKE,
      strokeWidth: 1,
      roughness: 0, // frames stay clean; only content is sketchy
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

  /**
   * A human teacher wipes the board: only the ACTIVE and PREVIOUS frames stay.
   * Older frames fade out and are removed, and their refs leave the registry
   * so gestures can never target ghosts.
   */
  private pruneOldFrames(): void {
    while (this.frames.length >= KEEP_FRAMES) {
      const old = this.frames.shift()!;
      const ids = [...old.elementIds];
      this.purgeRegistry(new Set(ids));
      void this.animateOpacity(ids, DIM_OLD, 0, 450).then(() => this.removeElements(ids));
    }
  }

  private purgeRegistry(removed: Set<string>): void {
    for (const [key, entry] of [...this.registry]) {
      if (entry.ids.length && entry.ids.every((id) => removed.has(id))) {
        this.registry.delete(key);
      }
    }
  }

  /** Instant render (hydrate/replay). Pointer intents become static arrows. */
  apply(intents: VisualIntent[]): void {
    if (!this.api) return;
    if (!this.frames.length) this.beginFrame(null);
    const frame = this.frames[this.frames.length - 1];
    for (const intent of intents) {
      this.applyOne(frame, intent);
    }
    this.syncFrameHeight(frame);
  }

  /** Live render: progressive reveal + gliding pointer. Resolves when done. */
  async applyAnimated(intents: VisualIntent[]): Promise<void> {
    if (!this.api) return;
    if (!this.frames.length) this.beginFrame(null);
    const frame = this.frames[this.frames.length - 1];

    for (const intent of intents) {
      if (intent.kind === 'pointer') {
        await this.pointTo(intent.to, intent.label);
        continue;
      }
      if (intent.kind === 'erase') {
        await this.eraseAnimated(intent.target);
        this.syncFrameHeight(frame);
        this.focusActiveFrame();
        continue;
      }
      this.animMode = true;
      this.newIds = [];
      this.applyOne(frame, intent);
      this.animMode = false;
      this.syncFrameHeight(frame);
      this.focusActiveFrame(); // camera follows: current work stays centered as the frame grows
      if (this.newIds.length) await this.revealNew(this.newIds);
    }
  }

  /**
   * Fire a gesture mid-speech (from an inline {point:ref} mark).
   * Fire-and-forget; silently ignores unknown refs.
   */
  gesture(action: GestureAction, ref: string): void {
    if (!this.api || !this.frames.length) return;
    if (!this.registry.has(ref)) return;
    const frame = this.frames[this.frames.length - 1];
    switch (action) {
      case 'point':
        void this.pointTo(ref);
        break;
      case 'highlight':
        this.renderHighlight(frame, ref);
        break;
      case 'circle':
        this.renderCircle(frame, ref);
        break;
      case 'underline':
        this.renderUnderline(frame, ref);
        break;
    }
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

  // ---- intent dispatch (shared by both paths) ----

  private applyOne(frame: Frame, intent: VisualIntent): void {
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
        this.renderPointerStatic(frame, intent.to, intent.label);
        break;
      case 'highlight':
        this.renderHighlight(frame, intent.target, intent.label);
        break;
      case 'update':
        this.renderUpdate(frame, intent.target, intent.text);
        break;
      case 'circle':
        this.renderCircle(frame, intent.target, intent.label);
        break;
      case 'underline':
        this.renderUnderline(frame, intent.target);
        break;
      case 'strike':
        this.renderStrike(frame, intent.target);
        break;
      case 'mark':
        this.renderMark(frame, intent.target, intent.symbol);
        break;
      case 'connect':
        this.renderConnect(frame, intent.from, intent.to, intent.label);
        break;
      case 'erase':
        this.eraseInstant(intent.target);
        break;
    }
  }

  // ---- animation primitives ----

  private animateOpacity(ids: string[], from: number, to: number, ms: number): Promise<void> {
    if (!this.api || !ids.length) return Promise.resolve();
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        const v = Math.round(from + (to - from) * easeOutCubic(t));
        this.mutate(new Set(ids), (el) => {
          el.opacity = v;
          return el;
        });
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  /**
   * Fade in freshly appended elements in small groups (~3 elements each).
   * Rows push (box, text, index/arrow) per cell in order, so groups of 3
   * naturally read as the teacher drawing cell after cell.
   */
  private revealNew(ids: string[]): Promise<void> {
    const groups: string[][] = [];
    for (let i = 0; i < ids.length; i += 3) groups.push(ids.slice(i, i + 3));
    const jobs = groups.map(
      (group, i) =>
        new Promise<void>((resolve) => {
          window.setTimeout(() => {
            void this.animateOpacity(group, 0, 100, REVEAL_MS).then(resolve);
          }, i * REVEAL_STAGGER_MS);
        }),
    );
    return Promise.all(jobs).then(() => undefined);
  }

  // ---- teacher pointer ----

  private async pointTo(ref: string, label?: string): Promise<void> {
    const target = this.registry.get(ref);
    const frame = this.frames[this.frames.length - 1];
    if (!target) {
      if (frame) this.renderNote(frame, `\u2192 ${label ?? ref}`);
      return;
    }
    const cx = target.bbox.x + target.bbox.w / 2;
    const top = target.bbox.y;
    // Pointing back at an OLDER frame: scroll it into view first (gaze follows hand).
    if (frame && this.api && target.bbox.y < frame.y) {
      const ids = new Set(target.ids);
      const els = this.api.getSceneElements().filter((e) => ids.has((e as AnyEl).id));
      if (els.length) this.api.scrollToContent(els, { animate: true });
    }
    await this.pointer.glideTo(cx, top - 10);
    if (label && frame) this.transientLabel(frame, cx + 26, top - 48, label);
  }

  /** Small accent label that lingers, fades, and removes itself. */
  private transientLabel(frame: Frame, x: number, y: number, text: string): void {
    const id = this.id('ptrlbl');
    const t = textEl(id, x, y, text, 16, ACCENT);
    frame.elementIds.push(id);
    this.append([t]);
    window.setTimeout(() => {
      void this.animateOpacity([id], 100, 0, 350).then(() => this.removeElements([id]));
    }, LABEL_LINGER_MS);
  }

  // ---- intent renderers ----

  private renderTitle(frame: Frame, text: string): void {
    if (frame.title) {
      if (frame.title.trim().toLowerCase() === text.trim().toLowerCase()) return; // duplicate
      this.renderNote(frame, text); // secondary heading -> subtitle
      return;
    }
    const t = textEl(this.id('title'), FRAME_X + FRAME_PAD, frame.cursorY, text, 24);
    frame.title = text;
    this.place(frame, [t], t.height as number);
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

  /** Static pointer arrow — used only on silent replay (hydrate). */
  private renderPointerStatic(frame: Frame, to: string, label?: string): void {
    const target = this.registry.get(to);
    if (!target) {
      this.renderNote(frame, `\u2192 ${label ?? to}`);
      return;
    }
    const cx = target.bbox.x + target.bbox.w / 2;
    const top = target.bbox.y;
    const els: AnyEl[] = [arrowEl(this.id('ptr'), cx + 42, top - 64, cx + 4, top - 8, ACCENT)];
    if (label) {
      els.push(textEl(this.id('ptrlbl'), cx + 48, top - 86, label, 16, ACCENT));
    }
    frame.elementIds.push(...els.map((e) => e.id as string));
    this.append(els);
  }

  private renderHighlight(frame: Frame, targetRef: string, label?: string): void {
    const target = this.registry.get(targetRef);
    if (!target) {
      this.renderNote(frame, `\u2605 ${label ?? targetRef}`);
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

  // ---- teacher gestures (added) ----

  private renderCircle(frame: Frame, targetRef: string, label?: string): void {
    const target = this.registry.get(targetRef);
    if (!target) {
      this.renderNote(frame, `\u25CB ${label ?? targetRef}`);
      return;
    }
    const pad = 10;
    const b = target.bbox;
    const els: AnyEl[] = [
      ellipseEl(this.id('circ'), b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, ACCENT, 2.5),
    ];
    if (label) {
      els.push(textEl(this.id('circlbl'), b.x - pad, b.y - pad - 28, label, 16, ACCENT));
    }
    frame.elementIds.push(...els.map((e) => e.id as string));
    this.append(els);
  }

  private renderUnderline(frame: Frame, targetRef: string): void {
    const target = this.registry.get(targetRef);
    if (!target) return;
    const b = target.bbox;
    const el = lineEl(this.id('ul'), b.x - 2, b.y + b.h + 5, b.x + b.w + 2, b.y + b.h + 8, ACCENT, 3);
    frame.elementIds.push(el.id as string);
    this.append([el]);
  }

  private renderStrike(frame: Frame, targetRef: string): void {
    const target = this.registry.get(targetRef);
    if (!target) return;
    const b = target.bbox;
    const el = lineEl(this.id('strike'), b.x - 6, b.y + b.h + 4, b.x + b.w + 6, b.y - 4, BAD, 3);
    frame.elementIds.push(el.id as string);
    this.append([el]);
  }

  private renderMark(frame: Frame, targetRef: string, symbol: 'check' | 'cross'): void {
    const target = this.registry.get(targetRef);
    if (!target) return;
    const b = target.bbox;
    const glyph = symbol === 'check' ? '\u2713' : '\u2717';
    const color = symbol === 'check' ? GOOD : BAD;
    const el = textEl(this.id('mark'), b.x + b.w + 10, b.y - 4, glyph, 28, color);
    frame.elementIds.push(el.id as string);
    this.append([el]);
  }

  private renderConnect(frame: Frame, fromRef: string, toRef: string, label?: string): void {
    const a = this.registry.get(fromRef);
    const b = this.registry.get(toRef);
    if (!a || !b) {
      if (label) this.renderNote(frame, label);
      return;
    }
    const acx = a.bbox.x + a.bbox.w / 2;
    const acy = a.bbox.y + a.bbox.h / 2;
    const bcx = b.bbox.x + b.bbox.w / 2;
    const bcy = b.bbox.y + b.bbox.h / 2;

    let x1: number, y1: number, x2: number, y2: number;
    if (Math.abs(bcx - acx) > Math.abs(bcy - acy)) {
      // mostly horizontal: side-to-side
      const leftToRight = bcx > acx;
      x1 = leftToRight ? a.bbox.x + a.bbox.w + 6 : a.bbox.x - 6;
      y1 = acy;
      x2 = leftToRight ? b.bbox.x - 6 : b.bbox.x + b.bbox.w + 6;
      y2 = bcy;
    } else {
      // mostly vertical: bottom-to-top
      const downward = bcy > acy;
      x1 = acx;
      y1 = downward ? a.bbox.y + a.bbox.h + 6 : a.bbox.y - 6;
      x2 = bcx;
      y2 = downward ? b.bbox.y - 6 : b.bbox.y + b.bbox.h + 6;
    }

    const els: AnyEl[] = [arrowEl(this.id('conn'), x1, y1, x2, y2, ACCENT)];
    if (label) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      els.push(textEl(this.id('connlbl'), mx + 8, my - 24, label, 15, SOFT));
    }
    frame.elementIds.push(...els.map((e) => e.id as string));
    this.append(els);
  }

  // ---- erase ----

  private collectEraseIds(targetRef: string): string[] {
    const entry = this.registry.get(targetRef);
    if (!entry) return [];
    const ids = [...entry.ids];
    if (entry.highlightId) ids.push(entry.highlightId, `${entry.highlightId}-lbl`);
    return ids;
  }

  private forgetRef(targetRef: string): void {
    for (const key of [...this.registry.keys()]) {
      if (key === targetRef || key.startsWith(`${targetRef}.`)) this.registry.delete(key);
    }
  }

  private eraseInstant(targetRef: string): void {
    const ids = this.collectEraseIds(targetRef);
    if (!ids.length) return;
    this.removeElements(ids);
    this.forgetRef(targetRef);
  }

  private async eraseAnimated(targetRef: string): Promise<void> {
    const ids = this.collectEraseIds(targetRef);
    if (!ids.length) return;
    await this.animateOpacity(ids, 100, 0, ERASE_MS);
    this.removeElements(ids);
    this.forgetRef(targetRef);
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
    if (this.animMode) {
      // Live path: elements enter invisible; revealNew() fades them in.
      for (const el of els) {
        el.opacity = 0;
        this.newIds.push(el.id as string);
      }
    }
    const current = this.api.getSceneElements();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.api.updateScene({ elements: [...current, ...els] as any[] });
    this.pointer.raise(); // the hand always stays on top
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

  /** Previous frame -> 45% opacity, older frames -> 25%: attention is unambiguous. */
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
