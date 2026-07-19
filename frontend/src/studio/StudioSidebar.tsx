import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Library, BarChart3, Settings, Plus, GraduationCap,
} from 'lucide-react';
import { useState } from 'react';
import { createCourseDraft } from '../features/courses/api';
import { SharpenerGlyph } from '../components/SharpenerGlyph';
import { signOut } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

const NAV = [
  { to: '/studio', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/studio/courses', label: 'My Courses', icon: Library, end: false },
  { to: '/studio/analytics', label: 'Analytics', icon: BarChart3, end: false },
  { to: '/studio/settings', label: 'Settings', icon: Settings, end: false },
];

export function StudioSidebar() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();

  const newCourse = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const course = await createCourseDraft();
      navigate(`/studio/courses/${course.id}/edit`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <aside className="flex w-16 shrink-0 flex-col border-r border-hairline bg-canvas md:w-60">
      <Link to="/" className="flex h-[60px] items-center gap-2.5 border-b border-hairline px-4">
        <SharpenerGlyph size={30} className="shrink-0 text-brand" />
        <span className="hidden font-sketch text-xl text-ink md:inline">
          shmora <span className="text-fg-soft">studio</span>
        </span>
      </Link>

      <div className="p-3">
        <button
          type="button"
          onClick={newCourse}
          disabled={creating}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-pill bg-brand text-button text-white transition-colors hover:bg-brand-active disabled:opacity-60"
        >
          <Plus size={16} />
          <span className="hidden md:inline">{creating ? 'Creating…' : 'New course'}</span>
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) =>
              'flex h-10 items-center gap-3 rounded-lg px-3 text-nav-link transition-colors ' +
              (isActive
                ? 'bg-surface-card text-brand-deep'
                : 'text-body hover:bg-surface-soft hover:text-ink')
            }
          >
            <Icon size={18} className="shrink-0" />
            <span className="hidden md:inline">{label}</span>
          </NavLink>
        ))}
      </nav>

      <Link
        to="/session"
        title="Back to learning"
        className="flex h-12 items-center gap-3 border-t border-hairline px-6 text-nav-link text-fg-muted hover:text-brand"
      >
        <GraduationCap size={18} className="shrink-0" />
        <span className="hidden md:inline">Back to learning</span>
      </Link>

      <div className="border-t border-hairline p-3 text-sm">
        <p className="mb-2 truncate text-fg-muted">{user?.displayName ?? user?.email}</p>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate('/');
          }}
          className="w-full rounded-lg border border-hairline px-3 py-1.5 text-left text-nav-link hover:bg-surface-soft"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
