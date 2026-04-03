import {
  Baby, LayoutDashboard, Stethoscope, TrendingUp,
  Syringe, Pill, FileText, Receipt, Users
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';
import { toast } from 'sonner';

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
  const location = useLocation();
  const { children, selectedChildId, setSelectedChildId } = useApp();


  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Baby className="h-6 w-6 text-primary shrink-0" />
          {!collapsed && <span className="font-display font-bold text-lg text-primary">BabyTracker</span>}
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
      </SidebarContent>

      {!collapsed && (
        <SidebarFooter className="p-4 space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={exportData}>
            <Download className="h-4 w-4" /> Export Data
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import Data
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
