import { useApp } from '@/lib/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Baby, Stethoscope, Syringe, TrendingUp, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInMonths, differenceInDays } from 'date-fns';
import { vaccineSchedule, getVaccineDueDate } from '@/lib/data/vaccineSchedule';
import { APP_TITLE, APP_TAGLINE } from '@/lib/appMeta';
import { getChildAvatar } from '@/lib/childAvatars';
import { useTranslation } from 'react-i18next';

function vaccinationsFocusPath(ageInWeeks: number, vaccineName: string) {
  return `/vaccinations?ageWeeks=${ageInWeeks}&vax=${encodeURIComponent(vaccineName)}`;
}

export default function Dashboard() {
  const { children, selectedChild, visits, vaccinations, prescriptions, billing } = useApp();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Baby className="h-20 w-20 text-primary/40 mb-6" />
        <h1 className="text-3xl font-display font-bold mb-2">{t('dashboard.welcomeTo', { appTitle: APP_TITLE })}</h1>
        <p className="text-sm text-primary/80 font-medium mb-2">{APP_TAGLINE}</p>
        <p className="text-muted-foreground mb-6 max-w-md">
          {t('dashboard.startByAddingChild')}
        </p>
        <Button size="lg" onClick={() => navigate('/children')} className="gap-2">
          <Plus className="h-5 w-5" /> {t('dashboard.addYourFirstChild')}
        </Button>
      </div>
    );
  }

  if (!selectedChild) return null;

  const childVisits = visits.filter(v => v.childId === selectedChild.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const childVaccinations = vaccinations.filter(v => v.childId === selectedChild.id);
  const childPrescriptions = prescriptions.filter(p => p.childId === selectedChild.id);
  const childBilling = billing.filter(b => b.childId === selectedChild.id);

  const latestVisit = childVisits[0];
  const ageMonths = differenceInMonths(new Date(), new Date(selectedChild.dateOfBirth));
  const ageDays = differenceInDays(new Date(), new Date(selectedChild.dateOfBirth));

  const completedVaxNames = new Set(childVaccinations.filter(v => v.completedDate).map(v => v.vaccineName));
  const upcomingVaxList = vaccineSchedule.filter(vs => !completedVaxNames.has(vs.name));
  const upcomingVax = upcomingVaxList[0] ?? null;
  const nextVaxDue = upcomingVax ? getVaccineDueDate(selectedChild.dateOfBirth, upcomingVax.ageInWeeks) : null;
  const upcomingVaxPreview = upcomingVaxList.slice(0, 5);

  const totalSpent = childBilling.reduce((sum, b) => sum + b.amount, 0);
  const activeRx = childPrescriptions.filter(p => p.active).length;

  const ageText = ageMonths >= 1 ? `${ageMonths} month${ageMonths > 1 ? 's' : ''}` : `${ageDays} day${ageDays > 1 ? 's' : ''}`;
  const dashAvatar = getChildAvatar(selectedChild.avatarId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl leading-none"
            aria-hidden
          >
            {dashAvatar ? dashAvatar.emoji : <Baby className="h-6 w-6 text-primary" />}
          </div>
          <div>
          <h1 className="text-3xl font-display font-bold">{selectedChild.name}</h1>
          <p className="text-muted-foreground">
            {ageText} {t('dashboard.old')} · {t('dashboard.born')} {format(new Date(selectedChild.dateOfBirth), 'PP')}
          </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/visits')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.lastVisit')}</CardTitle>
            <Stethoscope className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{latestVisit ? format(new Date(latestVisit.date), 'PP') : t('dashboard.noVisits')}</div>
            {latestVisit && <p className="text-xs text-muted-foreground mt-1">{latestVisit.reason}</p>}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/growth')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.latestGrowth')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            {latestVisit?.weight || latestVisit?.height ? (
              <div className="text-xl font-bold">
                {latestVisit.weight && `${latestVisit.weight} kg`}
                {latestVisit.weight && latestVisit.height && ' · '}
                {latestVisit.height && `${latestVisit.height} cm`}
              </div>
            ) : (
              <div className="text-xl font-bold">{t('dashboard.noData')}</div>
            )}
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() =>
            upcomingVax
              ? navigate(vaccinationsFocusPath(upcomingVax.ageInWeeks, upcomingVax.name))
              : navigate('/vaccinations')
          }
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.nextVaccination')}</CardTitle>
            <Syringe className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            {upcomingVax ? (
              <>
                <div className="text-lg font-bold">{upcomingVax.name}</div>
                <p className="text-xs text-muted-foreground mt-1">{t('dashboard.due')}: {format(new Date(nextVaxDue!), 'PP')}</p>
              </>
            ) : (
              <div className="text-xl font-bold">{t('dashboard.allDone')} 🎉</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.quickStats')}</CardTitle>
            <Baby className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('dashboard.activeRx')}</span>
              <Badge variant="secondary">{activeRx}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('dashboard.totalVisits')}</span>
              <Badge variant="secondary">{childVisits.length}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('dashboard.totalSpent')}</span>
              <span className="font-semibold">₹{totalSpent.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">{t('dashboard.recentVisits')}</CardTitle>
          </CardHeader>
          <CardContent>
            {childVisits.length === 0 ? (
              <p className="text-muted-foreground text-sm">No visits recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {childVisits.slice(0, 5).map(v => (
                  <div key={v.id} className="flex items-start justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium text-sm">{v.reason}</p>
                      <p className="text-xs text-muted-foreground">{v.hospitalName} · Dr. {v.doctorName}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(v.date), 'PP')}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">{t('dashboard.upcomingVaccinations')}</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingVaxPreview.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('dashboard.allVaccinationsCompleted')}</p>
            ) : (
              <div className="space-y-3">
                {upcomingVaxPreview.map(vs => {
                  const due = getVaccineDueDate(selectedChild.dateOfBirth, vs.ageInWeeks);
                  const isOverdue = new Date(due) < new Date();
                  return (
                    <button
                      type="button"
                      key={vs.name}
                      className="flex w-full items-center justify-between gap-2 border-b pb-2 text-left last:border-0 rounded-md -mx-1 px-1 hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(vaccinationsFocusPath(vs.ageInWeeks, vs.name))}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{vs.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{vs.description}</p>
                      </div>
                      <Badge variant={isOverdue ? 'destructive' : 'secondary'} className="text-xs shrink-0">
                        {isOverdue ? t('dashboard.overdue') : format(new Date(due), 'PP')}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate('/visits')} className="gap-2"><Plus className="h-4 w-4" /> {t('dashboard.newVisit')}</Button>
        <Button variant="outline" onClick={() => navigate('/vaccinations')} className="gap-2"><Syringe className="h-4 w-4" /> {t('dashboard.addVaccination')}</Button>
        <Button variant="outline" onClick={() => navigate('/documents')} className="gap-2"><Plus className="h-4 w-4" /> {t('dashboard.uploadDocument')}</Button>
      </div>
    </div>
  );
}
