import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Pencil, Stethoscope, ChevronDown, Pill, Receipt, FileText, Search } from 'lucide-react';
import { format } from 'date-fns';
import { HospitalVisit } from '@/types';
import { toast } from 'sonner';

const emptyVisit = (): Partial<HospitalVisit> => ({
  date: new Date().toISOString().split('T')[0], hospitalName: '', doctorName: '', reason: '', description: '',
});

export default function Visits() {
  const { selectedChild, visits, addVisit, updateVisit, deleteVisit, prescriptions, billing, documents } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HospitalVisit | null>(null);
  const [form, setForm] = useState<Partial<HospitalVisit>>(emptyVisit());
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">Please select or add a child first.</p>;

  const childVisits = visits
    .filter(v => v.childId === selectedChild.id)
    .filter(v => !search || v.reason.toLowerCase().includes(search.toLowerCase()) || v.hospitalName.toLowerCase().includes(search.toLowerCase()) || v.doctorName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSave = () => {
    if (!form.date || !form.hospitalName || !form.reason) {
      toast.error('Date, hospital, and reason are required.');
      return;
    }
    if (editing) {
      updateVisit({ ...editing, ...form } as HospitalVisit);
      toast.success('Visit updated!');
    } else {
      addVisit({ ...form, id: crypto.randomUUID(), childId: selectedChild.id, createdAt: new Date().toISOString() } as HospitalVisit);
      toast.success('Visit added!');
    }
    setOpen(false); setEditing(null); setForm(emptyVisit());
  };

  const openEdit = (v: HospitalVisit) => { setEditing(v); setForm(v); setOpen(true); };
  const set = (key: string, val: string | number) => setForm(p => ({ ...p, [key]: val }));

  const getRelatedRecords = (visit: HospitalVisit) => {
    const visitDate = visit.date;
    const rxList = prescriptions.filter(p => p.childId === selectedChild!.id && (p.visitId === visit.id || p.date === visitDate));
    const billList = billing.filter(b => b.childId === selectedChild!.id && (b.visitId === visit.id || b.date === visitDate));
    const docList = documents.filter(d => d.childId === selectedChild!.id && (d.visitId === visit.id || d.date === visitDate));
    return { rxList, billList, docList };
  };

  const getMedicines = (rx: any) => {
    if (rx.medicines?.length > 0) return rx.medicines;
    if (rx.medicineName) return [{ name: rx.medicineName, dosage: rx.dosage, frequency: rx.frequency, duration: rx.duration }];
    return [];
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-accent/30 px-4 pt-4 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-display font-bold">Visits</h1>
          </div>
          <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); setForm(emptyVisit()); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 rounded-full">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display">{editing ? 'Edit Visit' : 'New Visit'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Date *</Label><Input type="date" value={form.date || ''} onChange={e => set('date', e.target.value)} /></div>
                <div><Label>Hospital / Clinic *</Label><Input value={form.hospitalName || ''} onChange={e => set('hospitalName', e.target.value)} /></div>
                <div><Label>Doctor Name</Label><Input value={form.doctorName || ''} onChange={e => set('doctorName', e.target.value)} /></div>
                <div><Label>Reason *</Label><Input value={form.reason || ''} onChange={e => set('reason', e.target.value)} placeholder="e.g. Routine checkup" /></div>
                <div><Label>Description</Label><Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Weight (kg)</Label><Input type="number" step="0.01" value={form.weight || ''} onChange={e => set('weight', parseFloat(e.target.value) || 0)} /></div>
                  <div><Label>Height (cm)</Label><Input type="number" step="0.1" value={form.height || ''} onChange={e => set('height', parseFloat(e.target.value) || 0)} /></div>
                  <div><Label>Head Circ. (cm)</Label><Input type="number" step="0.1" value={form.headCircumference || ''} onChange={e => set('headCircumference', parseFloat(e.target.value) || 0)} /></div>
                  <div><Label>Temp (°F)</Label><Input type="number" step="0.1" value={form.temperature || ''} onChange={e => set('temperature', parseFloat(e.target.value) || 0)} /></div>
                </div>
                <div><Label>Additional Notes</Label><Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} /></div>
                <Button onClick={handleSave} className="w-full">{editing ? 'Update' : 'Add Visit'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="px-4 space-y-3 -mt-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search visits..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl bg-card" />
        </div>

        {childVisits.length === 0 ? (
          <div className="text-center py-16">
            <Stethoscope className="h-14 w-14 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {childVisits.map(v => {
              const { rxList, billList, docList } = getRelatedRecords(v);
              const hasRelated = rxList.length > 0 || billList.length > 0 || docList.length > 0;
              const isExpanded = expandedId === v.id;

              return (
                <div key={v.id} className="rounded-xl bg-card border border-border p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm truncate">{v.reason}</p>
                      <p className="text-xs text-muted-foreground">{v.hospitalName} · Dr. {v.doctorName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(v.date), 'PPP')}</p>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { deleteVisit(v.id); toast.success('Deleted.'); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>

                  {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}

                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {v.weight && <span className="bg-accent/40 px-2 py-0.5 rounded-full">⚖️ {v.weight} kg</span>}
                    {v.height && <span className="bg-accent/40 px-2 py-0.5 rounded-full">📏 {v.height} cm</span>}
                    {v.headCircumference && <span className="bg-accent/40 px-2 py-0.5 rounded-full">🧠 {v.headCircumference} cm</span>}
                    {v.temperature && <span className="bg-accent/40 px-2 py-0.5 rounded-full">🌡️ {v.temperature}°F</span>}
                  </div>

                  {v.notes && <p className="text-[11px] text-muted-foreground italic">{v.notes}</p>}

                  {hasRelated && (
                    <Collapsible open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : v.id)}>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground w-full pt-1 border-t border-border">
                          <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          <span>Related Records</span>
                          <div className="flex gap-1 ml-auto">
                            {rxList.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4"><Pill className="h-2.5 w-2.5 mr-0.5" />{rxList.length}</Badge>}
                            {billList.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4"><Receipt className="h-2.5 w-2.5 mr-0.5" />{billList.length}</Badge>}
                            {docList.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4"><FileText className="h-2.5 w-2.5 mr-0.5" />{docList.length}</Badge>}
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 mt-2">
                        {rxList.length > 0 && (
                          <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><Pill className="h-3 w-3 text-primary" /> Prescriptions</div>
                            {rxList.map(rx => {
                              const meds = getMedicines(rx);
                              return (
                                <div key={rx.id} className="text-xs border-l-2 border-primary/30 pl-2">
                                  {meds.map((m: any, i: number) => (
                                    <p key={i}><span className="font-medium">{m.name}</span> — {m.dosage} · {m.frequency} · {m.duration}</p>
                                  ))}
                                  <p className="text-muted-foreground">Dr. {rx.prescribingDoctor}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {billList.length > 0 && (
                          <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><Receipt className="h-3 w-3 text-primary" /> Billing</div>
                            {billList.map(b => (
                              <div key={b.id} className="text-xs border-l-2 border-primary/30 pl-2 flex justify-between">
                                <span>{b.hospitalName} — {b.description}</span>
                                <span className="font-bold">₹{b.amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {docList.length > 0 && (
                          <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><FileText className="h-3 w-3 text-primary" /> Documents</div>
                            {docList.map(d => (
                              <div key={d.id} className="text-xs border-l-2 border-primary/30 pl-2">
                                <span className="font-medium">{d.name}</span>
                                <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0">{d.type.replace('_', ' ')}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
