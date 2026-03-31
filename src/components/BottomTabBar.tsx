import { Home, CalendarDays, Pill, Syringe, MoreHorizontal } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Home', icon: Home, path: '/' },
  { label: 'Visits', icon: CalendarDays, path: '/visits' },
  { label: 'Medicines', icon: Pill, path: '/prescriptions' },
  { label: 'Vaccines', icon: Syringe, path: '/vaccinations' },
  { label: 'More', icon: MoreHorizontal, path: '/more' },
];

export function BottomTabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[56px]',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <tab.icon className={cn('h-5 w-5', isActive && 'fill-primary/20')} />
                <span className="text-[10px] font-semibold">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
