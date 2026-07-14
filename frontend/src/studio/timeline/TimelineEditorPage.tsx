import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, CloudOff, Copy, ExternalLink,
  Film, Loader2, Plus, Sparkles, Trash2,
} from 'lucide-react';
import type { LessonTimeline, TimelineBlock, TimelineScene } from '@shared/timelineTypes';
import {
  estimateBlockMs, estimateSceneMs, estimateTimelineMs, stripInlineMarks,
} from '@shared/timelineTypes';
import { fetchStudioCourse } from '../../features/courses/api';
import {
  fetchTimeline, generateTimeline, saveTimeline as saveTimelineApi,
} from '../../features/timeline/api';
import { randomId } from '../builder/id';
import { BlockInspector } from './BlockInspector';
import { formatMs, move, newBlock, newScene } from './timelineUtils';

type SaveState = 'saved' | 'saving' | 'error';

const KIND_CHIP: Record<string, string> = {
  title: 'Title', note: 'Note', array: 'Array', sequence: 'Seq', pointer: 'Point',
  highlight: 'HL', update: 'Upd', circle: 'Circle', underline: 'U̲', strike: 'Strike',
  mark: '✓/✗', connect: '→', erase: 'Erase',
};

export function TimelineEditorPage() {
  const { id, lessonId } = useParams<{ id: string; lessonId: string }>();
  const [lessonTitle, setLessonTitle] = useState('');
  const [timeline, setTimeline] = useState<LessonTimeline | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const dragFrom = useRef<number | null>(null);

  // ---- Load lesson meta + timeline ----
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
        const withScene = tl.scenes.length
          ? tl
          : { ...tl, scenes: [newScene('Scene 1')] };
        setTimeline(withScene);
        setBlockId(withScene.scenes[0]?.blocks[0]?.id ?? null);
      },
      (err: Error) => alive && setError(err.message),
    );
    return () => {
      alive = false;
    };
  }, [id, lessonId]);

  // ---- Debounced autosave (same pattern as useCourseDraft) ----
  const persist = useCallback(
    (next: LessonTimeline) => {
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

  if (error) {
    return (
      <div className="grid h-screen place-items-center bg-canvas">
        <div className="text-center">
          <p className="text-body-md text-body">{error}</p>
          <Link to={`/studio/courses/${id}/edit`} className="mt-2 inline-block text-body-sm text-brand hover:underline">
            Back to the course builder
          </Link>
        </div>
      </div>
    );
  }
  if (!timeline) {
    return (
      <div className="grid h-screen place-items-center bg-canvas text-body-sm text-fg-soft">
        Loading timeline…
      </div>
    );
  }

  const sceneIdx = Math.min(sceneIndex, timeline.scenes.length - 1);
  const scene = timeline.scenes[sceneIdx];
  const blockIdx = scene ? scene.blocks.findIndex((b) => b.id === blockId) : -1;
  const block = blockIdx >= 0 ? scene.blocks[blockIdx] : null;

  // ---- Mutators ----
  const setScenes = (scenes: TimelineScene[]) => persist({ ...timeline, scenes });

  const patchScene = (i: number, patch: Partial<TimelineScene>) =>
    setScenes(timeline.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const selectScene = (i: number) => {
    setSceneIndex(i);
    setBlockId(timeline.scenes[i]?.blocks[0]?.id ?? null);
  };

  const addScene = () => {
    const s = newScene(`Scene ${timeline.scenes.length + 1}`);
    setScenes([...timeline.scenes, s]);
    setSceneIndex(timeline.scenes.length);
    setBlockId(s.blocks[0]?.id ?? null);
  };

  const deleteScene = (i: number) => {
    if (timeline.scenes.length <= 1) return;
    if (!window.confirm('Delete this scene and all of its blocks?')) return;
    const scenes = timeline.scenes.filter((_, j) => j !== i);
    setScenes(scenes);
    const nextIdx = Math.max(0, Math.min(i, scenes.length - 1));
    setSceneIndex(nextIdx);
    setBlockId(scenes[nextIdx]?.blocks[0]?.id ?? null);
  };

  const addBlockAfter = (i: number) => {
    if (!scene) return;
    const b = newBlock();
    const blocks = [...scene.blocks];
    blocks.splice(i + 1, 0, b);
    patchScene(sceneIdx, { blocks });
    setBlockId(b.id);
  };

  const duplicateBlock = (i: number) => {
    if (!scene) return;
    const src = scene.blocks[i];
    const copy: TimelineBlock = { ...src, id: randomId(), visuals: [...src.visuals] };
    const blocks = [...scene.blocks];
    blocks.splice(i + 1, 0, copy);
    patchScene(sceneIdx, { blocks });
    setBlockId(copy.id);
  };

  const deleteBlock = (i: number) => {
    if (!scene) return;
    const blocks = scene.blocks.filter((_, j) => j !== i);
    patchScene(sceneIdx, { blocks });
    setBlockId(blocks[Math.min(i, blocks.length - 1)]?.id ?? null);
  };

  const generateDraft = () => {
    if (!id || !lessonId) return;
    const hasContent = timeline.scenes.some((s) => s.blocks.some((b) => b.script.trim() || b.visuals.length));
    if (hasContent && !window.confirm('Replace the current timeline with a fresh AI draft?')) return;
    setGenerating(true);
    generateTimeline(id, lessonId).then(
      (tl) => {
        setGenerating(false);
        persist(tl);
        setSceneIndex(0);
        setBlockId(tl.scenes[0]?.blocks[0]?.id ?? null);
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
      {/* ---- Header ---- */}
      <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-hairline bg-canvas px-5">
        <Link to={`/studio/courses/${id}/edit`} aria-label="Back to course builder" className="text-fg-muted hover:text-ink">
          <ArrowLeft size={18} />
        </Link>
        <Film size={16} className="shrink-0 text-brand" />
        <h1 className="min-w-0 truncate font-display text-title-md text-ink">
          {lessonTitle} <span className="text-fg-soft">· timeline</span>
        </h1>
        <span className="shrink-0 text-caption text-fg-soft">≈ {formatMs(totalMs)} total</span>
        <SaveIndicator state={saveState} />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <a
            href={`/session?courseId=${id}&lessonId=${lessonId}&topic=${encodeURIComponent(lessonTitle)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-hairline bg-white px-4 text-button text-body transition-colors hover:border-brand/40 hover:text-brand"
          >
            <ExternalLink size={14} /> Preview live
          </a>
          <button
            type="button"
            disabled={generating}
            onClick={generateDraft}
            className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand px-4 text-button text-white transition-colors hover:bg-brand-active disabled:opacity-60"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? 'Drafting…' : 'AI draft'}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px]">
        {/* ---- Left: scene rail + block track ---- */}
        <div className="flex min-w-0 flex-col">
          {/* Scene rail */}
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-hairline bg-surface-card/40 px-4 py-3">
            {timeline.scenes.map((s, i) => (
              <div
                key={s.id}
                className={
                  'group flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors ' +
                  (i === sceneIdx
                    ? 'border-brand/50 bg-white shadow-sm'
                    : 'border-hairline bg-white/60 hover:border-brand/30')
                }
              >
                <button type="button" onClick={() => selectScene(i)} className="flex items-center gap-2 text-left">
                  <span className={'grid h-5 w-5 place-items-center rounded-full text-[11px] ' + (i === sceneIdx ? 'bg-brand text-white' : 'bg-surface-strong text-body')}>
                    {i + 1}
                  </span>
                  <span className="max-w-[160px] truncate text-body-sm text-ink">{s.title || `Scene ${i + 1}`}</span>
                  <span className="text-caption text-fg-soft">{formatMs(estimateSceneMs(s))}</span>
                </button>
                <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <RailBtn label="Move left" disabled={i === 0} onClick={() => { setScenes(move(timeline.scenes, i, i - 1)); setSceneIndex(i - 1); }}>
                    <ChevronLeft size={12} />
                  </RailBtn>
                  <RailBtn label="Move right" disabled={i === timeline.scenes.length - 1} onClick={() => { setScenes(move(timeline.scenes, i, i + 1)); setSceneIndex(i + 1); }}>
                    <ChevronRight size={12} />
                  </RailBtn>
                  <RailBtn label="Delete scene" danger disabled={timeline.scenes.length <= 1} onClick={() => deleteScene(i)}>
                    <Trash2 size={12} />
                  </RailBtn>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addScene}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-hairline px-3 text-body-sm text-body transition-colors hover:border-brand/40 hover:text-brand"
            >
              <Plus size={14} /> Scene
            </button>
          </div>

          {/* Scene title */}
          {scene && (
            <div className="shrink-0 border-b border-hairline px-4 py-2.5">
              <input
                value={scene.title}
                onChange={(e) => patchScene(sceneIdx, { title: e.target.value })}
                placeholder={`Scene ${sceneIdx + 1} title (shown as a lesson step)`}
                className="w-full max-w-md rounded-md border border-transparent bg-transparent px-1.5 py-1 text-body-strong text-ink outline-none transition-colors placeholder:text-fg-soft hover:border-hairline focus:border-brand/50 focus:bg-white"
              />
            </div>
          )}

          {/* Block track — the "video editor" strip */}
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <div className="flex min-h-[220px] items-stretch gap-2">
              {scene?.blocks.map((b, i) => {
                const selected = b.id === blockId;
                const width = Math.max(180, Math.min(420, Math.round(estimateBlockMs(b) / 45)));
                return (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={() => { dragFrom.current = i; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      const from = dragFrom.current;
                      dragFrom.current = null;
                      if (from === null || from === i || !scene) return;
                      patchScene(sceneIdx, { blocks: move(scene.blocks, from, i) });
                    }}
                    onClick={() => setBlockId(b.id)}
                    style={{ width }}
                    className={
                      'flex shrink-0 cursor-grab flex-col overflow-hidden rounded-xl border bg-white transition-shadow active:cursor-grabbing ' +
                      (selected ? 'border-brand shadow-md ring-1 ring-brand/30' : 'border-hairline hover:shadow-sm')
                    }
                  >
                    <div className="flex items-center justify-between border-b border-hairline bg-surface-card/50 px-2.5 py-1.5">
                      <span className="text-caption text-fg-muted">Beat {i + 1}</span>
                      <span className="text-caption text-fg-soft">{formatMs(estimateBlockMs(b))}</span>
                    </div>
                    {/* Script lane */}
                    <p className="flex-1 px-2.5 py-2 text-caption leading-relaxed text-body [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4] overflow-hidden">
                      {stripInlineMarks(b.script).trim() || <span className="text-fg-soft">No script yet — click to write this beat.</span>}
                    </p>
                    {/* Board lane */}
                    <div className="flex flex-wrap items-center gap-1 border-t border-dashed border-hairline px-2.5 py-1.5">
                      {b.visuals.length === 0 ? (
                        <span className="text-[10px] text-fg-soft">speech only</span>
                      ) : (
                        b.visuals.map((v, vi) => (
                          <span key={vi} className="rounded bg-surface-strong px-1.5 py-0.5 text-[10px] text-body">
                            {KIND_CHIP[v.kind] ?? v.kind}
                          </span>
                        ))
                      )}
                    </div>
                    {/* Block toolbar */}
                    <div className="flex items-center justify-end gap-0.5 border-t border-hairline px-1.5 py-1">
                      <RailBtn label="Duplicate block" onClick={() => duplicateBlock(i)}><Copy size={12} /></RailBtn>
                      <RailBtn label="Add block after" onClick={() => addBlockAfter(i)}><Plus size={12} /></RailBtn>
                      <RailBtn label="Delete block" danger onClick={() => deleteBlock(i)}><Trash2 size={12} /></RailBtn>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => addBlockAfter((scene?.blocks.length ?? 1) - 1)}
                className="grid w-24 shrink-0 place-items-center rounded-xl border border-dashed border-hairline text-fg-muted transition-colors hover:border-brand/40 hover:text-brand"
                aria-label="Add block"
              >
                <Plus size={18} />
              </button>
            </div>
            <p className="mt-3 text-caption text-fg-soft">
              Drag beats to rearrange · widths reflect estimated on-air time · each beat's board
              actions render before its script is spoken.
            </p>
          </div>
        </div>

        {/* ---- Right: inspector ---- */}
        <aside className="min-h-0 border-l border-hairline bg-white">
          {block ? (
            <BlockInspector
              block={block}
              index={blockIdx}
              onChange={(patch) =>
                patchScene(sceneIdx, {
                  blocks: scene!.blocks.map((b, j) => (j === blockIdx ? { ...b, ...patch } : b)),
                })
              }
              onDelete={() => deleteBlock(blockIdx)}
            />
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-body-sm text-fg-soft">
              Select a beat on the timeline to edit its script and whiteboard actions.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function RailBtn({
  label, onClick, disabled = false, danger = false, children,
}: {
  label: string; onClick: () => void; disabled?: boolean; danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={
        'grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted transition-colors enabled:hover:bg-surface-soft disabled:opacity-30 ' +
        (danger ? 'enabled:hover:text-error' : 'enabled:hover:text-ink')
      }
    >
      {children}
    </button>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-caption text-fg-soft">
        <Loader2 size={13} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-caption text-error">
        <CloudOff size={13} /> Not saved
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-caption text-fg-soft">
      <Check size={13} /> Saved
    </span>
  );
}
