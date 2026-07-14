import { Plus, Trash2 } from 'lucide-react';
import type { TimelineBlock } from '@shared/timelineTypes';
import { estimateBlockMs } from '@shared/timelineTypes';
import type { VisualIntent } from '@shared/types';
import { formatMs, move } from './timelineUtils';
import { defaultIntent, VisualIntentEditor } from './VisualIntentEditor';

interface Props {
  block: TimelineBlock;
  index: number;
  onChange: (patch: Partial<TimelineBlock>) => void;
  onDelete: () => void;
}

export function BlockInspector({ block, index, onChange, onDelete }: Props) {
  const setVisuals = (visuals: VisualIntent[]) => onChange({ visuals });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3">
        <div>
          <h3 className="text-body-strong text-ink">Block {index + 1}</h3>
          <p className="text-caption text-fg-soft">≈ {formatMs(estimateBlockMs(block))} on air</p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-caption text-fg-muted transition-colors hover:bg-surface-soft hover:text-error"
        >
          <Trash2 size={13} /> Delete block
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption-uppercase uppercase text-fg-muted">AI script (spoken)</span>
          <textarea
            value={block.script}
            onChange={(e) => onChange({ script: e.target.value })}
            rows={5}
            placeholder="What the AI teacher says for this beat — 1–2 natural sentences."
            className="resize-y rounded-lg border border-hairline bg-white p-2.5 text-body-sm leading-relaxed outline-none placeholder:text-fg-soft focus:border-brand/50"
          />
        </label>
        <p className="mt-1.5 text-caption text-fg-soft">
          Tip: embed <code>{'{point:arr.3}'}</code>, <code>{'{highlight:note1}'}</code>,{' '}
          <code>{'{circle:…}'}</code> or <code>{'{underline:…}'}</code> right before the words
          about that element — the teacher's hand moves at that exact word.
        </p>

        <label className="mt-4 flex items-center justify-between gap-3">
          <span className="text-caption-uppercase uppercase text-fg-muted">
            Hold after speaking (seconds)
          </span>
          <input
            type="number"
            min={0}
            max={15}
            step={0.5}
            value={block.holdMs ? block.holdMs / 1000 : 0}
            onChange={(e) => {
              const s = Number(e.target.value);
              onChange({ holdMs: s > 0 ? Math.round(s * 1000) : undefined });
            }}
            className="h-8 w-20 rounded-md border border-hairline bg-white px-2 text-body-sm outline-none focus:border-brand/50"
          />
        </label>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-caption-uppercase uppercase text-fg-muted">
              Whiteboard actions (drawn before the script is spoken)
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {block.visuals.length === 0 && (
              <p className="rounded-lg border border-dashed border-hairline p-3 text-caption text-fg-soft">
                No board actions — this is a purely spoken beat. Add drawings, diagrams,
                highlights or erases below.
              </p>
            )}
            {block.visuals.map((v, i) => (
              <VisualIntentEditor
                key={i}
                value={v}
                index={i}
                count={block.visuals.length}
                onChange={(next) => setVisuals(block.visuals.map((x, j) => (j === i ? next : x)))}
                onDelete={() => setVisuals(block.visuals.filter((_, j) => j !== i))}
                onMove={(dir) => setVisuals(move(block.visuals, i, i + dir))}
              />
            ))}
            <button
              type="button"
              onClick={() => setVisuals([...block.visuals, defaultIntent('note', block.visuals.length + 1)])}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-dashed border-hairline text-body-sm text-body transition-colors hover:border-brand/40 hover:text-brand"
            >
              <Plus size={14} /> Add board action
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
