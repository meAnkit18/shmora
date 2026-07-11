import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import type { CourseStatus } from '@shared/courseTypes';
import type { CourseSummary } from '@shared/courseTypes';
import { useStudioCourses } from '../features/courses/hooks';
import {
  archiveCourse, deleteCourse, unarchiveCourse, unpublishCourse,
} from '../features/courses/api';
import { CourseStatusBadge } from '../components/courses/CourseStatusBadge';
import { CourseThumbnail } from '../components/courses/CourseThumbnail';

const TABS: { id: CourseStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'published', label: 'Published' },
  { id: 'archived', label: 'Archived' },
];

export function StudioCoursesPage() {
  const [tab, setTab] = useState<CourseStatus | 'all'>('all');
  const status = tab === 'all' ? undefined : tab;
  const { data: courses, loading, error, reload } = useStudioCourses(status);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const act = async (id: string, fn: (id: string) => Promise<unknown>) => {
    setBusyId(id);
    setRowError(null);
    try {
      await fn(id);
      reload();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-site p-6 lg:p-8">
      <h1 className="font-display text-display-sm text-ink">My Courses</h1>

      <div className="mt-5 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              'rounded-pill border px-4 py-1.5 text-body-sm transition-colors ' +
              (tab === t.id
                ? 'border-brand bg-brand text-white'
                : 'border-hairline bg-white text-body hover:border-brand/40 hover:text-brand')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {(error || rowError) && <p className="mt-4 text-body-sm text-error">{error ?? rowError}</p>}

      <div className="mt-6">
        {loading ? (
          <div className="h-48 animate-pulse rounded-xl bg-surface-soft" />
        ) : !courses?.length ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-hairline py-16 text-body-sm text-fg-soft">
            Nothing here yet.
          </div>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-white">
            {courses.map((c) => (
              <CourseRowItem key={c.id} course={c} busy={busyId === c.id} onAction={act} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CourseRowItem({
  course, busy, onAction,
}: {
  course: CourseSummary;
  busy: boolean;
  onAction: (id: string, fn: (id: string) => Promise<unknown>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="relative flex items-center gap-4 px-4 py-3">
      <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md">
        <CourseThumbnail title={course.title} seed={course.thumbnailSeed} url={course.thumbnailUrl} />
      </div>
      <div className="min-w-0 flex-1">
        <Link to={`/studio/courses/${course.id}/edit`} className="block truncate text-body-sm text-body-strong hover:text-brand">
          {course.title || 'Untitled course'}
        </Link>
        <p className="text-caption text-fg-soft">
          {course.lessonCount} lessons · {course.stats.enrollments} learners · updated{' '}
          {new Date(course.updatedAt).toLocaleDateString()}
        </p>
      </div>
      <CourseStatusBadge status={course.status} />

      <div className="relative">
        <button
          type="button"
          aria-label="Course actions"
          onClick={() => setOpen((o) => !o)}
          disabled={busy}
          className="grid h-8 w-8 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-soft hover:text-ink disabled:opacity-40"
        >
          <MoreHorizontal size={18} />
        </button>
        {open && (
          <div
            className="absolute right-0 top-9 z-10 w-44 overflow-hidden rounded-lg border border-hairline bg-white py-1 shadow-[0_8px_24px_rgba(20,20,19,0.12)]"
            onMouseLeave={() => setOpen(false)}
          >
            <MenuLink to={`/studio/courses/${course.id}/edit`}>Edit</MenuLink>
            {course.status === 'published' && (
              <>
                <MenuLink to={`/courses/${course.slug || course.id}`}>View live</MenuLink>
                <MenuButton onClick={() => onAction(course.id, unpublishCourse)}>Unpublish</MenuButton>
              </>
            )}
            {course.status !== 'archived' ? (
              <MenuButton onClick={() => onAction(course.id, archiveCourse)}>Archive</MenuButton>
            ) : (
              <MenuButton onClick={() => onAction(course.id, unarchiveCourse)}>Unarchive</MenuButton>
            )}
            {course.status !== 'published' && (
              <MenuButton
                danger
                onClick={() => {
                  if (window.confirm('Delete this course permanently?')) {
                    onAction(course.id, deleteCourse);
                  }
                }}
              >
                Delete
              </MenuButton>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function MenuLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="block px-4 py-2 text-body-sm text-body hover:bg-surface-card/60">
      {children}
    </Link>
  );
}

function MenuButton({
  onClick, danger = false, children,
}: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'block w-full px-4 py-2 text-left text-body-sm hover:bg-surface-card/60 ' +
        (danger ? 'text-error' : 'text-body')
      }
    >
      {children}
    </button>
  );
}
