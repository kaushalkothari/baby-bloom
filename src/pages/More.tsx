import { useApp } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { FileText, Receipt, TrendingUp, Settings, ChevronRight, Download, Upload, Baby } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRef } from 'react';

const menuItems = [
  { label: 'Documents', desc: 'View all uploaded documents', icon: FileText, path: '/documents' },
  { label: 'Billing', desc: 'View billing history', icon: Receipt, path: '/billing' },
  { label: 'Growth Charts', desc: 'Track weight & height', icon: TrendingUp, path: '/growth' },
  { label: 'Children', desc: 'Manage child profiles', icon: Baby, path: '/children' },
];

export default function More() {
  const { selectedChild, exportData, importData } = useApp();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const ok = importData(ev.target?.result as string);
      toast(ok ? 'Data imported successfully!' : 'Failed to import data');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-display font-bold">More</h1>

      {selectedChild && (
        <div className="rounded-xl bg-accent/40 p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-lg">
            {selectedChild.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold">{selectedChild.name}</p>
            <p className="text-xs text-muted-foreground">
              Born: {selectedChild.dateOfBirth}
              {selectedChild.bloodGroup && ` · Blood Group: ${selectedChild.bloodGroup}`}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:bg-muted/50 transition-colors"
          >
            <div className="h-10 w-10 rounded-lg bg-accent/40 flex items-center justify-center">
              <item.icon className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      <div className="space-y-2 pt-2">
        <Button variant="outline" className="w-full gap-2" onClick={exportData}>
          <Download className="h-4 w-4" /> Export Data
        </Button>
        <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Import Data
        </Button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>

      <p className="text-center text-xs text-muted-foreground pt-4">Baby Health Tracker v1.0.0</p>
    </div>
  );
}
