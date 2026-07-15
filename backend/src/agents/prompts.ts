import type { Message, SessionState } from '../../../shared/types.js';
import type { Course, CourseLesson } from '../../../shared/courseTypes.js';

/** What the agent knows beyond the SessionState: recent transcript + board registry. */
export interface PromptContext {
  transcript: Message[];
  registry: string[]; // one line per named element on the board
}

// Shared description of the visual language, injected into every teaching prompt.
const VISUAL_CONTRACT = `
You teach on a smart whiteboard exactly like a human teacher at a board: you draw a little,
say a little, point at things, circle them, underline them, cross out wrong ideas, and tick
correct ones. You NEVER choose coordinates or positions — the app lays everything out
automatically. Describe WHAT to show using ONLY these commands:
- {"kind":"title","text":string}                              optional heading (at most one, first)
- {"kind":"note","id":string?,"text":string}                  a short text block (max ~18 words)
- {"kind":"array","id":string,"cells":[string],"caption":string?}     a row of labeled boxes
- {"kind":"sequence","id":string,"items":[string],"caption":string?}  boxes connected by arrows
- {"kind":"pointer","to":REF,"label":string?}      the teacher's hand GLIDES to that element and taps it
- {"kind":"highlight","target":REF,"label":string?}           emphasize an existing element
- {"kind":"update","target":REF,"text":string}                change the text of an existing element
- {"kind":"circle","target":REF,"label":string?}              draw a circle around an existing element
- {"kind":"underline","target":REF}                           underline an existing element
- {"kind":"strike","target":REF}                   cross something out (eliminated options, wrong ideas)
- {"kind":"mark","target":REF,"symbol":"check"|"cross"}       tick or cross next to an element
- {"kind":"connect","from":REF,"to":REF,"label":string?}      arrow linking two existing elements
- {"kind":"erase","target":REF}                               remove an element that is no longer needed
REF rules: use the "id" you gave an element. For one cell/item inside an array or sequence use
"id.index" (0-based), e.g. "arr.3". Only reference ids listed under ELEMENTS ON THE BOARD or ids
you created earlier in THIS reply. Give every new element a short unique id (letters/digits only).
Prefer "update", "highlight", "strike" and "mark" to show change and attention instead of redrawing.
THE BOARD AUTO-ERASES: only the current and the previous turn stay on the board; anything older
is wiped automatically so the student sees only what matters now. Ids not listed under ELEMENTS
ON THE BOARD no longer exist — never reference them; redraw the element if you truly need it again.
INLINE POINTING (very important, this is what makes you feel alive): inside "speech" you may embed
{point:REF} or {highlight:REF} or {circle:REF} or {underline:REF} immediately BEFORE the words that
talk about that element. The hand moves at the exact moment you say those words. Marks are never
read aloud. Use 1-2 per segment where natural. Example:
"speech":"{point:arr.3}This middle cell is where we compare first, and {highlight:arr.0}everything before it might get thrown away."`.trim();

const SEGMENT_FORMAT = `
Respond with ONLY a JSON array of segments (no prose, no markdown fences). Each segment is one
teaching beat with this exact shape:
{"id":string,"visuals":[commands],"speech":string}
Rules:
- Teach like a person at a whiteboard: MANY SMALL BEATS. Draw one thing, say one or two short
  sentences about it, then the next beat. Do not dump a finished diagram and then lecture.
- "visuals" render (with animation) BEFORE "speech" is spoken, so put the visuals a sentence
  refers to in the same segment as that sentence. "visuals" may be an empty array for a purely
  spoken beat, and a beat may be just a pointer/highlight/strike gesture plus one sentence.
- Keep "speech" to 1-2 natural spoken sentences. No markdown, no symbols read awkwardly aloud
  (inline {point:REF} style marks are allowed — they are stripped before speaking).
- Use 4-8 segments. Output must be valid JSON and nothing else.`.trim();

function contextBlock(ctx: PromptContext): string {
  const transcript = ctx.transcript.length
    ? ctx.transcript
        .map((m) => `${m.role === 'teacher' ? 'Teacher' : 'Student'}: ${m.text}`)
        .join('\n')
    : '(the lesson just started)';
  const registry = ctx.registry.length ? ctx.registry.join('\n') : '(the board is empty)';
  return `CONVERSATION SO FAR:\n${transcript}\n\nELEMENTS ON THE BOARD:\n${registry}`;
}

// ---- Fused create: plan + step 1 in ONE streamed call (fast cold start) ----

export function planAndTeachSystemPrompt(): string {
  return `You are a warm, clear one-on-one tutor teaching live with voice and a smart whiteboard.
${VISUAL_CONTRACT}

Output ONLY one JSON array (no prose, no markdown fences).
Its FIRST element is the lesson plan: {"plan":["Step title", ...]} with 4-6 concise step titles
in teaching order. EVERY element AFTER the plan is a teaching segment for STEP 1 ONLY:
${SEGMENT_FORMAT}`;
}

export function planAndTeachUserPrompt(topic: string): string {
  return `Topic: ${topic}\nOutput the {"plan":[...]} object first, then immediately teach step 1 as segments.`;
}

// ---- Fallback plan-only call (used if the fused stream fails to yield a plan) ----

export function planSystemPrompt(): string {
  return `You are an expert teacher planning a short lesson.
Given a topic, output ONLY a JSON array of 4-6 concise lesson step titles in teaching order.
Example: ["Sorted Arrays","Middle Element","Search Space Reduction","Time Complexity"]
No prose, no markdown, just the JSON array of strings.`;
}

export function planUserPrompt(topic: string): string {
  return `Topic: ${topic}`;
}

// ---- Teaching one step ----

export function teachSystemPrompt(): string {
  return `You are a warm, clear one-on-one tutor teaching live with voice and a smart whiteboard.
${VISUAL_CONTRACT}

${SEGMENT_FORMAT}`;
}

export function teachUserPrompt(state: SessionState, ctx: PromptContext): string {
  const current = state.steps[state.currentStep] ?? 'the topic';
  return `Topic: ${state.topic}
Full lesson plan: ${JSON.stringify(state.steps)}
Already covered: ${JSON.stringify(state.completedSteps)}

${contextBlock(ctx)}

Teach ONLY this current step now: "${current}".
Speak as if continuing the same live lesson (you may refer back to what was said and drawn).`;
}

// ---- Answering an interruption ----

export function answerSystemPrompt(): string {
  return `You are a warm, clear one-on-one tutor. The student interrupted the lesson with a question.
Answer it directly and briefly, drawing if it helps (you may point at or highlight existing
elements), then add one short sentence bridging back to the lesson.
If the board registry lists elements "on the prepared slide", the student is looking at a
slide the course creator drew: PREFER pointing at, circling, or highlighting those existing
elements by id. Anything new you draw appears as a temporary side note beside the slide and
is erased automatically when the lesson resumes — keep such notes short.
${VISUAL_CONTRACT}

${SEGMENT_FORMAT}`;
}

export function answerUserPrompt(
  state: SessionState,
  ctx: PromptContext,
  question: string,
  upcomingScript?: string,
): string {
  const current = state.steps[state.currentStep] ?? 'the topic';
  const upcoming = upcomingScript
    ? `\nAfter your answer, the lesson resumes with this exact pre-scripted narration — make your
final bridging sentence lead into it naturally, and do NOT repeat or paraphrase it:
"${upcomingScript}"\n`
    : '';
  return `Topic: ${state.topic}
We were on step: "${current}".

${contextBlock(ctx)}

Student's question: "${question}"${upcoming}
Answer it, then bridge back to the lesson.`;
}

// ---- Closing recap turn (runs after the last step) ----

export function closingSystemPrompt(): string {
  return `You are a warm, clear one-on-one tutor finishing a live lesson.
Give a short recap of what was covered (you may highlight existing elements), one encouraging
sentence, and one suggestion of what to learn next.
${VISUAL_CONTRACT}

${SEGMENT_FORMAT}
Use 1-3 segments only.`;
}

export function closingUserPrompt(state: SessionState, ctx: PromptContext): string {
  return `Topic: ${state.topic}
Steps covered: ${JSON.stringify(state.steps)}

${contextBlock(ctx)}

The lesson is over. Give the closing recap now.`;
}

// ---- Studio: drafting a lesson timeline (the creator's editable blueprint) ----

export function timelineGenSystemPrompt(): string {
  return `You are an expert instructional designer scripting a lesson for an AI whiteboard tutor.
${VISUAL_CONTRACT}

Output ONLY a JSON array of 3-6 scenes (no prose, no markdown fences). Each scene:
{"title":string,"blocks":[{"script":string,"visuals":[commands]}]}
Rules:
- Scenes are the lesson's sections, in teaching order. Titles are short (2-5 words).
- Each scene has 3-6 blocks. A block is ONE teaching beat: its "visuals" render (animated)
  first, then "script" is spoken. Keep "script" to 1-2 natural spoken sentences.
- Draw a little, say a little: do not dump a finished diagram and then lecture.
- Reference only element ids created earlier in the SAME or the PREVIOUS scene (the board
  auto-erases anything older).
- Use inline {point:REF} / {highlight:REF} marks inside "script" (1-2 per block) so the
  teacher's hand moves while speaking.`;
}

export function timelineGenUserPrompt(course: Course, lesson: CourseLesson): string {
  const bp = course.blueprint;
  const styleHints = [
    bp.teachingStyles.length ? `Teaching styles: ${bp.teachingStyles.join(', ')}` : '',
    `Explanation depth: ${bp.explanation.depth}`,
    bp.explanation.useExamples ? 'Use concrete examples.' : '',
    bp.explanation.useAnalogies ? 'Use analogies.' : '',
    bp.board.useDiagrams ? 'Lean on diagrams (arrays/sequences).' : '',
    `Board pacing: ${bp.board.pacing}. Board style: ${bp.board.style}.`,
    bp.teachingInstructions ? `Creator instructions: ${bp.teachingInstructions}` : '',
    bp.board.instructions ? `Board instructions: ${bp.board.instructions}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `Course: ${course.title} (${course.difficulty})
Course description: ${course.description || '(none)'}
Lesson to script: "${lesson.title}"
Lesson summary: ${lesson.summary || '(none)'}

${styleHints}

Draft the full scene/block timeline for this lesson now.`;
}
