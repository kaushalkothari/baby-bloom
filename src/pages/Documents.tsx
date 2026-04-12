import { useState, useRef, useMemo } from 'react';
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
import { format, startOfDay, isAfter } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { Document as DocType } from '@/types';
import { toast } from 'sonner';
import { useFilePickerDialogGuard } from '@/hooks/useFilePickerDialogGuard';
import { normalizeImageDataUrl, isHeic } from '@/lib/imageUtils';
import {
  buildLinkedDocumentRows,
  imageMimeFromSrc,
  rowDisplayNotes,
  rowPreview,
  type LinkedDocumentRow,
} from '@/lib/documents/linkedDocuments';

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
    addDocument,
    deleteDocument,
    updatePrescription,
    updateVaccination,
    usesRemoteData,
  } = useApp();
  const maxBytes = usesRemoteData ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<DocType>>({ type: 'other', date: new Date().toISOString().split('T')[0] });
  const [preview, setPreview] = useState<{ name: string; fileData: string } | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const fileRef = useRef<HTMLInputElement>(null);
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const { pickingFile, beforePick, afterPick } = useFilePickerDialogGuard();

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">Please select or add a child first.</p>;

  const mergedRows = useMemo(
    () =>
      buildLinkedDocumentRows(selectedChild.id, documents, prescriptions, vaccinations, filterType),
    [selectedChild.id, documents, prescriptions, vaccinations, filterType],
  );

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
    if (file.size > maxBytes) {
      toast.error(usesRemoteData ? 'File too large (max 50 MB).' : 'File too large (max 5 MB for local storage).');
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
        if (isHeic(inferredType, file.name)) {
          const { data, mime } = await normalizeImageDataUrl(raw, file.name);
          const jpegName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
          setPickedFile({ data, type: mime, name: jpegName });
        } else {
          setPickedFile({ data: raw, type: inferredType, name: file.name });
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
    if (row.kind === 'upload') {
      deleteDocument(row.doc.id);
      toast.success('Deleted.');
      return;
    }
    if (row.kind === 'prescription') {
      updatePrescription({ ...row.rx, prescriptionImage: '' });
      toast.success('Prescription image removed.');
      return;
    }
    updateVaccination({ ...row.vax, cardPhoto: undefined });
    toast.success('Vaccination card image removed.');
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

      {mergedRows.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mergedRows.map(row => {
            const key =
              row.kind === 'upload'
                ? row.doc.id
                : row.kind === 'prescription'
                  ? `rx-img-${row.rx.id}`
                  : `vax-card-${row.vax.id}`;
            const derived = row.kind === 'upload' ? null : rowPreview(row);
            const title = row.kind === 'upload' ? row.doc.name : derived!.name;
            const typeLabel =
              row.kind === 'upload'
                ? docTypes.find(t => t.value === row.doc.type)?.label
                : row.kind === 'prescription'
                  ? 'Prescription'
                  : 'Vaccination Card';
            const dateStr =
              row.kind === 'upload'
                ? row.doc.date
                : row.kind === 'prescription'
                  ? row.rx.date
                  : row.vax.completedDate || row.vax.dueDate;
            const fileData = row.kind === 'upload' ? row.doc.fileData : derived!.fileData;
            const fileType =
              row.kind === 'upload' ? row.doc.fileType : imageMimeFromSrc(fileData);
            const notes = rowDisplayNotes(row);
            const showImage = fileType.startsWith('image/');

            return (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> {title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{typeLabel}</Badge>
                    <span className="text-xs text-muted-foreground">{format(new Date(dateStr), 'PP')}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {showImage && (
                    <img src={fileData} alt={title} className="w-full h-32 object-cover rounded-md mb-2" />
                  )}
                  {notes && <p className="text-xs text-muted-foreground mb-2">{notes}</p>}
                  <div className="flex gap-2">
                    {showImage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setPreview({ name: title, fileData })}
                      >
                        <Eye className="h-3 w-3" /> View
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
