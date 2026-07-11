import { Link } from 'react-router-dom';
import { Clock, Users, Star, BookOpen } from 'lucide-react';
import type { CourseSummary } from '@shared/courseTypes';
import { formatDuration } from '../../features/courses/constants';
import { CourseThumbnail } from './CourseThumbnail';

interface Props {
  course: CourseSummary;
  variant?: 'grid' | 'row';
}

export function CourseCard({ course, variant = 'grid' }: Props) {
  const width = variant === 'row' ? 'w-[280px] shrink-0' : 'w-full';
  return (
    <Link
      to={`/courses/${course.slug || course.id}`}
      className={
        width +
        ' group flex flex-col overflow-hidden rounded-xl border border-hairline bg-white ' +
        'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-brand/40 ' +
        'hover:shadow-[0_8px_24px_rgba(20,20,19,0.08)] motion-reduce:transition-none motion-reduce:hover:translate-y-0'
      }
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <CourseThumbnail title={course.title} seed={course.thumbnailSeed} url={course.thumbnailUrl} />
        <span className="absolute left-3 top-3 rounded-pill bg-white/90 px-2.5 py-0.5 text-caption text-body backdrop-blur-sm">
          {course.category || 'Uncategorized'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 font-display text-title-md text-ink group-hover:text-brand-deep">
          {course.title || 'Untitled course'}
        </h3>
        <p className="line-clamp-2 text-body-sm text-fg-muted">{course.description}</p>
        <p className="mt-0.5 text-caption text-fg-soft">by {course.creatorName}</p>

        <div className="mt-auto flex items-center gap-3 pt-3 text-caption text-fg-muted">
          <span className="capitalize">{course.difficulty}</span>
          <span className="inline-flex items-center gap-1">
            <Clock size={13} /> {formatDuration(course.estimatedMinutes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen size={13} /> {course.lessonCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users size={13} /> {course.stats.enrollments}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-amber">
            <Star size={13} fill="currentColor" />
            {course.stats.rating?.toFixed(1) ?? 'New'}
          </span>
        </div>
      </div>
    </Link>
  );
}
