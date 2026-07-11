import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CloudOff, Loader2 } from 'lucide-react';
import { useCourseDraft } from '../../features/courses/hooks';
import { CourseStatusBadge } from '../../components/courses/CourseStatusBadge';
import { BasicsStep } from './BasicsStep';
import { StructureStep } from './StructureStep';
import { BlueprintStep } from './BlueprintStep';
import { PublishDialog } from './PublishDialog';

const STEPS = [
  { id: 'basics', label: 'Course basics' },
  { id: 'structure', label: 'Structure' },
  { id: 'blueprint', label: 'Teaching blueprint' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export function CourseBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const { course, issues, loading, error, saveState, update } = useCourseDraft(id);
  const [step, setStep] = useState<StepId>('basics');
  const [showPublish, setShowPublish] = useState(false);

  if (loading) {
    return <div className="grid h-full place-items-center text-body-sm text-fg-soft">Loading course…</div>;
  }
  if (error || !course) {
    return (
      <div className="grid h-full place-items-center">
        <div className="text-center">
          <p className="text-body-md text-body">{error ?? 'Course not found.'}</p>
          <Link to="/studio/courses" className="mt-2 inline-block text-body-sm text-brand hover:underline">
            Back to My Courses
          </Link>
        </div>
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-hairline bg-canvas px-5">
        <Link to="/studio/courses" aria-label="Back to My Courses" className="text-fg-muted hover:text-ink">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="min-w-0 truncate font-display text-title-md text-ink">
          {course.title || 'Untitled course'}
        </h1>
        <CourseStatusBadge status={course.status} />
        <SaveIndicator state={saveState} />
        <button
          type="button"
          onClick={() => setShowPublish(true)}
          className="ml-auto h-9 shrink-0 rounded-pill bg-brand px-4 text-button text-white transition-colors hover:bg-brand-active"
        >
          {course.status === 'published' ? 'Publish update' : 'Publish'}
        </button>
      </header>

      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-hairline bg-canvas px-5">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={
              'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-nav-link transition-colors ' +
              (step === s.id
                ? 'border-brand text-brand-deep'
                : 'border-transparent text-fg-muted hover:text-ink')
            }
          >
            <span
              className={
                'grid h-5 w-5 place-items-center rounded-full text-[11px] ' +
                (step === s.id ? 'bg-brand text-white' : 'bg-surface-strong text-body')
              }
            >
              {i + 1}
            </span>
            {s.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-8">
        {step === 'basics' && <BasicsStep course={course} update={update} />}
        {step === 'structure' && <StructureStep course={course} update={update} />}
        {step === 'blueprint' && <BlueprintStep course={course} update={update} />}

        <div className="mt-10 flex max-w-3xl justify-between">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStep(STEPS[stepIndex - 1].id)}
            className="h-10 rounded-pill border border-hairline bg-white px-4 text-button text-body transition-colors enabled:hover:border-brand/40 enabled:hover:text-brand disabled:opacity-40"
          >
            Back
          </button>
          {stepIndex < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(STEPS[stepIndex + 1].id)}
              className="h-10 rounded-pill bg-brand px-5 text-button text-white transition-colors hover:bg-brand-active"
            >
              Next: {STEPS[stepIndex + 1].label}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowPublish(true)}
              className="h-10 rounded-pill bg-brand px-5 text-button text-white transition-colors hover:bg-brand-active"
            >
              Review & publish
            </button>
          )}
        </div>
      </div>

      {showPublish && (
        <PublishDialog course={course} issues={issues} onClose={() => setShowPublish(false)} />
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: 'saved' | 'saving' | 'error' }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-fg-soft">
        <Loader2 size={13} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-error">
        <CloudOff size={13} /> Not saved — check your connection
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-fg-soft">
      <Check size={13} /> Saved
    </span>
  );
}
