import type {
  AssessmentDifficulty, BoardPacing, BoardStyle, Course, CourseDraftPatch,
  ExplanationDepth, QuizFrequency, TeachingBlueprint,
} from '@shared/courseTypes';
import { TEACHING_STYLES } from '../../features/courses/constants';
import { Field, PillGroup, SelectInput, TextArea, Toggle } from './fields';

interface Props {
  course: Course;
  update: (patch: CourseDraftPatch) => void;
}

export function BlueprintStep({ course, update }: Props) {
  const bp = course.blueprint;
  const set = (patch: Partial<TeachingBlueprint>) => update({ blueprint: { ...bp, ...patch } });

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <Block
        title="Teaching style"
        subtitle="How should your AI teacher come across? Pick everything that fits."
      >
        <PillGroup
          options={[...TEACHING_STYLES]}
          selected={bp.teachingStyles}
          onToggle={(id) =>
            set({
              teachingStyles: bp.teachingStyles.includes(id)
                ? bp.teachingStyles.filter((s) => s !== id)
                : [...bp.teachingStyles, id],
            })
          }
        />
      </Block>

      <Block
        title="Teaching instructions"
        subtitle="Rules the AI follows in every lesson. This is where your teaching philosophy lives."
      >
        <TextArea
          rows={8}
          value={bp.teachingInstructions}
          onChange={(e) => set({ teachingInstructions: e.target.value })}
          placeholder={
            'Examples:\n' +
            '• Always explain concepts with analogies before definitions.\n' +
            '• Never introduce formulas before intuition.\n' +
            '• Pause after each topic and ask a conceptual question.\n' +
            '• Relate everything back to one running example.'
          }
        />
      </Block>

      <Block title="Explanation preferences" subtitle="How deep and with what ingredients.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Depth">
            <SelectInput
              value={bp.explanation.depth}
              onChange={(v) => set({ explanation: { ...bp.explanation, depth: v as ExplanationDepth } })}
              options={[
                { value: 'overview', label: 'Overview — the big picture' },
                { value: 'balanced', label: 'Balanced — intuition + detail' },
                { value: 'deep', label: 'Deep — rigorous and thorough' },
              ]}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <Toggle label="Worked examples" checked={bp.explanation.useExamples}
            onChange={(v) => set({ explanation: { ...bp.explanation, useExamples: v } })} />
          <Toggle label="Real-life analogies" checked={bp.explanation.useAnalogies}
            onChange={(v) => set({ explanation: { ...bp.explanation, useAnalogies: v } })} />
          <Toggle label="Code snippets" checked={bp.explanation.useCode}
            onChange={(v) => set({ explanation: { ...bp.explanation, useCode: v } })} />
          <Toggle label="Math notation" checked={bp.explanation.useMath}
            onChange={(v) => set({ explanation: { ...bp.explanation, useMath: v } })} />
          <Toggle label="Animated board reveals" checked={bp.explanation.useAnimations}
            onChange={(v) => set({ explanation: { ...bp.explanation, useAnimations: v } })} />
        </div>
      </Block>

      <Block
        title="Board instructions"
        subtitle="How the AI should draw on the live whiteboard while it speaks."
      >
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Toggle label="Diagrams" checked={bp.board.useDiagrams}
            onChange={(v) => set({ board: { ...bp.board, useDiagrams: v } })} />
          <Toggle label="Arrows & pointers" checked={bp.board.useArrows}
            onChange={(v) => set({ board: { ...bp.board, useArrows: v } })} />
          <Toggle label="Flowcharts" checked={bp.board.useFlowcharts}
            onChange={(v) => set({ board: { ...bp.board, useFlowcharts: v } })} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Board pacing">
            <SelectInput
              value={bp.board.pacing}
              onChange={(v) => set({ board: { ...bp.board, pacing: v as BoardPacing } })}
              options={[
                { value: 'slow', label: 'Slow — one idea at a time' },
                { value: 'medium', label: 'Medium' },
                { value: 'fast', label: 'Fast — dense boards' },
              ]}
            />
          </Field>
          <Field label="Drawing style">
            <SelectInput
              value={bp.board.style}
              onChange={(v) => set({ board: { ...bp.board, style: v as BoardStyle } })}
              options={[
                { value: 'minimal', label: 'Minimal — only what matters' },
                { value: 'rich', label: 'Rich — generous visuals' },
              ]}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Extra drawing rules" hint="Color preferences, favorite diagram shapes, anything specific.">
            <TextArea
              rows={3}
              value={bp.board.instructions}
              onChange={(e) => set({ board: { ...bp.board, instructions: e.target.value } })}
              placeholder='e.g. "Circle key terms. Always draw the data structure before mutating it."'
            />
          </Field>
        </div>
      </Block>

      <Block title="Assessment" subtitle="How the AI checks understanding.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quiz frequency">
            <SelectInput
              value={bp.assessment.quizFrequency}
              onChange={(v) => set({ assessment: { ...bp.assessment, quizFrequency: v as QuizFrequency } })}
              options={[
                { value: 'never', label: 'No quizzes' },
                { value: 'per-lesson', label: 'After every lesson' },
                { value: 'per-section', label: 'After every section' },
                { value: 'end-of-course', label: 'End of course only' },
              ]}
            />
          </Field>
          <Field label="Assessment difficulty">
            <SelectInput
              value={bp.assessment.difficulty}
              onChange={(v) => set({ assessment: { ...bp.assessment, difficulty: v as AssessmentDifficulty } })}
              options={[
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard' },
              ]}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <Toggle label="Assign homework" checked={bp.assessment.homework}
            onChange={(v) => set({ assessment: { ...bp.assessment, homework: v } })} />
          <Toggle label="Suggest projects" checked={bp.assessment.projects}
            onChange={(v) => set({ assessment: { ...bp.assessment, projects: v } })} />
        </div>
      </Block>
    </div>
  );
}

function Block({
  title, subtitle, children,
}: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-display text-title-md text-ink">{title}</h3>
      <p className="mb-4 mt-0.5 text-body-sm text-fg-muted">{subtitle}</p>
      {children}
    </section>
  );
}
