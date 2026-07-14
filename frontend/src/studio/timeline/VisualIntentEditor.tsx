import type { VisualIntent } from '@shared/types';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

export const INTENT_KINDS: VisualIntent['kind'][] = [
  'title', 'note', 'array', 'sequence', 'pointer', 'highlight', 'update',
  'circle', 'underline', 'strike', 'mark', 'connect', 'erase',
];

const KIND_LABELS: Record<VisualIntent['kind'], string> = {
  title: 'Title', note: 'Note', array: 'Array (boxes)', sequence: 'Sequence (→)',
  pointer: 'Point at', highlight: 'Highlight', update: 'Update text',
  circle: 'Circle', underline: 'Underline', strike: 'Strike through',
  mark: 'Check / cross', connect: 'Connect (arrow)', erase: 'Erase',
};

/** A sensible blank intent for each kind. `n` seeds a unique element id. */
export function defaultIntent(kind: VisualIntent['kind'], n: number): VisualIntent {
  const id = `el${n}`;
  switch (kind) {
    case 'title': return { kind, text: '' };
    case 'note': return { kind, id, text: '' };
    case 'array': return { kind, id, cells: ['a', 'b', 'c'] };
    case 'sequence': return { kind, id, items: ['first', 'second'] };
    case 'pointer': return { kind, to: '' };
    case 'highlight': return { kind, target: '' };
    case 'update': return { kind, target: '', text: '' };
    case 'circle': return { kind, target: '' };
    case 'underline': return { kind, target: '' };
    case 'strike': return { kind, target: '' };
    case 'mark': return { kind, target: '', symbol: 'check' };
    case 'connect': return { kind, from: '', to: '' };
    case 'erase': return { kind, target: '' };
  }
}

interface Props {
  value: VisualIntent;
  index: number;
  count: number;
  onChange: (next: VisualIntent) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}

export function VisualIntentEditor({ value, index, count, onChange, onDelete, onMove }: Props) {
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...value, ...patch } as VisualIntent);

  return (
    <div className="rounded-lg border border-hairline bg-white p-2.5">
      <div className="flex items-center gap-1.5">
        <select
          value={value.kind}
          onChange={(e) => onChange(defaultIntent(e.target.value as VisualIntent['kind'], index + 1))}
          className="h-8 min-w-0 flex-1 rounded-md border border-hairline bg-white px-2 text-body-sm outline-none focus:border-brand/50"
        >
          {INTENT_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABELS[k]}</option>
          ))}
        </select>
        <Btn label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          <ChevronUp size={13} />
        </Btn>
        <Btn label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
          <ChevronDown size={13} />
        </Btn>
        <Btn label="Delete action" danger onClick={onDelete}>
          <Trash2 size={13} />
        </Btn>
      </div>

      <div className="mt-2 grid gap-2">
        {value.kind === 'title' && (
          <Field label="Text" value={value.text} onChange={(v) => set({ text: v })} placeholder="Binary Search" />
        )}

        {value.kind === 'note' && (
          <>
            <Field label="Element id (optional, lets you reference it later)" value={value.id ?? ''} onChange={(v) => set({ id: v || undefined })} placeholder="note1" />
            <Field label="Text (max ~18 words)" value={value.text} onChange={(v) => set({ text: v })} placeholder="A short idea on the board" />
          </>
        )}

        {value.kind === 'array' && (
          <>
            <Field label="Element id" value={value.id} onChange={(v) => set({ id: v })} placeholder="arr" />
            <Field label="Cells (comma-separated)" value={value.cells.join(',')} onChange={(v) => set({ cells: v.split(',') })} placeholder="1,3,5,7,9" />
            <Field label="Caption (optional)" value={value.caption ?? ''} onChange={(v) => set({ caption: v || undefined })} placeholder="A sorted array" />
            <RefHint id={value.id} n={value.cells.length} />
          </>
        )}

        {value.kind === 'sequence' && (
          <>
            <Field label="Element id" value={value.id} onChange={(v) => set({ id: v })} placeholder="steps" />
            <Field label="Items (comma-separated)" value={value.items.join(',')} onChange={(v) => set({ items: v.split(',') })} placeholder="Plan,Draw,Explain" />
            <Field label="Caption (optional)" value={value.caption ?? ''} onChange={(v) => set({ caption: v || undefined })} placeholder="The workflow" />
            <RefHint id={value.id} n={value.items.length} />
          </>
        )}

        {value.kind === 'pointer' && (
          <>
            <Field label="Point at (element id or id.index)" value={value.to} onChange={(v) => set({ to: v })} placeholder="arr.3" />
            <Field label="Label (optional)" value={value.label ?? ''} onChange={(v) => set({ label: v || undefined })} placeholder="middle" />
          </>
        )}

        {(value.kind === 'highlight' || value.kind === 'circle') && (
          <>
            <Field label="Target (element id or id.index)" value={value.target} onChange={(v) => set({ target: v })} placeholder="arr.0" />
            <Field label="Label (optional)" value={value.label ?? ''} onChange={(v) => set({ label: v || undefined })} placeholder="start here" />
          </>
        )}

        {value.kind === 'update' && (
          <>
            <Field label="Target" value={value.target} onChange={(v) => set({ target: v })} placeholder="note1" />
            <Field label="New text" value={value.text} onChange={(v) => set({ text: v })} placeholder="Updated content" />
          </>
        )}

        {(value.kind === 'underline' || value.kind === 'strike' || value.kind === 'erase') && (
          <Field label="Target (element id or id.index)" value={value.target} onChange={(v) => set({ target: v })} placeholder="note1" />
        )}

        {value.kind === 'mark' && (
          <>
            <Field label="Target" value={value.target} onChange={(v) => set({ target: v })} placeholder="steps.1" />
            <label className="flex flex-col gap-1">
              <span className="text-caption text-fg-muted">Symbol</span>
              <select
                value={value.symbol}
                onChange={(e) => set({ symbol: e.target.value })}
                className="h-8 rounded-md border border-hairline bg-white px-2 text-body-sm outline-none focus:border-brand/50"
              >
                <option value="check">✓ check</option>
                <option value="cross">✗ cross</option>
              </select>
            </label>
          </>
        )}

        {value.kind === 'connect' && (
          <>
            <Field label="From" value={value.from} onChange={(v) => set({ from: v })} placeholder="a" />
            <Field label="To" value={value.to} onChange={(v) => set({ to: v })} placeholder="b" />
            <Field label="Label (optional)" value={value.label ?? ''} onChange={(v) => set({ label: v || undefined })} placeholder="leads to" />
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-caption text-fg-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 rounded-md border border-hairline bg-white px-2 text-body-sm outline-none placeholder:text-fg-soft focus:border-brand/50"
      />
    </label>
  );
}

function RefHint({ id, n }: { id: string; n: number }) {
  if (!id || n === 0) return null;
  return (
    <p className="text-caption text-fg-soft">
      Reference cells as <code>{id}.0</code> … <code>{id}.{n - 1}</code> in later actions or
      inline marks.
    </p>
  );
}

function Btn({
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
      onClick={onClick}
      className={
        'grid h-7 w-7 shrink-0 place-items-center rounded-md text-fg-muted transition-colors enabled:hover:bg-surface-soft disabled:opacity-30 ' +
        (danger ? 'enabled:hover:text-error' : 'enabled:hover:text-ink')
      }
    >
      {children}
    </button>
  );
}
