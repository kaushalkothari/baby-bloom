import { useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Child, HospitalVisit, Vaccination, Prescription, Document, BillingRecord } from '@/types';

/** Offline / no Supabase — persists to localStorage. */
export function useLocalAppData() {
  const [children, setChildren] = useLocalStorage<Child[]>('baby-tracker-children', []);
  const [visits, setVisits] = useLocalStorage<HospitalVisit[]>('baby-tracker-visits', []);
  const [vaccinations, setVaccinations] = useLocalStorage<Vaccination[]>('baby-tracker-vaccinations', []);
  const [prescriptions, setPrescriptions] = useLocalStorage<Prescription[]>('baby-tracker-prescriptions', []);
  const [documents, setDocuments] = useLocalStorage<Document[]>('baby-tracker-documents', []);
  const [billing, setBilling] = useLocalStorage<BillingRecord[]>('baby-tracker-billing', []);
  const [selectedChildId, setSelectedChildId] = useLocalStorage<string | null>('baby-tracker-selected-child', null);

  const selectedChild = children.find((c) => c.id === selectedChildId) || children[0] || null;

  const addChild = useCallback(async (child: Child) => {
    setChildren((prev) => [...prev, child]);
    return true;
  }, [setChildren]);
  const updateChild = (child: Child) => setChildren((prev) => prev.map((c) => (c.id === child.id ? child : c)));
  const deleteChild = (id: string) => {
    setChildren((prev) => prev.filter((c) => c.id !== id));
    setVisits((prev) => prev.filter((v) => v.childId !== id));
    setVaccinations((prev) => prev.filter((v) => v.childId !== id));
    setPrescriptions((prev) => prev.filter((p) => p.childId !== id));
    setDocuments((prev) => prev.filter((d) => d.childId !== id));
    setBilling((prev) => prev.filter((b) => b.childId !== id));
  };

  const addVisit = (visit: HospitalVisit) => setVisits((prev) => [...prev, visit]);
  const updateVisit = (visit: HospitalVisit) => setVisits((prev) => prev.map((v) => (v.id === visit.id ? visit : v)));
  const deleteVisit = (id: string) => setVisits((prev) => prev.filter((v) => v.id !== id));

  const addVaccination = (vax: Vaccination) => setVaccinations((prev) => [...prev, vax]);
  const updateVaccination = (vax: Vaccination) =>
    setVaccinations((prev) => prev.map((v) => (v.id === vax.id ? vax : v)));
  const deleteVaccination = (id: string) => setVaccinations((prev) => prev.filter((v) => v.id !== id));

  const addPrescription = (rx: Prescription) => setPrescriptions((prev) => [...prev, rx]);
  const updatePrescription = (rx: Prescription) =>
    setPrescriptions((prev) => prev.map((p) => (p.id === rx.id ? rx : p)));
  const deletePrescription = (id: string) => setPrescriptions((prev) => prev.filter((p) => p.id !== id));

  const addDocument = (doc: Document) => setDocuments((prev) => [...prev, doc]);
  const deleteDocument = (id: string) => setDocuments((prev) => prev.filter((d) => d.id !== id));

  const addBilling = (bill: BillingRecord) => setBilling((prev) => [...prev, bill]);
  const updateBilling = (bill: BillingRecord) => setBilling((prev) => prev.map((b) => (b.id === bill.id ? bill : b)));
  const deleteBilling = (id: string) => setBilling((prev) => prev.filter((b) => b.id !== id));

  const exportData = () => {
    const data = { children, visits, vaccinations, prescriptions, documents, billing };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baby-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.children) setChildren(data.children);
      if (data.visits) setVisits(data.visits);
      if (data.vaccinations) setVaccinations(data.vaccinations);
      if (data.prescriptions) setPrescriptions(data.prescriptions);
      if (data.documents) setDocuments(data.documents);
      if (data.billing) setBilling(data.billing);
      return true;
    } catch {
      return false;
    }
  };

  return {
    children,
    selectedChild,
    selectedChildId,
    setSelectedChildId,
    addChild,
    updateChild,
    deleteChild,
    visits,
    addVisit,
    updateVisit,
    deleteVisit,
    vaccinations,
    addVaccination,
    updateVaccination,
    deleteVaccination,
    prescriptions,
    addPrescription,
    updatePrescription,
    deletePrescription,
    documents,
    addDocument,
    deleteDocument,
    billing,
    addBilling,
    updateBilling,
    deleteBilling,
    exportData,
    importData,
  };
}
