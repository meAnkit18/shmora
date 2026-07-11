import { Outlet } from 'react-router-dom';
import { StudioSidebar } from './StudioSidebar';

export function StudioLayout() {
  return (
    <div className="flex h-full w-full bg-canvas text-body">
      <StudioSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
