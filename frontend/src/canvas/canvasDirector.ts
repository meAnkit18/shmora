import type { VisualIntent } from '@shared/types';
import type { CanvasBeat, CanvasFile, PointerSpec } from '@shared/canvasTypes';
import type { GestureAction } from '../lib/speechMarks';
import { TeacherPointer } from './teacherPointer';

export interface DirectorAPI {
  getSceneElements(): readonly any[];
  updateScene(data: { elements?: any[] }): void;
  scrollToContent(target?: unknown, opts?: { fitToContent?: boolean; animate?: boolean }): void;
  addFiles(files: any[]): void;
}

type AnyEl = Record<string, any>;

const INK = '#1e1e2e';
const ACCENT = '#e8590c';
const GOOD = '#2f9e44';
const BAD = '#e03131';
const HIGHLIGHT_BG = '#ffe066';

const REVEAL_MS = 260;
const REVEAL_STAGGER_MS = 80;
const FADE_SCENE_MS = 380;
const FLASH_LINGER_MS = 1600;
const NOTE_FONT = 16;
const MARGIN_GAP = 64;
const MARGIN_W = 300;

function rand(): number {
  return Math.trunc(Math.random() * 2 ** 31);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

let measureCtx: CanvasRenderingContext2D | null = null;

function textWidth(text: string, fontSize: number): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * fontSize * 0.6;
  measureCtx.font = `${fontSize}px sans-serif`;
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

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class CanvasDirector {
  private api: DirectorAPI | null = null;
  private pointer = new TeacherPointer();
  private _active = false;

  private authored = new Map<string, AnyEl>();
  private authoredOpacity = new Map<string, number>();
  private hidden = new Set<string>();
  private bounds: Bounds = { x: 0, y: 0, w: 900, h: 600 };
  private lastPointer: PointerSpec | null = null;

  private tempIds: string[] = [];
  private noteCursorY = 0;
  private uid = 0;

  setApi(api: DirectorAPI): void {
    this.api = api;
    this.pointer.setApi(api as any);
  }

  get active(): boolean {
    return this._active;
  }

  claim(): void {
    this._active = true;
  }

  clear(): void {
    this._active = false;
    this.authored.clear();
    this.authoredOpacity.clear();
    this.hidden.clear();
    this.tempIds = [];
    this.lastPointer = null;
    this.pointer.reset();
    this.api?.updateScene({ elements: [] });
  }

  async applyBeat(beat: CanvasBeat): Promise<void> {
    if (!this.api) return;
    if (beat.sceneStart && beat.elements) await this.loadScene(beat, true);
    await this.reveal(beat.reveal);
    if (beat.pointer) {
      this.lastPointer = beat.pointer;
      await this.glide(beat.pointer);
    }
  }

  applyBeatInstant(beat: CanvasBeat): void {
    if (!this.api) return;
    if (beat.sceneStart && beat.elements) void this.loadScene(beat, false);
    const shown = beat.reveal.filter((id) => this.hidden.has(id));
    for (const id of shown) this.hidden.delete(id);
    this.mutate(new Set(shown), (el) => {
      el.opacity = this.authoredOpacity.get(el.id as string) ?? 100;
    });
    if (beat.pointer) this.lastPointer = beat.pointer;
  }

  async settle(): Promise<void> {
    this.focus();
    if (this.lastPointer) await this.glide(this.lastPointer);
  }

  focus(): void {
    if (!this.api || !this.authored.size) return;
    const ids = new Set(this.authored.keys());
    const els = this.api.getSceneElements().filter((e) => ids.has((e as AnyEl).id));
    if (els.length) this.api.scrollToContent(els, { fitToContent: true, animate: true });
  }

  beginAnswer(): void {
    this.noteCursorY = this.bounds.y;
  }

  async endAnswer(): Promise<void> {
    if (this.tempIds.length) {
      const ids = [...this.tempIds];
      this.tempIds = [];
      await this.animateOpacity(ids, () => 0, 280);
      this.remove(ids);
    }
    if (this.lastPointer) await this.glide(this.lastPointer);
  }

  async renderIntents(intents: VisualIntent[]): Promise<void> {
    if (!this.api) return;
    for (const intent of intents) {
      if (intent.kind === 'pointer') {
        const p = this.resolve({ elementId: intent.to.split('.')[0] });
        if (p) await this.pointer.glideTo(p.x, p.y);
        continue;
      }
      const added = this.renderIntent(intent);
      if (!added.length) continue;
      this.tempIds.push(...added.map((e) => e.id as string));
      await this.fadeIn(added);
    }
  }

  gesture(action: GestureAction, ref: string): void {
    if (!this.api) return;
    const b = this.bbox(ref);
    if (!b) return;
    switch (action) {
      case 'point':
        void this.pointer.glideTo(b.x + b.w / 2, b.y + b.h / 2);
        break;
      case 'highlight':
        this.flash(this.highlightEl(b));
        break;
      case 'circle':
        this.flash(this.circleEl(b));
        break;
      case 'underline':
        this.flash(this.underlineEl(b));
        break;
    }
  }

  private prepScene(beat: CanvasBeat): AnyEl[] {
    this.pointer.reset();
    const files = beat.files ?? {};
    const fileList = Object.entries(files).map(([id, f]) => {
      const file = f as CanvasFile;
      return { id, mimeType: file.mimeType, dataURL: file.dataURL, created: Date.now() };
    });
    if (fileList.length) this.api!.addFiles(fileList);

    this.authored.clear();
    this.authoredOpacity.clear();
    this.hidden = new Set(beat.initialHidden ?? []);
    this.tempIds = [];
    this.lastPointer = null;

    const els: AnyEl[] = [];
    for (const raw of beat.elements ?? []) {
      const el: AnyEl = { ...(raw as AnyEl) };
      el.updated = Date.now();
      el.locked = true;
      const opacity = typeof el.opacity === 'number' ? el.opacity : 100;
      this.authoredOpacity.set(el.id, opacity);
      if (this.hidden.has(el.id)) el.opacity = 0;
      this.authored.set(el.id, el);
      els.push(el);
    }
    this.bounds = this.computeBounds(els);
    this.noteCursorY = this.bounds.y;
    return els;
  }

  private async loadScene(beat: CanvasBeat, animate: boolean): Promise<void> {
    if (!this.api) return;
    const els = this.prepScene(beat);
    if (animate && beat.transition === 'fade') {
      const target = new Map(els.map((e) => [e.id as string, e.opacity as number]));
      this.api.updateScene({ elements: els.map((e) => ({ ...e, opacity: 0 })) });
      this.focus();
      const visible = els.filter((e) => !this.hidden.has(e.id)).map((e) => e.id as string);
      await this.animateOpacity(visible, (id) => target.get(id) ?? 100, FADE_SCENE_MS);
    } else {
      this.api.updateScene({ elements: els });
      this.focus();
    }
  }

  private async reveal(ids: string[]): Promise<void> {
    const targets = ids.filter((id) => this.hidden.has(id));
    if (!targets.length) return;
    for (const id of targets) this.hidden.delete(id);
    for (let i = 0; i < targets.length; i++) {
      const id = targets[i];
      void this.animateOpacity([id], () => this.authoredOpacity.get(id) ?? 100, REVEAL_MS);
      if (i < targets.length - 1) await this.sleep(REVEAL_STAGGER_MS);
    }
    await this.sleep(REVEAL_MS);
    this.pointer.raise();
  }

  private resolve(spec: PointerSpec): { x: number; y: number } | null {
    if (spec.elementId) {
      const b = this.bbox(spec.elementId);
      if (b) return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    }
    if (spec.x !== undefined && spec.y !== undefined) return { x: spec.x, y: spec.y };
    return null;
  }

  private async glide(spec: PointerSpec): Promise<void> {
    const p = this.resolve(spec);
    if (p) await this.pointer.glideTo(p.x, p.y);
  }

  private bbox(ref: string): Bounds | null {
    const id = ref.split('.')[0];
    const live = this.api
      ?.getSceneElements()
      .find((e) => (e as AnyEl).id === id) as AnyEl | undefined;
    const el = live ?? this.authored.get(id);
    if (!el) return null;
    return { x: el.x as number, y: el.y as number, w: el.width as number, h: el.height as number };
  }

  private renderIntent(intent: VisualIntent): AnyEl[] {
    switch (intent.kind) {
      case 'title':
        return this.marginNote(intent.text, 20);
      case 'note':
      case 'update':
        return this.marginNote(intent.text, NOTE_FONT);
      case 'array':
        return this.marginNote(
          `[ ${intent.cells.join(' | ')} ]${intent.caption ? ` — ${intent.caption}` : ''}`,
          NOTE_FONT,
        );
      case 'sequence':
        return this.marginNote(
          `${intent.items.join(' → ')}${intent.caption ? ` — ${intent.caption}` : ''}`,
          NOTE_FONT,
        );
      case 'highlight': {
        const b = this.bbox(intent.target);
        return b ? [this.highlightEl(b)] : this.marginNote(intent.label ?? '', NOTE_FONT);
      }
      case 'circle': {
        const b = this.bbox(intent.target);
        return b ? [this.circleEl(b)] : [];
      }
      case 'underline': {
        const b = this.bbox(intent.target);
        return b ? [this.underlineEl(b)] : [];
      }
      case 'strike': {
        const b = this.bbox(intent.target);
        return b ? [this.lineEl(b.x, b.y + b.h / 2, b.w, 0, ACCENT, 3)] : [];
      }
      case 'mark': {
        const b = this.bbox(intent.target);
        if (!b) return [];
        const good = intent.symbol === 'check';
        return [this.textEl(good ? '✓' : '✗', b.x + b.w + 10, b.y - 4, 24, good ? GOOD : BAD)];
      }
      case 'connect': {
        const a = this.bbox(intent.from);
        const b = this.bbox(intent.to);
        if (!a || !b) return [];
        return [this.arrowEl(a.x + a.w / 2, a.y + a.h, b.x + b.w / 2, b.y)];
      }
      case 'erase': {
        const id = intent.target.split('.')[0];
        if (this.tempIds.includes(id)) {
          this.tempIds = this.tempIds.filter((t) => t !== id);
          this.remove([id]);
        }
        return [];
      }
      default:
        return [];
    }
  }

  private marginNote(text: string, fontSize: number): AnyEl[] {
    if (!text.trim()) return [];
    const x = this.bounds.x + this.bounds.w + MARGIN_GAP;
    const lines = wrapText(text, fontSize, MARGIN_W);
    const el = this.textEl(lines.join('\n'), x, this.noteCursorY, fontSize, ACCENT);
    this.noteCursorY += (el.height as number) + 18;
    return [el];
  }

  private async fadeIn(els: AnyEl[]): Promise<void> {
    const target = new Map(els.map((e) => [e.id as string, (e.opacity as number) ?? 100]));
    for (const el of els) el.opacity = 0;
    this.append(els);
    await this.animateOpacity([...target.keys()], (id) => target.get(id) ?? 100, REVEAL_MS);
  }

  private flash(el: AnyEl): void {
    this.append([el]);
    window.setTimeout(() => {
      void this.animateOpacity([el.id as string], () => 0, 300).then(() =>
        this.remove([el.id as string]),
      );
    }, FLASH_LINGER_MS);
  }

  private base(id: string): AnyEl {
    return {
      id,
      angle: 0,
      strokeColor: INK,
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
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
      locked: true,
      index: null,
    };
  }

  private nextId(prefix: string): string {
    return `qa-${prefix}-${++this.uid}-${rand().toString(36)}`;
  }

  private textEl(text: string, x: number, y: number, fontSize: number, color: string): AnyEl {
    const lines = text.split('\n');
    const width = Math.max(...lines.map((l) => textWidth(l, fontSize)), 10);
    const height = lines.length * fontSize * 1.25;
    return {
      ...this.base(this.nextId('text')),
      type: 'text',
      x,
      y,
      width,
      height,
      strokeColor: color,
      text,
      originalText: text,
      fontSize,
      fontFamily: 1,
      textAlign: 'left',
      verticalAlign: 'top',
      containerId: null,
      lineHeight: 1.25,
      autoResize: true,
    };
  }

  private highlightEl(b: Bounds): AnyEl {
    return {
      ...this.base(this.nextId('hl')),
      type: 'rectangle',
      x: b.x - 5,
      y: b.y - 5,
      width: b.w + 10,
      height: b.h + 10,
      strokeColor: 'transparent',
      backgroundColor: HIGHLIGHT_BG,
      fillStyle: 'solid',
      opacity: 40,
    };
  }

  private circleEl(b: Bounds): AnyEl {
    return {
      ...this.base(this.nextId('circle')),
      type: 'ellipse',
      x: b.x - 12,
      y: b.y - 12,
      width: b.w + 24,
      height: b.h + 24,
      strokeColor: ACCENT,
      strokeWidth: 2,
      roughness: 1.4,
    };
  }

  private underlineEl(b: Bounds): AnyEl {
    return this.lineEl(b.x, b.y + b.h + 6, b.w, 0, ACCENT, 3);
  }

  private lineEl(x: number, y: number, dx: number, dy: number, color: string, width: number): AnyEl {
    return {
      ...this.base(this.nextId('line')),
      type: 'line',
      x,
      y,
      width: Math.abs(dx),
      height: Math.abs(dy),
      strokeColor: color,
      strokeWidth: width,
      points: [
        [0, 0],
        [dx, dy],
      ],
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: null,
    };
  }

  private arrowEl(x1: number, y1: number, x2: number, y2: number): AnyEl {
    return {
      ...this.base(this.nextId('arrow')),
      type: 'arrow',
      x: x1,
      y: y1,
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      strokeColor: ACCENT,
      points: [
        [0, 0],
        [x2 - x1, y2 - y1],
      ],
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: 'arrow',
      elbowed: false,
    };
  }

  private append(els: AnyEl[]): void {
    if (!this.api || !els.length) return;
    const cur = this.api.getSceneElements() as AnyEl[];
    this.api.updateScene({ elements: [...cur, ...els] });
    this.pointer.raise();
  }

  private remove(ids: string[]): void {
    if (!this.api || !ids.length) return;
    const set = new Set(ids);
    const next = (this.api.getSceneElements() as AnyEl[]).filter((e) => !set.has(e.id));
    this.api.updateScene({ elements: next });
  }

  private mutate(ids: Set<string>, fn: (el: AnyEl) => void): void {
    if (!this.api || !ids.size) return;
    const next = (this.api.getSceneElements() as AnyEl[]).map((e) => {
      if (!ids.has(e.id)) return e;
      const copy = { ...e };
      fn(copy);
      copy.version = (copy.version ?? 1) + 1;
      copy.versionNonce = rand();
      copy.updated = Date.now();
      return copy;
    });
    this.api.updateScene({ elements: next });
  }

  private animateOpacity(ids: string[], target: (id: string) => number, ms: number): Promise<void> {
    if (!this.api || !ids.length) return Promise.resolve();
    const set = new Set(ids);
    const from = new Map<string, number>();
    for (const e of this.api.getSceneElements() as AnyEl[]) {
      if (set.has(e.id)) from.set(e.id, (e.opacity as number) ?? 100);
    }
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        const k = easeOutCubic(t);
        this.mutate(set, (el) => {
          const f = from.get(el.id as string) ?? 0;
          el.opacity = Math.round(f + (target(el.id as string) - f) * k);
        });
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  private computeBounds(els: AnyEl[]): Bounds {
    if (!els.length) return { x: 0, y: 0, w: 900, h: 600 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of els) {
      minX = Math.min(minX, el.x as number);
      minY = Math.min(minY, el.y as number);
      maxX = Math.max(maxX, (el.x as number) + ((el.width as number) || 0));
      maxY = Math.max(maxY, (el.y as number) + ((el.height as number) || 0));
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
