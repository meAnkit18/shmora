import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CourseSummary } from '@shared/courseTypes';
import { CourseCard } from './CourseCard';

interface Props {
  title: string;
  courses: CourseSummary[];
}

export function CourseRow({ title, courses }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  if (!courses.length) return null;

  const scrollBy = (dir: 1 | -1) =>
    scroller.current?.scrollBy({ left: dir * 600, behavior: 'smooth' });

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-title-lg text-ink">{title}</h2>
        <div className="hidden gap-1.5 sm:flex">
          <RowButton onClick={() => scrollBy(-1)} label={`Scroll ${title} left`}>
            <ChevronLeft size={16} />
          </RowButton>
          <RowButton onClick={() => scrollBy(1)} label={`Scroll ${title} right`}>
            <ChevronRight size={16} />
          </RowButton>
        </div>
      </div>
      <div
        ref={scroller}
        className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]"
      >
        {courses.map((c) => (
          <CourseCard key={c.id} course={c} variant="row" />
        ))}
      </div>
    </section>
  );
}

function RowButton({
  onClick, label, children,
}: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-pill border border-hairline bg-white text-body transition-colors hover:border-brand/40 hover:text-brand"
    >
      {children}
    </button>
  );
}
