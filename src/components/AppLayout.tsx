import { Outlet } from 'react-router-dom';
import { BottomTabBar } from '@/components/BottomTabBar';

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <main className="flex-1 pb-20 overflow-auto">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}
