import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, ChevronDown, ChevronUp, CloudOff, Crosshair, ExternalLink,
  Eye, Layers, Loader2, MousePointerClick, Play, Plus, Sigma, Sparkles, Trash2, X,
} from 'lucide-react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { LessonTimeline, TimelineBlock, TimelineScene } from '@shared/timelineTypes';
import { estimateBlockMs, estimateSceneMs, estimateTimelineMs } from '@shared/timelineTypes';
import { fetchStudioCourse } from '../../features/courses/api';
import {
  fetchTimeline, generateTimeline, saveTimeline as saveTimelineApi,
} from '../../features/timeline/api';
import { randomId } from '../builder/id';
import { TeacherPointer } from '../../canvas/teacherPointer';
import { EquationDialog } from './EquationDialog';
import {
  displayLabel, formatMs, imageElement, move, newBeat, newScene, type AnyEl,
} from './editorUtils';
import type { RenderedTex } from './mathTex';

type SaveState = 'saved' | 'saving' | 'error';

interface EditorAPI {
  getSceneElements(): readonly AnyEl[];
  getAppState(): any;
  getFiles(): Record<string, any>;
  updateScene(data: { elements?: AnyEl[] }): void;
  addFiles(files: any[]): void;
  scrollToContent(target?: unknown, opts?: { fitToContent?: boolean; animate?: boolean }): void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function CanvasEditorPage() {
  const { id, lessonId } = useParams<{ id: string; lessonId: string }>();
  const [lessonTitle, setLessonTitle] = useState('');
  const [timeline, setTimeline] = useState<LessonTimeline | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [beatId, setBeatId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [generating, setGenerating] = useState(false);
  const [rehearsing, setRehearsing] = useState(false);
  const [pickingSpot, setPickingSpot] = useState(false);
  const [eqOpen, setEqOpen] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiRef = useRef<EditorAPI | null>(null);
  const timelineRef = useRef<LessonTimeline | null>(null);
  const sceneIndexRef = useRef(0);
  const beatIdRef = useRef<string | null>(null);
  const rehearsingRef = useRef(false);
  const pickingRef = useRef(false);
  const pointerDownRef = useRef(false);
  const loadingRef = useRef(0);
  const initializedRef = useRef(false);
  const lastSelKeyRef = useRef('');
  const saveTimer = useRef<number | null>(null);
  const captureTimer = useRef<number | null>(null);
  const dragBeat = useRef<number | null>(null);

  useEffect(() => { sceneIndexRef.current = sceneIndex; }, [sceneIndex]);
  useEffect(() => { beatIdRef.current = beatId; }, [beatId]);
  useEffect(() => { pickingRef.current = pickingSpot; }, [pickingSpot]);
  useEffect(() => { rehearsingRef.current = rehearsing; }, [rehearsing]);

  useEffect(() => {
    if (!id || !lessonId) return;
    let alive = true;
    Promise.all([fetchStudioCourse(id), fetchTimeline(id, lessonId)]).then(
      ([{ course }, tl]) => {
        if (!alive) return;
        for (const section of course.sections) {
          const lesson = section.lessons.find((l) => l.id === lessonId);
          if (lesson) setLessonTitle(lesson.title || 'Untitled lesson');
        }
        const withScene = tl.scenes.length ? tl : { ...tl, scenes: [newScene('Scene 1')] };
        timelineRef.current = withScene;
        setTimeline(withScene);
        setBeatId(withScene.scenes[0]?.blocks[0]?.id ?? null);
      },
      (err: Error) => alive && setError(err.message),
    );
    return () => { alive = false; };
  }, [id, lessonId]);

  const persist = useCallback(
    (next: LessonTimeline) => {
      timelineRef.current = next;
      setTimeline(next);
      setSaveState('saving');
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        if (!id || !lessonId) return;
        saveTimelineApi(id, lessonId, next).then(
          () => setSaveState('saved'),
          () => setSaveState('error'),
        );
      }, 600);
    },
    [id, lessonId],
  );

  const mutateTimeline = useCallback(
    (fn: (tl: LessonTimeline) => LessonTimeline) => {
      const tl = timelineRef.current;
      if (tl) persist(fn(tl));
    },
    [persist],
  );

  const captureNow = useCallback(() => {
    const api = apiRef.current;
    const tl = timelineRef.current;
    if (!api || !tl) return;
    const i = sceneIndexRef.current;
    const scene = tl.scenes[i];
    if (!scene) return;
    const elements = (api.getSceneElements() as AnyEl[])
      .filter((e) => !e.isDeleted)
      .map((e) => ({ ...e }));
    const used = new Set(
      elements.filter((e) => e.type === 'image').map((e) => String(e.fileId)),
    );
    const filesRaw = api.getFiles();
    const files: Record<string, { mimeType: string; dataURL: string }> = {};
    for (const [key, f] of Object.entries(filesRaw)) {
      if (used.has(key) && f && typeof f.dataURL === 'string') {
        files[key] = { mimeType: String(f.mimeType ?? 'image/png'), dataURL: f.dataURL };
      }
    }
    const ids = new Set(elements.map((e) => String(e.id)));
    const blocks = scene.blocks.map((b) => ({
      ...b,
      reveal: b.reveal?.filter((rid) => ids.has(rid)),
      pointer:
        b.pointer?.elementId && !ids.has(b.pointer.elementId) ? undefined : b.pointer,
    }));
    const canvas = elements.length ? { elements: elements as any, files } as any : undefined;
    mutateTimeline((cur) => ({
      ...cur,
      scenes: cur.scenes.map((s, j) => (j === i ? { ...s, blocks, canvas } : s)),
    }));
  }, [mutateTimeline]);

  const scheduleCapture = useCallback(() => {
    if (captureTimer.current) window.clearTimeout(captureTimer.current);
    captureTimer.current = window.setTimeout(() => {
      captureTimer.current = null;
      captureNow();
    }, 700);
  }, [captureNow]);

  const flushCapture = useCallback(() => {
    if (captureTimer.current) {
      window.clearTimeout(captureTimer.current);
      captureTimer.current = null;
    }
    captureNow();
  }, [captureNow]);

  const loadScene = useCallback((scene: TimelineScene | undefined) => {
    const api = apiRef.current;
    if (!api) return;
    loadingRef.current++;
    const els = (scene?.canvas?.elements ?? []).map((e) => ({ ...(e as AnyEl) }));
    const files = scene?.canvas?.files ?? {};
    const fileList = Object.entries(files).map(([fid, f]) => ({
      id: fid,
      mimeType: f.mimeType,
      dataURL: f.dataURL,
      created: Date.now(),
    }));
    if (fileList.length) api.addFiles(fileList);
    api.updateScene({ elements: els });
    if (els.length) api.scrollToContent(els, { fitToContent: true, animate: false });
    window.setTimeout(() => {
      loadingRef.current = Math.max(0, loadingRef.current - 1);
    }, 250);
  }, []);

  useEffect(() => {
    if (!apiReady || !timeline || initializedRef.current) return;
    initializedRef.current = true;
    loadScene(timeline.scenes[0]);
  }, [apiReady, timeline, loadScene]);

  const onCanvasChange = useCallback(
    (elements: readonly AnyEl[], appState: any) => {
      if (loadingRef.current > 0 || rehearsingRef.current) return;
      const selMap = (appState?.selectedElementIds ?? {}) as Record<string, boolean>;
      const sel = Object.keys(selMap).filter((k) => selMap[k]);
      const key = sel.join(',');
      if (key !== lastSelKeyRef.current) {
        lastSelKeyRef.current = key;
        setSelection(sel);
        if (sel.length === 1) {
          const el = elements.find((e) => e.id === sel[0]);
          const custom = el?.customData as { label?: unknown } | undefined;
          setLabelDraft(typeof custom?.label === 'string' ? custom.label : '');
        } else {
          setLabelDraft('');
        }
      }
      scheduleCapture();
    },
    [scheduleCapture],
  );

  const onPointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number }; button: 'down' | 'up' }) => {
      if (!pickingRef.current) return;
      if (payload.button === 'down' && !pointerDownRef.current) {
        pointerDownRef.current = true;
        const bid = beatIdRef.current;
        const i = sceneIndexRef.current;
        const { x, y } = payload.pointer;
        mutateTimeline((tl) => ({
          ...tl,
          scenes: tl.scenes.map((s, j) =>
            j === i
              ? {
                  ...s,
                  blocks: s.blocks.map((b) =>
                    b.id === bid
                      ? { ...b, pointer: { x: Math.round(x), y: Math.round(y) } }
                      : b,
                  ),
                }
              : s,
          ),
        }));
        setPickingSpot(false);
      }
      if (payload.button === 'up') pointerDownRef.current = false;
    },
    [mutateTimeline],
  );

  if (error) {
    return (
      <div className="grid h-screen place-items-center bg-canvas">
        <div className="text-center">
          <p className="text-body-md text-body">{error}</p>
          <Link
            to={`/studio/courses/${id}/edit`}
            className="mt-2 inline-block text-body-sm text-brand hover:underline"
          >
            Back to the course builder
          </Link>
        </div>
      </div>
    );
  }
  if (!timeline) {
    return (
      <div className="grid h-screen place-items-center bg-canvas text-body-sm text-fg-soft">
        Loading the canvas studio...
      </div>
    );
  }

  const sceneIdx = Math.min(sceneIndex, timeline.scenes.length - 1);
  const scene = timeline.scenes[sceneIdx];
  const beat = scene?.blocks.find((b) => b.id === beatId) ?? null;
  const sceneEls = scene?.canvas?.elements ?? [];
  const labelOf = (rid: string): string => {
    const el = sceneEls.find((e) => e.id === rid);
    return el ? displayLabel(el as AnyEl) : rid.slice(0, 8);
  };

  const selectScene = (i: number) => {
    if (i === sceneIdx || rehearsing) return;
    flushCapture();
    setSceneIndex(i);
    const target = timelineRef.current?.scenes[i];
    setBeatId(target?.blocks[0]?.id ?? null);
    loadScene(target);
  };

  const addScene = () => {
    flushCapture();
    const s = newScene(`Scene ${(timelineRef.current?.scenes.length ?? 0) + 1}`);
    mutateTimeline((tl) => ({ ...tl, scenes: [...tl.scenes, s] }));
    setSceneIndex((timelineRef.current?.scenes.length ?? 1) - 1);
    setBeatId(s.blocks[0]?.id ?? null);
    loadScene(s);
  };

  const deleteScene = (i: number) => {
    const tl = timelineRef.current;
    if (!tl || tl.scenes.length <= 1) return;
    if (!window.confirm('Delete this scene, its board, and all of its beats?')) return;
    const scenes = tl.scenes.filter((_, j) => j !== i);
    mutateTimeline((cur) => ({ ...cur, scenes }));
    const nextIdx = Math.max(0, Math.min(i, scenes.length - 1));
    setSceneIndex(nextIdx);
    setBeatId(scenes[nextIdx]?.blocks[0]?.id ?? null);
    loadScene(scenes[nextIdx]);
  };

  const moveScene = (i: number, dir: -1 | 1) => {
    flushCapture();
    mutateTimeline((tl) => ({ ...tl, scenes: move(tl.scenes, i, i + dir) }));
    if (i === sceneIdx) setSceneIndex(Math.max(0, Math.min(timeline.scenes.length - 1, i + dir)));
    else if (i + dir === sceneIdx) setSceneIndex(i);
  };

  const patchScene = (patch: Partial<TimelineScene>) =>
    mutateTimeline((tl) => ({
      ...tl,
      scenes: tl.scenes.map((s, j) => (j === sceneIdx ? { ...s, ...patch } : s)),
    }));

  const patchBlocks = (fn: (blocks: TimelineBlock[]) => TimelineBlock[]) =>
    mutateTimeline((tl) => ({
      ...tl,
      scenes: tl.scenes.map((s, j) => (j === sceneIdx ? { ...s, blocks: fn(s.blocks) } : s)),
    }));

  const patchBeat = (patch: Partial<TimelineBlock>) => {
    if (!beat) return;
    patchBlocks((blocks) => blocks.map((b) => (b.id === beat.id ? { ...b, ...patch } : b)));
  };

  const addBeat = () => {
    const b = newBeat();
    patchBlocks((blocks) => [...blocks, b]);
    setBeatId(b.id);
  };

  const deleteBeat = (bid: string) => {
    const blocks = scene?.blocks ?? [];
    if (blocks.length <= 1) return;
    const idx = blocks.findIndex((b) => b.id === bid);
    patchBlocks((cur) => cur.filter((b) => b.id !== bid));
    const remaining = blocks.filter((b) => b.id !== bid);
    setBeatId(remaining[Math.min(idx, remaining.length - 1)]?.id ?? null);
  };

  const revealSelection = () => {
    if (!beat || !selection.length) return;
    flushCapture();
    const picked = new Set(selection);
    patchBlocks((blocks) =>
      blocks.map((b) => {
        if (b.id === beat.id) {
          const revealSet = new Set([...(b.reveal ?? []), ...picked]);
          return { ...b, reveal: [...revealSet] };
        }
        return { ...b, reveal: b.reveal?.filter((rid) => !picked.has(rid)) };
      }),
    );
  };

  const unreveal = (rid: string) =>
    patchBeat({ reveal: (beat?.reveal ?? []).filter((x) => x !== rid) });

  const pointAtSelection = () => {
    if (!beat || selection.length !== 1) return;
    patchBeat({ pointer: { elementId: selection[0] } });
  };

  const clearPointer = () => patchBeat({ pointer: undefined });

  const applyLabel = () => {
    const api = apiRef.current;
    if (!api || selection.length !== 1) return;
    const sel = selection[0];
    loadingRef.current++;
    const next = (api.getSceneElements() as AnyEl[]).map((e) => {
      if (e.id !== sel) return e;
      return {
        ...e,
        customData: { ...(e.customData ?? {}), label: labelDraft.trim() || undefined },
        version: (e.version ?? 1) + 1,
        versionNonce: Math.trunc(Math.random() * 2 ** 31),
      };
    });
    api.updateScene({ elements: next });
    window.setTimeout(() => {
      loadingRef.current = Math.max(0, loadingRef.current - 1);
      captureNow();
    }, 100);
  };

  const insertEquation = (r: RenderedTex) => {
    setEqOpen(false);
    const api = apiRef.current;
    if (!api) return;
    const app = api.getAppState();
    const zoom = app.zoom?.value ?? 1;
    const cx = app.width / 2 / zoom - app.scrollX;
    const cy = app.height / 2 / zoom - app.scrollY;
    const fid = randomId().replace(/-/g, '');
    api.addFiles([{ id: fid, mimeType: 'image/svg+xml', dataURL: r.dataURL, created: Date.now() }]);
    const el = imageElement(fid, cx - r.width / 2, cy - r.height / 2, r.width, r.height);
    api.updateScene({ elements: [...(api.getSceneElements() as AnyEl[]), el] });
    scheduleCapture();
  };

  const rehearse = async () => {
    const api = apiRef.current;
    if (!api || rehearsing) return;
    flushCapture();
    const sc = timelineRef.current?.scenes[sceneIndexRef.current];
    if (!sc?.canvas?.elements.length) return;
    setRehearsing(true);
    rehearsingRef.current = true;
    loadingRef.current++;
    const pointer = new TeacherPointer();
    pointer.setApi(api as any);
    const authored = new Map(
      sc.canvas.elements.map((e) => [
        String(e.id),
        typeof (e as AnyEl).opacity === 'number' ? ((e as AnyEl).opacity as number) : 100,
      ]),
    );
    const hidden = new Set<string>();
    for (const b of sc.blocks) for (const rid of b.reveal ?? []) hidden.add(rid);
    const setOpacity = (ids: Set<string>, value: (eid: string) => number) => {
      if (!ids.size) return;
      const next = (api.getSceneElements() as AnyEl[]).map((e) =>
        ids.has(e.id)
          ? {
              ...e,
              opacity: value(e.id),
              version: (e.version ?? 1) + 1,
              versionNonce: Math.trunc(Math.random() * 2 ** 31),
            }
          : e,
      );
      api.updateScene({ elements: next });
    };
    try {
      setOpacity(hidden, () => 0);
      api.scrollToContent(api.getSceneElements() as AnyEl[], {
        fitToContent: true,
        animate: true,
      });
      await sleep(600);
      for (const b of sc.blocks) {
        setOpacity(new Set(b.reveal ?? []), (eid) => authored.get(eid) ?? 100);
        const p = b.pointer;
        if (p) {
          let x = p.x;
          let y = p.y;
          if (p.elementId) {
            const el = (api.getSceneElements() as AnyEl[]).find((e) => e.id === p.elementId);
            if (el) {
              x = el.x + el.width / 2;
              y = el.y + el.height / 2;
            }
          }
          if (x !== undefined && y !== undefined) await pointer.glideTo(x!, y!);
        }
        await sleep(Math.min(2500, Math.max(800, estimateBlockMs(b) / 2)));
      }
    } finally {
      pointer.reset();
      setOpacity(new Set(authored.keys()), (eid) => authored.get(eid) ?? 100);
      window.setTimeout(() => {
        loadingRef.current = Math.max(0, loadingRef.current - 1);
      }, 250);
      rehearsingRef.current = false;
      setRehearsing(false);
    }
  };

  const generateDraft = () => {
    if (!id || !lessonId) return;
    const hasContent = timeline.scenes.some(
      (s) => s.blocks.some((b) => b.script.trim()) || s.canvas,
    );
    if (
      hasContent &&
      !window.confirm('Replace all scenes and beats with a fresh AI script draft? Boards are cleared.')
    ) {
      return;
    }
    setGenerating(true);
    generateTimeline(id, lessonId).then(
      (tl) => {
        setGenerating(false);
        timelineRef.current = tl;
        persist(tl);
        setSceneIndex(0);
        setBeatId(tl.scenes[0]?.blocks[0]?.id ?? null);
        loadScene(tl.scenes[0]);
      },
      (err: Error) => {
        setGenerating(false);
        window.alert(err.message);
      },
    );
  };

  const totalMs = estimateTimelineMs(timeline);

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-hairline bg-canvas px-5">
        <Link
          to={`/studio/courses/${id}/edit`}
          aria-label="Back to course builder"
          className="text-fg-muted hover:text-ink"
        >
          <ArrowLeft size={18} />
        </Link>
        <Layers size={16} className="shrink-0 text-brand" />
        <h1 className="min-w-0 truncate font-display text-title-md text-ink">
          {lessonTitle} <span className="text-fg-soft">· canvas studio</span>
        </h1>
        <span className="shrink-0 text-caption text-fg-soft">≈ {formatMs(totalMs)} total</span>
        <SaveIndicator state={saveState} />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            onClick={generateDraft}
            disabled={generating}
            className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-hairline bg-white px-4 text-button text-body transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI script draft
          </button>
          <a
            href={`/session?courseId=${id}&lessonId=${lessonId}&topic=${encodeURIComponent(lessonTitle)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-hairline bg-white px-4 text-button text-body transition-colors hover:border-brand/40 hover:text-brand"
          >
            <ExternalLink size={14} /> Preview live
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r border-hairline bg-canvas">
          <div className="flex items-center justify-between px-4 pb-1 pt-4">
            <span className="text-caption font-medium uppercase tracking-wide text-fg-soft">
              Scenes
            </span>
            <button onClick={addScene} aria-label="Add scene" className="text-fg-muted hover:text-brand">
              <Plus size={15} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {timeline.scenes.map((s, i) => (
              <div
                key={s.id}
                onClick={() => selectScene(i)}
                className={`group mt-1.5 cursor-pointer rounded-lg border px-3 py-2 transition-colors ${
                  i === sceneIdx
                    ? 'border-brand/40 bg-white'
                    : 'border-transparent hover:border-hairline hover:bg-white/60'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      s.canvas?.elements.length ? 'bg-brand' : 'bg-hairline'
                    }`}
                    title={s.canvas?.elements.length ? 'Board drawn' : 'Empty board'}
                  />
                  <span className="min-w-0 truncate text-body-sm text-ink">
                    {s.title.trim() || `Scene ${i + 1}`}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-caption text-fg-soft">
                  <span>
                    {s.blocks.length} beat{s.blocks.length === 1 ? '' : 's'}
                  </span>
                  <span>· {formatMs(estimateSceneMs(s))}</span>
                  <span className="ml-auto hidden items-center gap-1 group-hover:flex">
                    <button
                      aria-label="Move scene up"
                      onClick={(e) => { e.stopPropagation(); moveScene(i, -1); }}
                      className="text-fg-muted hover:text-ink"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      aria-label="Move scene down"
                      onClick={(e) => { e.stopPropagation(); moveScene(i, 1); }}
                      className="text-fg-muted hover:text-ink"
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      aria-label="Delete scene"
                      onClick={(e) => { e.stopPropagation(); deleteScene(i); }}
                      className="text-fg-muted hover:text-error"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 bg-white">
            <Excalidraw
              excalidrawAPI={(api) => {
                apiRef.current = api as unknown as EditorAPI;
                setApiReady(true);
              }}
              onChange={onCanvasChange}
              onPointerUpdate={onPointerUpdate}
              initialData={{ appState: { viewBackgroundColor: '#ffffff' } }}
            />
            {pickingSpot && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
                <div className="pointer-events-auto flex items-center gap-3 rounded-pill border border-brand/40 bg-white px-4 py-2 text-body-sm text-ink shadow-md">
                  <Crosshair size={14} className="text-brand" />
                  Click anywhere on the board to place this beat's pointer
                  <button
                    onClick={() => setPickingSpot(false)}
                    className="text-fg-muted hover:text-ink"
                    aria-label="Cancel picking"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex h-[104px] shrink-0 items-stretch gap-2 overflow-x-auto border-t border-hairline bg-canvas px-3 py-2.5">
            {(scene?.blocks ?? []).map((b, i) => (
              <button
                key={b.id}
                draggable
                onDragStart={() => { dragBeat.current = i; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragBeat.current !== null && dragBeat.current !== i) {
                    patchBlocks((blocks) => move(blocks, dragBeat.current!, i));
                  }
                  dragBeat.current = null;
                }}
                onClick={() => setBeatId(b.id)}
                className={`flex w-44 shrink-0 flex-col rounded-lg border px-3 py-2 text-left transition-colors ${
                  b.id === beatId
                    ? 'border-brand/50 bg-white'
                    : 'border-hairline bg-white/70 hover:border-brand/30'
                }`}
              >
                <span className="text-caption font-medium text-fg-soft">Beat {i + 1}</span>
                <span className="mt-0.5 line-clamp-2 text-caption text-body">
                  {b.script.trim() ? b.script : <em className="text-fg-soft">board only</em>}
                </span>
                <span className="mt-auto flex items-center gap-2 pt-1 text-caption text-fg-soft">
                  {(b.reveal?.length ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Eye size={11} /> {b.reveal!.length}
                    </span>
                  )}
                  {b.pointer && (
                    <span className="inline-flex items-center gap-0.5 text-brand">
                      <Crosshair size={11} /> pointer
                    </span>
                  )}
                </span>
              </button>
            ))}
            <button
              onClick={addBeat}
              className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-hairline text-caption text-fg-soft transition-colors hover:border-brand/40 hover:text-brand"
            >
              <Plus size={15} /> Add beat
            </button>
          </div>
        </div>

        <aside className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-hairline bg-canvas p-4">
          <section>
            <h2 className="text-caption font-medium uppercase tracking-wide text-fg-soft">
              Scene
            </h2>
            <input
              value={scene?.title ?? ''}
              onChange={(e) => patchScene({ title: e.target.value })}
              placeholder={`Scene ${sceneIdx + 1} title`}
              className="mt-2 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-body-sm text-body outline-none focus:border-brand/50"
            />
            <div className="mt-2 flex items-center gap-2">
              <label className="text-caption text-fg-soft">Enter with</label>
              <select
                value={scene?.transition ?? 'cut'}
                onChange={(e) => patchScene({ transition: e.target.value as 'cut' | 'fade' })}
                className="rounded-lg border border-hairline bg-white px-2 py-1 text-caption text-body outline-none"
              >
                <option value="cut">Cut</option>
                <option value="fade">Fade in</option>
              </select>
              <button
                onClick={rehearse}
                disabled={rehearsing || !scene?.canvas?.elements.length}
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-pill border border-hairline bg-white px-3 text-caption text-body transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
              >
                {rehearsing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Rehearse
              </button>
            </div>
            <button
              onClick={() => setEqOpen(true)}
              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-pill border border-hairline bg-white px-3 text-caption text-body transition-colors hover:border-brand/40 hover:text-brand"
            >
              <Sigma size={12} /> Insert equation...
            </button>
          </section>

          <section>
            <h2 className="text-caption font-medium uppercase tracking-wide text-fg-soft">
              Selection
            </h2>
            {selection.length === 0 ? (
              <p className="mt-2 text-caption text-fg-soft">
                Select elements on the board to name them, reveal them with the current beat, or
                aim the pointer at them.
              </p>
            ) : (
              <>
                <p className="mt-2 text-caption text-fg-soft">
                  {selection.length} element{selection.length === 1 ? '' : 's'} selected
                </p>
                {selection.length === 1 && (
                  <div className="mt-2 flex gap-1.5">
                    <input
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && applyLabel()}
                      placeholder="Name (the AI uses this to point at it)"
                      className="min-w-0 flex-1 rounded-lg border border-hairline bg-white px-3 py-1.5 text-caption text-body outline-none focus:border-brand/50"
                    />
                    <button
                      onClick={applyLabel}
                      className="rounded-lg border border-hairline bg-white px-2.5 text-caption text-body hover:border-brand/40 hover:text-brand"
                    >
                      Set
                    </button>
                  </div>
                )}
                <div className="mt-2 flex flex-col gap-1.5">
                  <button
                    onClick={revealSelection}
                    disabled={!beat}
                    className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-hairline bg-white px-3 text-caption text-body transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
                  >
                    <Eye size={12} /> Reveal with this beat
                  </button>
                  <button
                    onClick={pointAtSelection}
                    disabled={!beat || selection.length !== 1}
                    className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-hairline bg-white px-3 text-caption text-body transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
                  >
                    <MousePointerClick size={12} /> Point beat at selection
                  </button>
                </div>
              </>
            )}
          </section>

          {beat && (
            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-caption font-medium uppercase tracking-wide text-fg-soft">
                  Beat {(scene?.blocks.findIndex((b) => b.id === beat.id) ?? 0) + 1}
                </h2>
                <button
                  onClick={() => deleteBeat(beat.id)}
                  disabled={(scene?.blocks.length ?? 0) <= 1}
                  aria-label="Delete beat"
                  className="text-fg-muted hover:text-error disabled:opacity-40"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <textarea
                rows={4}
                value={beat.script}
                onChange={(e) => patchBeat({ script: e.target.value })}
                placeholder="What the AI says during this beat (leave empty for a silent, board-only beat)"
                className="mt-2 w-full resize-none rounded-lg border border-hairline bg-white px-3 py-2 text-body-sm text-body outline-none focus:border-brand/50"
              />
              <div className="mt-2 flex items-center gap-2">
                <label className="text-caption text-fg-soft">Hold after</label>
                <input
                  type="number"
                  min={0}
                  max={15}
                  step={0.5}
                  value={(beat.holdMs ?? 0) / 1000}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    patchBeat({ holdMs: v > 0 ? Math.round(v * 1000) : undefined });
                  }}
                  className="w-16 rounded-lg border border-hairline bg-white px-2 py-1 text-caption text-body outline-none"
                />
                <span className="text-caption text-fg-soft">seconds</span>
              </div>

              <div className="mt-3">
                <span className="text-caption text-fg-soft">Laser pointer</span>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {beat.pointer ? (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-1 text-caption text-brand">
                      <Crosshair size={11} />
                      {beat.pointer.elementId
                        ? labelOf(beat.pointer.elementId)
                        : `x ${beat.pointer.x}, y ${beat.pointer.y}`}
                      <button onClick={clearPointer} aria-label="Clear pointer" className="hover:text-ink">
                        <X size={11} />
                      </button>
                    </span>
                  ) : (
                    <span className="text-caption text-fg-soft">none</span>
                  )}
                  <button
                    onClick={() => setPickingSpot(true)}
                    className="rounded-pill border border-hairline bg-white px-2.5 py-1 text-caption text-body hover:border-brand/40 hover:text-brand"
                  >
                    Pick a spot...
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <span className="text-caption text-fg-soft">Revealed at this beat</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(beat.reveal ?? []).length === 0 && (
                    <span className="text-caption text-fg-soft">
                      nothing — everything else shows from scene start
                    </span>
                  )}
                  {(beat.reveal ?? []).map((rid) => (
                    <span
                      key={rid}
                      className="inline-flex items-center gap-1 rounded-pill bg-white px-2.5 py-1 text-caption text-body ring-1 ring-hairline"
                    >
                      <Eye size={11} className="text-brand" /> {labelOf(rid)}
                      <button onClick={() => unreveal(rid)} aria-label="Remove reveal" className="text-fg-muted hover:text-error">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>

      {eqOpen && <EquationDialog onInsert={insertEquation} onClose={() => setEqOpen(false)} />}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-caption text-fg-soft">
        <Loader2 size={12} className="animate-spin" /> Saving...
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-caption text-error">
        <CloudOff size={12} /> Not saved
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-caption text-fg-soft">
      <Check size={12} /> Saved
    </span>
  );
}
