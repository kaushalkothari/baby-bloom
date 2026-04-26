import {
  Baby, LayoutDashboard, Stethoscope, TrendingUp,
  Syringe, Pill, FileText, ReceiptIndianRupee, Users,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useApp } from '@/lib/contexts/AppContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { APP_TITLE, APP_TAGLINE } from '@/lib/appMeta';
import { getChildAvatar } from '@/lib/childAvatars';
import { useTranslation } from 'react-i18next';

const navItems = [
  { key: 'nav.dashboard', url: '/', icon: LayoutDashboard },
  { key: 'nav.children', url: '/children', icon: Users },
  { key: 'nav.visits', url: '/visits', icon: Stethoscope },
  { key: 'nav.growth', url: '/growth', icon: TrendingUp },
  { key: 'nav.vaccinations', url: '/vaccinations', icon: Syringe },
  { key: 'nav.prescriptions', url: '/prescriptions', icon: Pill },
  { key: 'nav.billing', url: '/billing', icon: ReceiptIndianRupee },
  { key: 'nav.documents', url: '/documents', icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { children, selectedChildId, setSelectedChildId } = useApp();
  const { t } = useTranslation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2" title={collapsed ? `${APP_TITLE} — ${APP_TAGLINE}` : undefined}>
          <img
            src="/babybloom_flower_512.png"
            alt={`${APP_TITLE} logo`}
            className="h-8 w-8 shrink-0 rounded-md object-contain"
          />
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
              <SelectValue placeholder={t('children.selectChild')} />
            </SelectTrigger>
            <SelectContent>
              {children.map((c) => {
                const av = getChildAvatar(c.avatarId);
                return (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span className="text-base leading-none w-6 text-center" aria-hidden>
                        {av ? av.emoji : '👶'}
                      </span>
                      <span>{c.name}</span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.navigation')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === '/'} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                      <item.icon className="h-4 w-4 mr-2 shrink-0" />
                      {!collapsed && <span>{t(item.key)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

    </Sidebar>
  );
}
