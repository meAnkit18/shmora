import type { CatalogQuery, CatalogSort, CourseDifficulty } from '@shared/courseTypes';
import { CATEGORIES, DIFFICULTIES, DURATION_FILTERS, SORTS } from '../../features/courses/constants';

interface Props {
  query: CatalogQuery;
  onChange: (patch: Partial<CatalogQuery>) => void;
}

export function CourseFilters({ query, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Chip active={!query.category} onClick={() => onChange({ category: undefined, page: 1 })}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={query.category === c} onClick={() => onChange({ category: c, page: 1 })}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          label="Difficulty"
          value={query.difficulty ?? ''}
          onChange={(v) => onChange({ difficulty: (v || undefined) as CourseDifficulty | undefined, page: 1 })}
          options={[{ value: '', label: 'Any level' }, ...DIFFICULTIES.map((d) => ({ value: d.id, label: d.label }))]}
        />
        <Select
          label="Duration"
          value={String(query.maxMinutes ?? '')}
          onChange={(v) => onChange({ maxMinutes: v ? Number(v) : undefined, page: 1 })}
          options={DURATION_FILTERS.map((d) => ({ value: String(d.maxMinutes ?? ''), label: d.label }))}
        />
        <div className="ml-auto">
          <Select
            label="Sort"
            value={query.sort ?? 'newest'}
            onChange={(v) => onChange({ sort: v as CatalogSort, page: 1 })}
            options={SORTS.map((s) => ({ value: s.id, label: s.label }))}
          />
        </div>
      </div>
    </div>
  );
}

function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-pill border px-3.5 py-1.5 text-body-sm transition-colors ' +
        (active
          ? 'border-brand bg-brand text-white'
          : 'border-hairline bg-white text-body hover:border-brand/40 hover:text-brand')
      }
    >
      {children}
    </button>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-caption text-fg-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-hairline bg-white px-2.5 text-body-sm text-ink focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/15"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
