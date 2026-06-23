import type { DrawCommand, Segment } from '../../../shared/types.js';

const ALLOWED: Record<string, true> = {
  text: true,
  rectangle: true,
  circle: true,
  arrow: true,
  line: true,
};

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Pick the first finite number among candidate keys (tolerates model aliases). */
function num(c: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    if (isNumber(c[k])) return c[k] as number;
  }
  return null;
}

/** Validate one draw command; returns the command or null if malformed. */
function validateDrawCommand(raw: unknown, idx: number): DrawCommand | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const type = c.type;
  if (typeof type !== 'string' || !ALLOWED[type]) return null;
  const id = typeof c.id === 'string' && c.id ? c.id : `cmd-${idx}-${type}`;

  switch (type) {
    case 'text':
      if (!isNumber(c.x) || !isNumber(c.y) || typeof c.content !== 'string') return null;
      return { type, id, x: c.x, y: c.y, content: c.content };
    case 'rectangle':
      if (!isNumber(c.x) || !isNumber(c.y) || !isNumber(c.w) || !isNumber(c.h)) return null;
      return {
        type,
        id,
        x: c.x,
        y: c.y,
        w: c.w,
        h: c.h,
        ...(typeof c.label === 'string' ? { label: c.label } : {}),
      };
    case 'circle':
      if (!isNumber(c.x) || !isNumber(c.y) || !isNumber(c.r)) return null;
      return {
        type,
        id,
        x: c.x,
        y: c.y,
        r: c.r,
        ...(typeof c.label === 'string' ? { label: c.label } : {}),
      };
    case 'arrow': {
      const x1 = num(c, 'x1', 'fromX', 'startX');
      const y1 = num(c, 'y1', 'fromY', 'startY');
      const x2 = num(c, 'x2', 'toX', 'endX');
      const y2 = num(c, 'y2', 'toY', 'endY');
      if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
      return {
        type,
        id,
        x1,
        y1,
        x2,
        y2,
        ...(typeof c.label === 'string' ? { label: c.label } : {}),
      };
    }
    case 'line': {
      const x1 = num(c, 'x1', 'fromX', 'startX');
      const y1 = num(c, 'y1', 'fromY', 'startY');
      const x2 = num(c, 'x2', 'toX', 'endX');
      const y2 = num(c, 'y2', 'toY', 'endY');
      if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
      return { type, id, x1, y1, x2, y2 };
    }
    default:
      return null;
  }
}

/** Validate a parsed object into a Segment; drops malformed draw commands. */
export function validateSegment(raw: unknown, fallbackId: string): Segment | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.speech !== 'string') return null;
  const id = typeof s.id === 'string' && s.id ? s.id : fallbackId;
  const drawingsRaw = Array.isArray(s.drawings) ? s.drawings : [];
  const drawings: DrawCommand[] = [];
  drawingsRaw.forEach((d, i) => {
    const cmd = validateDrawCommand(d, i);
    if (cmd) drawings.push(cmd);
  });
  return { id, drawings, speech: s.speech };
}

/**
 * Incrementally extracts complete top-level segment objects from a streaming
 * JSON array. Feed it content deltas; it emits each segment as soon as its
 * closing brace arrives. Tolerant of markdown fences and leading prose.
 */
export class SegmentExtractor {
  private buffer = '';
  private cursor = 0; // index of next unscanned char
  private started = false; // have we found the opening '['
  private count = 0;

  constructor(private readonly onSegment: (segment: Segment) => void) {}

  push(delta: string): void {
    this.buffer += delta;
    this.scan();
  }

  /** Call when the stream ends; no-op safety hook. */
  end(): void {
    this.scan();
  }

  private scan(): void {
    if (!this.started) {
      const open = this.buffer.indexOf('[', this.cursor);
      if (open === -1) return;
      this.cursor = open + 1;
      this.started = true;
    }

    while (this.cursor < this.buffer.length) {
      // skip whitespace and commas between objects
      while (this.cursor < this.buffer.length) {
        const ch = this.buffer[this.cursor];
        if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === ',') {
          this.cursor++;
        } else {
          break;
        }
      }
      if (this.cursor >= this.buffer.length) return;
      if (this.buffer[this.cursor] === ']') return; // array finished

      if (this.buffer[this.cursor] !== '{') {
        // unexpected char; skip it to stay resilient
        this.cursor++;
        continue;
      }

      const end = this.findObjectEnd(this.cursor);
      if (end === -1) return; // object not fully streamed yet

      const slice = this.buffer.slice(this.cursor, end + 1);
      this.cursor = end + 1;
      this.count++;
      try {
        const parsed = JSON.parse(slice);
        const seg = validateSegment(parsed, `seg-${this.count}`);
        if (seg) this.onSegment(seg);
      } catch {
        // skip malformed segment, keep going
      }
    }
  }

  /** Returns index of the matching closing brace for the object starting at `start`, or -1. */
  private findObjectEnd(start: number): number {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }
}
