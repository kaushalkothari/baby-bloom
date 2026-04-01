import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Receipt, Trash2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { BillingRecord } from '@/types';
import { toast } from 'sonner';

const emptyBill = (): Partial<BillingRecord> => ({
  date: new Date().toISOString().split('T')[0], amount: 0, hospitalName: '', description: '',
});

export default function Billing() {
  const { selectedChild, billing, addBilling, updateBilling, deleteBilling } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BillingRecord | null>(null);
  const [form, setForm] = useState<Partial<BillingRecord>>(emptyBill());

  if (!selectedChild) return <p className="text-muted-foreground text-center py-20">Please select or add a child first.</p>;

  const childBills = billing
    .filter(b => b.childId === selectedChild.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const total = childBills.reduce((s, b) => s + b.amount, 0);

  const handleSave = () => {
    if (!form.hospitalName || !form.amount) { toast.error('Hospital and amount are required.'); return; }
    if (editing) {
      updateBilling({ ...editing, ...form } as BillingRecord);
      toast.success('Updated!');
    } else {
      addBilling({ ...form, id: crypto.randomUUID(), childId: selectedChild.id, createdAt: new Date().toISOString() } as BillingRecord);
      toast.success('Bill added!');
    }
    setOpen(false); setEditing(null); setForm(emptyBill());
  };

  const set = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-accent/30 px-4 pt-4 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold">Billing</h1>
              <p className="text-xs text-muted-foreground">Total: <span className="font-bold text-foreground">₹{total.toLocaleString()}</span></p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(null); setForm(emptyBill()); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 rounded-full"><Plus className="h-4 w-4" /> Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">{editing ? 'Edit' : 'Add'} Bill</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Date</Label><Input type="date" value={form.date || ''} onChange={e => set('date', e.target.value)} /></div>
                <div><Label>Hospital *</Label><Input value={form.hospitalName || ''} onChange={e => set('hospitalName', e.target.value)} /></div>
                <div><Label>Amount (₹) *</Label><Input type="number" value={form.amount || ''} onChange={e => set('amount', parseFloat(e.target.value) || 0)} /></div>
                <div><Label>Description</Label><Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} /></div>
                <Button onClick={handleSave} className="w-full">{editing ? 'Update' : 'Add Bill'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="px-4 space-y-3 -mt-3">
        {childBills.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="h-14 w-14 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No billing records yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {childBills.map(b => (
              <div key={b.id} className="rounded-xl bg-card border border-border p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm">{b.hospitalName}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(b.date), 'PPP')}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-bold">₹{b.amount.toLocaleString()}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(b); setForm(b); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { deleteBilling(b.id); toast.success('Deleted.'); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </div>
                {b.description && <p className="text-xs text-muted-foreground mt-1">{b.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
