import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '@/lib/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Pill, Trash2, Pencil, Image, X } from 'lucide-react';
import { format, startOfDay, isAfter, isBefore, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { Prescription, Medicine } from '@/types';
import { toast } from 'sonner';
import { useFilePickerDialogGuard } from '@/hooks/useFilePickerDialogGuard';
import { normalizeImageDataUrl } from '@/lib/imageUtils';
import {
  MAX_IMAGE_PICK_BYTES,
  validateClientDataUrl,
  validatePickedFile,
} from '@/lib/security/uploads';
import { medsFromRx } from '@/lib/documents/linkedDocuments';
import { useHighlightScroll } from '@/hooks/useHighlightParam';
import { cn } from '@/lib/utils';

const MED_META_SENTINEL = '\n__bb_meta__:';

type TimesOfDay = 'morning' | 'afternoon' | 'night';
type MealTiming = Medicine['mealTiming'];
type Route = Medicine['route'];
type DurationUnit = Medicine['durationUnit'];
type DosageUnit = Medicine['dosageUnit'];

function summarizeMedicine(med: Medicine): string {
  const name = med.name?.trim() || 'New medicine';
  const dosage = med.dosageValue != null && med.dosageUnit ? `${med.dosageValue} ${med.dosageUnit}` : '';
  const dur = med.durationValue != null && med.durationUnit ? `${med.durationValue} ${med.durationUnit}` : '';
  const bits = [dosage, dur].filter(Boolean).join(' · ');
  return bits ? `${name} — ${bits}` : name;
}

function parseRxNotesToFields(notes: string | undefined): { chiefComplaint: string; condition: string } {
  const raw = (notes ?? '').trim();
  if (!raw) return { chiefComplaint: '', condition: '' };

  // New format:
  // Chief complaint: ...
  // Condition: ...
  const ccMatch = raw.match(/(?:^|\n)Chief complaint:\s*([\s\S]*?)(?=\nCondition:|$)/i);
  const condMatch = raw.match(/(?:^|\n)Condition:\s*([\s\S]*?)$/i);
  if (ccMatch || condMatch) {
    return {
      chiefComplaint: (ccMatch?.[1] ?? '').trim(),
      condition: (condMatch?.[1] ?? '').trim(),
    };
  }

  // Back-compat: treat old notes as chief complaint.
  return { chiefComplaint: raw, condition: '' };
}

function buildRxNotesFromFields(chiefComplaint: string | undefined, condition: string | undefined): string {
  const cc = chiefComplaint?.trim() || '';
  const cond = condition?.trim() || '';
  if (!cc && !cond) return '';
  // Condition is no longer a separate UI field; keep parsing support for older notes,
  // but only persist the chief complaint going forward.
  return `Chief complaint: ${cc || cond}`;
}

function unpackMedicine(m: Medicine): Medicine {
  const raw = m.duration || '';
  const idx = raw.indexOf(MED_META_SENTINEL);
  if (idx === -1) return m;
  const displayDuration = raw.slice(0, idx).trim();
  const metaRaw = raw.slice(idx + MED_META_SENTINEL.length).trim();
  try {
    const meta = JSON.parse(metaRaw) as Partial<Medicine>;
    return { ...m, ...meta, duration: displayDuration, instructions: meta.instructions ?? m.instructions };
  } catch {
    return { ...m, duration: displayDuration };
  }
}

function packMedicine(m: Medicine): Medicine {
  const dosageMl = Number.isFinite(m.dosageMl) ? m.dosageMl : undefined;
  const dosageValue = Number.isFinite(m.dosageValue) ? m.dosageValue : undefined;
  const durationValue = Number.isFinite(m.durationValue) ? m.durationValue : undefined;
  const timesOfDay = (m.timesOfDay ?? []).filter(Boolean) as TimesOfDay[];

  const dosageUnit = m.dosageUnit;
  const dosage =
    dosageValue != null && dosageUnit
      ? `${dosageValue} ${dosageUnit}`
      : dosageMl != null
        ? `${dosageMl} ml`
        : (m.dosage ?? '');
  const parts: string[] = [];
  if (timesOfDay.length) parts.push(timesOfDay.map((t) => t[0].toUpperCase() + t.slice(1)).join(', '));
  if (m.mealTiming) {
    const mealLabel: Record<NonNullable<MealTiming>, string> = {
      before_breakfast: 'Before breakfast',
      after_breakfast: 'After breakfast',
      before_food: 'Before food',
      after_food: 'After food',
      before_lunch: 'Before lunch',
      after_lunch: 'After lunch',
      before_dinner: 'Before dinner',
      after_dinner: 'After dinner',
    };
    parts.push(mealLabel[m.mealTiming]);
  }
  if (m.route) parts.push(m.route.toUpperCase());
  const frequency = parts.join(' · ') || (m.frequency ?? '');

  const durationText =
    durationValue != null && m.durationUnit
      ? `${durationValue} ${m.durationUnit}`
      : (m.duration ?? '');

  const meta: Partial<Medicine> = {
    dosageMl,
    dosageValue,
    dosageUnit,
    timesOfDay,
    mealTiming: m.mealTiming,
    route: m.route,
    durationValue,
    durationUnit: m.durationUnit,
    instructions: m.instructions?.trim() || undefined,
  };

  const storedDuration = `${durationText || ''}${MED_META_SENTINEL}${JSON.stringify(meta)}`;

  return {
    ...m,
    dosage,
    frequency,
    duration: storedDuration,
    instructions: meta.instructions,
    dosageMl,
    dosageValue,
    timesOfDay,
    durationValue,
  };
}

const emptyMedicine = (): Medicine => ({
  id: crypto.randomUUID(), name: '', dosage: '', frequency: '', duration: '',
});

const emptyRx = (): Partial<Prescription> & { medicines: Medicine[] } => ({
  medicines: [emptyMedicine()],
  prescribingDoctor: '',
  date: new Date().toISOString().split('T')[0],
  active: true,
  chiefComplaint: '',
  condition: '',
  notes: '',
  prescriptionImage: '',
});

export default function Prescriptions() {
  const { selectedChild, prescriptions, addPrescription, updatePrescription, deletePrescription } = useApp();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get('highlight');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Prescription | null>(null);
  const [form, setForm] = useState<Partial<Prescription> & { medicines: Medicine[] }>(emptyRx());
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [detailRxId, setDetailRxId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { pickingFile, beforePick, afterPick } = useFilePickerDialogGuard();

  const childRx = useMemo(() => {
    if (!selectedChild) return [];
    const from = dateFrom?.trim() || '';
    const to = dateTo?.trim() || '';
    const rangeStart = from && to && from > to ? to : from;
    const rangeEnd = from && to && from > to ? from : to;

    const q = search.trim().toLowerCase();

    return prescriptions
      .filter((p) => p.childId === selectedChild.id)
      .filter((p) => {
        if (rangeStart && p.date < rangeStart) return false;
        if (rangeEnd && p.date > rangeEnd) return false;
        return true;
      })
      .filter((p) => {
        if (!q) return true;
        const meds = medsFromRx(p);
        const hay = [
          p.prescribingDoctor,
          p.notes,
          ...meds.flatMap((m) => [m.name, m.dosage, m.frequency, m.duration]),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedChild, prescriptions, dateFrom, dateTo, search]);

  const highlightReady = Boolean(highlight && childRx.some((p) => p.id === highlight));
  useHighlightScroll(highlight, highlightReady && highlight ? `rx-${highlight}` : null, highlightReady);

  useEffect(() => {
    if (!selectedChild) {
      setDetailRxId(null);
      return;
    }
    if (detailRxId && !childRx.some((p) => p.id === detailRxId)) {
      setDetailRxId(null);
    }
  }, [selectedChild, childRx, detailRxId]);

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">Please select or add a child first.</p>;

  const today = startOfDay(new Date());
  const setRange = (from: Date, to: Date) => {
    const a = startOfDay(from);
    const b = startOfDay(to);
    const start = isBefore(a, b) ? a : b;
    const end = isBefore(a, b) ? b : a;
    setDateFrom(format(start, 'yyyy-MM-dd'));
    setDateTo(format(end, 'yyyy-MM-dd'));
  };

  const detailRx = detailRxId ? childRx.find((p) => p.id === detailRxId) ?? null : null;
  const detailMeds = detailRx ? medsFromRx(detailRx) : [];
  const detailTitle = (() => {
    if (!detailRx) return '';
    const { chiefComplaint } = parseRxNotesToFields(detailRx.notes);
    if (chiefComplaint.trim()) return chiefComplaint.trim();
    if (detailMeds.length === 1 && detailMeds[0].name?.trim()) return detailMeds[0].name.trim();
    return 'Prescription';
  })();

  const resetDialog = () => {
    setEditing(null);
    setForm(emptyRx());
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSave = () => {
    const validMeds = form.medicines.filter(m => m.name.trim());
    if (validMeds.length === 0) { toast.error('At least one medicine name is required.'); return; }
    const rxData = {
      ...form,
      notes: buildRxNotesFromFields(form.chiefComplaint, form.condition),
      medicines: validMeds.map((m) => packMedicine(m)),
    };
    if (editing) {
      updatePrescription({ ...editing, ...rxData } as Prescription);
      toast.success('Updated!');
    } else {
      addPrescription({
        ...rxData,
        id: crypto.randomUUID(),
        childId: selectedChild.id,
        createdAt: new Date().toISOString(),
      } as Prescription);
      toast.success('Prescription added!');
    }
    setOpen(false);
    resetDialog();
  };

  const patchForm = (key: string, val: unknown) => setForm(p => ({ ...p, [key]: val }));

  const patchMedicine = (idx: number, patch: Partial<Medicine>) => {
    setForm((p) => {
      const meds = [...p.medicines];
      meds[idx] = { ...meds[idx], ...patch };
      return { ...p, medicines: meds };
    });
  };

  const addMedicine = () => setForm(p => ({ ...p, medicines: [...p.medicines, emptyMedicine()] }));
  const removeMedicine = (idx: number) => {
    if (form.medicines.length <= 1) return;
    setForm(p => ({ ...p, medicines: p.medicines.filter((_, i) => i !== idx) }));
  };

  const triggerFilePick = () => {
    beforePick();
    fileRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    afterPick();
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const pickErr = validatePickedFile(file, { maxBytes: MAX_IMAGE_PICK_BYTES, allowPdf: false });
    if (pickErr) {
      toast.error(pickErr);
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result;
      if (typeof raw !== 'string') return;
      try {
        const { data } = await normalizeImageDataUrl(raw, file.name);
        const urlErr = validateClientDataUrl(data, MAX_IMAGE_PICK_BYTES, { allowPdf: false });
        if (urlErr) {
          toast.error(urlErr);
          return;
        }
        setForm(prev => ({ ...prev, prescriptionImage: data }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not process this image.');
      }
      input.value = '';
    };
    reader.readAsDataURL(file);
  };

  const openEditRx = (rx: Prescription) => {
    setEditing(rx);
    const fields = parseRxNotesToFields(rx.notes);
    setForm({
      ...rx,
      ...fields,
      medicines: medsFromRx(rx).map(unpackMedicine),
    });
    setOpen(true);
  };

  const blockCloseWhilePicking = (e: Event) => {
    if (pickingFile.current) e.preventDefault();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold">Prescriptions</h1>
        <Dialog
          open={open}
          onOpenChange={o => {
            if (!o && pickingFile.current) return;
            setOpen(o);
            if (!o) resetDialog();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Prescription</Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-lg max-h-[90vh] overflow-y-auto"
            onFocusOutside={blockCloseWhilePicking}
            onPointerDownOutside={blockCloseWhilePicking}
          >
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? 'Edit' : 'Add'} Prescription</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Medicines list */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Advice medications</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addMedicine} className="gap-1">
                    <Plus className="h-3 w-3" /> Add Medicine
                  </Button>
                </div>
                <Accordion
                  type="multiple"
                  className="space-y-2"
                  defaultValue={form.medicines.length === 1 ? [`med-${form.medicines[0].id}`] : []}
                >
                  {form.medicines.map((med, idx) => {
                    const itemValue = `med-${med.id}`;
                    const timesCount = (med.timesOfDay ?? []).length;
                    return (
                      <AccordionItem key={med.id} value={itemValue} className="border rounded-lg bg-muted/20">
                        <div className="flex items-start gap-3 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <AccordionTrigger className="py-0 hover:no-underline">
                              <div className="min-w-0 text-left">
                                <div className="text-xs font-medium text-muted-foreground">Medicine {idx + 1}</div>
                                <div className="text-sm font-medium truncate">{summarizeMedicine(med)}</div>
                              </div>
                            </AccordionTrigger>
                          </div>
                          {form.medicines.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => removeMedicine(idx)}
                              aria-label="Remove medicine"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <AccordionContent className="px-3 pb-3">
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2 space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Drug name *</Label>
                                <Input
                                  placeholder="e.g. Crocin / Paracetamol"
                                  value={med.name}
                                  onChange={(e) => patchMedicine(idx, { name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Dosage</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.1"
                                    min={0}
                                    value={med.dosageValue ?? ''}
                                    onChange={(e) => patchMedicine(idx, { dosageValue: parseFloat(e.target.value) || 0 })}
                                    className="w-20 shrink-0"
                                  />
                                  <select
                                    className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                                    value={med.dosageUnit ?? ''}
                                    onChange={(e) => patchMedicine(idx, { dosageUnit: (e.target.value || undefined) as DosageUnit })}
                                  >
                                    <option value="">—</option>
                                    <option value="ml">ml</option>
                                    <option value="drops">drops</option>
                                    <option value="mg">mg</option>
                                    <option value="g">g</option>
                                    <option value="tsp">tsp</option>
                                    <option value="tbsp">tbsp</option>
                                    <option value="puffs">puffs</option>
                                    <option value="tablets">tablets</option>
                                    <option value="capsules">capsules</option>
                                    <option value="units">units</option>
                                    <option value="other">other</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">When</Label>
                              <div className="flex flex-wrap gap-2">
                                {(['morning', 'afternoon', 'night'] as const).map((t) => {
                                  const checked = (med.timesOfDay ?? []).includes(t);
                                  return (
                                    <Button
                                      key={t}
                                      type="button"
                                      size="sm"
                                      variant={checked ? 'default' : 'outline'}
                                      className="capitalize h-8"
                                      onClick={() => {
                                        const next = new Set(med.timesOfDay ?? []);
                                        if (checked) next.delete(t); else next.add(t);
                                        const nextTimes = Array.from(next) as TimesOfDay[];
                                        const isFoodTiming =
                                          med.mealTiming === 'before_food' || med.mealTiming === 'after_food';
                                        const shouldForceFoodTiming = nextTimes.length >= 2;
                                        const shouldDisallowFoodTiming = nextTimes.length < 2;
                                        patchMedicine(idx, {
                                          timesOfDay: nextTimes,
                                          ...(shouldDisallowFoodTiming && isFoodTiming ? { mealTiming: undefined } : {}),
                                          ...(shouldForceFoodTiming && !isFoodTiming ? { mealTiming: undefined } : {}),
                                        });
                                      }}
                                    >
                                      {t}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Meal timing</Label>
                                <select
                                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                                  value={med.mealTiming ?? ''}
                                  onChange={(e) => patchMedicine(idx, { mealTiming: (e.target.value || undefined) as MealTiming })}
                                >
                                  <option value="">—</option>
                                  {timesCount >= 2 ? (
                                    <>
                                      <option value="before_food">Before food</option>
                                      <option value="after_food">After food</option>
                                    </>
                                  ) : (
                                    <>
                                      <option value="before_breakfast">Before breakfast</option>
                                      <option value="after_breakfast">After breakfast</option>
                                      <option value="before_lunch">Before lunch</option>
                                      <option value="after_lunch">After lunch</option>
                                      <option value="before_dinner">Before dinner</option>
                                      <option value="after_dinner">After dinner</option>
                                    </>
                                  )}
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Route</Label>
                                <select
                                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                                  value={med.route ?? ''}
                                  onChange={(e) => patchMedicine(idx, { route: (e.target.value || undefined) as Route })}
                                >
                                  <option value="">—</option>
                                  <option value="oral">Oral</option>
                                  <option value="iv">IV</option>
                                  <option value="im">IM</option>
                                  <option value="sc">SC</option>
                                  <option value="inhalation">Inhalation</option>
                                  <option value="topical">Topical</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Duration</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step="1"
                                    value={med.durationValue ?? ''}
                                    onChange={(e) => patchMedicine(idx, { durationValue: parseInt(e.target.value, 10) || 0 })}
                                    className="w-20 shrink-0"
                                  />
                                  <select
                                    className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                                    value={med.durationUnit ?? ''}
                                    onChange={(e) => patchMedicine(idx, { durationUnit: (e.target.value || undefined) as DurationUnit })}
                                  >
                                    <option value="">—</option>
                                    <option value="days">Days</option>
                                    <option value="weeks">Weeks</option>
                                    <option value="months">Months</option>
                                    <option value="years">Years</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Instructions</Label>
                              <Input
                                placeholder="e.g. If fever above 99°F"
                                value={med.instructions ?? ''}
                                onChange={(e) => patchMedicine(idx, { instructions: e.target.value })}
                              />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>

              <div><Label>Prescribing Doctor</Label><Input value={form.prescribingDoctor || ''} onChange={e => patchForm('prescribingDoctor', e.target.value)} /></div>
              <div className="space-y-2">
                <Label htmlFor="rx-date">Date</Label>
                <DatePicker
                  id="rx-date"
                  value={form.date || ''}
                  onChange={(v) => patchForm('date', v)}
                  disabled={(d) => isAfter(startOfDay(d), startOfDay(new Date()))}
                />
              </div>
              <div className="space-y-2">
                <Label>Chief complaint / condition</Label>
                <Textarea
                  value={form.chiefComplaint || ''}
                  onChange={(e) => patchForm('chiefComplaint', e.target.value)}
                  placeholder="e.g. Fever since 1 day, cold"
                />
              </div>

              {/* Prescription Image — hidden input + preview */}
              <div className="space-y-2">
                <Label>Prescription Image</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  className="hidden"
                  onChange={handleImageUpload}
                />

                {form.prescriptionImage ? (
                  <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                    <img
                      src={form.prescriptionImage}
                      alt="Prescription preview"
                      className="max-h-52 w-full object-contain bg-background"
                    />
                    <div className="border-t border-border px-3 py-2 flex gap-2 justify-end">
                      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={triggerFilePick}>
                        <Image className="h-4 w-4" /> Replace
                      </Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => patchForm('prescriptionImage', '')}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={triggerFilePick}>
                    <Image className="h-4 w-4" /> Upload Image
                  </Button>
                )}
              </div>

              <Button onClick={handleSave} className="w-full">{editing ? 'Update' : 'Add'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="w-full sm:max-w-sm">
          <Label htmlFor="rx-search" className="text-xs text-muted-foreground">Search</Label>
          <Input
            id="rx-search"
            placeholder="Search prescriptions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setRange(today, today)}>
            Today
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRange(subDays(today, 6), today)}>
            Last 7 days
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRange(subDays(today, 29), today)}>
            Last 30 days
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRange(startOfMonth(today), endOfMonth(today))}>
            This month
          </Button>
          {(dateFrom || dateTo || search.trim()) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        <div className="w-full sm:w-auto sm:min-w-[220px]">
          <Label htmlFor="rx-date-from" className="text-xs text-muted-foreground">From</Label>
          <DatePicker
            id="rx-date-from"
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
          <Label htmlFor="rx-date-to" className="text-xs text-muted-foreground">To</Label>
          <DatePicker
            id="rx-date-to"
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

      {childRx.length === 0 ? (
        <div className="text-center py-20">
          <Pill className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">No prescriptions recorded yet.</p>
        </div>
      ) : (
        <div className="relative space-y-4">
          {childRx.map(rx => {
            const meds = medsFromRx(rx);
            const { chiefComplaint } = parseRxNotesToFields(rx.notes);
            const cardTitle =
              chiefComplaint.trim() ||
              (meds.length === 1 ? meds[0].name : `${meds.length} Medicines`);
            return (
              <Card
                key={rx.id}
                id={`rx-${rx.id}`}
                className={cn(
                  'cursor-pointer transition-[box-shadow,opacity] duration-200 hover:shadow-md',
                  !rx.active && 'opacity-60',
                )}
                onClick={() => setDetailRxId(rx.id)}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base font-display flex flex-wrap items-center gap-2">
                      <Pill className="h-4 w-4 text-primary" />
                      <span className="min-w-0 truncate">{cardTitle}</span>
                      <Badge variant={rx.active ? 'default' : 'secondary'}>{rx.active ? 'Active' : 'Completed'}</Badge>
                    </CardTitle>
                    {chiefComplaint.trim() ? (
                      <p className="text-sm text-muted-foreground">
                        {meds.length === 1 ? meds[0].name : `${meds.length} medicines`}
                      </p>
                    ) : meds.length === 1 ? (
                      <p className="text-sm text-muted-foreground">{meds[0].dosage} · {meds[0].frequency} · {meds[0].duration}</p>
                    ) : (
                      <div className="mt-1 space-y-0.5">
                        {meds.map((m, i) => (
                          <p key={i} className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{m.name}</span> — {m.dosage} · {m.frequency} · {m.duration}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => updatePrescription({ ...rx, active: !rx.active })}>
                        {rx.active ? 'Mark Done' : 'Reactivate'}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditRx(rx)} aria-label="Edit prescription">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          deletePrescription(rx.id);
                          toast.success('Deleted.');
                          setDetailRxId((id) => (id === rx.id ? null : id));
                        }}
                        aria-label="Delete prescription"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    {rx.prescriptionImage && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        title="View prescription image"
                        onClick={() => setPreviewImg(rx.prescriptionImage!)}
                      >
                        <Image className="h-4 w-4 shrink-0" />
                        View prescription image
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Dr. {rx.prescribingDoctor} · {format(new Date(rx.date), 'PP')}</p>
                  {rx.notes && <p className="text-xs text-muted-foreground mt-1 italic">{rx.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Prescription detail (dimmed backdrop via Dialog overlay) */}
      <Dialog open={detailRx != null} onOpenChange={(o) => { if (!o) setDetailRxId(null); }}>
        <DialogContent className="max-w-2xl max-h-[min(90dvh,720px)] gap-0 p-0 sm:rounded-lg">
          {detailRx && (
            <>
              <div className="border-b border-border bg-muted/30 px-6 py-4 pr-14">
                <DialogHeader className="space-y-2 text-left">
                  <DialogTitle className="font-display text-xl leading-snug pr-2">{detailTitle}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Dr. {detailRx.prescribingDoctor || '—'} · {format(new Date(detailRx.date), 'PPP')}
                  </DialogDescription>
                  <div className="pt-1">
                    <Badge variant={detailRx.active ? 'default' : 'secondary'}>
                      {detailRx.active ? 'Active' : 'Completed'}
                    </Badge>
                  </div>
                </DialogHeader>
              </div>
              <div className="space-y-4 px-6 py-4">
                {(() => {
                  const fields = parseRxNotesToFields(detailRx.notes);
                  const chief = fields.chiefComplaint;
                  const cond = fields.condition;
                  const mealLabel: Record<
                    NonNullable<MealTiming>,
                    string
                  > = {
                    before_breakfast: 'Before breakfast',
                    after_breakfast: 'After breakfast',
                    before_food: 'Before food',
                    after_food: 'After food',
                    before_lunch: 'Before lunch',
                    after_lunch: 'After lunch',
                    before_dinner: 'Before dinner',
                    after_dinner: 'After dinner',
                  };
                  const routeLabel: Record<NonNullable<Route>, string> = {
                    oral: 'Oral',
                    iv: 'IV',
                    im: 'IM',
                    sc: 'SC',
                    inhalation: 'Inhalation',
                    topical: 'Topical',
                    other: 'Other',
                  };
                  const timesLabel = (times: Array<TimesOfDay> | undefined) => {
                    const t = (times ?? []).filter(Boolean);
                    if (!t.length) return '';
                    const order: TimesOfDay[] = ['morning', 'afternoon', 'night'];
                    return order
                      .filter((k) => t.includes(k))
                      .map((k) => k[0].toUpperCase() + k.slice(1))
                      .join(', ');
                  };
                  return (
                    <>
                      {(chief || cond) && (
                        <div className="space-y-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Chief complaint / condition
                          </h3>
                          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                            {chief && (
                              <div className="text-sm">
                                <p className="text-muted-foreground whitespace-pre-wrap">{chief}</p>
                              </div>
                            )}
                            {/* Keep showing parsed condition from older notes, but don't require a separate field in the form. */}
                            {cond && !chief && (
                              <div className="text-sm">
                                <p className="text-muted-foreground whitespace-pre-wrap">{cond}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Advice medications
                        </h3>
                        <div className="space-y-3">
                          {detailMeds.map((m) => {
                            const dose =
                              m.dosageValue != null && m.dosageUnit
                                ? `${m.dosageValue} ${m.dosageUnit}`
                                : (m.dosage || '');
                            const when = timesLabel(m.timesOfDay as TimesOfDay[] | undefined) || '';
                            const meal = m.mealTiming ? mealLabel[m.mealTiming as NonNullable<MealTiming>] : '';
                            const route = m.route ? routeLabel[m.route as NonNullable<Route>] : '';
                            const duration =
                              m.durationValue != null && m.durationUnit
                                ? `${m.durationValue} ${m.durationUnit}`
                                : (m.duration || '');
                            const instruction = m.instructions?.trim() || '';

                            const Row = ({ label, value }: { label: string; value: string }) =>
                              value ? (
                                <div className="flex items-start justify-between gap-3">
                                  <div className="text-xs font-semibold text-muted-foreground">{label}</div>
                                  <div className="text-sm text-muted-foreground text-right whitespace-pre-wrap break-words">
                                    {value}
                                  </div>
                                </div>
                              ) : null;

                            return (
                              <div key={m.id} className="rounded-lg border border-border bg-card p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold">{m.name || '—'}</div>
                                  </div>
                                </div>

                                <div className="mt-3 space-y-2">
                                  <Row label="Dose" value={dose} />
                                  <Row label="When" value={when} />
                                  <Row label="Meal timing" value={meal} />
                                  <Row label="Route" value={route} />
                                  <Row label="Duration" value={duration} />
                                  <Row label="Instruction" value={instruction} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()}

                {detailRx.prescriptionImage && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Prescription image
                    </h3>
                    <button
                      type="button"
                      className="relative w-full overflow-hidden rounded-lg border border-border bg-muted/20 text-left outline-none ring-offset-background transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => setPreviewImg(detailRx.prescriptionImage!)}
                    >
                      <img
                        src={detailRx.prescriptionImage}
                        alt="Prescription attachment"
                        className="max-h-56 w-full object-contain bg-background"
                      />
                      <span className="absolute bottom-2 right-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium shadow-sm">
                        Tap to enlarge
                      </span>
                    </button>
                  </div>
                )}
              </div>
              <DialogFooter className="flex-col gap-2 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:justify-between sm:space-x-0">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updatePrescription({ ...detailRx, active: !detailRx.active });
                      toast.success(detailRx.active ? 'Marked completed.' : 'Reactivated.');
                    }}
                  >
                    {detailRx.active ? 'Mark done' : 'Reactivate'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setDetailRxId(null);
                      openEditRx(detailRx);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => setDetailRxId(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Full-screen image preview */}
      <Dialog open={!!previewImg} onOpenChange={() => setPreviewImg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Prescription Image</DialogTitle></DialogHeader>
          {previewImg && <img src={previewImg} alt="Prescription" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
