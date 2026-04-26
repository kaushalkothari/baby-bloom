import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/lib/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Pencil, Stethoscope, ChevronDown, Pill, ReceiptIndianRupee, FileText, ExternalLink } from 'lucide-react';
import { format, startOfDay, isAfter, isBefore, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { HospitalVisit, Prescription } from '@/types';
import { toast } from 'sonner';
import { medsFromRx } from '@/lib/documents/linkedDocuments';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const emptyVisit = (): Partial<HospitalVisit> => ({
  date: new Date().toISOString().split('T')[0], hospitalName: '', doctorName: '', reason: '', description: '',
});

/** INR in Related records (explicit rupee + Indian digit grouping). */
function formatRelatedBillingAmount(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2 font-medium text-foreground break-words">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

export default function Visits() {
  const { selectedChild, visits, addVisit, updateVisit, deleteVisit, prescriptions, billing, documents } = useApp();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HospitalVisit | null>(null);
  const [form, setForm] = useState<Partial<HospitalVisit>>(emptyVisit());
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailVisitId, setDetailVisitId] = useState<string | null>(null);

  const childVisits = useMemo(() => {
    if (!selectedChild) return [];
    const from = dateFrom?.trim() || '';
    const to = dateTo?.trim() || '';
    // Prefer stable behavior: if user picks inverted range, treat it as swapped.
    const rangeStart = from && to && from > to ? to : from;
    const rangeEnd = from && to && from > to ? from : to;
    return visits
      .filter((v) => v.childId === selectedChild.id)
      .filter(
        (v) =>
          !search ||
          v.reason.toLowerCase().includes(search.toLowerCase()) ||
          v.hospitalName.toLowerCase().includes(search.toLowerCase()) ||
          v.doctorName.toLowerCase().includes(search.toLowerCase()),
      )
      .filter((v) => {
        if (rangeStart && v.date < rangeStart) return false;
        if (rangeEnd && v.date > rangeEnd) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedChild, visits, search, dateFrom, dateTo]);

  useEffect(() => {
    if (detailVisitId && !childVisits.some((v) => v.id === detailVisitId)) {
      setDetailVisitId(null);
    }
  }, [childVisits, detailVisitId]);

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">{t('empty.selectChildFirst')}</p>;

  const today = startOfDay(new Date());
  const setRange = (from: Date, to: Date) => {
    const a = startOfDay(from);
    const b = startOfDay(to);
    const start = isBefore(a, b) ? a : b;
    const end = isBefore(a, b) ? b : a;
    setDateFrom(format(start, 'yyyy-MM-dd'));
    setDateTo(format(end, 'yyyy-MM-dd'));
  };

  const handleSave = () => {
    if (!form.date || !form.hospitalName || !form.reason) {
      toast.error(t('visits.requiredError'));
      return;
    }
    if (editing) {
      updateVisit({ ...editing, ...form } as HospitalVisit);
      toast.success(t('visits.updated'));
    } else {
      addVisit({ ...form, id: crypto.randomUUID(), childId: selectedChild.id, createdAt: new Date().toISOString() } as HospitalVisit);
      toast.success(t('visits.added'));
    }
    setOpen(false); setEditing(null); setForm(emptyVisit());
  };

  const openEdit = (v: HospitalVisit) => { setEditing(v); setForm(v); setOpen(true); };
  const set = (key: string, val: string | number) => setForm(p => ({ ...p, [key]: val }));

  // Records linked to a visit by visitId OR same-day match on the record's date.
  const getRelatedRecords = (visit: HospitalVisit) => {
    const linkedToVisit = (record: { childId: string; visitId?: string; date: string }) =>
      record.childId === selectedChild!.id && (record.visitId === visit.id || record.date === visit.date);
    // Uploaded files from Documents: same day/visit. Skip prescription & receipt types (those belong on Prescriptions / Billing).
    const docList = documents.filter(
      (d) =>
        linkedToVisit(d) && d.type !== 'prescription' && d.type !== 'receipt',
    );
    return {
      rxList: prescriptions.filter(linkedToVisit),
      billList: billing.filter(linkedToVisit),
      docList,
    };
  };

  const detailVisit = detailVisitId ? childVisits.find((v) => v.id === detailVisitId) ?? null : null;
  const detailRelated = detailVisit ? getRelatedRecords(detailVisit) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold">{t('pages.visits.title')}</h1>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); setForm(emptyVisit()); } }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> {t('visits.addVisit')}</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-display">{editing ? t('visits.editVisit') : t('visits.newVisit')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="visit-date">{t('visits.form.dateRequired')}</Label>
                <DatePicker
                  id="visit-date"
                  value={form.date || ''}
                  onChange={(v) => set('date', v)}
                  disabled={(d) => isAfter(startOfDay(d), startOfDay(new Date()))}
                />
              </div>
              <div><Label>{t('visits.info.hospitalName')} *</Label><Input value={form.hospitalName || ''} onChange={e => set('hospitalName', e.target.value)} /></div>
              <div><Label>{t('visits.info.doctorName')}</Label><Input value={form.doctorName || ''} onChange={e => set('doctorName', e.target.value)} /></div>
              <div><Label>{t('visits.form.reasonRequired')}</Label><Input value={form.reason || ''} onChange={e => set('reason', e.target.value)} placeholder={t('visits.form.reasonPlaceholder')} /></div>
              <div><Label>{t('visits.form.details')}</Label><Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('visits.info.weightKg')}</Label><Input type="number" step="0.01" value={form.weight || ''} onChange={e => set('weight', parseFloat(e.target.value) || 0)} /></div>
                <div><Label>{t('visits.info.heightCm')}</Label><Input type="number" step="0.1" value={form.height || ''} onChange={e => set('height', parseFloat(e.target.value) || 0)} /></div>
                <div><Label>{t('visits.info.headCircumferenceCm')}</Label><Input type="number" step="0.1" value={form.headCircumference || ''} onChange={e => set('headCircumference', parseFloat(e.target.value) || 0)} /></div>
                <div><Label>{t('visits.info.temperatureF')}</Label><Input type="number" step="0.1" value={form.temperature || ''} onChange={e => set('temperature', parseFloat(e.target.value) || 0)} /></div>
              </div>
              <div><Label>{t('visits.form.additionalNotes')}</Label><Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} /></div>
              <Button onClick={handleSave} className="w-full">{editing ? t('common.update') : t('visits.addVisit')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="w-full sm:max-w-sm">
          <Label htmlFor="visit-search" className="text-xs text-muted-foreground">{t('common.search')}</Label>
          <Input
            id="visit-search"
            placeholder={t('visits.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setRange(today, today)}>
            {t('common.today')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRange(subDays(today, 6), today)}>
            {t('common.last7Days')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRange(subDays(today, 29), today)}>
            {t('common.last30Days')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRange(startOfMonth(today), endOfMonth(today))}>
            {t('common.thisMonth')}
          </Button>
          {(dateFrom || dateTo) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
              {t('common.clearDates')}
            </Button>
          )}
        </div>
        <div className="w-full sm:w-auto sm:min-w-[220px]">
          <Label htmlFor="visit-date-from" className="text-xs text-muted-foreground">{t('common.from')}</Label>
          <DatePicker
            id="visit-date-from"
            value={dateFrom}
            onChange={setDateFrom}
            allowClear
            disabled={(d) => {
              const day = startOfDay(d);
              if (isAfter(day, today)) return true;
              if (dateTo) return isAfter(day, startOfDay(new Date(dateTo)));
              return false;
            }}
          />
        </div>
        <div className="w-full sm:w-auto sm:min-w-[220px]">
          <Label htmlFor="visit-date-to" className="text-xs text-muted-foreground">{t('common.to')}</Label>
          <DatePicker
            id="visit-date-to"
            value={dateTo}
            onChange={setDateTo}
            allowClear
            disabled={(d) => {
              const day = startOfDay(d);
              if (isAfter(day, today)) return true;
              if (dateFrom) return isBefore(day, startOfDay(new Date(dateFrom)));
              return false;
            }}
          />
        </div>
      </div>

      {childVisits.length === 0 ? (
        <div className="text-center py-20">
          <Stethoscope className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">{t('visits.empty')}</p>
        </div>
      ) : (
        <div className="relative space-y-4">
          {childVisits.map(v => {
            const { rxList, billList, docList } = getRelatedRecords(v);
            const hasRelated = rxList.length > 0 || billList.length > 0 || docList.length > 0;
            const isExpanded = expandedId === v.id;

            return (
              <Card
                key={v.id}
                className={cn(
                  'cursor-pointer transition-[box-shadow,opacity] duration-200 hover:shadow-md',
                )}
                onClick={() => setDetailVisitId(v.id)}
              >
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex-1">
                    <CardTitle className="text-base font-display">{v.reason}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {v.hospitalName} · {v.doctorName?.trim() ? t('common.drWithName', { name: v.doctorName.trim() }) : '—'} ·{' '}
                      {format(new Date(v.date), 'PPP')}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        deleteVisit(v.id);
                        toast.success(t('visits.deleted'));
                        setDetailVisitId((id) => (id === v.id ? null : id));
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {v.description && <p className="text-sm">{v.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {v.weight && <span>⚖️ {v.weight} kg</span>}
                    {v.height && <span>📏 {v.height} cm</span>}
                    {v.headCircumference && <span>🧠 {v.headCircumference} cm</span>}
                    {v.temperature && <span>🌡️ {v.temperature}°F</span>}
                  </div>
                  {v.notes && <p className="text-xs text-muted-foreground italic">{v.notes}</p>}

                  {/* Related records section */}
                  {hasRelated && (
                    <div onClick={(e) => e.stopPropagation()}>
                    <Collapsible open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : v.id)}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2 text-xs w-full justify-start text-muted-foreground hover:text-foreground">
                          <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          {t('visits.relatedRecords')}
                          <div className="flex gap-1 ml-auto">
                            {rxList.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Pill className="h-2.5 w-2.5 mr-0.5" />{rxList.length}</Badge>}
                            {billList.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><ReceiptIndianRupee className="h-2.5 w-2.5 mr-0.5" />{billList.length}</Badge>}
                            {docList.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><FileText className="h-2.5 w-2.5 mr-0.5" />{docList.length}</Badge>}
                          </div>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-3 mt-2">
                        {/* Prescriptions */}
                        {rxList.length > 0 && (
                          <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                              <Pill className="h-3.5 w-3.5 text-primary" /> {t('visits.sections.prescriptions')}
                            </div>
                            {rxList.map((rx: Prescription) => {
                              const meds = medsFromRx(rx);
                              return (
                                <div key={rx.id} className="text-sm border-l-2 border-primary/30 pl-3 space-y-1">
                                  {meds.map((m, i) => (
                                    <p key={i}><span className="font-medium">{m.name}</span> — {m.dosage} · {m.frequency} · {m.duration}</p>
                                  ))}
                                  <p className="text-xs text-muted-foreground">
                                    {rx.prescribingDoctor?.trim()
                                      ? t('common.drWithName', { name: rx.prescribingDoctor.trim() })
                                      : '—'}
                                  </p>
                                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
                                    <Link to={`/prescriptions?highlight=${encodeURIComponent(rx.id)}`}>
                                      <ExternalLink className="h-3 w-3" />
                                      {t('visits.openIn.prescriptions')}
                                    </Link>
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Billing */}
                        {billList.length > 0 && (
                          <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                              <ReceiptIndianRupee className="h-3.5 w-3.5 text-primary" /> {t('visits.sections.billing')}
                            </div>
                            {billList.map(b => (
                              <div key={b.id} className="text-sm border-l-2 border-primary/30 pl-3 space-y-1">
                                <div className="flex justify-between gap-2">
                                  <span>
                                    {b.hospitalName}
                                    {b.description?.trim()
                                      ? ` — ${b.description.replace(/\$/g, '₹')}`
                                      : ''}
                                  </span>
                                  <span className="font-bold shrink-0 tabular-nums">{formatRelatedBillingAmount(b.amount)}</span>
                                </div>
                                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
                                  <Link to={`/billing?highlight=${encodeURIComponent(b.id)}`}>
                                    <ExternalLink className="h-3 w-3" />
                                    {t('visits.openIn.billing')}
                                  </Link>
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Uploaded documents (Documents tab) for this visit day — lab reports, discharge, etc. */}
                        {docList.length > 0 && (
                          <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                              <FileText className="h-3.5 w-3.5 text-primary" /> {t('visits.sections.documents')}
                            </div>
                            {docList.map((d) => (
                              <div key={d.id} className="text-sm border-l-2 border-primary/30 pl-3 space-y-1">
                                <div>
                                  <span className="font-medium">{d.name}</span>
                                  <Badge variant="outline" className="ml-2 text-[10px]">{t(`documents.types.${d.type}`)}</Badge>
                                </div>
                                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
                                  <Link to={`/documents?highlight=${encodeURIComponent(d.id)}`}>
                                    <ExternalLink className="h-3 w-3" />
                                    {t('visits.openIn.documents')}
                                  </Link>
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Visit detail dialog (dimmed backdrop via Dialog overlay) */}
      <Dialog open={detailVisit != null} onOpenChange={(o) => { if (!o) setDetailVisitId(null); }}>
        <DialogContent className="max-w-2xl max-h-[min(90dvh,720px)] gap-0 p-0 sm:rounded-lg">
          {detailVisit && (
            <>
              <div className="border-b border-border bg-muted/30 px-6 py-4 pr-14">
                <DialogHeader className="space-y-2 text-left">
                  <DialogTitle className="font-display text-xl leading-snug pr-2">{detailVisit.reason}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    {t('visits.detail.subtitle')}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="space-y-5 px-6 py-4">
                <div className="space-y-3">
                  <SectionTitle>{t('visits.detail.visitInformation')}</SectionTitle>
                  <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
                    <InfoRow label={t('visits.info.hospitalName')} value={detailVisit.hospitalName || '—'} />
                    <InfoRow label={t('visits.info.doctorName')} value={detailVisit.doctorName?.trim() || '—'} />
                    <InfoRow label={t('visits.info.dateOfVisit')} value={format(new Date(detailVisit.date), 'PPP')} />
                  </div>
                </div>

                {(detailVisit.weight || detailVisit.height || detailVisit.headCircumference || detailVisit.temperature) && (
                  <div className="space-y-3">
                    <SectionTitle>{t('visits.detail.vitals')}</SectionTitle>
                    <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
                      {detailVisit.weight != null ? (
                        <InfoRow label={t('visits.info.weightKg')} value={detailVisit.weight} />
                      ) : null}
                      {detailVisit.height != null ? (
                        <InfoRow label={t('visits.info.heightCm')} value={detailVisit.height} />
                      ) : null}
                      {detailVisit.headCircumference != null ? (
                        <InfoRow label={t('visits.info.headCircumferenceCm')} value={detailVisit.headCircumference} />
                      ) : null}
                      {detailVisit.temperature != null ? (
                        <InfoRow label={t('visits.info.temperatureF')} value={detailVisit.temperature} />
                      ) : null}
                    </div>
                  </div>
                )}

                {(detailVisit.description?.trim() || detailVisit.notes?.trim()) && (
                  <div className="space-y-3">
                    <SectionTitle>{t('visits.detail.notes')}</SectionTitle>
                    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                      {detailVisit.description?.trim() && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground">{t('visits.detail.description')}</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailVisit.description.trim()}</p>
                        </div>
                      )}
                      {detailVisit.notes?.trim() && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground">{t('visits.detail.additionalNotes')}</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailVisit.notes.trim()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {detailRelated && (detailRelated.rxList.length > 0 || detailRelated.billList.length > 0 || detailRelated.docList.length > 0) && (
                  <div className="space-y-3">
                    <SectionTitle>{t('visits.detail.relatedRecords')}</SectionTitle>
                    <div className="space-y-3">
                      {detailRelated.rxList.length > 0 && (
                        <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Pill className="h-3.5 w-3.5 text-primary" /> {t('visits.sections.prescriptions')}
                          </div>
                          {detailRelated.rxList.map((rx: Prescription) => {
                            const meds = medsFromRx(rx);
                            return (
                              <div key={rx.id} className="text-sm border-l-2 border-primary/30 pl-3 space-y-1">
                                {meds.map((m, i) => (
                                  <p key={i}><span className="font-medium">{m.name}</span> — {m.dosage} · {m.frequency} · {m.duration}</p>
                                ))}
                                <p className="text-xs text-muted-foreground">
                                  {rx.prescribingDoctor?.trim()
                                    ? t('common.drWithName', { name: rx.prescribingDoctor.trim() })
                                    : '—'}
                                </p>
                                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
                                  <Link to={`/prescriptions?highlight=${encodeURIComponent(rx.id)}`}>
                                    <ExternalLink className="h-3 w-3" />
                                    {t('visits.openIn.prescriptions')}
                                  </Link>
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {detailRelated.billList.length > 0 && (
                        <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <ReceiptIndianRupee className="h-3.5 w-3.5 text-primary" /> {t('visits.sections.billing')}
                          </div>
                          {detailRelated.billList.map((b) => (
                            <div key={b.id} className="text-sm border-l-2 border-primary/30 pl-3 space-y-1">
                              <div className="flex justify-between gap-2">
                                <span>
                                  {b.hospitalName}
                                  {b.description?.trim()
                                    ? ` — ${b.description.replace(/\$/g, '₹')}`
                                    : ''}
                                </span>
                                <span className="font-bold shrink-0 tabular-nums">{formatRelatedBillingAmount(b.amount)}</span>
                              </div>
                              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
                                <Link to={`/billing?highlight=${encodeURIComponent(b.id)}`}>
                                  <ExternalLink className="h-3 w-3" />
                                  {t('visits.openIn.billing')}
                                </Link>
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {detailRelated.docList.length > 0 && (
                        <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <FileText className="h-3.5 w-3.5 text-primary" /> {t('visits.sections.documents')}
                          </div>
                          {detailRelated.docList.map((d) => (
                            <div key={d.id} className="text-sm border-l-2 border-primary/30 pl-3 space-y-1">
                              <div>
                                <span className="font-medium">{d.name}</span>
                                <Badge variant="outline" className="ml-2 text-[10px]">{t(`documents.types.${d.type}`)}</Badge>
                              </div>
                              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
                                <Link to={`/documents?highlight=${encodeURIComponent(d.id)}`}>
                                  <ExternalLink className="h-3 w-3" />
                                  {t('visits.openIn.documents')}
                                </Link>
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col gap-2 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:justify-between sm:space-x-0">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setDetailVisitId(null);
                      openEdit(detailVisit);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    {t('common.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      deleteVisit(detailVisit.id);
                      toast.success(t('visits.deleted'));
                      setDetailVisitId(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('common.delete')}
                  </Button>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => setDetailVisitId(null)}>
                  {t('common.close')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
