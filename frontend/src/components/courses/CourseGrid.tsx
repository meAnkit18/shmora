import type { CourseSummary } from '@shared/courseTypes';
import { CourseCard } from './CourseCard';

interface Props {
  courses: CourseSummary[];
  emptyMessage?: string;
}

export function CourseGrid({ courses, emptyMessage = 'No courses match these filters yet.' }: Props) {
  if (!courses.length) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-hairline py-20 text-body-sm text-fg-soft">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {courses.map((c) => (
        <CourseCard key={c.id} course={c} />
      ))}
    </div>
  );
}
