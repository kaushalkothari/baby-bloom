import { ReactNode, useState } from 'react';
import { useApp } from '@/lib/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Syringe, Check, Image as ImageIcon, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { format, startOfDay, isAfter } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { vaccineSchedule, getVaccineDueDate, immunizationReferenceLinks } from '@/lib/data/vaccineSchedule';
import { Vaccination, VaccinationStatus } from '@/types';
import { toast } from 'sonner';

type CompleteFormFields = {
  location: string;
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

const AGE_BUCKET_LABELS: Record<number, string> = {
  0: 'At birth',
  6: '6 weeks',
  10: '10 weeks',
  14: '14 weeks',
  39: '9–12 months',
  68: '16–24 months',
  260: '5–6 years',
  520: '10 years',
  832: '16 years',
};

function ageBucketLabel(ageInWeeks: number): string {
  if (ageInWeeks in AGE_BUCKET_LABELS) return AGE_BUCKET_LABELS[ageInWeeks];
  // Fallback for any new schedule items.
  if (ageInWeeks < 52) return `${ageInWeeks} weeks`;
  const years = Math.round((ageInWeeks / 52) * 10) / 10;
  return `${years} years`;
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
    administeredBy: record?.administeredBy?.trim() ?? '',
    vaccineManufacturer: record?.vaccineManufacturer?.trim() ?? '',
    batchNumber: record?.batchNumber?.trim() ?? '',
    manufacturingDate: record?.manufacturingDate ?? '',
    expiryDate: record?.expiryDate ?? '',
    administrationSite: record?.administrationSite?.trim() ?? '',
    completedDate: todayIsoDate(),
  };
}

function validateCompleteForm(f: CompleteFormFields): string | null {
  if (!f.location.trim()) return 'Hospital name is required.';
  return null;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}:</span> {children}
    </p>
  );
}

function statusBadgeClass(status: VaccinationStatus): string {
  if (status === 'completed') return 'bg-success text-success-foreground';
  if (status === 'overdue') return 'bg-destructive text-destructive-foreground';
  return 'bg-secondary text-secondary-foreground';
}

export default function Vaccinations() {
  const { selectedChild, vaccinations, addVaccination, updateVaccination } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Vaccination>>({});
  const [photoViewOpen, setPhotoViewOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | VaccinationStatus>('all');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeContext, setCompleteContext] = useState<CompleteContext | null>(null);
  const [completeForm, setCompleteForm] = useState<CompleteFormFields>(() => prefillCompleteForm(undefined));

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">Please select or add a child first.</p>;

  const childVax = vaccinations.filter(v => v.childId === selectedChild.id);

  const scheduleWithStatus = vaccineSchedule.map(vs => {
    const record = childVax.find(v => v.vaccineName === vs.name);
    const dueDate = getVaccineDueDate(selectedChild.dateOfBirth, vs.ageInWeeks);
    let status: VaccinationStatus = 'upcoming';
    if (record?.completedDate) status = 'completed';
    else if (new Date(dueDate) < new Date()) status = 'overdue';
    return { ...vs, dueDate, status, record };
  });

  type ScheduleRow = (typeof scheduleWithStatus)[number];

  const uniqueAges = Array.from(new Set(scheduleWithStatus.map(v => v.ageInWeeks))).sort((a, b) => a - b);
  const grouped = uniqueAges
    .map((ageInWeeks) => {
      const rows = scheduleWithStatus
        .filter((r) => r.ageInWeeks === ageInWeeks)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
      return { ageInWeeks, label: ageBucketLabel(ageInWeeks), rows, shown };
    })
    // Hide empty sections when filtering.
    .filter((g) => filter === 'all' || g.shown.length > 0);

  const openCompleteScheduled = (vs: ScheduleRow) => {
    setCompleteForm(prefillCompleteForm(vs.record));
    setCompleteContext({ kind: 'scheduled', vaccineName: vs.name, dueDate: vs.dueDate, record: vs.record });
    setCompleteOpen(true);
  };

  const submitComplete = () => {
    const err = validateCompleteForm(completeForm);
    if (err) {
      toast.error(err);
      return;
    }
    if (!completeContext) return;
    const details = {
      completedDate: trimToOptional(completeForm.completedDate) ?? todayIsoDate(),
      location: completeForm.location.trim(),
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
    toast.success(`${vaccineName} marked as completed!`);
    setCompleteOpen(false);
    setCompleteContext(null);
  };

  const handleAddCustom = () => {
    if (!form.vaccineName || !form.dueDate) {
      toast.error('Vaccine name and due date are required.');
      return;
    }
    addVaccination({
      ...form,
      id: crypto.randomUUID(),
      childId: selectedChild.id,
      createdAt: new Date().toISOString(),
    } as Vaccination);
    toast.success('Vaccination added!');
    setOpen(false);
    setForm({});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold">Vaccinations</h1>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setForm({});
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Custom
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Add Custom Vaccination</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Vaccine Name *</Label>
                <Input value={form.vaccineName || ''} onChange={e => setForm(p => ({ ...p, vaccineName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vax-due">Due Date *</Label>
                <DatePicker
                  id="vax-due"
                  value={form.dueDate || ''}
                  onChange={(v) => setForm((p) => ({ ...p, dueDate: v }))}
                  fromYear={new Date().getFullYear() - 5}
                  toYear={new Date().getFullYear() + 10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vax-completed">Date given</Label>
                <DatePicker
                  id="vax-completed"
                  value={form.completedDate || ''}
                  onChange={(v) => setForm((p) => ({ ...p, completedDate: v }))}
                  allowClear
                  disabled={(d) => isAfter(startOfDay(d), startOfDay(new Date()))}
                />
              </div>

              <div><Label>Hospital name</Label><Input value={form.location || ''} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Clinic or hospital" /></div>
              <div><Label>Administered by</Label><Input value={form.administeredBy || ''} onChange={e => setForm(p => ({ ...p, administeredBy: e.target.value }))} placeholder="Nurse or doctor" /></div>
              <div><Label>Site</Label><Input value={form.administrationSite || ''} onChange={e => setForm(p => ({ ...p, administrationSite: e.target.value }))} placeholder="e.g. Left thigh" /></div>
              <div><Label>Vaccine company</Label><Input value={form.vaccineManufacturer || ''} onChange={e => setForm(p => ({ ...p, vaccineManufacturer: e.target.value }))} /></div>
              <div><Label>Batch number</Label><Input value={form.batchNumber || ''} onChange={e => setForm(p => ({ ...p, batchNumber: e.target.value }))} /></div>
              <div className="space-y-2">
                <Label htmlFor="vax-mfg">Manufacturing date</Label>
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
                <Label htmlFor="vax-expiry">Expiry date</Label>
                <DatePicker
                  id="vax-expiry"
                  value={form.expiryDate || ''}
                  onChange={(v) => setForm((p) => ({ ...p, expiryDate: v }))}
                  allowClear
                  fromYear={new Date().getFullYear() - 2}
                  toYear={new Date().getFullYear() + 15}
                />
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>

              <Button onClick={handleAddCustom} className="w-full">Add Vaccination</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Filter:</span>
        {(['all', 'upcoming', 'overdue', 'completed'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="capitalize">
            {f}
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
                    {g.rows.length} vaccines · {counts.completed} completed · {counts.overdue} overdue · {counts.upcoming} upcoming
                  </p>
                </div>
                {filter !== 'all' && (
                  <Badge variant="outline" className="capitalize">
                    Showing: {filter} ({g.shown.length})
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {g.shown.map((vs: ScheduleRow) => {
                  const isExpanded = expandedCard === vs.name;
                  const hasDetails = !!vs.remarks || (vs.sideEffects && vs.sideEffects.length > 0);
                  const isCompleted = vs.status === 'completed';
                  const record = vs.record;

                  return (
                    <Card key={vs.name} className={isCompleted ? 'opacity-75' : ''}>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                          <CardTitle className="text-base font-display flex items-center gap-2">
                            <Syringe className="h-4 w-4 text-primary" /> {vs.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">{vs.description}</p>
                        </div>
                        <Badge className={statusBadgeClass(vs.status)}>{vs.status}</Badge>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm space-y-1">
                            <InfoRow label="Due">{format(new Date(vs.dueDate), 'PP')}</InfoRow>
                            {vs.dose && <InfoRow label="Dose">{vs.dose}</InfoRow>}
                            {vs.route && <InfoRow label="Route">{vs.route}</InfoRow>}
                            {record?.administrationSite
                              ? <InfoRow label="Site">{record.administrationSite}</InfoRow>
                              : vs.site && <InfoRow label="Recommended site">{vs.site}</InfoRow>}
                            {record?.completedDate && <InfoRow label="Done">{format(new Date(record.completedDate), 'PP')}</InfoRow>}
                            {record?.location && <InfoRow label="Hospital">{record.location}</InfoRow>}
                            {record?.administeredBy && <InfoRow label="By">{record.administeredBy}</InfoRow>}
                            {record?.vaccineManufacturer && <InfoRow label="Company">{record.vaccineManufacturer}</InfoRow>}
                            {record?.batchNumber && <InfoRow label="Batch">{record.batchNumber}</InfoRow>}
                            {record?.manufacturingDate && <InfoRow label="Mfg">{format(new Date(record.manufacturingDate), 'PP')}</InfoRow>}
                            {record?.expiryDate && <InfoRow label="Expiry">{format(new Date(record.expiryDate), 'PP')}</InfoRow>}
                          </div>
                          <div className="flex items-center gap-1">
                            {record?.cardPhoto && (
                              <Button size="sm" variant="ghost" className="gap-1" onClick={() => setPhotoViewOpen(record.cardPhoto!)}>
                                <ImageIcon className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant={isCompleted ? 'secondary' : 'outline'}
                              className="gap-1"
                              onClick={() => openCompleteScheduled(vs)}
                            >
                              <Check className="h-3 w-3" /> {isCompleted ? 'Edit' : 'Done'}
                            </Button>
                          </div>
                        </div>

                        {hasDetails && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs text-muted-foreground gap-1 h-7"
                            onClick={() => setExpandedCard(isExpanded ? null : vs.name)}
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {isExpanded ? 'Hide details' : 'More details'}
                          </Button>
                        )}

                        {isExpanded && (
                          <div className="text-xs space-y-2 rounded-md bg-muted/50 p-3">
                            {vs.remarks && (
                              <p><span className="font-medium text-foreground/80">Remarks:</span> {vs.remarks}</p>
                            )}
                            {vs.sideEffects && vs.sideEffects.length > 0 && (
                              <div>
                                <p className="font-medium text-foreground/80 mb-1">Potential side effects:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                                  {vs.sideEffects.map((se, i) => <li key={i}>{se}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
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
          <CardTitle className="text-sm font-medium text-muted-foreground">Reference Links</CardTitle>
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
                ? `Mark completed — ${completeContext.vaccineName}`
                : 'Mark vaccination completed'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="complete-hospital">Hospital name *</Label>
              <Input
                id="complete-hospital"
                value={completeForm.location}
                onChange={(e) => setCompleteForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="Clinic or hospital"
              />
            </div>
            <div>
              <Label htmlFor="complete-by">Administered by</Label>
              <Input
                id="complete-by"
                value={completeForm.administeredBy}
                onChange={(e) => setCompleteForm((p) => ({ ...p, administeredBy: e.target.value }))}
                placeholder="Nurse or doctor"
              />
            </div>
            <div>
              <Label htmlFor="complete-site">Site</Label>
              <Input
                id="complete-site"
                value={completeForm.administrationSite}
                onChange={(e) => setCompleteForm((p) => ({ ...p, administrationSite: e.target.value }))}
                placeholder="e.g. Left thigh"
              />
            </div>
            <div>
              <Label htmlFor="complete-company">Vaccine company</Label>
              <Input
                id="complete-company"
                value={completeForm.vaccineManufacturer}
                onChange={(e) => setCompleteForm((p) => ({ ...p, vaccineManufacturer: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="complete-batch">Batch number</Label>
              <Input
                id="complete-batch"
                value={completeForm.batchNumber}
                onChange={(e) => setCompleteForm((p) => ({ ...p, batchNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complete-mfg">Manufacturing date</Label>
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
              <Label htmlFor="complete-expiry">Expiry date</Label>
              <DatePicker
                id="complete-expiry"
                value={completeForm.expiryDate}
                onChange={(v) => setCompleteForm((p) => ({ ...p, expiryDate: v }))}
                allowClear
                fromYear={new Date().getFullYear() - 2}
                toYear={new Date().getFullYear() + 15}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complete-done">Date given</Label>
              <p className="text-xs text-muted-foreground">Defaults to today if not set.</p>
              <DatePicker
                id="complete-done"
                value={completeForm.completedDate}
                onChange={(v) => setCompleteForm((p) => ({ ...p, completedDate: v }))}
                allowClear
                disabled={(d) => isAfter(startOfDay(d), startOfDay(new Date()))}
              />
            </div>
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
              Cancel
            </Button>
            <Button type="button" onClick={submitComplete}>
              <Check className="h-4 w-4 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Viewer Dialog */}
      <Dialog open={!!photoViewOpen} onOpenChange={() => setPhotoViewOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Vaccine Card Photo</DialogTitle></DialogHeader>
          {photoViewOpen && (
            <img src={photoViewOpen} alt="Vaccine card" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
