import type { Segment, VisualIntent } from '../../../shared/types.js';

/** A segment as parsed from the model — before the service stamps turnId/seq. */
export type SegmentDraft = Omit<Segment, 'turnId' | 'seq'>;

function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isStrArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === 'string');
}

/** Validate one visual intent; returns the intent or null if malformed. */
function validateIntent(raw: unknown): VisualIntent | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  switch (c.kind) {
    case 'title':
      return isStr(c.text) ? { kind: 'title', text: c.text } : null;
    case 'note':
      if (!isStr(c.text)) return null;
      return { kind: 'note', text: c.text, ...(isStr(c.id) ? { id: c.id } : {}) };
    case 'array':
      if (!isStr(c.id) || !isStrArray(c.cells)) return null;
      return {
        kind: 'array',
        id: c.id,
        cells: c.cells,
        ...(isStr(c.caption) ? { caption: c.caption } : {}),
      };
    case 'sequence':
      if (!isStr(c.id) || !isStrArray(c.items)) return null;
      return {
        kind: 'sequence',
        id: c.id,
        items: c.items,
        ...(isStr(c.caption) ? { caption: c.caption } : {}),
      };
    case 'pointer':
      if (!isStr(c.to)) return null;
      return { kind: 'pointer', to: c.to, ...(isStr(c.label) ? { label: c.label } : {}) };
    case 'highlight':
      if (!isStr(c.target)) return null;
      return {
        kind: 'highlight',
        target: c.target,
        ...(isStr(c.label) ? { label: c.label } : {}),
      };
    case 'update':
      if (!isStr(c.target) || typeof c.text !== 'string') return null;
      return { kind: 'update', target: c.target, text: c.text };
    // ---- teacher gestures (added) ----
    case 'circle':
      if (!isStr(c.target)) return null;
      return { kind: 'circle', target: c.target, ...(isStr(c.label) ? { label: c.label } : {}) };
    case 'underline':
      return isStr(c.target) ? { kind: 'underline', target: c.target } : null;
    case 'strike':
      return isStr(c.target) ? { kind: 'strike', target: c.target } : null;
    case 'mark':
      if (!isStr(c.target) || (c.symbol !== 'check' && c.symbol !== 'cross')) return null;
      return { kind: 'mark', target: c.target, symbol: c.symbol };
    case 'connect':
      if (!isStr(c.from) || !isStr(c.to)) return null;
      return {
        kind: 'connect',
        from: c.from,
        to: c.to,
        ...(isStr(c.label) ? { label: c.label } : {}),
      };
    case 'erase':
      return isStr(c.target) ? { kind: 'erase', target: c.target } : null;
    default:
      return null;
  }
}

/** Validate a parsed object into a SegmentDraft; drops malformed intents. */
export function validateSegment(raw: unknown, fallbackId: string): SegmentDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.speech !== 'string') return null;
  const id = typeof s.id === 'string' && s.id ? s.id : fallbackId;
  const visualsRaw = Array.isArray(s.visuals) ? s.visuals : [];
  const visuals: VisualIntent[] = [];
  for (const v of visualsRaw) {
    const intent = validateIntent(v);
    if (intent) visuals.push(intent);
  }
  return { id, visuals, speech: s.speech };
}

export interface ExtractorOptions {
  onSegment: (segment: SegmentDraft) => void;
  /** If provided: the first object shaped {"plan":[...strings]} is routed here (fused create). */
  onPlan?: (steps: string[]) => void;
}

/**
 * Incrementally extracts complete top-level objects from a streaming JSON
 * array. Feed it content deltas; it emits each segment as soon as its closing
 * brace arrives. Tolerant of markdown fences and leading prose.
 */
export class SegmentExtractor {
  private buffer = '';
  private cursor = 0; // index of next unscanned char
  private started = false; // have we found the opening '['
  private count = 0;
  private planEmitted = false;

  constructor(private readonly opts: ExtractorOptions) {}

  push(delta: string): void {
    this.buffer += delta;
    this.scan();
  }

  /** Call when the stream ends; no-op safety hook. */
  end(): void {
    this.scan();
  }

  private handleParsed(parsed: unknown): void {
    // Fused create: first object may be the lesson plan.
    if (this.opts.onPlan && !this.planEmitted && parsed && typeof parsed === 'object') {
      const plan = (parsed as Record<string, unknown>).plan;
      if (isStrArray(plan)) {
        this.planEmitted = true;
        this.opts.onPlan(plan.map((s) => s.trim()).filter(Boolean));
        return;
      }
    }
    const seg = validateSegment(parsed, `seg-${this.count}`);
    if (seg) this.opts.onSegment(seg);
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
        this.handleParsed(JSON.parse(slice));
      } catch {
        // skip malformed object, keep going
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
