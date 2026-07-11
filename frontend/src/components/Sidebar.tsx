import { useState, type ReactNode } from 'react';
import {
  GraduationCap,
  History as HistoryIcon,
  Settings,
  User,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from 'lucide-react';
import { SharpenerGlyph } from './SharpenerGlyph';
import type { LessonEntry } from '../lib/lessonHistory';

interface Props {
  lessons: LessonEntry[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (entry: LessonEntry) => void;
  onDelete: (id: string) => void;
}

function NavRow({
  icon,
  label,
  expanded,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  expanded: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={
        'group flex h-10 w-full items-center rounded-lg px-[9px] text-left transition-colors duration-200 ease-out motion-reduce:transition-none ' +
        (active
          ? 'bg-surface-strong/60 text-ink'
          : 'text-fg-muted hover:bg-surface-strong/45 hover:text-ink')
      }
    >
      <span className="grid w-[22px] shrink-0 place-items-center">{icon}</span>
      <span
        className={
          'ml-3 whitespace-nowrap text-body-sm transition-all duration-200 ease-out motion-reduce:transition-none ' +
          (expanded ? 'opacity-100 translate-x-0' : 'pointer-events-none opacity-0 -translate-x-1')
        }
      >
        {label}
      </span>
    </button>
  );
}

export function Sidebar({ lessons, activeId, onNew, onSelect, onDelete }: Props) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const expanded = hovered || pinned;

  return (
    <div className="relative w-[60px] shrink-0">
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: expanded ? 248 : 60 }}
        className="absolute inset-y-0 left-0 z-20 flex flex-col overflow-hidden border-r border-ink/15 bg-white transition-[width] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
      >
        <div className="flex h-[60px] items-center gap-2.5 px-[18px]">
          <SharpenerGlyph size={24} className="shrink-0 text-brand" />
          <span
            className={
              'whitespace-nowrap font-sketch text-xl leading-none text-ink transition-all duration-200 ease-out motion-reduce:transition-none ' +
              (expanded ? 'opacity-100 translate-x-0' : 'pointer-events-none opacity-0 -translate-x-1')
            }
          >
            shmora
          </span>
          <button
            onClick={() => setPinned((v) => !v)}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
            className={
              'ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-muted transition-all duration-200 ease-out hover:bg-surface-strong/60 hover:text-ink motion-reduce:transition-none ' +
              (expanded ? 'opacity-100' : 'pointer-events-none opacity-0')
            }
          >
            {pinned ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 px-2.5 py-1">
          <NavRow icon={<Plus size={20} />} label="New lesson" expanded={expanded} onClick={onNew} />
          <NavRow icon={<GraduationCap size={20} />} label="Learn" expanded={expanded} onClick={onNew} />
        </nav>

        <div className="mt-1 flex min-h-0 flex-1 flex-col px-2.5">
          <div
            className={
              'flex items-center gap-2 px-[9px] pb-1 pt-3 text-caption-uppercase uppercase text-fg-soft transition-opacity duration-200 ease-out motion-reduce:transition-none ' +
              (expanded ? 'opacity-100' : 'opacity-0')
            }
          >
            <HistoryIcon size={14} className="shrink-0" />
            History
          </div>

          {!expanded ? (
            <NavRow
              icon={<HistoryIcon size={20} />}
              label="History"
              expanded={false}
              onClick={() => setPinned(true)}
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              {lessons.length === 0 ? (
                <p className="px-[9px] py-2 text-body-sm text-fg-soft">No lessons yet.</p>
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
                            'flex w-full items-center rounded-lg px-[9px] py-2 pr-8 text-left text-body-sm transition-colors duration-200 ease-out motion-reduce:transition-none ' +
                            (active
                              ? 'bg-surface-strong/60 font-medium text-ink'
                              : 'text-body hover:bg-surface-strong/45 hover:text-ink')
                          }
                        >
                          <span className="truncate">{l.topic}</span>
                        </button>
                        <button
                          onClick={() => onDelete(l.id)}
                          title="Remove from history"
                          className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-fg-soft opacity-0 transition-opacity duration-200 ease-out hover:bg-surface-strong hover:text-error group-hover:opacity-100 motion-reduce:transition-none"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-0.5 border-t border-hairline px-2.5 py-2">
          <NavRow icon={<Settings size={20} />} label="Settings" expanded={expanded} onClick={() => {}} />
          <NavRow icon={<User size={20} />} label="Profile" expanded={expanded} onClick={() => {}} />
        </div>
      </aside>
    </div>
  );
}
