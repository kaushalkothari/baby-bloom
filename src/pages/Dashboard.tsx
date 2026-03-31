import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Baby, Syringe, TrendingUp, Plus, AlertCircle, Clock, ChevronDown, HeartPulse, Pill } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInMonths, differenceInDays } from 'date-fns';
import { vaccineSchedule, getVaccineDueDate } from '@/data/vaccineSchedule';
import { useState } from 'react';

export default function Dashboard() {
  const { children, selectedChild, selectedChildId, setSelectedChildId, visits, vaccinations, prescriptions } = useApp();
  const navigate = useNavigate();
  const [showChildPicker, setShowChildPicker] = useState(false);

  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6">
        <Baby className="h-20 w-20 text-primary/40 mb-6" />
        <h1 className="text-3xl font-display font-bold mb-2">Welcome to BabyTracker</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          Start by adding your child's profile to track hospital visits, vaccinations, growth, and more.
        </p>
        <Button size="lg" onClick={() => navigate('/children')} className="gap-2">
          <Plus className="h-5 w-5" /> Add Your First Child
        </Button>
      </div>
    );
  }

  if (!selectedChild) return null;

  const childVisits = visits.filter(v => v.childId === selectedChild.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const childVaccinations = vaccinations.filter(v => v.childId === selectedChild.id);
  const childPrescriptions = prescriptions.filter(p => p.childId === selectedChild.id);

  const latestVisit = childVisits[0];
  const ageMonths = differenceInMonths(new Date(), new Date(selectedChild.dateOfBirth));
  const ageDays = differenceInDays(new Date(), new Date(selectedChild.dateOfBirth));
  const ageText = ageMonths >= 1 ? `${ageMonths} month${ageMonths > 1 ? 's' : ''}` : `${ageDays} day${ageDays > 1 ? 's' : ''}`;

  // Vaccination stats
  const completedVaxNames = new Set(childVaccinations.filter(v => v.completedDate).map(v => v.vaccineName));
  const totalVax = vaccineSchedule.length;
  const completedCount = vaccineSchedule.filter(vs => completedVaxNames.has(vs.name)).length;
  const progressPct = totalVax > 0 ? (completedCount / totalVax) * 100 : 0;

  const overdueVax = vaccineSchedule.filter(vs => {
    if (completedVaxNames.has(vs.name)) return false;
    const due = getVaccineDueDate(selectedChild.dateOfBirth, vs.ageInWeeks);
    return new Date(due) < new Date();
  });

  const upcomingVax = vaccineSchedule.filter(vs => {
    if (completedVaxNames.has(vs.name)) return false;
    const due = getVaccineDueDate(selectedChild.dateOfBirth, vs.ageInWeeks);
    return new Date(due) >= new Date();
  });

  const activeRx = childPrescriptions.filter(p => p.active).length;
  const latestWeight = latestVisit?.weight;
  const latestHeight = latestVisit?.height;

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-accent/30 px-4 pt-4 pb-5 relative">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowChildPicker(!showChildPicker)}
            className="flex items-center gap-3"
          >
            <div className="h-12 w-12 rounded-full bg-muted-foreground/30 flex items-center justify-center text-card font-bold text-lg">
              {selectedChild.name.charAt(0)}
            </div>
            <div className="text-left">
              <h1 className="text-xl font-display font-bold">{selectedChild.name}</h1>
              <p className="text-xs text-muted-foreground">{ageText}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          <Button size="icon" variant="ghost" onClick={() => navigate('/children')} className="rounded-full">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Child picker dropdown */}
        {showChildPicker && children.length > 1 && (
          <div className="absolute left-4 right-4 top-[72px] z-20 bg-card border border-border rounded-xl shadow-lg p-2 space-y-1">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => { setSelectedChildId(child.id); setShowChildPicker(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${child.id === selectedChildId ? 'bg-accent' : 'hover:bg-muted'}`}
              >
                <div className="h-8 w-8 rounded-full bg-muted-foreground/30 flex items-center justify-center text-card font-bold text-sm">
                  {child.name.charAt(0)}
                </div>
                <span className="font-medium text-sm">{child.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 space-y-4 -mt-3">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          <div
            className="rounded-xl bg-accent/40 p-3 flex flex-col items-center gap-1 cursor-pointer hover:bg-accent/60 transition-colors"
            onClick={() => navigate('/growth')}
          >
            <HeartPulse className="h-5 w-5 text-accent-foreground/70" />
            <span className="text-xl font-bold">{latestWeight ? `${latestWeight} kg` : '—'}</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Weight</span>
          </div>
          <div
            className="rounded-xl bg-warning/15 p-3 flex flex-col items-center gap-1 cursor-pointer hover:bg-warning/25 transition-colors"
            onClick={() => navigate('/growth')}
          >
            <TrendingUp className="h-5 w-5 text-warning" />
            <span className="text-xl font-bold">{latestHeight ? `${latestHeight} cm` : '—'}</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Height</span>
          </div>
          <div
            className="rounded-xl bg-secondary/60 p-3 flex flex-col items-center gap-1 cursor-pointer hover:bg-secondary/80 transition-colors"
            onClick={() => navigate('/prescriptions')}
          >
            <Pill className="h-5 w-5 text-secondary-foreground/70" />
            <span className="text-xl font-bold">{activeRx}</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Active Rx</span>
          </div>
        </div>

        {/* Vaccination Progress */}
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-success" />
            <h2 className="font-display font-bold">Vaccination Progress</h2>
          </div>
          <Progress value={progressPct} className="h-2" />
          <p className="text-xs text-muted-foreground">{completedCount} of {totalVax} completed</p>
        </div>

        {/* Overdue Vaccines */}
        {overdueVax.length > 0 && (
          <div className="rounded-xl border-l-4 border-l-destructive bg-card border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <h2 className="font-display font-bold text-destructive">Overdue Vaccines</h2>
            </div>
            <div className="space-y-2">
              {overdueVax.slice(0, 5).map(vs => (
                <div key={vs.name} className="flex items-center gap-2 border-b border-border last:border-0 pb-2 last:pb-0">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{vs.name}</p>
                    <p className="text-xs text-muted-foreground">Due: {format(new Date(getVaccineDueDate(selectedChild.dateOfBirth, vs.ageInWeeks)), 'yyyy-MM-dd')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Vaccines */}
        {upcomingVax.length > 0 && (
          <div className="rounded-xl bg-card border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              <h2 className="font-display font-bold">Upcoming Vaccines</h2>
            </div>
            <div className="space-y-2">
              {upcomingVax.slice(0, 5).map(vs => (
                <div key={vs.name} className="flex items-center gap-2 border-b border-border last:border-0 pb-2 last:pb-0">
                  <div className="h-2 w-2 rounded-full bg-info" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{vs.name}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(getVaccineDueDate(selectedChild.dateOfBirth, vs.ageInWeeks)), 'yyyy-MM-dd')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Visits */}
        {childVisits.length > 0 && (
          <div className="rounded-xl bg-card border border-border p-4 space-y-3">
            <h2 className="font-display font-bold">Recent Visits</h2>
            <div className="space-y-2">
              {childVisits.slice(0, 3).map(v => (
                <div key={v.id} className="flex items-start justify-between border-b border-border last:border-0 pb-2 last:pb-0">
                  <div>
                    <p className="font-medium text-sm">{v.reason}</p>
                    <p className="text-xs text-muted-foreground">{v.hospitalName} · Dr. {v.doctorName}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(v.date), 'PP')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
