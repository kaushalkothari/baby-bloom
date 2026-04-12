import { useState, useRef } from 'react';
import { useApp } from '@/lib/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pill, Trash2, Pencil, Image, X } from 'lucide-react';
import { format, startOfDay, isAfter } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { Prescription, Medicine } from '@/types';
import { toast } from 'sonner';
import { useFilePickerDialogGuard } from '@/hooks/useFilePickerDialogGuard';
import { normalizeImageDataUrl } from '@/lib/imageUtils';

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
  const { pickingFile, beforePick, afterPick } = useFilePickerDialogGuard();

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">Please select or add a child first.</p>;

  const childRx = prescriptions
    .filter(p => p.childId === selectedChild.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const resetDialog = () => {
    setEditing(null);
    setForm(emptyRx());
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSave = () => {
    const validMeds = form.medicines.filter(m => m.name.trim());
    if (validMeds.length === 0) { toast.error('At least one medicine name is required.'); return; }
    const rxData = { ...form, medicines: validMeds };
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

  const triggerFilePick = () => {
    beforePick();
    fileRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    afterPick();
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result;
      if (typeof raw !== 'string') return;
      try {
        const { data } = await normalizeImageDataUrl(raw, file.name);
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
    setForm({ ...rx, medicines: getMedicines(rx) });
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
                  <Label className="text-sm font-semibold">Medicines</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addMedicine} className="gap-1">
                    <Plus className="h-3 w-3" /> Add Medicine
                  </Button>
                </div>
                {form.medicines.map((med, idx) => (
                  <div key={med.id} className="rounded-lg border border-border p-3 space-y-2 relative bg-muted/30">
                    {form.medicines.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeMedicine(idx)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                    <div className="text-xs font-medium text-muted-foreground">Medicine {idx + 1}</div>
                    <Input placeholder="Medicine name *" value={med.name} onChange={e => updateMedicine(idx, 'name', e.target.value)} />
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Dosage" value={med.dosage} onChange={e => updateMedicine(idx, 'dosage', e.target.value)} />
                      <Input placeholder="Frequency" value={med.frequency} onChange={e => updateMedicine(idx, 'frequency', e.target.value)} />
                      <Input placeholder="Duration" value={med.duration} onChange={e => updateMedicine(idx, 'duration', e.target.value)} />
                    </div>
                  </div>
                ))}
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
              <div><Label>Notes</Label><Textarea value={form.notes || ''} onChange={e => patchForm('notes', e.target.value)} /></div>

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

      {childRx.length === 0 ? (
        <div className="text-center py-20">
          <Pill className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">No prescriptions recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {childRx.map(rx => {
            const meds = getMedicines(rx);
            return (
              <Card key={rx.id} className={!rx.active ? 'opacity-60' : ''}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex-1">
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Pill className="h-4 w-4 text-primary" />
                      {meds.length === 1 ? meds[0].name : `${meds.length} Medicines`}
                      <Badge variant={rx.active ? 'default' : 'secondary'}>{rx.active ? 'Active' : 'Completed'}</Badge>
                    </CardTitle>
                    {meds.length === 1 ? (
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
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => updatePrescription({ ...rx, active: !rx.active })}>
                      {rx.active ? 'Mark Done' : 'Reactivate'}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditRx(rx)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { deletePrescription(rx.id); toast.success('Deleted.'); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Dr. {rx.prescribingDoctor} · {format(new Date(rx.date), 'PP')}</p>
                  {rx.notes && <p className="text-xs text-muted-foreground mt-1 italic">{rx.notes}</p>}
                  {rx.prescriptionImage && (
                    <img
                      src={rx.prescriptionImage}
                      alt="Prescription"
                      className="mt-2 rounded-lg max-h-32 cursor-pointer border border-border hover:opacity-80 transition-opacity"
                      onClick={() => setPreviewImg(rx.prescriptionImage!)}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
