import type { SessionState } from '@shared/types';

interface Props {
  state: SessionState | null;
}

export function LessonStatusPanel({ state }: Props) {
  if (!state) {
    return (
      <div className="p-4 text-body-sm text-fg-soft">No active lesson.</div>
    );
  }

  const current = state.steps[state.currentStep];

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="font-display text-title-lg text-ink">{state.topic}</h2>
        {state.paused && (
          <span className="mt-1.5 inline-block rounded-pill bg-amber/15 px-2.5 py-0.5 text-caption text-amber">
            Paused — answering question
          </span>
        )}
      </div>

      <ol className="flex flex-col gap-1.5 text-body-sm">
        {state.steps.map((step, i) => {
          const done = i < state.currentStep;
          const active = i === state.currentStep;
          return (
            <li
              key={i}
              className={
                'flex gap-2 ' +
                (active
                  ? 'font-medium text-brand'
                  : done
                    ? 'text-fg-soft line-through'
                    : 'text-body')
              }
            >
              <span className="shrink-0">{done ? '✓' : active ? '▶' : '○'}</span>
              <span>{step}</span>
            </li>
          );
        })}
      </ol>

      {current && !state.paused && (
        <p className="text-caption text-fg-soft">Currently teaching: {current}</p>
      )}
    </div>
  );
}
