import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import type { Course, PublishIssue } from '@shared/courseTypes';
import { publishCourse } from '../../features/courses/api';

interface Props {
  course: Course;
  issues: PublishIssue[];
  onClose: () => void;
}

export function PublishDialog({ course, issues, onClose }: Props) {
  const navigate = useNavigate();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = issues.length === 0;

  const publish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const published = await publishCourse(course.id);
      navigate(`/courses/${published.slug || published.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
      setPublishing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Publish course"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-hairline bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-title-lg text-ink">
            {ready ? 'Ready to publish' : 'Almost there'}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-fg-muted hover:bg-surface-soft hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {ready ? (
          <p className="mt-2 text-body-sm text-body">
            &ldquo;{course.title}&rdquo; goes live in the catalog. You can unpublish or keep editing any time —
            publishing again releases a new version.
          </p>
        ) : (
          <>
            <p className="mt-2 text-body-sm text-body">Fix these before your AI teacher goes live:</p>
            <ul className="mt-3 flex flex-col gap-2">
              {issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-body-sm text-body">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-warning" />
                  {issue.message}
                </li>
              ))}
            </ul>
          </>
        )}

        {error && <p className="mt-3 text-body-sm text-error">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-pill border border-hairline bg-white px-4 text-button text-body hover:border-brand/40 hover:text-brand"
          >
            Keep editing
          </button>
          {ready && (
            <button
              type="button"
              onClick={publish}
              disabled={publishing}
              className="inline-flex h-10 items-center gap-2 rounded-pill bg-brand px-4 text-button text-white transition-colors hover:bg-brand-active disabled:opacity-60"
            >
              <CheckCircle2 size={16} /> {publishing ? 'Publishing…' : 'Publish'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
