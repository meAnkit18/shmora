import { randomId } from './id';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { Course, CourseDraftPatch, CourseSection } from '@shared/courseTypes';
import { TextInput } from './fields';

interface Props {
  course: Course;
  update: (patch: CourseDraftPatch) => void;
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function StructureStep({ course, update }: Props) {
  const sections = course.sections;
  const setSections = (next: CourseSection[]) => update({ sections: next });

  const patchSection = (i: number, patch: Partial<CourseSection>) =>
    setSections(sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const addSection = () =>
    setSections([...sections, { id: randomId(), title: '', lessons: [] }]);

  const addLesson = (si: number) =>
    patchSection(si, {
      lessons: [...sections[si].lessons, { id: randomId(), title: '', summary: '' }],
    });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="flex min-w-0 flex-col gap-5">
        {sections.length === 0 && (
          <div className="grid place-items-center rounded-xl border border-dashed border-hairline py-14 text-body-sm text-fg-soft">
            Structure the course as sections of lessons. Every lesson becomes a live AI teaching session.
          </div>
        )}

        {sections.map((section, si) => (
          <div key={section.id} className="rounded-xl border border-hairline bg-white p-4">
            <div className="flex items-center gap-2">
              <GripVertical size={16} className="shrink-0 text-fg-soft" />
              <TextInput
                value={section.title}
                onChange={(e) => patchSection(si, { title: e.target.value })}
                placeholder={`Section ${si + 1} title`}
              />
              <ReorderButtons
                onUp={() => setSections(move(sections, si, si - 1))}
                onDown={() => setSections(move(sections, si, si + 1))}
              />
              <IconButton
                label="Delete section"
                danger
                onClick={() => setSections(sections.filter((_, j) => j !== si))}
              >
                <Trash2 size={15} />
              </IconButton>
            </div>

            <div className="mt-3 flex flex-col gap-2 pl-6">
              {section.lessons.map((lesson, li) => (
                <div key={lesson.id} className="flex items-start gap-2">
                  <span className="mt-2.5 w-5 shrink-0 text-caption text-fg-soft">{li + 1}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <TextInput
                      value={lesson.title}
                      onChange={(e) =>
                        patchSection(si, {
                          lessons: section.lessons.map((l, j) =>
                            j === li ? { ...l, title: e.target.value } : l,
                          ),
                        })
                      }
                      placeholder="Lesson title"
                    />
                    <TextInput
                      value={lesson.summary}
                      onChange={(e) =>
                        patchSection(si, {
                          lessons: section.lessons.map((l, j) =>
                            j === li ? { ...l, summary: e.target.value } : l,
                          ),
                        })
                      }
                      placeholder="One-line summary (guides the AI's lesson plan)"
                    />
                  </div>
                  <ReorderButtons
                    onUp={() => patchSection(si, { lessons: move(section.lessons, li, li - 1) })}
                    onDown={() => patchSection(si, { lessons: move(section.lessons, li, li + 1) })}
                  />
                  <IconButton
                    label="Delete lesson"
                    danger
                    onClick={() =>
                      patchSection(si, { lessons: section.lessons.filter((_, j) => j !== li) })
                    }
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addLesson(si)}
                className="inline-flex items-center gap-1.5 self-start text-body-sm text-brand hover:underline"
              >
                <Plus size={14} /> Add lesson
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addSection}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-hairline text-body-sm text-body transition-colors hover:border-brand/40 hover:text-brand"
        >
          <Plus size={15} /> Add section
        </button>
      </div>

      <aside className="h-fit rounded-xl border border-hairline bg-surface-card/50 p-4">
        <h3 className="mb-3 text-caption-uppercase uppercase text-fg-muted">Outline preview</h3>
        {sections.length === 0 ? (
          <p className="text-caption text-fg-soft">Your outline appears here.</p>
        ) : (
          <ol className="flex flex-col gap-2 text-body-sm">
            {sections.map((s, si) => (
              <li key={s.id}>
                <p className="text-body-strong">{s.title || `Section ${si + 1}`}</p>
                <ul className="mt-1 flex flex-col gap-0.5 pl-4 text-caption text-fg-muted">
                  {s.lessons.map((l, li) => (
                    <li key={l.id}>{li + 1}. {l.title || 'Untitled lesson'}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}

function ReorderButtons({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  return (
    <div className="flex shrink-0 flex-col">
      <IconButton label="Move up" onClick={onUp}><ChevronUp size={14} /></IconButton>
      <IconButton label="Move down" onClick={onDown}><ChevronDown size={14} /></IconButton>
    </div>
  );
}

function IconButton({
  label, onClick, danger = false, children,
}: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        'grid h-7 w-7 shrink-0 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-soft ' +
        (danger ? 'hover:text-error' : 'hover:text-ink')
      }
    >
      {children}
    </button>
  );
}
