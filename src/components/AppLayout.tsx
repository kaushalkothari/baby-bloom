import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '@/lib/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LogOut } from 'lucide-react';

export function AppLayout() {
  const { userEmail, usesRemoteData, signOut } = useApp();
  const navigate = useNavigate();

  const initials = (email: string) => {
    const base = email.split('@')[0] || email;
    const parts = base.split(/[._-]+/).filter(Boolean);
    const a = (parts[0]?.[0] || base[0] || 'U').toUpperCase();
    const b = (parts[1]?.[0] || '').toUpperCase();
    return (a + b).slice(0, 2);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between gap-3 border-b px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger />
            {usesRemoteData && userEmail && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 w-10 rounded-full p-0"
                    aria-label="Account"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background text-xs font-semibold">
                      {initials(userEmail)}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-2">
                  <div className="px-2 py-2">
                    <div className="text-sm font-medium leading-none">Account</div>
                    <div className="mt-1 text-xs text-muted-foreground truncate" title={userEmail}>
                      {userEmail}
                    </div>
                  </div>
                  <div className="h-px bg-muted my-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    onClick={async () => {
                      await signOut();
                      navigate('/login', { replace: true });
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </PopoverContent>
              </Popover>
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
