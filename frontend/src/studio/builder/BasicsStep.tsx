import type { Course, CourseDraftPatch, CourseDifficulty } from '@shared/courseTypes';
import { CATEGORIES, DIFFICULTIES, LANGUAGES } from '../../features/courses/constants';
import { CourseThumbnail } from '../../components/courses/CourseThumbnail';
import { Field, SelectInput, TextArea, TextInput } from './fields';

interface Props {
  course: Course;
  update: (patch: CourseDraftPatch) => void;
}

export function BasicsStep({ course, update }: Props) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Field label="Title">
          <TextInput
            value={course.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="e.g. Data Structures, taught the intuitive way"
            maxLength={90}
          />
        </Field>

        <Field label="Description" hint="Shown on the course card and details page.">
          <TextArea
            value={course.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="What will your AI teacher cover, and what makes the way it teaches special?"
            rows={4}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Category">
            <SelectInput
              value={course.category}
              onChange={(v) => update({ category: v })}
              options={[{ value: '', label: 'Pick one…' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
            />
          </Field>
          <Field label="Difficulty">
            <SelectInput
              value={course.difficulty}
              onChange={(v) => update({ difficulty: v as CourseDifficulty })}
              options={DIFFICULTIES.map((d) => ({ value: d.id, label: d.label }))}
            />
          </Field>
          <Field label="Language">
            <SelectInput
              value={course.language}
              onChange={(v) => update({ language: v })}
              options={LANGUAGES.map((l) => ({ value: l, label: l }))}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Estimated duration (minutes)">
            <TextInput
              type="number"
              min={5}
              value={course.estimatedMinutes}
              onChange={(e) => update({ estimatedMinutes: Math.max(5, Number(e.target.value) || 5) })}
            />
          </Field>
          <Field label="Tags" hint="Comma separated.">
            <TextInput
              defaultValue={course.tags.join(', ')}
              onBlur={(e) =>
                update({
                  tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8),
                })
              }
              placeholder="arrays, recursion, big-O"
            />
          </Field>
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-caption text-body-strong">Thumbnail</span>
        <div className="aspect-[16/9] overflow-hidden rounded-xl border border-hairline">
          <CourseThumbnail title={course.title} seed={course.thumbnailSeed} url={course.thumbnailUrl} />
        </div>
        <button
          type="button"
          onClick={() => update({ thumbnailSeed: Math.floor(Math.random() * 2 ** 31) })}
          className="mt-2 text-body-sm text-brand hover:underline"
        >
          Shuffle style
        </button>
        <p className="mt-1 text-caption text-fg-soft">
          Generated from your title for now — image uploads arrive with creator profiles.
        </p>
      </div>
    </div>
  );
}
