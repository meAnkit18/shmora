import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogQuery } from '@shared/courseTypes';
import { useCatalog } from '../features/courses/hooks';
import { CourseSearch } from '../components/courses/CourseSearch';
import { CourseFilters } from '../components/courses/CourseFilters';
import { CourseGrid } from '../components/courses/CourseGrid';
import { SharpenerGlyph } from '../components/SharpenerGlyph';

const PAGE_SIZE = 12;

export function CoursesPage() {
  const [query, setQuery] = useState<CatalogQuery>({ sort: 'newest', page: 1, pageSize: PAGE_SIZE });
  const { data, loading, error } = useCatalog(query);
  const patch = (p: Partial<CatalogQuery>) => setQuery((q) => ({ ...q, ...p }));

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const page = query.page ?? 1;

  return (
    <div className="min-h-full bg-canvas">
      <header className="border-b border-hairline bg-canvas/70 backdrop-blur-md">
        <div className="mx-auto flex h-[64px] max-w-site items-center gap-4 px-6">
          <Link to="/" className="flex items-center gap-2">
            <SharpenerGlyph size={30} className="text-brand" />
            <span className="font-sketch text-xl text-ink">shmora</span>
          </Link>
          <nav className="ml-auto flex items-center gap-4 text-nav-link">
            <Link to="/session" className="text-body hover:text-brand">Learn</Link>
            <Link to="/studio" className="text-body hover:text-brand">Studio</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-site px-6 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-display-sm text-ink">Courses</h1>
            <p className="mt-1 text-body-sm text-fg-muted">
              Every course is a live AI teacher — explained with voice and a whiteboard, never a video.
            </p>
          </div>
          <CourseSearch value={query.q ?? ''} onChange={(q) => patch({ q, page: 1 })} />
        </div>

        <CourseFilters query={query} onChange={patch} />

        <div className="mt-6">
          {error && <p className="mb-4 text-body-sm text-error">{error}</p>}
          {loading && !data ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-surface-soft" />
              ))}
            </div>
          ) : (
            <CourseGrid courses={data?.items ?? []} />
          )}
        </div>

        {data && data.total > PAGE_SIZE && (
          <nav className="mt-8 flex items-center justify-center gap-3 text-body-sm">
            <PageButton disabled={page <= 1} onClick={() => patch({ page: page - 1 })}>
              Previous
            </PageButton>
            <span className="text-fg-muted">
              Page {page} of {totalPages}
            </span>
            <PageButton disabled={page >= totalPages} onClick={() => patch({ page: page + 1 })}>
              Next
            </PageButton>
          </nav>
        )}
      </main>
    </div>
  );
}

function PageButton({
  disabled, onClick, children,
}: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-pill border border-hairline bg-white px-4 py-1.5 text-body transition-colors enabled:hover:border-brand/40 enabled:hover:text-brand disabled:opacity-40"
    >
      {children}
    </button>
  );
}
