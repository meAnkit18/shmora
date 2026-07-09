import { SharpenerGlyph } from './SharpenerGlyph';
import type { LessonEntry } from '../lib/lessonHistory';

interface Props {
  lessons: LessonEntry[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (entry: LessonEntry) => void;
  onDelete: (id: string) => void;
  onCollapse: () => void;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function SidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function Sidebar({ lessons, activeId, onNew, onSelect, onDelete, onCollapse }: Props) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-hairline bg-surface-soft">
      {/* Brand + collapse */}
      <div className="flex h-[60px] items-center justify-between px-3">
        <div className="flex items-center gap-2 pl-1">
          <SharpenerGlyph size={26} className="text-brand" />
          <span className="font-sketch text-xl leading-none text-ink">shmora</span>
        </div>
        <button
          onClick={onCollapse}
          title="Collapse sidebar"
          className="flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-strong/60 hover:text-ink"
        >
          <SidebarIcon />
        </button>
      </div>

      {/* New lesson */}
      <div className="px-3 pb-2">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-lg border border-hairline bg-white px-3 py-2.5 text-title-sm text-ink transition-colors hover:border-brand/40 hover:text-brand"
        >
          <PlusIcon />
          New lesson
        </button>
      </div>

      {/* History */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <p className="px-2 pb-1 pt-2 text-caption-uppercase uppercase text-fg-soft">Lessons</p>
        {lessons.length === 0 ? (
          <p className="px-2 py-2 text-body-sm text-fg-soft">No lessons yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {lessons.map((l) => {
              const active = l.id === activeId;
              return (
                <li key={l.id} className="group relative">
                  <button
                    onClick={() => onSelect(l)}
                    title={l.topic}
                    className={
                      'flex w-full items-center rounded-lg px-2.5 py-2 pr-8 text-left text-body-sm transition-colors ' +
                      (active
                        ? 'bg-brand/12 font-medium text-brand'
                        : 'text-body hover:bg-surface-strong/50 hover:text-ink')
                    }
                  >
                    <span className="truncate">{l.topic}</span>
                  </button>
                  <button
                    onClick={() => onDelete(l.id)}
                    title="Remove from history"
                    className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-fg-soft opacity-0 transition-opacity hover:bg-surface-strong hover:text-error group-hover:opacity-100"
                  >
                    <TrashIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-hairline px-4 py-3">
        <p className="font-sketch text-base text-fg-muted">Sharpen your ideas.</p>
      </div>
    </aside>
  );
}
