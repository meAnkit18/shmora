import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { Segment, TurnInfo, TurnRecord } from '@shared/types';
import type { GestureAction } from '../lib/speechMarks';
import { BoardEngine, type ExcalidrawAPI } from '../canvas/layoutEngine';
import { CanvasDirector, type DirectorAPI } from '../canvas/canvasDirector';

export interface CanvasHandle {
  beginTurn: (turn: TurnInfo) => void;
  execute: (segment: Segment) => Promise<void>;
  gesture: (action: GestureAction, ref: string) => void;
  hydrate: (log: TurnRecord[]) => Promise<void>;
  endAnswer: () => Promise<void>;
  clear: () => void;
  isReady: () => boolean;
}

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
  const directorRef = useRef<CanvasDirector>(new CanvasDirector());
  const modeRef = useRef<'engine' | 'canvas'>('engine');
  const turnRef = useRef<TurnInfo | null>(null);
  const frameOpenedRef = useRef<string | null>(null);

  const toCanvasMode = () => {
    if (modeRef.current === 'canvas') return;
    engineRef.current.reset();
    directorRef.current.claim();
    modeRef.current = 'canvas';
  };

  const toEngineMode = () => {
    if (modeRef.current === 'engine') return;
    directorRef.current.clear();
    modeRef.current = 'engine';
  };

  const ensureFrame = (turn: TurnInfo | null) => {
    if (!turn || frameOpenedRef.current === turn.turnId) return;
    frameOpenedRef.current = turn.turnId;
    engineRef.current.beginFrame(frameTitle(turn));
  };

  useImperativeHandle(ref, () => ({
    isReady: () => engineRef.current.ready,
    clear: () => {
      directorRef.current.clear();
      engineRef.current.reset();
      modeRef.current = 'engine';
      frameOpenedRef.current = null;
      turnRef.current = null;
    },
    beginTurn: (turn: TurnInfo) => {
      turnRef.current = turn;
      if (modeRef.current === 'canvas' && turn.kind === 'answer') {
        directorRef.current.beginAnswer();
      }
    },
    execute: async (segment: Segment) => {
      const engine = engineRef.current;
      if (!engine.ready) return;

      if (segment.canvas) {
        toCanvasMode();
        await directorRef.current.applyBeat(segment.canvas);
        await nextPaint();
        return;
      }

      if (modeRef.current === 'canvas') {
        await directorRef.current.renderIntents(segment.visuals);
        await nextPaint();
        return;
      }

      ensureFrame(turnRef.current);
      engine.focusActiveFrame();
      await engine.applyAnimated(segment.visuals);
      engine.focusActiveFrame();
      await nextPaint();
    },
    gesture: (action: GestureAction, ref2: string) => {
      if (modeRef.current === 'canvas') directorRef.current.gesture(action, ref2);
      else engineRef.current.gesture(action, ref2);
    },
    endAnswer: async () => {
      if (modeRef.current === 'canvas') await directorRef.current.endAnswer();
    },
    hydrate: async (log: TurnRecord[]) => {
      const engine = engineRef.current;
      const director = directorRef.current;
      if (!engine.ready) return;
      director.clear();
      engine.reset();
      modeRef.current = 'engine';
      frameOpenedRef.current = null;

      for (const record of log) {
        const canvasSegs = record.segments.filter((s) => s.canvas);
        if (canvasSegs.length) {
          toCanvasMode();
          for (const seg of canvasSegs) director.applyBeatInstant(seg.canvas!);
          continue;
        }
        if (modeRef.current === 'canvas' as any) {
          if (record.turn.kind !== 'teach') continue;
          toEngineMode();
        }
        engine.beginFrame(frameTitle(record.turn));
        for (const segment of record.segments) {
          engine.apply(segment.visuals);
        }
      }

      if (modeRef.current === 'canvas' as any) await director.settle();
      else engine.focusActiveFrame();
      await nextPaint();
    },
  }));

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={(api) => {
          engineRef.current.setApi(api as unknown as ExcalidrawAPI);
          directorRef.current.setApi(api as unknown as DirectorAPI);
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
