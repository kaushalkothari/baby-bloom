import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const { selectedChild, vaccinations, addVaccination, updateVaccination, deleteVaccination } = useApp();
  const [open, setOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [photoViewOpen, setPhotoViewOpen] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Vaccination>>({});
  const [filter, setFilter] = useState<'all' | VaccinationStatus>('all');

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">Please select or add a child first.</p>;

  const childVax = vaccinations.filter(v => v.childId === selectedChild.id);
  const completedNames = new Set(childVax.filter(v => v.completedDate).map(v => v.vaccineName));

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

  const handlePhotoCapture = (photo: string) => {
    setForm(p => ({ ...p, cardPhoto: photo }));
  };

  const handleOcrResult = (result: { vaccineName?: string; batchNumber?: string; completedDate?: string; administeredBy?: string }) => {
    setForm(p => ({
      ...p,
      ...(result.vaccineName && !p.vaccineName ? { vaccineName: result.vaccineName } : {}),
      ...(result.batchNumber && !p.batchNumber ? { batchNumber: result.batchNumber } : {}),
      ...(result.completedDate && !p.completedDate ? { completedDate: result.completedDate } : {}),
      ...(result.administeredBy && !p.administeredBy ? { administeredBy: result.administeredBy } : {}),
    }));
  };

  const statusColor = (s: VaccinationStatus) =>
    s === 'completed' ? 'bg-success text-success-foreground' :
    s === 'overdue' ? 'bg-destructive text-destructive-foreground' :
    'bg-secondary text-secondary-foreground';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold">Vaccinations</h1>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setForm({}); }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Add Custom</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-display">Add Custom Vaccination</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Scan vaccine card button */}
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 border-dashed border-2 h-12"
                onClick={() => setCaptureOpen(true)}
              >
                <Camera className="h-5 w-5 text-primary" />
                {form.cardPhoto ? 'Retake Vaccine Card Photo' : 'Scan Vaccine Card (OCR)'}
              </Button>

              {form.cardPhoto && (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={form.cardPhoto} alt="Vaccine card" className="w-full max-h-32 object-contain bg-muted" />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2 h-6 text-xs"
                    onClick={() => setForm(p => ({ ...p, cardPhoto: undefined }))}
                  >
                    Remove
                  </Button>
                </div>
              )}

              <div><Label>Vaccine Name *</Label><Input value={form.vaccineName || ''} onChange={e => setForm(p => ({ ...p, vaccineName: e.target.value }))} /></div>
              <div><Label>Due Date *</Label><Input type="date" value={form.dueDate || ''} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
              <div><Label>Completed Date</Label><Input type="date" value={form.completedDate || ''} onChange={e => setForm(p => ({ ...p, completedDate: e.target.value }))} /></div>
              <div><Label>Batch Number</Label><Input value={form.batchNumber || ''} onChange={e => setForm(p => ({ ...p, batchNumber: e.target.value }))} /></div>
              <div><Label>Administered By</Label><Input value={form.administeredBy || ''} onChange={e => setForm(p => ({ ...p, administeredBy: e.target.value }))} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <Button onClick={handleAddCustom} className="w-full">Add Vaccination</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Filter:</span>
        {(['all', 'upcoming', 'overdue', 'completed'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(vs => (
          <Card key={vs.name} className={vs.status === 'completed' ? 'opacity-75' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <Syringe className="h-4 w-4 text-primary" /> {vs.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{vs.description}</p>
              </div>
              <Badge className={statusColor(vs.status)}>{vs.status}</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Due:</span> {format(new Date(vs.dueDate), 'PP')}</p>
                  {vs.record?.completedDate && <p><span className="text-muted-foreground">Done:</span> {format(new Date(vs.record.completedDate), 'PP')}</p>}
                  {vs.record?.batchNumber && <p><span className="text-muted-foreground">Batch:</span> {vs.record.batchNumber}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {vs.record?.cardPhoto && (
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => setPhotoViewOpen(vs.record!.cardPhoto!)}>
                      <ImageIcon className="h-3 w-3" />
                    </Button>
                  )}
                  {vs.status !== 'completed' && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => markComplete(vs)}>
                      <Check className="h-3 w-3" /> Done
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Vaccine Card Capture Dialog */}
      <VaccineCardCapture
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        onPhotoCapture={handlePhotoCapture}
        onOcrResult={handleOcrResult}
      />

      {/* Photo Viewer Dialog */}
      <Dialog open={!!photoViewOpen} onOpenChange={() => setPhotoViewOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Vaccine Card Photo</DialogTitle></DialogHeader>
          {photoViewOpen && (
            <img src={photoViewOpen} alt="Vaccine card" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
