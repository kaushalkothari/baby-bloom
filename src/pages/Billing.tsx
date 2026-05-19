/**
 * BabyBloomCare
 * Copyright (c) 2026 Kaushal Kothari. All rights reserved.
 * Unauthorized copying, modification or distribution
 * of this software is strictly prohibited.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '@/lib/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, ReceiptIndianRupee, Trash2, Pencil, Image } from 'lucide-react';
import { format, startOfDay, isAfter, isBefore, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { BillingRecord } from '@/types';
import { toast } from 'sonner';
import { useFilePickerDialogGuard } from '@/hooks/useFilePickerDialogGuard';
import { normalizeImageDataUrl } from '@/lib/imageUtils';
import {
  MAX_IMAGE_PICK_BYTES,
  validateClientDataUrl,
  validatePickedFile,
} from '@/lib/security/uploads';
import { useHighlightScroll } from '@/hooks/useHighlightParam';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { randomUUID } from '@/lib/randomUUID';
import { decryptLocalValue, encryptLocalValue } from '@/lib/security/localEncryption';

const emptyBill = (): Partial<BillingRecord> => ({
  date: new Date().toISOString().split('T')[0],
  amount: 0,
  hospitalName: '',
  description: '',
  receiptImage: '',
});

const BILL_DESCRIPTION_CHIPS = [
  'Consultation',
  'Lab',
  'Pharmacy',
  'Vaccine',
  'Other',
] as const;

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

type BillingDraft = {
  form: Partial<BillingRecord>;
  savedAt: string;
};

function draftKey(childId: string) {
  return `babybloom:draft:billing:${childId}`;
}

function hasAnyDraftValue(form: Partial<BillingRecord>): boolean {
  const hasReceipt = Boolean(form.receiptImage?.trim());
  const hasHospital = Boolean(form.hospitalName?.trim());
  const hasAmount = Boolean(form.amount && form.amount > 0);
  const hasDescription = Boolean(form.description?.trim());
  const hasVisitLink = Boolean(form.visitId?.trim());
  const hasDate = Boolean(form.date?.trim() && form.date !== new Date().toISOString().split('T')[0]);
  return hasReceipt || hasHospital || hasAmount || hasDescription || hasVisitLink || hasDate;
}

export default function Billing() {
  const { selectedChild, billing, visits, addBilling, updateBilling, deleteBilling } = useApp();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const highlight = searchParams.get('highlight');
  const fromVisit = searchParams.get('fromVisit');
  const fromDate = searchParams.get('date');
  const fromHospital = searchParams.get('hospital');
  const returnTo = searchParams.get('returnTo');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BillingRecord | null>(null);
  const [form, setForm] = useState<Partial<BillingRecord>>(emptyBill());
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { pickingFile, beforePick, afterPick } = useFilePickerDialogGuard();
  const [focusedBillId, setFocusedBillId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const childBills = useMemo(() => {
    if (!selectedChild) return [];
    const from = dateFrom?.trim() || '';
    const to = dateTo?.trim() || '';
    const rangeStart = from && to && from > to ? to : from;
    const rangeEnd = from && to && from > to ? from : to;
    const q = search.trim().toLowerCase();

    return billing
      .filter((b) => b.childId === selectedChild.id)
      .filter((b) => {
        if (rangeStart && b.date < rangeStart) return false;
        if (rangeEnd && b.date > rangeEnd) return false;
        return true;
      })
      .filter((b) => {
        if (!q) return true;
        const hay = [
          b.hospitalName,
          b.description,
          String(b.amount ?? ''),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedChild, billing, dateFrom, dateTo, search]);

  const highlightReady = Boolean(highlight && childBills.some((b) => b.id === highlight));
  useHighlightScroll(highlight, highlightReady && highlight ? `bill-${highlight}` : null, highlightReady);

  useEffect(() => {
    if (focusedBillId && !childBills.some((b) => b.id === focusedBillId)) {
      setFocusedBillId(null);
    }
  }, [childBills, focusedBillId]);

  const today = startOfDay(new Date());
  const setRange = (from: Date, to: Date) => {
    const a = startOfDay(from);
    const b = startOfDay(to);
    const start = isBefore(a, b) ? a : b;
    const end = isBefore(a, b) ? b : a;
    setDateFrom(format(start, 'yyyy-MM-dd'));
    setDateTo(format(end, 'yyyy-MM-dd'));
  };

  const total = childBills.reduce((s, b) => s + b.amount, 0);

  const resetDialog = () => {
    setEditing(null);
    setForm(emptyBill());
    if (fileRef.current) fileRef.current.value = '';
  };

  const recentHospitals = useMemo(() => {
    if (!selectedChild) return [];
    const seen = new Set<string>();
    const out: string[] = [];

    const billsForChild = billing
      .filter((b) => b.childId === selectedChild.id)
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    for (const b of billsForChild) {
      const name = b.hospitalName?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
      if (out.length >= 5) break;
    }

    if (out.length < 5) {
      const visitsForChild = (visits ?? [])
        .filter((v) => v.childId === selectedChild.id)
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      for (const v of visitsForChild) {
        const name = v.hospitalName?.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(name);
        if (out.length >= 5) break;
      }
    }

    return out;
  }, [selectedChild, billing, visits]);

  const loadDraft = () => {
    if (!selectedChild) return null;
    try {
      const raw = localStorage.getItem(draftKey(selectedChild.id));
      if (!raw) return null;
      const decrypted = decryptLocalValue(raw);
      const parsed = JSON.parse(decrypted ?? raw) as BillingDraft;
      return parsed;
    } catch {
      return null;
    }
  };

  const saveDraft = (next: BillingDraft | null) => {
    if (!selectedChild) return;
    try {
      if (!next) {
        localStorage.removeItem(draftKey(selectedChild.id));
        return;
      }
      localStorage.setItem(draftKey(selectedChild.id), encryptLocalValue(JSON.stringify(next)));
    } catch {
      // Ignore quota errors; draft saving is best-effort.
    }
  };

  const openedFromVisitRef = useRef(false);
  const didSaveRef = useRef(false);
  const returnToRef = useRef<string | null>(null);

  // Deep-link from a visit: open add bill dialog prefilled with visitId/date/hospital, then clear params.
  useEffect(() => {
    if (!selectedChild) return;
    if (!fromVisit) return;
    openedFromVisitRef.current = true;
    didSaveRef.current = false;
    returnToRef.current = returnTo;
    setEditing(null);
    setForm((prev) => ({
      ...emptyBill(),
      ...prev,
      visitId: fromVisit,
      date: fromDate || prev.date || new Date().toISOString().split('T')[0],
      hospitalName: fromHospital || '',
    }));
    setOpen(true);
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete('fromVisit');
        next.delete('date');
        next.delete('hospital');
        next.delete('returnTo');
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild, fromVisit]);

  const handleSave = () => {
    const hospital = form.hospitalName?.trim() || '';
    const amount = Number(form.amount || 0);
    if (!hospital || amount <= 0) {
      toast.error(t('billing.requiredError'));
      return;
    }
    const combinedDescription = (form.description || '').trim();

    if (editing) {
      updateBilling({ ...editing, ...form, description: combinedDescription } as BillingRecord);
      toast.success(t('billing.updated'));
    } else {
      addBilling({
        ...form,
        id: randomUUID(),
        childId: selectedChild.id,
        description: combinedDescription,
        createdAt: new Date().toISOString(),
      } as BillingRecord);
      toast.success(t('billing.added'));
    }
    didSaveRef.current = true;
    saveDraft(null);
    setOpen(false);
    resetDialog();
  };

  const patchForm = (key: string, val: unknown) => setForm(p => ({ ...p, [key]: val }));

  const beforeTriggerFilePick = () => {
    beforePick();
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        patchForm('receiptImage', data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('common.imageProcessFailed'));
      }
      input.value = '';
    };
    reader.readAsDataURL(file);
  };

  const blockCloseWhilePicking = (e: Event) => {
    if (pickingFile.current) e.preventDefault();
  };

  const openNew = () => {
    setEditing(null);
    const draft = loadDraft();
    const base = emptyBill();
    const merged = { ...base, ...(draft?.form ?? {}) };
    if (!merged.hospitalName?.trim() && recentHospitals.length > 0) merged.hospitalName = recentHospitals[0];
    if (!merged.date?.trim()) merged.date = base.date;
    setForm(merged);
    setOpen(true);
  };

  const openEdit = (b: BillingRecord) => {
    setEditing(b);
    setForm({ ...b, receiptImage: b.receiptImage || '' });
    setOpen(true);
  };

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">{t('empty.selectChildFirst')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold">{t('pages.billing.title')}</h1>
          <p className="text-muted-foreground">{t('billing.totalSpent')} <span className="font-bold text-foreground tabular-nums">{formatInr(total)}</span></p>
        </div>
        <Dialog
          open={open}
          onOpenChange={o => {
            if (!o && pickingFile.current) return;
            setOpen(o);
            if (!o) {
              if (!didSaveRef.current && !editing && hasAnyDraftValue(form)) {
                saveDraft({
                  form,
                  savedAt: new Date().toISOString(),
                });
              } else if (!editing) {
                saveDraft(null);
              }
              resetDialog();
              const target = returnToRef.current;
              if (openedFromVisitRef.current && !didSaveRef.current && target) {
                openedFromVisitRef.current = false;
                returnToRef.current = null;
                navigate(target);
              }
              openedFromVisitRef.current = false;
              didSaveRef.current = false;
              returnToRef.current = null;
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openNew}>
              <Plus className="h-4 w-4" /> {t('billing.addBill')}
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-lg max-h-[90vh] overflow-y-auto"
            onFocusOutside={blockCloseWhilePicking}
            onPointerDownOutside={blockCloseWhilePicking}
          >
            <DialogHeader>
              <DialogTitle className="font-display">
                {t('billing.dialogTitle', { action: editing ? t('common.edit') : t('common.add') })}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('billing.form.receiptImage')}</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  id="bill-receipt-input"
                  className="sr-only"
                  onChange={handleReceiptUpload}
                />
                <Button
                  type="button"
                  variant={form.receiptImage ? 'secondary' : 'outline'}
                  className="w-full gap-2"
                  asChild
                >
                  <label htmlFor="bill-receipt-input" onClick={beforeTriggerFilePick} className="cursor-pointer">
                    <Image className="h-4 w-4" /> {form.receiptImage ? t('billing.form.replaceReceiptPhoto') : t('billing.form.uploadReceiptPhoto')}
                  </label>
                </Button>
                {form.receiptImage && (
                  <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setPreviewImg(form.receiptImage as string)}
                    >
                      {t('billing.viewReceipt')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => patchForm('receiptImage', '')}
                    >
                      {t('common.remove')}
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bill-date">{t('billing.form.date')}</Label>
                <DatePicker
                  id="bill-date"
                  value={form.date || ''}
                  onChange={(v) => patchForm('date', v)}
                  disabled={(d) => isAfter(startOfDay(d), startOfDay(new Date()))}
                />
              </div>

              {recentHospitals.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t('billing.recentHospitals')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentHospitals.map((h) => (
                      <Button
                        key={h}
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs"
                        onClick={() => patchForm('hospitalName', (form.hospitalName || '').trim() === h ? '' : h)}
                      >
                        {h}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>{t('billing.form.hospitalRequired')}</Label>
                <Input
                  value={form.hospitalName || ''}
                  onChange={(e) => patchForm('hospitalName', e.target.value)}
                  placeholder={recentHospitals[0] ? t('billing.hospitalPlaceholder', { hospital: recentHospitals[0] }) : undefined}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bill-amount">{t('billing.form.amountInr')}</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>
                    ₹
                  </span>
                  <Input
                    id="bill-amount"
                    type="number"
                    className="pl-8 tabular-nums"
                    min={0}
                    step="0.01"
                    value={form.amount || ''}
                    onChange={(e) => patchForm('amount', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t('billing.commonItems')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {BILL_DESCRIPTION_CHIPS.map((label) => (
                    <Button
                      key={label}
                      type="button"
                      size="sm"
                      variant={(form.description || '').trim() === label ? 'default' : 'secondary'}
                      className="h-7 text-xs"
                      onClick={() => {
                        patchForm('description', (form.description || '').trim() === label ? '' : label);
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label>{t('billing.form.description')}</Label>
                <Textarea
                  value={form.description || ''}
                  onChange={(e) => patchForm('description', e.target.value)}
                  placeholder={t('billing.descriptionPlaceholder')}
                />
              </div>

              <Button onClick={handleSave} className="w-full">{editing ? t('common.update') : t('billing.addBill')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:max-w-sm">
          <Label htmlFor="bill-search" className="text-xs text-muted-foreground">{t('common.search')}</Label>
          <Input
            id="bill-search"
            placeholder={t('billing.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              {t('common.clearFilters')}
            </Button>
          )}
        </div>
        <div className="w-full sm:w-auto sm:min-w-[220px]">
          <Label htmlFor="bill-date-from" className="text-xs text-muted-foreground">{t('common.from')}</Label>
          <DatePicker
            id="bill-date-from"
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
          <Label htmlFor="bill-date-to" className="text-xs text-muted-foreground">{t('common.to')}</Label>
          <DatePicker
            id="bill-date-to"
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

      {childBills.length === 0 ? (
        <div className="text-center py-20">
          <ReceiptIndianRupee className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">{t('billing.empty')}</p>
        </div>
      ) : (
        <div className="relative space-y-4">
          {childBills.map(b => {
            const isFocused = focusedBillId === b.id;
            return (
            <Card
              key={b.id}
              id={`bill-${b.id}`}
              className={cn(
                'cursor-pointer transition-[box-shadow,transform] duration-200',
                isFocused && 'relative z-10 scale-[1.01] shadow-lg ring-2 ring-primary ring-offset-2 ring-offset-background',
              )}
              onClick={() => setFocusedBillId((cur) => (cur === b.id ? null : b.id))}
            >
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-display">{b.hospitalName}</CardTitle>
                  <p className="text-sm text-muted-foreground">{format(new Date(b.date), 'PPP')}</p>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-lg font-bold tabular-nums">{formatInr(b.amount)}</span>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      deleteBilling(b.id);
                      toast.success(t('billing.deleted'));
                      setFocusedBillId((id) => (id === b.id ? null : id));
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {b.description && <p className="text-sm">{b.description.replace(/\$/g, '₹')}</p>}
                {b.receiptImage && (
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setPreviewImg(b.receiptImage!)}
                    >
                      <Image className="h-3 w-3" /> {t('billing.viewReceipt')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewImg} onOpenChange={() => setPreviewImg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t('billing.receiptDialogTitle')}</DialogTitle></DialogHeader>
          {previewImg && <img src={previewImg} alt={t('billing.receiptAlt')} className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
