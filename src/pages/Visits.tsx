import { useState } from 'react';
import { useApp } from '@/lib/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Pencil, Stethoscope, ChevronDown, Pill, Receipt, FileText } from 'lucide-react';
import { format, startOfDay, isAfter } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { HospitalVisit, Prescription } from '@/types';
import { toast } from 'sonner';
import { medsFromRx } from '@/lib/documents/linkedDocuments';

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

  // Records linked to a visit by visitId OR same-day match on the record's date.
  const getRelatedRecords = (visit: HospitalVisit) => {
    const linkedToVisit = (record: { childId: string; visitId?: string; date: string }) =>
      record.childId === selectedChild!.id && (record.visitId === visit.id || record.date === visit.date);
    return {
      rxList: prescriptions.filter(linkedToVisit),
      billList: billing.filter(linkedToVisit),
      docList: documents.filter(linkedToVisit),
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold">Hospital Visits</h1>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); setForm(emptyVisit()); } }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Add Visit</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-display">{editing ? 'Edit Visit' : 'New Visit'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="visit-date">Date *</Label>
                <DatePicker
                  id="visit-date"
                  value={form.date || ''}
                  onChange={(v) => set('date', v)}
                  disabled={(d) => isAfter(startOfDay(d), startOfDay(new Date()))}
                />
              </div>
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

      <Input placeholder="Search visits..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />

      {childVisits.length === 0 ? (
        <div className="text-center py-20">
          <Stethoscope className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">No visits recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {childVisits.map(v => {
            const { rxList, billList, docList } = getRelatedRecords(v);
            const hasRelated = rxList.length > 0 || billList.length > 0 || docList.length > 0;
            const isExpanded = expandedId === v.id;

            return (
              <Card key={v.id}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex-1">
                    <CardTitle className="text-base font-display">{v.reason}</CardTitle>
                    <p className="text-sm text-muted-foreground">{v.hospitalName} · Dr. {v.doctorName} · {format(new Date(v.date), 'PPP')}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { deleteVisit(v.id); toast.success('Deleted.'); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {v.description && <p className="text-sm">{v.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {v.weight && <span>⚖️ {v.weight} kg</span>}
                    {v.height && <span>📏 {v.height} cm</span>}
                    {v.headCircumference && <span>🧠 {v.headCircumference} cm</span>}
                    {v.temperature && <span>🌡️ {v.temperature}°F</span>}
                  </div>
                  {v.notes && <p className="text-xs text-muted-foreground italic">{v.notes}</p>}

                  {/* Related records section */}
                  {hasRelated && (
                    <Collapsible open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : v.id)}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2 text-xs w-full justify-start text-muted-foreground hover:text-foreground">
                          <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          Related Records
                          <div className="flex gap-1 ml-auto">
                            {rxList.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Pill className="h-2.5 w-2.5 mr-0.5" />{rxList.length}</Badge>}
                            {billList.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Receipt className="h-2.5 w-2.5 mr-0.5" />{billList.length}</Badge>}
                            {docList.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><FileText className="h-2.5 w-2.5 mr-0.5" />{docList.length}</Badge>}
                          </div>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-3 mt-2">
                        {/* Prescriptions */}
                        {rxList.length > 0 && (
                          <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                              <Pill className="h-3.5 w-3.5 text-primary" /> Prescriptions
                            </div>
                            {rxList.map((rx: Prescription) => {
                              const meds = medsFromRx(rx);
                              return (
                                <div key={rx.id} className="text-sm border-l-2 border-primary/30 pl-3">
                                  {meds.map((m, i) => (
                                    <p key={i}><span className="font-medium">{m.name}</span> — {m.dosage} · {m.frequency} · {m.duration}</p>
                                  ))}
                                  <p className="text-xs text-muted-foreground">Dr. {rx.prescribingDoctor}</p>
                                  {rx.prescriptionImage && (
                                    <img src={rx.prescriptionImage} alt="Rx" className="mt-1 rounded max-h-20 border border-border" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Billing */}
                        {billList.length > 0 && (
                          <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                              <Receipt className="h-3.5 w-3.5 text-primary" /> Billing
                            </div>
                            {billList.map(b => (
                              <div key={b.id} className="text-sm border-l-2 border-primary/30 pl-3 flex justify-between">
                                <span>{b.hospitalName} — {b.description}</span>
                                <span className="font-bold">₹{b.amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Documents */}
                        {docList.length > 0 && (
                          <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                              <FileText className="h-3.5 w-3.5 text-primary" /> Documents
                            </div>
                            {docList.map(d => (
                              <div key={d.id} className="text-sm border-l-2 border-primary/30 pl-3">
                                <span className="font-medium">{d.name}</span>
                                <Badge variant="outline" className="ml-2 text-[10px]">{d.type.replace('_', ' ')}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
