import { useState, useRef, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '@/lib/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileText, Trash2, Download, Eye, Image } from 'lucide-react';
import { format, startOfDay, isAfter, isBefore, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { Document as DocType } from '@/types';
import { toast } from 'sonner';
import { useFilePickerDialogGuard } from '@/hooks/useFilePickerDialogGuard';
import { normalizeImageDataUrl, isHeic } from '@/lib/imageUtils';
import {
  buildLinkedDocumentRows,
  imageMimeFromSrc,
  rowDate,
  rowDisplayNotes,
  rowFileData,
  rowKey,
  rowTitle,
  rowTypeLabel,
  type LinkedDocumentRow,
} from '@/lib/documents/linkedDocuments';
import {
  MAX_DOCUMENT_BYTES_LOCAL,
  MAX_DOCUMENT_BYTES_REMOTE,
  validateClientDataUrl,
  validatePickedFile,
} from '@/lib/security/uploads';
import { useHighlightScroll } from '@/hooks/useHighlightParam';
import { cn } from '@/lib/utils';

const docTypes = [
  { value: 'receipt', label: 'Receipt' },
  { value: 'lab_report', label: 'Lab Report' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'vaccination_card', label: 'Vaccination Card' },
  { value: 'other', label: 'Other' },
];

interface PickedFile {
  data: string;
  type: string;
  name: string;
}

export default function Documents() {
  const {
    selectedChild,
    documents,
    prescriptions,
    vaccinations,
    billing,
    addDocument,
    deleteDocument,
    updatePrescription,
    updateVaccination,
    updateBilling,
    usesRemoteData,
  } = useApp();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get('highlight');
  const maxBytes = usesRemoteData ? MAX_DOCUMENT_BYTES_REMOTE : MAX_DOCUMENT_BYTES_LOCAL;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<DocType>>({ type: 'other', date: new Date().toISOString().split('T')[0] });
  const [preview, setPreview] = useState<{ name: string; fileData: string } | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const { pickingFile, beforePick, afterPick } = useFilePickerDialogGuard();
  const [focusedDocKey, setFocusedDocKey] = useState<string | null>(null);

  const mergedRows = useMemo(
    () =>
      selectedChild
        ? buildLinkedDocumentRows(selectedChild.id, documents, prescriptions, vaccinations, billing, filterType)
          .slice()
          .filter((r) => {
            const from = dateFrom?.trim() || '';
            const to = dateTo?.trim() || '';
            const rangeStart = from && to && from > to ? to : from;
            const rangeEnd = from && to && from > to ? from : to;
            const d = rowDate(r);
            if (rangeStart && d < rangeStart) return false;
            if (rangeEnd && d > rangeEnd) return false;
            return true;
          })
          .sort((a, b) => new Date(rowDate(b)).getTime() - new Date(rowDate(a)).getTime())
        : [],
    [selectedChild, documents, prescriptions, vaccinations, billing, filterType, dateFrom, dateTo],
  );

  useEffect(() => {
    if (!highlight || !selectedChild) return;
    const allRows = buildLinkedDocumentRows(
      selectedChild.id,
      documents,
      prescriptions,
      vaccinations,
      billing,
      'all',
    );
    const targetRow = allRows.find(
      (r) => rowKey(r) === highlight || (r.kind === 'upload' && r.doc.id === highlight),
    );
    if (!targetRow) return;
    const targetKey = rowKey(targetRow);
    if (!mergedRows.some((r) => rowKey(r) === targetKey)) {
      setFilterType('all');
    }
  }, [
    highlight,
    selectedChild,
    documents,
    prescriptions,
    vaccinations,
    billing,
    mergedRows,
  ]);

  const docHighlightRow = useMemo(() => {
    if (!highlight || !selectedChild) return null;
    return (
      mergedRows.find(
        (r) => rowKey(r) === highlight || (r.kind === 'upload' && r.doc.id === highlight),
      ) ?? null
    );
  }, [highlight, mergedRows, selectedChild]);

  const docHighlightReady = docHighlightRow != null;
  useHighlightScroll(
    highlight,
    docHighlightRow ? `doc-${rowKey(docHighlightRow)}` : null,
    docHighlightReady,
  );

  useEffect(() => {
    if (focusedDocKey && !mergedRows.some((r) => rowKey(r) === focusedDocKey)) {
      setFocusedDocKey(null);
    }
  }, [mergedRows, focusedDocKey]);

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">Please select or add a child first.</p>;

  const resetDialog = () => {
    setForm({ type: 'other', date: new Date().toISOString().split('T')[0] });
    setPickedFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const triggerFilePick = () => {
    beforePick();
    fileRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    afterPick();
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const pickErr = validatePickedFile(file, { maxBytes, allowPdf: true });
    if (pickErr) {
      toast.error(pickErr);
      input.value = '';
      return;
    }
    const lower = file.name.toLowerCase();
    const inferredType =
      file.type ||
      (lower.endsWith('.pdf') ? 'application/pdf' : '') ||
      (lower.endsWith('.heic') ? 'image/heic' : '') ||
      (lower.endsWith('.heif') ? 'image/heif' : '') ||
      'application/octet-stream';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result;
      if (typeof raw !== 'string') return;
      try {
        let data: string;
        let mime: string;
        if (isHeic(inferredType, file.name)) {
          const converted = await normalizeImageDataUrl(raw, file.name);
          data = converted.data;
          mime = converted.mime;
        } else {
          data = raw;
          mime = inferredType;
        }
        const urlErr = validateClientDataUrl(data, maxBytes, { allowPdf: true });
        if (urlErr) {
          toast.error(urlErr);
          return;
        }
        if (isHeic(inferredType, file.name)) {
          const jpegName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
          setPickedFile({ data, type: mime, name: jpegName });
        } else {
          setPickedFile({ data, type: mime, name: file.name });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not process this image.');
      }
      input.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.name || !pickedFile) { toast.error('Name and file are required.'); return; }
    const urlErr = validateClientDataUrl(pickedFile.data, maxBytes, { allowPdf: true });
    if (urlErr) {
      toast.error(urlErr);
      return;
    }
    addDocument({
      ...form,
      id: crypto.randomUUID(),
      childId: selectedChild.id,
      fileData: pickedFile.data,
      fileType: pickedFile.type,
      createdAt: new Date().toISOString(),
    } as DocType);
    toast.success('Document uploaded!');
    setOpen(false);
    resetDialog();
  };

  const downloadFile = (name: string, fileData: string) => {
    const a = document.createElement('a');
    a.href = fileData;
    const ext =
      fileData.startsWith('data:image/png') ? '.png' :
      fileData.startsWith('data:image/webp') ? '.webp' :
      fileData.startsWith('data:image/') ? '.jpg' : '';
    a.download = name.includes('.') ? name : `${name}${ext || '.jpg'}`;
    a.click();
  };

  const handleDeleteRow = (row: LinkedDocumentRow) => {
    const k = rowKey(row);
    const clearFocus = () => setFocusedDocKey((cur) => (cur === k ? null : cur));
    if (row.kind === 'upload') {
      deleteDocument(row.doc.id);
      clearFocus();
      toast.success('Deleted.');
      return;
    }
    if (row.kind === 'prescription') {
      updatePrescription({ ...row.rx, prescriptionImage: '' });
      clearFocus();
      toast.success('Prescription image removed.');
      return;
    }
    if (row.kind === 'vaccination') {
      updateVaccination({ ...row.vax, cardPhoto: undefined });
      clearFocus();
      toast.success('Vaccination card image removed.');
      return;
    }
    updateBilling({ ...row.bill, receiptImage: '' });
    clearFocus();
    toast.success('Billing receipt image removed.');
  };

  const blockCloseWhilePicking = (e: Event) => {
    if (pickingFile.current) e.preventDefault();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold">Documents</h1>
        <Dialog
          open={open}
          onOpenChange={o => {
            if (!o && pickingFile.current) return;
            setOpen(o);
            if (!o) resetDialog();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Upload</Button>
          </DialogTrigger>
          <DialogContent
            onFocusOutside={blockCloseWhilePicking}
            onPointerDownOutside={blockCloseWhilePicking}
          >
            <DialogHeader><DialogTitle className="font-display">Upload Document</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name *</Label><Input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.type || 'other'} onValueChange={v => setForm(p => ({ ...p, type: v as DocType['type'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{docTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-date">Date</Label>
                <DatePicker
                  id="doc-date"
                  value={form.date || ''}
                  onChange={(v) => setForm((p) => ({ ...p, date: v }))}
                  disabled={(d) => isAfter(startOfDay(d), startOfDay(new Date()))}
                />
              </div>

              {/* File input + inline preview */}
              <div className="space-y-2">
                <Label>File *</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.heic,.heif,.pdf"
                  className="hidden"
                  onChange={handleFile}
                />

                {pickedFile ? (
                  <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                    {pickedFile.type.startsWith('image/') ? (
                      <img
                        src={pickedFile.data}
                        alt={pickedFile.name}
                        className="max-h-52 w-full object-contain bg-background"
                      />
                    ) : pickedFile.type === 'application/pdf' ? (
                      <div className="flex items-center gap-3 p-4">
                        <FileText className="h-10 w-10 shrink-0 text-primary" aria-hidden />
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-medium truncate">{pickedFile.name}</p>
                          <p className="text-xs text-muted-foreground">PDF ready to upload</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-4">
                        <FileText className="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden />
                        <p className="text-sm truncate">{pickedFile.name}</p>
                      </div>
                    )}
                    <div className="border-t border-border px-3 py-2 flex gap-2 justify-end">
                      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={triggerFilePick}>
                        <Image className="h-4 w-4" /> Replace
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setPickedFile(null);
                          if (fileRef.current) fileRef.current.value = '';
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={triggerFilePick}>
                    <Image className="h-4 w-4" /> Choose File
                  </Button>
                )}
              </div>

              <div><Label>Notes</Label><Textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <Button onClick={handleSave} className="w-full">Upload</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Button variant={filterType === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilterType('all')}>All</Button>
        {docTypes.map(t => (
          <Button key={t.value} variant={filterType === t.value ? 'default' : 'outline'} size="sm" onClick={() => setFilterType(t.value)}>{t.label}</Button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-wrap items-end gap-2">
          {(() => {
            const today = startOfDay(new Date());
            const setRange = (from: Date, to: Date) => {
              const a = startOfDay(from);
              const b = startOfDay(to);
              const start = isBefore(a, b) ? a : b;
              const end = isBefore(a, b) ? b : a;
              setDateFrom(format(start, 'yyyy-MM-dd'));
              setDateTo(format(end, 'yyyy-MM-dd'));
            };
            return (
              <>
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
                {(dateFrom || dateTo) && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                    Clear dates
                  </Button>
                )}
              </>
            );
          })()}
        </div>
        <div className="w-full sm:w-auto sm:min-w-[220px]">
          <Label htmlFor="doc-date-from" className="text-xs text-muted-foreground">From</Label>
          <DatePicker
            id="doc-date-from"
            value={dateFrom}
            onChange={setDateFrom}
            allowClear
            disabled={(d) => {
              const today = startOfDay(new Date());
              const day = startOfDay(d);
              if (isAfter(day, today)) return true;
              if (dateTo) return isAfter(day, startOfDay(new Date(dateTo)));
              return false;
            }}
          />
        </div>
        <div className="w-full sm:w-auto sm:min-w-[220px]">
          <Label htmlFor="doc-date-to" className="text-xs text-muted-foreground">To</Label>
          <DatePicker
            id="doc-date-to"
            value={dateTo}
            onChange={setDateTo}
            allowClear
            disabled={(d) => {
              const today = startOfDay(new Date());
              const day = startOfDay(d);
              if (isAfter(day, today)) return true;
              if (dateFrom) return isBefore(day, startOfDay(new Date(dateFrom)));
              return false;
            }}
          />
        </div>
      </div>

      {mergedRows.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mergedRows.map(row => {
            const title = rowTitle(row);
            const rk = rowKey(row);
            const fileData = rowFileData(row);
            const fileType = row.kind === 'upload' ? row.doc.fileType : imageMimeFromSrc(fileData);
            const notes = rowDisplayNotes(row);
            const showImage = fileType.startsWith('image/');
            const isFocused = focusedDocKey === rk;

            return (
              <Card
                key={rk}
                id={`doc-${rk}`}
                className={cn(
                  'cursor-pointer transition-[box-shadow,transform] duration-200',
                  isFocused && 'relative z-10 scale-[1.01] shadow-lg ring-2 ring-primary ring-offset-2 ring-offset-background',
                )}
                onClick={() => setFocusedDocKey((cur) => (cur === rk ? null : rk))}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> {title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{rowTypeLabel(row, docTypes)}</Badge>
                    <span className="text-xs text-muted-foreground">{format(new Date(rowDate(row)), 'PP')}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {notes && <p className="text-xs text-muted-foreground mb-2">{notes}</p>}
                  <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {showImage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setPreview({ name: title, fileData })}
                      >
                        <Eye className="h-3 w-3" /> {row.kind === 'prescription' ? 'View image' : 'View'}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => downloadFile(title, fileData)}>
                      <Download className="h-3 w-3" /> Download
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteRow(row)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{preview?.name}</DialogTitle></DialogHeader>
          {preview && <img src={preview.fileData} alt={preview.name} className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
