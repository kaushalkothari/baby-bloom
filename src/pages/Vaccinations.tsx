import { ReactNode, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '@/lib/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Syringe, Check, Image as ImageIcon, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { format, startOfDay, isAfter } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { vaccineSchedule, getVaccineDueDate, immunizationReferenceLinks } from '@/lib/data/vaccineSchedule';
import { Vaccination, VaccinationStatus } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type CompleteFormFields = {
  location: string;
  locationCity: string;
  locationState: string;
  administeredBy: string;
  vaccineManufacturer: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  administrationSite: string;
  completedDate: string;
};

type CompleteContext = {
  kind: 'scheduled';
  vaccineName: string;
  dueDate: string;
  record?: Vaccination;
};

function ageBucketLabel(ageInWeeks: number, t: (key: string, opts?: any) => string): string {
  const map: Record<number, string> = {
    0: t('vaccinations.ageBuckets.atBirth'),
    6: t('vaccinations.ageBuckets.weeks6'),
    10: t('vaccinations.ageBuckets.weeks10'),
    14: t('vaccinations.ageBuckets.weeks14'),
    39: t('vaccinations.ageBuckets.months9to12'),
    68: t('vaccinations.ageBuckets.months16to24'),
    260: t('vaccinations.ageBuckets.years5to6'),
    520: t('vaccinations.ageBuckets.years10'),
    832: t('vaccinations.ageBuckets.years16'),
  };
  if (ageInWeeks in map) return map[ageInWeeks];
  // Fallback for any new schedule items.
  if (ageInWeeks < 52) return t('vaccinations.ageBuckets.weeks', { count: ageInWeeks });
  const years = Math.round((ageInWeeks / 52) * 10) / 10;
  return t('vaccinations.ageBuckets.years', { count: years });
}

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

function trimToOptional(s: string | undefined): string | undefined {
  const t = s?.trim();
  return t || undefined;
}

function prefillCompleteForm(record: Partial<Vaccination> | undefined): CompleteFormFields {
  return {
    location: record?.location?.trim() ?? '',
    locationCity: record?.locationCity?.trim() ?? '',
    locationState: record?.locationState?.trim() ?? '',
    administeredBy: record?.administeredBy?.trim() ?? '',
    vaccineManufacturer: record?.vaccineManufacturer?.trim() ?? '',
    batchNumber: record?.batchNumber?.trim() ?? '',
    manufacturingDate: record?.manufacturingDate ?? '',
    expiryDate: record?.expiryDate ?? '',
    administrationSite: record?.administrationSite?.trim() ?? '',
    completedDate: todayIsoDate(),
  };
}

function validateCompleteForm(f: CompleteFormFields, t: (key: string) => string): string | null {
  if (!f.location.trim()) return t('vaccinations.errors.hospitalRequired');
  return null;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}:</span> {children}
    </p>
  );
}

function DetailsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {title}
      </p>
      <div className="text-xs space-y-1">{children}</div>
    </div>
  );
}

function statusBadgeClass(status: VaccinationStatus): string {
  if (status === 'completed') return 'bg-success text-success-foreground';
  if (status === 'overdue') return 'bg-destructive text-destructive-foreground';
  return 'bg-secondary text-secondary-foreground';
}

export default function Vaccinations() {
  const { selectedChild, vaccinations, addVaccination, updateVaccination } = useApp();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const cardScrollRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Vaccination>>({});
  const [photoViewOpen, setPhotoViewOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | VaccinationStatus>('all');
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeContext, setCompleteContext] = useState<CompleteContext | null>(null);
  const [completeForm, setCompleteForm] = useState<CompleteFormFields>(() => prefillCompleteForm(undefined));
  const [focusedVaxKey, setFocusedVaxKey] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState<string | null>(null);

  const childVax = useMemo(
    () => (selectedChild ? vaccinations.filter((v) => v.childId === selectedChild.id) : []),
    [selectedChild, vaccinations],
  );

  const scheduleWithStatus = useMemo(() => {
    if (!selectedChild) return [];
    return vaccineSchedule.map((vs) => {
      const record = childVax.find((v) => v.vaccineName === vs.name);
      const dueDate = getVaccineDueDate(selectedChild.dateOfBirth, vs.ageInWeeks);
      let status: VaccinationStatus = 'upcoming';
      if (record?.completedDate) status = 'completed';
      else if (new Date(dueDate) < new Date()) status = 'overdue';
      return { ...vs, dueDate, status, record };
    });
  }, [selectedChild, childVax]);

  type ScheduleRow = (typeof scheduleWithStatus)[number];

  const grouped = useMemo(() => {
    if (!selectedChild || scheduleWithStatus.length === 0) return [];
    const uniqueAges = Array.from(new Set(scheduleWithStatus.map((v) => v.ageInWeeks))).sort((a, b) => a - b);
    return uniqueAges
      .map((ageInWeeks) => {
        const rows = scheduleWithStatus
          .filter((r) => r.ageInWeeks === ageInWeeks)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
        return { ageInWeeks, label: ageBucketLabel(ageInWeeks, t), rows, shown };
      })
      .filter((g) => filter === 'all' || g.shown.length > 0);
  }, [selectedChild, scheduleWithStatus, filter, t]);

  useEffect(() => {
    if (!focusedVaxKey) return;
    const stillThere = grouped.some((grp) =>
      grp.shown.some((vs) => `${grp.ageInWeeks}::${vs.name}` === focusedVaxKey),
    );
    if (!stillThere) setFocusedVaxKey(null);
  }, [focusedVaxKey, grouped]);

  useEffect(() => {
    const inView = (key: string | null) =>
      key &&
      grouped.some((grp) => grp.shown.some((vs) => `${grp.ageInWeeks}::${vs.name}` === key));
    if (!inView(expandedCard)) setExpandedCard(null);
    if (!inView(recordOpen)) setRecordOpen(null);
  }, [expandedCard, recordOpen, grouped]);

  useEffect(() => {
    const ageRaw = searchParams.get('ageWeeks');
    const vaxName = searchParams.get('vax');
    if (ageRaw === null || !vaxName) return;
    const key = `${ageRaw}::${vaxName}`;
    setFilter('all');
    setFocusedVaxKey(key);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('ageWeeks');
        next.delete('vax');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!focusedVaxKey) return;
    const raf = requestAnimationFrame(() => {
      const el = cardScrollRefs.current.get(focusedVaxKey);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(raf);
  }, [focusedVaxKey]);

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">{t('empty.selectChildFirst')}</p>;

  const openCompleteScheduled = (vs: ScheduleRow) => {
    setCompleteForm(prefillCompleteForm(vs.record));
    setCompleteContext({ kind: 'scheduled', vaccineName: vs.name, dueDate: vs.dueDate, record: vs.record });
    setCompleteOpen(true);
  };

  const submitComplete = () => {
    const err = validateCompleteForm(completeForm, t);
    if (err) {
      toast.error(err);
      return;
    }
    if (!completeContext) return;
    const details = {
      completedDate: trimToOptional(completeForm.completedDate) ?? todayIsoDate(),
      location: completeForm.location.trim(),
      locationCity: trimToOptional(completeForm.locationCity),
      locationState: trimToOptional(completeForm.locationState),
      administeredBy: trimToOptional(completeForm.administeredBy),
      vaccineManufacturer: trimToOptional(completeForm.vaccineManufacturer),
      batchNumber: trimToOptional(completeForm.batchNumber),
      manufacturingDate: trimToOptional(completeForm.manufacturingDate),
      expiryDate: trimToOptional(completeForm.expiryDate),
      administrationSite: trimToOptional(completeForm.administrationSite),
    };
    const { vaccineName, dueDate, record } = completeContext;
    if (record) {
      updateVaccination({ ...record, ...details });
    } else {
      addVaccination({
        id: crypto.randomUUID(),
        childId: selectedChild.id,
        vaccineName,
        dueDate,
        ...details,
        createdAt: new Date().toISOString(),
      });
    }
    toast.success(t('vaccinations.markedCompleted', { name: vaccineName }));
    setCompleteOpen(false);
    setCompleteContext(null);
  };

  const handleAddCustom = () => {
    if (!form.vaccineName || !form.dueDate) {
      toast.error(t('vaccinations.vaccineNameRequired'));
      return;
    }
    addVaccination({
      ...form,
      id: crypto.randomUUID(),
      childId: selectedChild.id,
      createdAt: new Date().toISOString(),
    } as Vaccination);
    toast.success(t('vaccinations.vaccinationAdded'));
    setOpen(false);
    setForm({});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold">{t('vaccinations.title')}</h1>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setForm({});
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> {t('vaccinations.customAdd')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">{t('vaccinations.addCustomTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('vaccinations.form.vaccineName')} *</Label>
                <Input value={form.vaccineName || ''} onChange={e => setForm(p => ({ ...p, vaccineName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vax-due">{t('vaccinations.form.dueDate')} *</Label>
                <DatePicker
                  id="vax-due"
                  value={form.dueDate || ''}
                  onChange={(v) => setForm((p) => ({ ...p, dueDate: v }))}
                  fromYear={new Date().getFullYear() - 5}
                  toYear={new Date().getFullYear() + 10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vax-completed">{t('vaccinations.form.dateGiven')}</Label>
                <DatePicker
                  id="vax-completed"
                  value={form.completedDate || ''}
                  onChange={(v) => setForm((p) => ({ ...p, completedDate: v }))}
                  allowClear
                  disabled={(d) => isAfter(startOfDay(d), startOfDay(new Date()))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vax-hospital">{t('vaccinations.form.hospitalName')}</Label>
                <Input
                  id="vax-hospital"
                  value={form.location || ''}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder={t('vaccinations.form.clinicOrHospital')}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="vax-city">{t('vaccinations.form.city')}</Label>
                  <Input
                    id="vax-city"
                    value={form.locationCity || ''}
                    onChange={(e) => setForm((p) => ({ ...p, locationCity: e.target.value }))}
                    placeholder={t('vaccinations.form.city')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vax-state">{t('vaccinations.form.state')}</Label>
                  <Input
                    id="vax-state"
                    value={form.locationState || ''}
                    onChange={(e) => setForm((p) => ({ ...p, locationState: e.target.value }))}
                    placeholder={t('vaccinations.form.state')}
                  />
                </div>
              </div>
              <div><Label>{t('vaccinations.form.administeredBy')}</Label><Input value={form.administeredBy || ''} onChange={e => setForm(p => ({ ...p, administeredBy: e.target.value }))} placeholder={t('vaccinations.form.nurseOrDoctor')} /></div>
              <div><Label>{t('vaccinations.form.site')}</Label><Input value={form.administrationSite || ''} onChange={e => setForm(p => ({ ...p, administrationSite: e.target.value }))} placeholder={t('vaccinations.form.siteExample')} /></div>
              <div><Label>{t('vaccinations.form.vaccineCompany')}</Label><Input value={form.vaccineManufacturer || ''} onChange={e => setForm(p => ({ ...p, vaccineManufacturer: e.target.value }))} /></div>
              <div><Label>{t('vaccinations.form.batchNumber')}</Label><Input value={form.batchNumber || ''} onChange={e => setForm(p => ({ ...p, batchNumber: e.target.value }))} /></div>
              <div className="space-y-2">
                <Label htmlFor="vax-mfg">{t('vaccinations.form.manufacturingDate')}</Label>
                <DatePicker
                  id="vax-mfg"
                  value={form.manufacturingDate || ''}
                  onChange={(v) => setForm((p) => ({ ...p, manufacturingDate: v }))}
                  allowClear
                  fromYear={new Date().getFullYear() - 10}
                  toYear={new Date().getFullYear() + 2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vax-expiry">{t('vaccinations.form.expiryDate')}</Label>
                <DatePicker
                  id="vax-expiry"
                  value={form.expiryDate || ''}
                  onChange={(v) => setForm((p) => ({ ...p, expiryDate: v }))}
                  allowClear
                  fromYear={new Date().getFullYear() - 2}
                  toYear={new Date().getFullYear() + 15}
                />
              </div>
              <div><Label>{t('vaccinations.form.notes')}</Label><Textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>

              <Button onClick={handleAddCustom} className="w-full">{t('dashboard.addVaccination')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t('vaccinations.filterLabel')}</span>
        {(['all', 'upcoming', 'overdue', 'completed'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="capitalize">
            {t(`vaccinations.status.${f}`)}
          </Button>
        ))}
      </div>

      <div className="space-y-6">
        {grouped.map((g) => {
          const counts = {
            completed: g.rows.filter((r) => r.status === 'completed').length,
            overdue: g.rows.filter((r) => r.status === 'overdue').length,
            upcoming: g.rows.filter((r) => r.status === 'upcoming').length,
          };

          return (
            <div key={g.ageInWeeks} className="space-y-3">
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div className="space-y-0.5">
                  <h2 className="text-lg font-display font-semibold">{g.label}</h2>
                  <p className="text-xs text-muted-foreground">
                    {g.rows.length} {t('vaccinations.vaccines')} · {counts.completed} {t('vaccinations.completed')} · {counts.overdue} {t('vaccinations.overdue')} · {counts.upcoming} {t('vaccinations.upcoming')}
                  </p>
                </div>
                {filter !== 'all' && (
                  <Badge variant="outline" className="capitalize">
                    {t('vaccinations.showing')}: {t(`vaccinations.status.${filter}`)} ({g.shown.length})
                  </Badge>
                )}
              </div>

              <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
                {g.shown.map((vs: ScheduleRow) => {
                  const cardFocusKey = `${g.ageInWeeks}::${vs.name}`;
                  const isFocused = focusedVaxKey === cardFocusKey;
                  const isCompleted = vs.status === 'completed';
                  const record = vs.record;
                  const isExpanded = expandedCard === cardFocusKey;
                  const isRecordOpen = recordOpen === cardFocusKey;

                  const hasRecord =
                    !!record &&
                    (isCompleted ||
                      !!(
                        record.completedDate ||
                        record.location ||
                        record.locationCity ||
                        record.locationState ||
                        record.administeredBy ||
                        record.administrationSite ||
                        record.vaccineManufacturer ||
                        record.batchNumber ||
                        record.manufacturingDate ||
                        record.expiryDate ||
                        record.notes?.trim() ||
                        record.cardPhoto
                      ));
                  const hasNotes = !!vs.remarks || !!(vs.sideEffects && vs.sideEffects.length > 0);

                  return (
                    <div
                      key={vs.name}
                      className="h-full min-h-0"
                      ref={(el) => {
                        if (el) cardScrollRefs.current.set(cardFocusKey, el);
                        else cardScrollRefs.current.delete(cardFocusKey);
                      }}
                    >
                      <Card
                        className={cn(
                          'flex h-full flex-col cursor-pointer transition-[box-shadow,transform,opacity] duration-200',
                          isCompleted && 'opacity-75',
                          isFocused && 'relative z-10 scale-[1.01] shadow-lg ring-2 ring-primary ring-offset-2 ring-offset-background',
                        )}
                        onClick={() => setFocusedVaxKey((cur) => (cur === cardFocusKey ? null : cardFocusKey))}
                      >
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <div className="min-w-0">
                            <CardTitle className="text-base font-display flex items-center gap-2">
                              <Syringe className="h-4 w-4 shrink-0 text-primary" />{' '}
                              <span className="truncate">{vs.name}</span>
                            </CardTitle>
                            {vs.description ? (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{vs.description}</p>
                            ) : null}
                          </div>
                          <Badge className={cn('shrink-0', statusBadgeClass(vs.status))}>
                            {t(`vaccinations.status.${vs.status}`)}
                          </Badge>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm space-y-1 min-w-0">
                              {isCompleted && record?.completedDate ? (
                                <>
                                  <InfoRow label={t('vaccinations.cards.doneLabel')}>
                                    {format(new Date(record.completedDate), 'PP')}
                                  </InfoRow>
                                  <p className="text-xs text-muted-foreground">
                                    {t('vaccinations.cards.dueLabel')}{' '}
                                    {format(new Date(vs.dueDate), 'PP')}
                                  </p>
                                </>
                              ) : (
                                <InfoRow label={t('vaccinations.cards.dueLabel')}>
                                  {format(new Date(vs.dueDate), 'PP')}
                                </InfoRow>
                              )}
                              {vs.dose && <InfoRow label={t('vaccinations.cards.dose')}>{vs.dose}</InfoRow>}
                              {vs.route && <InfoRow label={t('vaccinations.cards.route')}>{vs.route}</InfoRow>}
                              {record?.administrationSite ? (
                                <InfoRow label={t('vaccinations.cards.site')}>{record.administrationSite}</InfoRow>
                              ) : (
                                vs.site && (
                                  <InfoRow label={t('vaccinations.cards.recommendedSite')}>{vs.site}</InfoRow>
                                )
                              )}
                            </div>
                            <div
                              className="flex flex-col items-end gap-2 shrink-0 self-start"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-1">
                                {record?.cardPhoto && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="gap-1"
                                    onClick={() => setPhotoViewOpen(record.cardPhoto!)}
                                    aria-label={t('common.viewImage')}
                                  >
                                    <ImageIcon className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant={isCompleted ? 'secondary' : 'outline'}
                                  className="gap-1"
                                  onClick={() => openCompleteScheduled(vs)}
                                >
                                  <Check className="h-3 w-3" />{' '}
                                  {isCompleted ? t('vaccinations.actions.edit') : t('vaccinations.actions.done')}
                                </Button>
                              </div>
                              {hasRecord && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-muted-foreground h-7 px-2"
                                  onClick={() => setRecordOpen(isRecordOpen ? null : cardFocusKey)}
                                >
                                  {isRecordOpen
                                    ? t('vaccinations.actions.hideRecord')
                                    : t('vaccinations.actions.viewRecord')}
                                </Button>
                              )}
                            </div>
                          </div>

                          {(hasRecord || hasNotes) && (
                            <div className="mt-auto space-y-2" onClick={(e) => e.stopPropagation()}>
                              {hasRecord && isRecordOpen && record && (
                                <div className="rounded-md bg-muted/40 p-3">
                                  <DetailsSection title={t('vaccinations.sections.administrationRecord')}>
                                    {record.completedDate && (
                                      <InfoRow label={t('vaccinations.form.dateGiven')}>
                                        {format(new Date(record.completedDate), 'PP')}
                                      </InfoRow>
                                    )}
                                    {record.location && (
                                      <InfoRow label={t('vaccinations.form.hospitalName')}>{record.location}</InfoRow>
                                    )}
                                    {record.locationCity && (
                                      <InfoRow label={t('vaccinations.form.city')}>{record.locationCity}</InfoRow>
                                    )}
                                    {record.locationState && (
                                      <InfoRow label={t('vaccinations.form.state')}>{record.locationState}</InfoRow>
                                    )}
                                    {record.administeredBy && (
                                      <InfoRow label={t('vaccinations.form.administeredBy')}>
                                        {record.administeredBy}
                                      </InfoRow>
                                    )}
                                    {record.administrationSite && (
                                      <InfoRow label={t('vaccinations.form.site')}>{record.administrationSite}</InfoRow>
                                    )}
                                    {record.vaccineManufacturer && (
                                      <InfoRow label={t('vaccinations.form.vaccineCompany')}>
                                        {record.vaccineManufacturer}
                                      </InfoRow>
                                    )}
                                    {record.batchNumber && (
                                      <InfoRow label={t('vaccinations.form.batchNumber')}>{record.batchNumber}</InfoRow>
                                    )}
                                    {record.manufacturingDate && (
                                      <InfoRow label={t('vaccinations.form.manufacturingDate')}>
                                        {format(new Date(record.manufacturingDate), 'PP')}
                                      </InfoRow>
                                    )}
                                    {record.expiryDate && (
                                      <InfoRow label={t('vaccinations.form.expiryDate')}>
                                        {format(new Date(record.expiryDate), 'PP')}
                                      </InfoRow>
                                    )}
                                    {record.notes?.trim() && (
                                      <p className="whitespace-pre-wrap">
                                        <span className="text-muted-foreground">{t('vaccinations.form.notes')}:</span>{' '}
                                        {record.notes.trim()}
                                      </p>
                                    )}
                                    {record.cardPhoto && (
                                      <p className="text-muted-foreground">
                                        {t('vaccinations.photoViewer.title')}:{' '}
                                        <button
                                          type="button"
                                          className="text-primary underline-offset-2 hover:underline"
                                          onClick={() => setPhotoViewOpen(record.cardPhoto!)}
                                        >
                                          {t('common.viewImage')}
                                        </button>
                                      </p>
                                    )}
                                  </DetailsSection>
                                </div>
                              )}

                              {hasNotes && (
                                <div className="space-y-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-xs text-muted-foreground gap-1 h-7"
                                    onClick={() =>
                                      setExpandedCard(isExpanded ? null : cardFocusKey)
                                    }
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                    {isExpanded
                                      ? t('vaccinations.actions.hideDetails')
                                      : t('vaccinations.actions.moreDetails')}
                                  </Button>

                                  {isExpanded && (
                                    <div className="rounded-md bg-muted/50 p-3">
                                      <DetailsSection title={t('vaccinations.sections.notes')}>
                                        {vs.remarks && (
                                          <p>
                                            <span className="font-medium text-foreground/80">
                                              {t('vaccinations.notes.remarks')}:
                                            </span>{' '}
                                            {vs.remarks}
                                          </p>
                                        )}
                                        {vs.sideEffects && vs.sideEffects.length > 0 && (
                                          <div>
                                            <p className="font-medium text-foreground/80 mb-1">
                                              {t('vaccinations.notes.potentialSideEffects')}
                                            </p>
                                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                                              {vs.sideEffects.map((se, i) => (
                                                <li key={i}>{se}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </DetailsSection>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reference links */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('vaccinations.sections.referenceLinks')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            {immunizationReferenceLinks.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog
        open={completeOpen}
        onOpenChange={(o) => {
          setCompleteOpen(o);
          if (!o) setCompleteContext(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {completeContext
                ? t('vaccinations.completeDialog.titleWithName', { name: completeContext.vaccineName })
                : t('vaccinations.completeDialog.titleGeneric')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">{t('vaccinations.completeDialog.whenWhere')}</h3>
              <div className="space-y-2">
                <Label htmlFor="complete-done">{t('vaccinations.form.dateGiven')}</Label>
                <p className="text-xs text-muted-foreground">{t('vaccinations.completeDialog.defaultsToday')}</p>
                <DatePicker
                  id="complete-done"
                  value={completeForm.completedDate}
                  onChange={(v) => setCompleteForm((p) => ({ ...p, completedDate: v }))}
                  allowClear
                  disabled={(d) => isAfter(startOfDay(d), startOfDay(new Date()))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complete-hospital">{t('vaccinations.form.hospitalName')} *</Label>
                <Input
                  id="complete-hospital"
                  value={completeForm.location}
                  onChange={(e) => setCompleteForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder={t('vaccinations.form.clinicOrHospital')}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="complete-city">{t('vaccinations.form.city')}</Label>
                  <Input
                    id="complete-city"
                    value={completeForm.locationCity}
                    onChange={(e) => setCompleteForm((p) => ({ ...p, locationCity: e.target.value }))}
                    placeholder={t('vaccinations.form.city')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complete-state">{t('vaccinations.form.state')}</Label>
                  <Input
                    id="complete-state"
                    value={completeForm.locationState}
                    onChange={(e) => setCompleteForm((p) => ({ ...p, locationState: e.target.value }))}
                    placeholder={t('vaccinations.form.state')}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="complete-by">{t('vaccinations.form.administeredBy')}</Label>
                <Input
                  id="complete-by"
                  value={completeForm.administeredBy}
                  onChange={(e) => setCompleteForm((p) => ({ ...p, administeredBy: e.target.value }))}
                  placeholder={t('vaccinations.form.nurseOrDoctor')}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">{t('vaccinations.completeDialog.howGiven')}</h3>
              <div>
                <Label htmlFor="complete-site">{t('vaccinations.form.site')}</Label>
                <Input
                  id="complete-site"
                  value={completeForm.administrationSite}
                  onChange={(e) => setCompleteForm((p) => ({ ...p, administrationSite: e.target.value }))}
                  placeholder={t('vaccinations.form.siteExample')}
                />
              </div>
            </section>

            <Accordion type="single" collapsible>
              <AccordionItem value="vial" className="border-b-0">
                <AccordionTrigger className="py-2 text-sm font-semibold text-muted-foreground hover:no-underline">
                  {t('vaccinations.completeDialog.vialDetails')}
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div>
                    <Label htmlFor="complete-company">{t('vaccinations.form.vaccineCompany')}</Label>
                    <Input
                      id="complete-company"
                      value={completeForm.vaccineManufacturer}
                      onChange={(e) => setCompleteForm((p) => ({ ...p, vaccineManufacturer: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="complete-batch">{t('vaccinations.form.batchNumber')}</Label>
                    <Input
                      id="complete-batch"
                      value={completeForm.batchNumber}
                      onChange={(e) => setCompleteForm((p) => ({ ...p, batchNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="complete-mfg">{t('vaccinations.form.manufacturingDate')}</Label>
                    <DatePicker
                      id="complete-mfg"
                      value={completeForm.manufacturingDate}
                      onChange={(v) => setCompleteForm((p) => ({ ...p, manufacturingDate: v }))}
                      allowClear
                      fromYear={new Date().getFullYear() - 10}
                      toYear={new Date().getFullYear() + 2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="complete-expiry">{t('vaccinations.form.expiryDate')}</Label>
                    <DatePicker
                      id="complete-expiry"
                      value={completeForm.expiryDate}
                      onChange={(v) => setCompleteForm((p) => ({ ...p, expiryDate: v }))}
                      allowClear
                      fromYear={new Date().getFullYear() - 2}
                      toYear={new Date().getFullYear() + 15}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCompleteOpen(false);
                setCompleteContext(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={submitComplete}>
              <Check className="h-4 w-4 mr-1" /> {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Viewer Dialog */}
      <Dialog open={!!photoViewOpen} onOpenChange={() => setPhotoViewOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">{t('vaccinations.photoViewer.title')}</DialogTitle></DialogHeader>
          {photoViewOpen && (
            <img src={photoViewOpen} alt={t('vaccinations.photoViewer.alt')} className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
