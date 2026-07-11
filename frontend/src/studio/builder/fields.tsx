export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-caption text-body-strong">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-caption text-fg-soft">{hint}</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-hairline bg-white px-3.5 text-body-sm text-ink ' +
  'placeholder:text-fg-soft transition-all focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/15';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass + ' h-10 ' + (props.className ?? '')} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={inputClass + ' py-2.5 leading-relaxed ' + (props.className ?? '')} />;
}

export function SelectInput({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass + ' h-10'}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function PillGroup({
  options, selected, onToggle,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(o.id)}
            className={
              'rounded-pill border px-3.5 py-1.5 text-body-sm transition-colors ' +
              (active
                ? 'border-brand bg-brand text-white'
                : 'border-hairline bg-white text-body hover:border-brand/40 hover:text-brand')
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-left text-body-sm text-body transition-colors hover:border-brand/40"
    >
      {label}
      <span
        className={
          'relative h-5 w-9 shrink-0 rounded-pill transition-colors ' +
          (checked ? 'bg-brand' : 'bg-surface-strong')
        }
      >
        <span
          className={
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ' +
            (checked ? 'left-[18px]' : 'left-0.5')
          }
        />
      </span>
    </button>
  );
}

export function StringListEditor({
  items, onChange, placeholder,
}: { items: string[]; onChange: (items: string[]) => void; placeholder: string }) {
  const set = (i: number, v: string) => onChange(items.map((s, j) => (j === i ? v : s)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <TextInput value={item} onChange={(e) => set(i, e.target.value)} placeholder={placeholder} />
          <button
            type="button"
            aria-label="Remove item"
            onClick={() => remove(i)}
            className="shrink-0 rounded-lg border border-hairline px-3 text-body-sm text-fg-muted hover:border-error/40 hover:text-error"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="self-start text-body-sm text-brand hover:underline"
      >
        + Add item
      </button>
    </div>
  );
}
