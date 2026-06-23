import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { DrawCommand } from '@shared/types';
import { executeDrawCommands, clearCanvas, type ExcalidrawAPI } from '../canvas/drawCommands';

export interface CanvasHandle {
  /** Render commands, then resolve once the browser has painted them. */
  execute: (drawings: DrawCommand[]) => Promise<void>;
  clear: () => void;
  isReady: () => boolean;
}

/** Wait for two animation frames — a reliable "visuals are painted" signal. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

export const TeachingCanvas = forwardRef<CanvasHandle>((_props, ref) => {
  const apiRef = useRef<ExcalidrawAPI | null>(null);

  useImperativeHandle(ref, () => ({
    isReady: () => apiRef.current !== null,
    clear: () => {
      if (apiRef.current) clearCanvas(apiRef.current);
    },
    execute: async (drawings: DrawCommand[]) => {
      const api = apiRef.current;
      if (!api) return;
      executeDrawCommands(api, drawings);
      await nextPaint();
    },
  }));

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api;
          // DEV-only verification hook (stripped from prod builds).
          if (import.meta.env.DEV) {
            (window as unknown as { __getShapeCount?: () => number }).__getShapeCount =
              () => api.getSceneElements().length;
          }
        }}
        viewModeEnabled={true}
        initialData={{ appState: { viewBackgroundColor: '#ffffff' } }}
      />
    </div>
  );
});

TeachingCanvas.displayName = 'TeachingCanvas';
