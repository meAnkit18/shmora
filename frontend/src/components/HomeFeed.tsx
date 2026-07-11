import { Link } from 'react-router-dom';
import { useHomeFeed } from '../features/courses/hooks';
import { CourseRow } from './courses/CourseRow';

export function HomeFeed() {
  const { data, loading } = useHomeFeed();

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-site px-6 pb-16">
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 w-[280px] shrink-0 animate-pulse rounded-xl bg-surface-soft" />
          ))}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const hasAny =
    data.continueLearning.length + data.recommended.length + data.popular.length +
    data.newest.length + data.trending.length > 0;

  if (!hasAny) {
    return (
      <div className="mx-auto w-full max-w-site px-6 pb-16">
        <div className="grid place-items-center rounded-xl border border-dashed border-hairline py-14 text-center">
          <p className="text-body-sm text-fg-muted">No published courses yet.</p>
          <Link to="/studio" className="mt-2 text-body-sm text-brand hover:underline">
            Create the first one in Studio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-site flex-col gap-10 px-6 pb-16">
      <CourseRow title="Continue learning" courses={data.continueLearning} />
      <CourseRow title="Popular courses" courses={data.popular} />
      <CourseRow title="Newest" courses={data.newest} />
      <CourseRow title="Trending" courses={data.trending} />
      <div className="text-center">
        <Link
          to="/courses"
          className="inline-block rounded-pill border border-hairline bg-white px-5 py-2 text-body-sm text-body transition-colors hover:border-brand/40 hover:text-brand"
        >
          Browse all courses
        </Link>
      </div>
    </div>
  );
}
