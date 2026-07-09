import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { Segment, TurnInfo, TurnRecord } from '@shared/types';
import type { GestureAction } from '../lib/speechMarks';
import { BoardEngine, type ExcalidrawAPI } from '../canvas/layoutEngine';

export interface CanvasHandle {
  /** Open a new frame for a turn (teach step / question / recap). */
  beginTurn: (turn: TurnInfo) => void;
  /** Render a segment's visuals progressively; resolve once the drawing finishes. */
  execute: (segment: Segment) => Promise<void>;
  /** Fire a mid-speech gesture (from an inline {point:ref} mark). */
  gesture: (action: GestureAction, ref: string) => void;
  /** Replay a whole session's visuals silently (resume after refresh). */
  hydrate: (log: TurnRecord[]) => Promise<void>;
  clear: () => void;
  isReady: () => boolean;
}

/** Wait for two animation frames — a reliable "visuals are painted" signal. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function frameTitle(turn: TurnInfo): string | null {
  switch (turn.kind) {
    case 'teach':
      return turn.stepTitle ?? (turn.stepIndex != null ? `Step ${turn.stepIndex + 1}` : null);
    case 'answer':
      return 'Question';
    case 'closing':
      return 'Recap';
  }
}

export const TeachingCanvas = forwardRef<CanvasHandle>((_props, ref) => {
  const engineRef = useRef<BoardEngine>(new BoardEngine());

  useImperativeHandle(ref, () => ({
    isReady: () => engineRef.current.ready,
    clear: () => engineRef.current.reset(),
    beginTurn: (turn: TurnInfo) => {
      engineRef.current.beginFrame(frameTitle(turn));
    },
    execute: async (segment: Segment) => {
      const engine = engineRef.current;
      if (!engine.ready) return;
      engine.focusActiveFrame(); // look at the board before drawing starts
      await engine.applyAnimated(segment.visuals); // progressive drawing + pointer glides
      engine.focusActiveFrame(); // re-fit: the frame may have grown
      await nextPaint();
    },
    gesture: (action: GestureAction, ref2: string) => {
      engineRef.current.gesture(action, ref2);
    },
    hydrate: async (log: TurnRecord[]) => {
      const engine = engineRef.current;
      if (!engine.ready) return;
      engine.reset();
      for (const record of log) {
        engine.beginFrame(frameTitle(record.turn));
        for (const segment of record.segments) {
          engine.apply(segment.visuals); // instant, silent replay
        }
      }
      engine.focusActiveFrame();
      await nextPaint();
    },
  }));

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={(api) => {
          engineRef.current.setApi(api as unknown as ExcalidrawAPI);
          // DEV-only verification hook (stripped from prod builds).
          if (import.meta.env.DEV) {
            (window as unknown as { __getShapeCount?: () => number }).__getShapeCount = () =>
              (api as unknown as ExcalidrawAPI).getSceneElements().length;
          }
        }}
        viewModeEnabled={true}
        initialData={{ appState: { viewBackgroundColor: '#ffffff' } }}
      />
    </div>
  );
});

TeachingCanvas.displayName = 'TeachingCanvas';
