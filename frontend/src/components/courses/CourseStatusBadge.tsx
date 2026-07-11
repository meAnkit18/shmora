import type { CourseStatus } from '@shared/courseTypes';

const STYLES: Record<CourseStatus, string> = {
  draft: 'bg-amber/15 text-amber',
  published: 'bg-success/15 text-success',
  archived: 'bg-fg-soft/15 text-fg-muted',
};

const LABELS: Record<CourseStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  return (
    <span className={'inline-block rounded-pill px-2.5 py-0.5 text-caption ' + STYLES[status]}>
      {LABELS[status]}
    </span>
  );
}
