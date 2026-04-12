import {
  Baby, LayoutDashboard, Stethoscope, TrendingUp,
  Syringe, Pill, FileText, Receipt, Users, LogOut, Radio,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/lib/contexts/AppContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { APP_TITLE, APP_TAGLINE } from '@/lib/appMeta';
import { testSupabaseConnection } from '@/lib/supabase/connection-test';
import { toast } from 'sonner';
import { useState } from 'react';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Children', url: '/children', icon: Users },
  { title: 'Hospital Visits', url: '/visits', icon: Stethoscope },
  { title: 'Growth Charts', url: '/growth', icon: TrendingUp },
  { title: 'Vaccinations', url: '/vaccinations', icon: Syringe },
  { title: 'Prescriptions', url: '/prescriptions', icon: Pill },
  { title: 'Documents', url: '/documents', icon: FileText },
  { title: 'Billing', url: '/billing', icon: Receipt },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();
  const { children, selectedChildId, setSelectedChildId, usesRemoteData, signOut } = useApp();
  const [testingConn, setTestingConn] = useState(false);


  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2" title={collapsed ? `${APP_TITLE} — ${APP_TAGLINE}` : undefined}>
          <Baby className="h-6 w-6 text-primary shrink-0" aria-hidden />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <span className="font-display font-bold text-lg text-primary block leading-tight">{APP_TITLE}</span>
              <span className="text-[10px] text-muted-foreground leading-tight block mt-0.5 line-clamp-2">{APP_TAGLINE}</span>
            </div>
          )}
        </div>
        {!collapsed && children.length > 0 && (
          <Select value={selectedChildId || ''} onValueChange={setSelectedChildId}>
            <SelectTrigger className="mt-3">
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              {children.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === '/'} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                      <item.icon className="h-4 w-4 mr-2 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {usesRemoteData && (
          <SidebarGroup>
            <SidebarGroupLabel>Account</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    disabled={testingConn}
                    onClick={async () => {
                      setTestingConn(true);
                      try {
                        const result = await testSupabaseConnection();
                        const lines = result.steps.map((s) => `${s.ok ? '✓' : '✗'} ${s.name}${s.detail ? `: ${s.detail}` : ''}`);
                        if (result.ok) {
                          toast.success('Supabase connection OK', { description: lines.join('\n'), duration: 8000 });
                        } else {
                          toast.error('Supabase check failed', { description: lines.join('\n'), duration: 12000 });
                        }
                      } finally {
                        setTestingConn(false);
                      }
                    }}
                  >
                    <Radio className="h-4 w-4 mr-2 shrink-0" />
                    {!collapsed && <span>{testingConn ? 'Testing…' : 'Test Supabase'}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    onClick={async () => {
                      await signOut();
                      navigate('/login', { replace: true });
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2 shrink-0" />
                    {!collapsed && <span>Sign out</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

    </Sidebar>
  );
}
