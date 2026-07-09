// The teacher's "hand": a single orange chalk cursor that GLIDES to targets and
// taps them. Owns exactly two Excalidraw elements and always keeps them on top.
import type { ExcalidrawAPI } from './layoutEngine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = Record<string, any>;

const ACCENT = '#e8590c';
const TIP_ID = 'teacher-pointer-tip';
const STICK_ID = 'teacher-pointer-stick';

function rand(): number {
  return Math.trunc(Math.random() * 2 ** 31);
}

function baseEl(id: string): AnyEl {
  return {
    id,
    angle: 0,
    strokeColor: ACCENT,
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
    locked: true,
    index: null,
  };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class TeacherPointer {
  private api: ExcalidrawAPI | null = null;
  private x = 0;
  private y = 0;
  private present = false;
  private gen = 0; // a new glide cancels the previous one

  setApi(api: ExcalidrawAPI): void {
    this.api = api;
  }

  /** Forget position/presence (call together with a board reset). */
  reset(): void {
    this.gen++;
    this.present = false;
    if (!this.api) return;
    const next = this.api
      .getSceneElements()
      .filter((e) => (e as AnyEl).id !== TIP_ID && (e as AnyEl).id !== STICK_ID);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.api.updateScene({ elements: next as any[] });
  }

  /** Re-append on top of the scene (call after the board adds elements). */
  raise(): void {
    if (this.present) this.upsert(this.x, this.y);
  }

  /** Glide the tip to (x, y) with easing, then a small tap. Resolves when done. */
  async glideTo(x: number, y: number): Promise<void> {
    if (!this.api) return;
    const gen = ++this.gen;
    if (!this.present) {
      // First appearance: slide in from just below-right of the target.
      this.x = x + 140;
      this.y = y + 90;
      this.present = true;
    }
    const sx = this.x;
    const sy = this.y;
    const dist = Math.hypot(x - sx, y - sy);
    if (dist > 1) {
      const dur = Math.max(280, Math.min(750, dist * 0.9));
      await this.animate(dur, (t) => {
        const e = easeInOutCubic(t);
        this.x = sx + (x - sx) * e;
        this.y = sy + (y - sy) * e;
        this.upsert(this.x, this.y);
      }, gen);
    }
    if (gen !== this.gen) return;
    // Tap: a quick bounce toward the target and back.
    await this.animate(180, (t) => {
      const dy = Math.sin(t * Math.PI) * 6;
      this.upsert(this.x, this.y + dy);
    }, gen);
    if (gen === this.gen) this.upsert(this.x, this.y);
  }

  // ---- internals ----

  /** Tip sits at (x, y); the chalk stick leans up-right like a held pen. */
  private elements(x: number, y: number): AnyEl[] {
    const tip: AnyEl = {
      ...baseEl(TIP_ID),
      type: 'ellipse',
      x: x - 6,
      y: y - 6,
      width: 12,
      height: 12,
      backgroundColor: ACCENT,
    };
    const stick: AnyEl = {
      ...baseEl(STICK_ID),
      type: 'line',
      x: x + 5,
      y: y - 5,
      width: 24,
      height: 32,
      strokeWidth: 5,
      points: [
        [0, 0],
        [24, -32],
      ],
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: null,
    };
    return [tip, stick];
  }

  private upsert(x: number, y: number): void {
    if (!this.api) return;
    const others = this.api
      .getSceneElements()
      .filter((e) => (e as AnyEl).id !== TIP_ID && (e as AnyEl).id !== STICK_ID);
    // Re-appending at the end keeps the pointer above everything.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.api.updateScene({ elements: [...others, ...this.elements(x, y)] as any[] });
  }

  private animate(ms: number, tick: (t: number) => void, gen: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now: number) => {
        if (gen !== this.gen) return resolve(); // superseded
        const t = Math.min(1, (now - start) / ms);
        tick(t);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }
}
