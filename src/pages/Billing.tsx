import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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

const emptyBill = (): Partial<BillingRecord> => ({
  date: new Date().toISOString().split('T')[0],
  amount: 0,
  hospitalName: '',
  description: '',
  receiptImage: '',
});

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function Billing() {
  const { selectedChild, billing, addBilling, updateBilling, deleteBilling } = useApp();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get('highlight');
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

  const total = childBills.reduce((s, b) => s + b.amount, 0);

  const resetDialog = () => {
    setEditing(null);
    setForm(emptyBill());
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSave = () => {
    if (!form.hospitalName || !form.amount) { toast.error(t('billing.requiredError')); return; }
    if (editing) {
      updateBilling({ ...editing, ...form } as BillingRecord);
      toast.success(t('billing.updated'));
    } else {
      addBilling({
        ...form,
        id: crypto.randomUUID(),
        childId: selectedChild.id,
        createdAt: new Date().toISOString(),
      } as BillingRecord);
      toast.success(t('billing.added'));
    }
    setOpen(false);
    resetDialog();
  };

  const patchForm = (key: string, val: unknown) => setForm(p => ({ ...p, [key]: val }));

  const triggerFilePick = () => {
    beforePick();
    fileRef.current?.click();
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
            if (!o) resetDialog();
          }}
        >
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> {t('billing.addBill')}</Button></DialogTrigger>
          <DialogContent
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
                <Label htmlFor="bill-date">{t('billing.form.date')}</Label>
                <DatePicker
                  id="bill-date"
                  value={form.date || ''}
                  onChange={(v) => patchForm('date', v)}
                  disabled={(d) => isAfter(startOfDay(d), startOfDay(new Date()))}
                />
              </div>
              <div><Label>{t('billing.form.hospitalRequired')}</Label><Input value={form.hospitalName || ''} onChange={e => patchForm('hospitalName', e.target.value)} /></div>
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
              <div><Label>{t('billing.form.description')}</Label><Textarea value={form.description || ''} onChange={e => patchForm('description', e.target.value)} /></div>

              <div className="space-y-2">
                <Label>{t('billing.form.receiptImage')}</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  className="hidden"
                  onChange={handleReceiptUpload}
                />
                {form.receiptImage ? (
                  <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                    <img
                      src={form.receiptImage}
                      alt={t('billing.receiptAlt')}
                      className="max-h-48 w-full object-contain bg-background"
                    />
                    <div className="border-t border-border px-3 py-2 flex gap-2 justify-end">
                      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={triggerFilePick}>
                        <Image className="h-4 w-4" /> {t('common.replace')}
                      </Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => patchForm('receiptImage', '')}>
                        {t('common.remove')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={triggerFilePick}>
                    <Image className="h-4 w-4" /> {t('billing.form.uploadReceiptPhoto')}
                  </Button>
                )}
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
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(b); setForm({ ...b, receiptImage: b.receiptImage || '' }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
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
