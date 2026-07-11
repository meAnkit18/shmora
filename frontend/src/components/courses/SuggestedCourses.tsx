import { useHomeFeed } from '../../features/courses/hooks';
import { CourseRow } from './CourseRow';

export function SuggestedCourses() {
  const { data, loading } = useHomeFeed();

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-site px-6 pb-4">
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 w-[280px] shrink-0 animate-pulse rounded-xl bg-surface-soft" />
          ))}
        </div>
      </div>
    );
  }

  const courses =
    data?.recommended.length ? data.recommended
    : data?.popular.length ? data.popular
    : data?.newest ?? [];

  if (!courses.length) return null;

  return (
    <div className="mx-auto w-full max-w-site px-6 pb-4">
      <CourseRow title="Suggested for you" courses={courses} />
    </div>
  );
}
