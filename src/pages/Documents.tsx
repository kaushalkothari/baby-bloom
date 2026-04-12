import { useState, useRef } from 'react';
import { useApp } from '@/lib/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileText, Trash2, Download, Eye } from 'lucide-react';
import { format, startOfDay, isAfter } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { Document as DocType } from '@/types';
import { toast } from 'sonner';

const docTypes = [
  { value: 'receipt', label: 'Receipt' },
  { value: 'lab_report', label: 'Lab Report' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'vaccination_card', label: 'Vaccination Card' },
  { value: 'other', label: 'Other' },
];

export default function Documents() {
  const { selectedChild, documents, addDocument, deleteDocument, usesRemoteData } = useApp();
  const maxBytes = usesRemoteData ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<DocType>>({ type: 'other', date: new Date().toISOString().split('T')[0] });
  const [preview, setPreview] = useState<DocType | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileData, setFileData] = useState<{ data: string; type: string } | null>(null);

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">Please select or add a child first.</p>;

  const childDocs = documents
    .filter(d => d.childId === selectedChild.id)
    .filter(d => filterType === 'all' || d.type === filterType)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxBytes) {
      toast.error(usesRemoteData ? 'File too large (max 50MB).' : 'File too large (max 5MB for local storage).');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setFileData({ data: ev.target?.result as string, type: file.type });
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.name || !fileData) { toast.error('Name and file are required.'); return; }
    addDocument({
      ...form, id: crypto.randomUUID(), childId: selectedChild.id,
      fileData: fileData.data, fileType: fileData.type, createdAt: new Date().toISOString(),
    } as DocType);
    toast.success('Document uploaded!');
    setOpen(false); setForm({ type: 'other', date: new Date().toISOString().split('T')[0] }); setFileData(null);
  };

  const downloadDoc = (doc: DocType) => {
    const a = document.createElement('a');
    a.href = doc.fileData;
    a.download = doc.name;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold">Documents</h1>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setForm({ type: 'other', date: new Date().toISOString().split('T')[0] }); setFileData(null); } }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Upload</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Upload Document</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name *</Label><Input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Type</Label>
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
              <div>
                <Label>File *</Label>
                <Input type="file" accept="image/*,.pdf" ref={fileRef} onChange={handleFile} />
                {fileData && <p className="text-xs text-muted-foreground mt-1">File loaded ✓</p>}
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

      {childDocs.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {childDocs.map(doc => (
            <Card key={doc.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> {doc.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{docTypes.find(t => t.value === doc.type)?.label}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(doc.date), 'PP')}</span>
                </div>
              </CardHeader>
              <CardContent>
                {doc.fileType.startsWith('image/') && (
                  <img src={doc.fileData} alt={doc.name} className="w-full h-32 object-cover rounded-md mb-2" />
                )}
                {doc.notes && <p className="text-xs text-muted-foreground mb-2">{doc.notes}</p>}
                <div className="flex gap-2">
                  {doc.fileType.startsWith('image/') && (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setPreview(doc)}>
                      <Eye className="h-3 w-3" /> View
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => downloadDoc(doc)}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { deleteDocument(doc.id); toast.success('Deleted.'); }}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
