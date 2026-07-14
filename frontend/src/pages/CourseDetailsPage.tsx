import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, Clock, Play, Star, Users } from 'lucide-react';
import { useCourse } from '../features/courses/hooks';
import { formatDuration } from '../features/courses/constants';
import { CourseThumbnail } from '../components/courses/CourseThumbnail';

export function CourseDetailsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: course, loading, error } = useCourse(slug);

  const startLearning = () => {
    if (!course) return;
    const first = course.sections[0]?.lessons[0];
    const topic = first ? `${course.title}: ${first.title}` : course.title;
    const params = new URLSearchParams({ topic });
    if (first) {
      // The server replays the lesson's authored timeline when it exists,
      // and falls back to the generative teacher when it doesn't.
      params.set('courseId', course.id);
      params.set('lessonId', first.id);
    }
    navigate(`/session?${params.toString()}`);
  };

  if (loading) {
    return <div className="grid h-full place-items-center bg-canvas text-body-sm text-fg-soft">Loading course…</div>;
  }
  if (error || !course) {
    return (
      <div className="grid h-full place-items-center bg-canvas">
        <div className="text-center">
          <p className="text-body-md text-body">{error ?? 'Course not found.'}</p>
          <Link to="/courses" className="mt-3 inline-block text-body-sm text-brand hover:underline">
            Browse all courses
          </Link>
        </div>
      </div>
    );
  }

  const lessonCount = course.sections.reduce((n, s) => n + s.lessons.length, 0);

  return (
    <div className="min-h-full bg-canvas">
      <section className="border-b border-hairline bg-surface-card/50">
        <div className="mx-auto grid max-w-site gap-8 px-6 py-10 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0">
            <Link to="/courses" className="mb-4 inline-flex items-center gap-1.5 text-body-sm text-fg-muted hover:text-brand">
              <ArrowLeft size={15} /> All courses
            </Link>
            <p className="text-caption-uppercase uppercase text-brand-deep">{course.category}</p>
            <h1 className="mt-2 font-display text-display-md text-ink">{course.title}</h1>
            <p className="mt-3 max-w-body text-body-md text-body">{course.description}</p>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-body-sm text-fg-muted">
              <span>by <span className="text-body-strong">{course.creatorName}</span></span>
              <span className="capitalize">{course.difficulty}</span>
              <span className="inline-flex items-center gap-1"><Clock size={14} /> {formatDuration(course.estimatedMinutes)}</span>
              <span className="inline-flex items-center gap-1"><BookOpen size={14} /> {lessonCount} lessons</span>
              <span className="inline-flex items-center gap-1"><Users size={14} /> {course.stats.enrollments} learners</span>
              <span className="inline-flex items-center gap-1 text-amber">
                <Star size={14} fill="currentColor" /> {course.stats.rating?.toFixed(1) ?? 'New'}
              </span>
            </div>

            {course.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {course.tags.map((t) => (
                  <span key={t} className="rounded-pill border border-hairline bg-white px-3 py-1 text-caption text-fg-muted">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <aside className="h-fit overflow-hidden rounded-xl border border-hairline bg-white">
            <div className="aspect-[16/9]">
              <CourseThumbnail title={course.title} seed={course.thumbnailSeed} url={course.thumbnailUrl} />
            </div>
            <div className="flex flex-col gap-3 p-5">
              <button
                type="button"
                onClick={startLearning}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-pill bg-brand text-button text-white transition-colors hover:bg-brand-active"
              >
                <Play size={16} fill="currentColor" /> Start learning
              </button>
              <p className="text-center text-caption text-fg-soft">
                Taught live by an AI teacher — interrupt with questions any time.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <main className="mx-auto grid max-w-site gap-10 px-6 py-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-10">
          {course.learnOutcomes.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-title-lg text-ink">What you'll learn</h2>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {course.learnOutcomes.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-body-sm text-body">
                    <Check size={16} className="mt-0.5 shrink-0 text-success" /> {o}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-4 font-display text-title-lg text-ink">Course outline</h2>
            <div className="overflow-hidden rounded-xl border border-hairline bg-white">
              {course.sections.map((section, si) => (
                <div key={section.id} className={si > 0 ? 'border-t border-hairline' : ''}>
                  <div className="bg-surface-card/60 px-5 py-3 text-title-sm text-ink">
                    {section.title || `Section ${si + 1}`}
                  </div>
                  <ul>
                    {section.lessons.map((lesson, li) => (
                      <li key={lesson.id} className="flex items-baseline gap-3 border-t border-hairline-soft px-5 py-3">
                        <span className="w-6 shrink-0 text-caption text-fg-soft">{li + 1}</span>
                        <div className="min-w-0">
                          <p className="text-body-sm text-body-strong">{lesson.title}</p>
                          {lesson.summary && <p className="text-caption text-fg-muted">{lesson.summary}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {course.requirements.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-title-lg text-ink">Requirements</h2>
              <ul className="list-inside list-disc space-y-1.5 text-body-sm text-body">
                {course.requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-4 font-display text-title-lg text-ink">Reviews</h2>
            <div className="grid place-items-center rounded-xl border border-dashed border-hairline py-14 text-body-sm text-fg-soft">
              Reviews arrive once learners finish this course.
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
