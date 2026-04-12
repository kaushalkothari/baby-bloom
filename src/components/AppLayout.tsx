import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Outlet } from 'react-router-dom';
import { useApp } from '@/lib/contexts/AppContext';

export function AppLayout() {
  const { userEmail, usesRemoteData } = useApp();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between gap-3 border-b px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger />
            {usesRemoteData && userEmail && (
              <span className="text-xs text-muted-foreground truncate max-w-[50vw] md:max-w-md" title={userEmail}>
                {userEmail}
              </span>
            )}
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
