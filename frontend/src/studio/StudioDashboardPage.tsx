import { Link, useNavigate } from 'react-router-dom';
import { Plus, PencilLine, Library, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useStudioCourses } from '../features/courses/hooks';
import { createCourseDraft } from '../features/courses/api';
import { CourseStatusBadge } from '../components/courses/CourseStatusBadge';
import { CourseThumbnail } from '../components/courses/CourseThumbnail';

export function StudioDashboardPage() {
  const { data: courses, loading } = useStudioCourses();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const published = courses?.filter((c) => c.status === 'published') ?? [];
  const drafts = courses?.filter((c) => c.status === 'draft') ?? [];
  const learners = published.reduce((n, c) => n + c.stats.enrollments, 0);
  const recent = (courses ?? []).slice(0, 5);

  const newCourse = async () => {
    setCreating(true);
    try {
      const c = await createCourseDraft();
      navigate(`/studio/courses/${c.id}/edit`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-site p-6 lg:p-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-display-sm text-ink">Studio</h1>
          <p className="mt-1 text-body-sm text-fg-muted">
            Design AI teachers — their knowledge, their style, their board.
          </p>
        </div>
        <button
          type="button"
          onClick={newCourse}
          disabled={creating}
          className="inline-flex h-10 items-center gap-2 rounded-pill bg-brand px-4 text-button text-white transition-colors hover:bg-brand-active disabled:opacity-60"
        >
          <Plus size={16} /> {creating ? 'Creating…' : 'New course'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<Library size={18} />} label="Published courses" value={published.length} />
        <Stat icon={<PencilLine size={18} />} label="Drafts" value={drafts.length} />
        <Stat icon={<Sparkles size={18} />} label="Total learners" value={learners} />
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-title-lg text-ink">Recent courses</h2>
          <Link to="/studio/courses" className="text-body-sm text-brand hover:underline">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-surface-soft" />
        ) : recent.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-hairline py-16 text-center">
            <p className="text-body-sm text-fg-muted">You haven't created a course yet.</p>
            <button type="button" onClick={newCourse} className="mt-2 text-body-sm text-brand hover:underline">
              Create your first AI teacher
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-white">
            {recent.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/studio/courses/${c.id}/edit`}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-card/50"
                >
                  <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md">
                    <CourseThumbnail title={c.title} seed={c.thumbnailSeed} url={c.thumbnailUrl} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm text-body-strong">{c.title || 'Untitled course'}</p>
                    <p className="text-caption text-fg-soft">
                      {c.lessonCount} lessons · updated {new Date(c.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <CourseStatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-hairline bg-white p-5">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-card text-brand-deep">{icon}</span>
      <div>
        <p className="font-display text-display-sm leading-none text-ink">{value}</p>
        <p className="mt-1 text-caption text-fg-muted">{label}</p>
      </div>
    </div>
  );
}
