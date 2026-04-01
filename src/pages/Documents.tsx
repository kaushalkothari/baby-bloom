import { useState, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileText, Trash2, Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
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
  const { selectedChild, documents, addDocument, deleteDocument } = useApp();
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
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large (max 5MB).'); return; }
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
    <div className="max-w-lg mx-auto">
      <div className="bg-accent/30 px-4 pt-4 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-display font-bold">Documents</h1>
          </div>
          <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setForm({ type: 'other', date: new Date().toISOString().split('T')[0] }); setFileData(null); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 rounded-full"><Plus className="h-4 w-4" /> Upload</Button>
            </DialogTrigger>
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
                <div><Label>Date</Label><Input type="date" value={form.date || ''} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
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
      </div>

      <div className="px-4 space-y-3 -mt-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Button variant={filterType === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilterType('all')} className="rounded-full text-xs shrink-0">All</Button>
          {docTypes.map(t => (
            <Button key={t.value} variant={filterType === t.value ? 'default' : 'outline'} size="sm" onClick={() => setFilterType(t.value)} className="rounded-full text-xs shrink-0">{t.label}</Button>
          ))}
        </div>

        {childDocs.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-14 w-14 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {childDocs.map(doc => (
              <div key={doc.id} className="rounded-xl bg-card border border-border p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-display font-bold text-sm truncate">{doc.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{docTypes.find(t => t.value === doc.type)?.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{format(new Date(doc.date), 'PP')}</p>
                {doc.fileType.startsWith('image/') && (
                  <img src={doc.fileData} alt={doc.name} className="w-full h-28 object-cover rounded-lg" />
                )}
                {doc.notes && <p className="text-[11px] text-muted-foreground">{doc.notes}</p>}
                <div className="flex gap-2">
                  {doc.fileType.startsWith('image/') && (
                    <Button variant="outline" size="sm" className="gap-1 rounded-full text-xs h-7" onClick={() => setPreview(doc)}>
                      <Eye className="h-3 w-3" /> View
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-1 rounded-full text-xs h-7" onClick={() => downloadDoc(doc)}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => { deleteDocument(doc.id); toast.success('Deleted.'); }}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{preview?.name}</DialogTitle></DialogHeader>
          {preview && <img src={preview.fileData} alt={preview.name} className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
