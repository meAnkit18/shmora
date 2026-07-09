// Inline speech marks: the model may embed {point:ref}, {highlight:ref}, {circle:ref}
// or {underline:ref} inside "speech". We strip them before speaking/displaying and
// fire the gesture at the exact word where the mark sat (via TTS boundary events).

export type GestureAction = 'point' | 'highlight' | 'circle' | 'underline';

export interface SpeechMark {
  /** Character index in the CLEAN text where the gesture should fire. */
  at: number;
  action: GestureAction;
  ref: string;
}

const MARK_RE = /\{(point|highlight|circle|underline)\s*:\s*([A-Za-z0-9_.\-]+)\}\s*/g;

export function parseSpeechMarks(speech: string): { clean: string; marks: SpeechMark[] } {
  const marks: SpeechMark[] = [];
  let clean = '';
  let last = 0;
  MARK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARK_RE.exec(speech)) !== null) {
    clean += speech.slice(last, m.index);
    marks.push({ at: clean.length, action: m[1] as GestureAction, ref: m[2] });
    last = m.index + m[0].length;
  }
  clean += speech.slice(last);
  return { clean, marks };
}

export function stripSpeechMarks(speech: string): string {
  return parseSpeechMarks(speech).clean;
}
