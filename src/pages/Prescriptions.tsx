import { useState, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pill, Trash2, Pencil, Image, X } from 'lucide-react';
import { format } from 'date-fns';
import { Prescription, Medicine } from '@/types';
import { toast } from 'sonner';

const emptyMedicine = (): Medicine => ({
  id: crypto.randomUUID(), name: '', dosage: '', frequency: '', duration: '',
});

const emptyRx = (): Partial<Prescription> & { medicines: Medicine[] } => ({
  medicines: [emptyMedicine()],
  prescribingDoctor: '',
  date: new Date().toISOString().split('T')[0],
  active: true,
  notes: '',
  prescriptionImage: '',
});

function getMedicines(rx: Prescription): Medicine[] {
  if (rx.medicines && rx.medicines.length > 0) return rx.medicines;
  if (rx.medicineName) {
    return [{ id: 'legacy', name: rx.medicineName, dosage: rx.dosage || '', frequency: rx.frequency || '', duration: rx.duration || '' }];
  }
  return [];
}

export default function Prescriptions() {
  const { selectedChild, prescriptions, addPrescription, updatePrescription, deletePrescription } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Prescription | null>(null);
  const [form, setForm] = useState<Partial<Prescription> & { medicines: Medicine[] }>(emptyRx());
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">Please select or add a child first.</p>;

  const childRx = prescriptions
    .filter(p => p.childId === selectedChild.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSave = () => {
    const validMeds = form.medicines.filter(m => m.name.trim());
    if (validMeds.length === 0) { toast.error('At least one medicine name is required.'); return; }
    const rxData = { ...form, medicines: validMeds };
    if (editing) {
      updatePrescription({ ...editing, ...rxData } as Prescription);
      toast.success('Updated!');
    } else {
      addPrescription({ ...rxData, id: crypto.randomUUID(), childId: selectedChild.id, createdAt: new Date().toISOString() } as Prescription);
      toast.success('Prescription added!');
    }
    setOpen(false); setEditing(null); setForm(emptyRx());
  };

  const set = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));
  const updateMedicine = (idx: number, key: keyof Medicine, val: string) => {
    setForm(p => {
      const meds = [...p.medicines];
      meds[idx] = { ...meds[idx], [key]: val };
      return { ...p, medicines: meds };
    });
  };
  const addMedicine = () => setForm(p => ({ ...p, medicines: [...p.medicines, emptyMedicine()] }));
  const removeMedicine = (idx: number) => {
    if (form.medicines.length <= 1) return;
    setForm(p => ({ ...p, medicines: p.medicines.filter((_, i) => i !== idx) }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => set('prescriptionImage', reader.result as string);
    reader.readAsDataURL(file);
  };

  const openEditRx = (rx: Prescription) => {
    setEditing(rx);
    setForm({ ...rx, medicines: getMedicines(rx) });
    setOpen(true);
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-accent/30 px-4 pt-4 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Pill className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-display font-bold">Medicines</h1>
          </div>
          <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); setForm(emptyRx()); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 rounded-full">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display">{editing ? 'Edit' : 'Add'} Prescription</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Medicines</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addMedicine} className="gap-1 rounded-full">
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </div>
                  {form.medicines.map((med, idx) => (
                    <div key={med.id} className="rounded-xl border border-border p-3 space-y-2 relative bg-muted/30">
                      {form.medicines.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeMedicine(idx)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                      <div className="text-[11px] font-medium text-muted-foreground">Medicine {idx + 1}</div>
                      <Input placeholder="Medicine name *" value={med.name} onChange={e => updateMedicine(idx, 'name', e.target.value)} />
                      <div className="grid grid-cols-3 gap-2">
                        <Input placeholder="Dosage" value={med.dosage} onChange={e => updateMedicine(idx, 'dosage', e.target.value)} />
                        <Input placeholder="Frequency" value={med.frequency} onChange={e => updateMedicine(idx, 'frequency', e.target.value)} />
                        <Input placeholder="Duration" value={med.duration} onChange={e => updateMedicine(idx, 'duration', e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
                <div><Label>Prescribing Doctor</Label><Input value={form.prescribingDoctor || ''} onChange={e => set('prescribingDoctor', e.target.value)} /></div>
                <div><Label>Date</Label><Input type="date" value={form.date || ''} onChange={e => set('date', e.target.value)} /></div>
                <div><Label>Notes</Label><Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} /></div>
                <div>
                  <Label>Prescription Image</Label>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  {form.prescriptionImage ? (
                    <div className="relative mt-2">
                      <img src={form.prescriptionImage} alt="Prescription" className="rounded-xl max-h-40 w-full object-cover border border-border" />
                      <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => set('prescriptionImage', '')}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" className="w-full mt-1 gap-2" onClick={() => fileRef.current?.click()}>
                      <Image className="h-4 w-4" /> Upload Image
                    </Button>
                  )}
                </div>
                <Button onClick={handleSave} className="w-full">{editing ? 'Update' : 'Add'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="px-4 space-y-3 -mt-3">
        {childRx.length === 0 ? (
          <div className="text-center py-16">
            <Pill className="h-14 w-14 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No prescriptions recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {childRx.map(rx => {
              const meds = getMedicines(rx);
              return (
                <div key={rx.id} className={`rounded-xl bg-card border border-border p-4 space-y-2 ${!rx.active ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Pill className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-display font-bold text-sm truncate">
                        {meds.length === 1 ? meds[0].name : `${meds.length} Medicines`}
                      </span>
                      <Badge variant={rx.active ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 shrink-0">
                        {rx.active ? 'Active' : 'Done'}
                      </Badge>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updatePrescription({ ...rx, active: !rx.active })}>
                        <span className="text-[10px]">{rx.active ? '✓' : '↺'}</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRx(rx)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { deletePrescription(rx.id); toast.success('Deleted.'); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </div>

                  {meds.length === 1 ? (
                    <p className="text-xs text-muted-foreground">{meds[0].dosage} · {meds[0].frequency} · {meds[0].duration}</p>
                  ) : (
                    <div className="space-y-0.5">
                      {meds.map((m, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{m.name}</span> — {m.dosage} · {m.frequency} · {m.duration}
                        </p>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">Dr. {rx.prescribingDoctor} · {format(new Date(rx.date), 'PP')}</p>
                  {rx.notes && <p className="text-[11px] text-muted-foreground italic">{rx.notes}</p>}
                  {rx.prescriptionImage && (
                    <img
                      src={rx.prescriptionImage}
                      alt="Prescription"
                      className="mt-1 rounded-lg max-h-24 cursor-pointer border border-border hover:opacity-80 transition-opacity"
                      onClick={() => setPreviewImg(rx.prescriptionImage!)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!previewImg} onOpenChange={() => setPreviewImg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Prescription Image</DialogTitle></DialogHeader>
          {previewImg && <img src={previewImg} alt="Prescription" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
