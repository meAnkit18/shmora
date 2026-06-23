// Per-browser lesson history (Phase 1 has no accounts / persistence backend).
// Stores the topics a learner has started so the sidebar can list them.

export interface LessonEntry {
  id: string; // sessionId of the most recent session on this topic
  topic: string;
  ts: number;
}

const KEY = 'shmora.lessons';
const norm = (t: string) => t.trim().toLowerCase();

export function loadLessons(): LessonEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? (list as LessonEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(list: LessonEntry[]): LessonEntry[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode / quota — keep the in-memory copy */
  }
  return list;
}

/** Add or move a topic to the top, de-duplicated by topic. */
export function saveLesson(entry: LessonEntry): LessonEntry[] {
  const rest = loadLessons().filter((l) => norm(l.topic) !== norm(entry.topic));
  return persist([entry, ...rest].slice(0, 50));
}

export function deleteLesson(id: string): LessonEntry[] {
  return persist(loadLessons().filter((l) => l.id !== id));
}
