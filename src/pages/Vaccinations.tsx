import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Syringe, Check, Camera, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { vaccineSchedule, getVaccineDueDate } from '@/data/vaccineSchedule';
import { Vaccination, VaccinationStatus } from '@/types';
import { VaccineCardCapture } from '@/components/VaccineCardCapture';
import { toast } from 'sonner';

export default function Vaccinations() {
  const { selectedChild, vaccinations, addVaccination, updateVaccination } = useApp();
  const [open, setOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [photoViewOpen, setPhotoViewOpen] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Vaccination>>({});
  const [filter, setFilter] = useState<'all' | VaccinationStatus>('all');

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">Please select or add a child first.</p>;

  const childVax = vaccinations.filter(v => v.childId === selectedChild.id);

  const scheduleWithStatus = vaccineSchedule.map(vs => {
    const record = childVax.find(v => v.vaccineName === vs.name);
    const dueDate = getVaccineDueDate(selectedChild.dateOfBirth, vs.ageInWeeks);
    let status: VaccinationStatus = 'upcoming';
    if (record?.completedDate) status = 'completed';
    else if (new Date(dueDate) < new Date()) status = 'overdue';
    return { ...vs, dueDate, status, record };
  });

  const filtered = filter === 'all' ? scheduleWithStatus : scheduleWithStatus.filter(v => v.status === filter);

  const markComplete = (vs: typeof scheduleWithStatus[0]) => {
    if (vs.record) {
      updateVaccination({ ...vs.record, completedDate: new Date().toISOString().split('T')[0] });
    } else {
      addVaccination({
        id: crypto.randomUUID(), childId: selectedChild.id, vaccineName: vs.name,
        dueDate: vs.dueDate, completedDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      });
    }
    toast.success(`${vs.name} marked as completed!`);
  };

  const handleAddCustom = () => {
    if (!form.vaccineName || !form.dueDate) { toast.error('Vaccine name and due date are required.'); return; }
    addVaccination({
      ...form, id: crypto.randomUUID(), childId: selectedChild.id, createdAt: new Date().toISOString(),
    } as Vaccination);
    toast.success('Vaccination added!');
    setOpen(false); setForm({});
  };

  const handlePhotoCapture = (photo: string) => setForm(p => ({ ...p, cardPhoto: photo }));
  const handleOcrResult = (result: { vaccineName?: string; batchNumber?: string; completedDate?: string; expiryDate?: string; administeredBy?: string }) => {
    setForm(p => ({
      ...p,
      ...(result.vaccineName && !p.vaccineName ? { vaccineName: result.vaccineName } : {}),
      ...(result.batchNumber && !p.batchNumber ? { batchNumber: result.batchNumber } : {}),
      ...(result.completedDate && !p.completedDate ? { completedDate: result.completedDate } : {}),
      ...(result.expiryDate && !p.expiryDate ? { expiryDate: result.expiryDate } : {}),
      ...(result.administeredBy && !p.administeredBy ? { administeredBy: result.administeredBy } : {}),
    }));
  };

  const statusColor = (s: VaccinationStatus) =>
    s === 'completed' ? 'bg-success text-success-foreground' :
    s === 'overdue' ? 'bg-destructive text-destructive-foreground' :
    'bg-secondary text-secondary-foreground';

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-accent/30 px-4 pt-4 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Syringe className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-display font-bold">Vaccines</h1>
          </div>
          <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setForm({}); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 rounded-full">
                <Plus className="h-4 w-4" /> Custom
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display">Add Custom Vaccination</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Button type="button" variant="outline" className="w-full gap-2 border-dashed border-2 h-12" onClick={() => setCaptureOpen(true)}>
                  <Camera className="h-5 w-5 text-primary" />
                  {form.cardPhoto ? 'Retake Vaccine Card Photo' : 'Scan Vaccine Card (OCR)'}
                </Button>
                {form.cardPhoto && (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img src={form.cardPhoto} alt="Vaccine card" className="w-full max-h-32 object-contain bg-muted" />
                    <Button size="sm" variant="destructive" className="absolute top-2 right-2 h-6 text-xs" onClick={() => setForm(p => ({ ...p, cardPhoto: undefined }))}>Remove</Button>
                  </div>
                )}
                <div><Label>Vaccine Name *</Label><Input value={form.vaccineName || ''} onChange={e => setForm(p => ({ ...p, vaccineName: e.target.value }))} /></div>
                <div><Label>Due Date *</Label><Input type="date" value={form.dueDate || ''} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
                <div><Label>Completed Date</Label><Input type="date" value={form.completedDate || ''} onChange={e => setForm(p => ({ ...p, completedDate: e.target.value }))} /></div>
                <div><Label>Batch Number</Label><Input value={form.batchNumber || ''} onChange={e => setForm(p => ({ ...p, batchNumber: e.target.value }))} /></div>
                <div><Label>Expiry Date</Label><Input type="date" value={form.expiryDate || ''} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} /></div>
                <div><Label>Administered By</Label><Input value={form.administeredBy || ''} onChange={e => setForm(p => ({ ...p, administeredBy: e.target.value }))} /></div>
                <div><Label>Notes</Label><Textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
                <Button onClick={handleAddCustom} className="w-full">Add Vaccination</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="px-4 space-y-3 -mt-3">
        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(['all', 'upcoming', 'overdue', 'completed'] as const).map(f => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="capitalize rounded-full text-xs shrink-0">
              {f}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map(vs => (
            <div key={vs.name} className={`rounded-xl bg-card border border-border p-4 space-y-2 ${vs.status === 'completed' ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Syringe className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-display font-bold text-sm truncate">{vs.name}</span>
                </div>
                <Badge className={`${statusColor(vs.status)} text-[10px] px-1.5 py-0 shrink-0`}>{vs.status}</Badge>
              </div>

              <p className="text-[11px] text-muted-foreground">{vs.description}</p>

              <div className="flex items-center justify-between">
                <div className="text-xs space-y-0.5">
                  <p><span className="text-muted-foreground">Due:</span> {format(new Date(vs.dueDate), 'PP')}</p>
                  {vs.record?.completedDate && <p><span className="text-muted-foreground">Done:</span> {format(new Date(vs.record.completedDate), 'PP')}</p>}
                  {vs.record?.batchNumber && <p><span className="text-muted-foreground">Batch:</span> {vs.record.batchNumber}</p>}
                  {vs.record?.expiryDate && <p><span className="text-muted-foreground">Expiry:</span> {format(new Date(vs.record.expiryDate), 'PP')}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {vs.record?.cardPhoto && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setPhotoViewOpen(vs.record!.cardPhoto!)}>
                      <ImageIcon className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {vs.status !== 'completed' && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs rounded-full h-7" onClick={() => markComplete(vs)}>
                      <Check className="h-3 w-3" /> Done
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <VaccineCardCapture open={captureOpen} onOpenChange={setCaptureOpen} onPhotoCapture={handlePhotoCapture} onOcrResult={handleOcrResult} />

      <Dialog open={!!photoViewOpen} onOpenChange={() => setPhotoViewOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Vaccine Card Photo</DialogTitle></DialogHeader>
          {photoViewOpen && <img src={photoViewOpen} alt="Vaccine card" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
