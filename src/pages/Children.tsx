import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Baby, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, differenceInMonths, differenceInDays } from 'date-fns';
import { Child } from '@/types';
import { toast } from 'sonner';

const emptyChild = (): Partial<Child> => ({ name: '', dateOfBirth: '', gender: 'female', bloodGroup: '', notes: '' });

export default function Children() {
  const { children, addChild, updateChild, deleteChild, setSelectedChildId } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [form, setForm] = useState<Partial<Child>>(emptyChild());

  const handleSave = () => {
    if (!form.name || !form.dateOfBirth || !form.gender) {
      toast.error('Name, date of birth, and gender are required.');
      return;
    }
    if (editing) {
      updateChild({ ...editing, ...form } as Child);
      toast.success('Child updated!');
    } else {
      const child: Child = { ...form, id: crypto.randomUUID(), createdAt: new Date().toISOString() } as Child;
      addChild(child);
      setSelectedChildId(child.id);
      toast.success('Child added!');
    }
    setOpen(false); setEditing(null); setForm(emptyChild());
  };

  const openEdit = (child: Child) => { setEditing(child); setForm(child); setOpen(true); };
  const handleDelete = (child: Child) => {
    if (confirm(`Delete ${child.name} and all associated records?`)) {
      deleteChild(child.id);
      toast.success('Deleted.');
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-accent/30 px-4 pt-4 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Baby className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-display font-bold">Children</h1>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(emptyChild()); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 rounded-full"><Plus className="h-4 w-4" /> Add</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="font-display">{editing ? 'Edit Child' : 'Add Child'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name *</Label><Input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>Date of Birth *</Label><Input type="date" value={form.dateOfBirth || ''} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} /></div>
                <div><Label>Gender *</Label>
                  <Select value={form.gender || ''} onValueChange={v => setForm(p => ({ ...p, gender: v as Child['gender'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Blood Group</Label><Input value={form.bloodGroup || ''} onChange={e => setForm(p => ({ ...p, bloodGroup: e.target.value }))} placeholder="e.g. O+" /></div>
                <div><Label>Notes</Label><Textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
                <Button onClick={handleSave} className="w-full">{editing ? 'Update' : 'Add Child'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="px-4 space-y-3 -mt-3">
        {children.length === 0 ? (
          <div className="text-center py-16">
            <Baby className="h-14 w-14 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No children added yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map(child => {
              const ageMonths = differenceInMonths(new Date(), new Date(child.dateOfBirth));
              const ageDays = differenceInDays(new Date(), new Date(child.dateOfBirth));
              const ageText = ageMonths >= 1 ? `${ageMonths} month${ageMonths > 1 ? 's' : ''}` : `${ageDays} day${ageDays > 1 ? 's' : ''}`;
              return (
                <button
                  key={child.id}
                  onClick={() => setSelectedChildId(child.id)}
                  className="w-full rounded-xl bg-card border border-border p-4 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Baby className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-sm">{child.name}</p>
                    <p className="text-xs text-muted-foreground">{ageText} · Born {format(new Date(child.dateOfBirth), 'PP')}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="capitalize">{child.gender}</span>
                      {child.bloodGroup && <span>· {child.bloodGroup}</span>}
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(child)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(child)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
