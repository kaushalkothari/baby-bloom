import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Child, HospitalVisit, Vaccination, Prescription, Document, BillingRecord } from '@/types';
import { getSupabaseBrowserClient } from './client';
import * as db from './data-access';

function selectedChildStorageKey(userId: string) {
  return `babybloom-selected-child-${userId}`;
}

export type CloudAppData = {
  children: Child[];
  selectedChild: Child | null;
  selectedChildId: string | null;
  setSelectedChildId: (id: string | null) => void;
  addChild: (child: Child) => Promise<boolean>;
  updateChild: (child: Child) => void;
  deleteChild: (id: string) => void;
  visits: HospitalVisit[];
  addVisit: (visit: HospitalVisit) => void;
  updateVisit: (visit: HospitalVisit) => void;
  deleteVisit: (id: string) => void;
  vaccinations: Vaccination[];
  addVaccination: (vax: Vaccination) => void;
  updateVaccination: (vax: Vaccination) => void;
  deleteVaccination: (id: string) => void;
  prescriptions: Prescription[];
  addPrescription: (rx: Prescription) => void;
  updatePrescription: (rx: Prescription) => void;
  deletePrescription: (id: string) => void;
  documents: Document[];
  addDocument: (doc: Document) => void;
  deleteDocument: (id: string) => void;
  billing: BillingRecord[];
  addBilling: (bill: BillingRecord) => void;
  updateBilling: (bill: BillingRecord) => void;
  deleteBilling: (id: string) => void;
  exportData: () => void;
  importData: (json: string) => boolean;
  refresh: () => Promise<void>;
};

const empty: CloudAppData = {
  children: [],
  selectedChild: null,
  selectedChildId: null,
  setSelectedChildId: () => {},
  addChild: async () => false,
  updateChild: () => {},
  deleteChild: () => {},
  visits: [],
  addVisit: () => {},
  updateVisit: () => {},
  deleteVisit: () => {},
  vaccinations: [],
  addVaccination: () => {},
  updateVaccination: () => {},
  deleteVaccination: () => {},
  prescriptions: [],
  addPrescription: () => {},
  updatePrescription: () => {},
  deletePrescription: () => {},
  documents: [],
  addDocument: () => {},
  deleteDocument: () => {},
  billing: [],
  addBilling: () => {},
  updateBilling: () => {},
  deleteBilling: () => {},
  exportData: () => {},
  importData: () => false,
  refresh: async () => {},
};

/**
 * Supabase-backed app data. When `active` is false, returns inert empty API (no network).
 */
export function useCloudAppData(active: boolean, userId: string | null): CloudAppData {
  const client = useMemo(() => getSupabaseBrowserClient(), []);

  const [children, setChildren] = useState<Child[]>([]);
  const [visits, setVisits] = useState<HospitalVisit[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [billing, setBilling] = useState<BillingRecord[]>([]);
  const [selectedChildId, setSelectedChildIdState] = useState<string | null>(null);

  /** Fire-and-forget async op with consistent error toasting. */
  const runAsync = useCallback((fallbackError: string, op: () => Promise<void>): void => {
    void (async () => {
      try {
        await op();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : fallbackError);
      }
    })();
  }, []);

  useEffect(() => {
    if (!active || !userId) {
      setSelectedChildIdState(null);
      return;
    }
    try {
      const raw = localStorage.getItem(selectedChildStorageKey(userId));
      setSelectedChildIdState(raw && raw.length > 0 ? raw : null);
    } catch {
      setSelectedChildIdState(null);
    }
  }, [active, userId]);

  const setSelectedChildId = useCallback(
    (id: string | null) => {
      setSelectedChildIdState(id);
      if (active && userId) {
        try {
          if (id) localStorage.setItem(selectedChildStorageKey(userId), id);
          else localStorage.removeItem(selectedChildStorageKey(userId));
        } catch {
          /* ignore */
        }
      }
    },
    [active, userId],
  );

  const refresh = useCallback(async () => {
    if (!active || !userId || !client) return;
    try {
      const ch = await db.fetchChildrenForUser(client, userId);
      setChildren(ch);
      const ids = ch.map((c) => c.id);
      const [v, vx, rx, doc, bill] = await Promise.all([
        db.fetchVisitsForChildren(client, ids),
        db.fetchVaccinationsForChildren(client, ids),
        db.fetchPrescriptionsForChildren(client, ids),
        db.fetchDocumentsForChildren(client, ids),
        db.fetchBillingForChildren(client, ids),
      ]);
      setVisits(v);
      setVaccinations(vx);
      setPrescriptions(rx);
      setDocuments(doc);
      setBilling(bill);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load data');
    }
  }, [active, userId, client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!active) return;
    if (children.length === 0) {
      setSelectedChildId(null);
      return;
    }
    if (!selectedChildId || !children.some((c) => c.id === selectedChildId)) {
      setSelectedChildId(children[0].id);
    }
  }, [active, children, selectedChildId, setSelectedChildId]);

  const selectedChild = useMemo(() => {
    return children.find((c) => c.id === selectedChildId) || children[0] || null;
  }, [children, selectedChildId]);

  const addChild = useCallback(
    async (child: Child): Promise<boolean> => {
      if (!active || !userId || !client) return false;
      try {
        const row = await db.insertChild(client, userId, child);
        setChildren((p) => [...p, row]);
        setSelectedChildId(row.id);
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not add child');
        return false;
      }
    },
    [active, userId, client, setSelectedChildId],
  );

  const updateChild = useCallback(
    (child: Child) => {
      if (!active || !userId || !client) return;
      runAsync('Could not update child', async () => {
        const row = await db.updateChildRow(client, child);
        setChildren((p) => p.map((c) => (c.id === row.id ? row : c)));
      });
    },
    [active, userId, client, runAsync],
  );

  const deleteChild = useCallback(
    (id: string) => {
      if (!active || !client) return;
      runAsync('Could not delete child', async () => {
        await db.deleteChildRow(client, id);
        setChildren((p) => p.filter((c) => c.id !== id));
        setVisits((p) => p.filter((v) => v.childId !== id));
        setVaccinations((p) => p.filter((v) => v.childId !== id));
        setPrescriptions((p) => p.filter((r) => r.childId !== id));
        setDocuments((p) => p.filter((d) => d.childId !== id));
        setBilling((p) => p.filter((b) => b.childId !== id));
        setSelectedChildIdState((cur) => (cur === id ? null : cur));
      });
    },
    [active, client, runAsync],
  );

  const addVisit = useCallback(
    (visit: HospitalVisit) => {
      if (!active || !client) return;
      runAsync('Could not save visit', async () => {
        const row = await db.upsertVisit(client, visit);
        setVisits((p) => [...p.filter((x) => x.id !== row.id), row]);
      });
    },
    [active, client, runAsync],
  );

  const updateVisit = useCallback(
    (visit: HospitalVisit) => {
      if (!active || !client) return;
      runAsync('Could not update visit', async () => {
        const row = await db.upsertVisit(client, visit);
        setVisits((p) => p.map((v) => (v.id === row.id ? row : v)));
      });
    },
    [active, client, runAsync],
  );

  const deleteVisit = useCallback(
    (id: string) => {
      if (!active || !client) return;
      runAsync('Could not delete visit', async () => {
        await db.deleteVisitRow(client, id);
        setVisits((p) => p.filter((v) => v.id !== id));
      });
    },
    [active, client, runAsync],
  );

  const addVaccination = useCallback(
    (vax: Vaccination) => {
      if (!active || !userId || !client) return;
      runAsync('Could not save vaccination', async () => {
        const row = await db.upsertVaccination(client, userId, vax);
        setVaccinations((p) => [...p.filter((x) => x.id !== row.id), row]);
      });
    },
    [active, userId, client, runAsync],
  );

  const updateVaccination = useCallback(
    (vax: Vaccination) => {
      if (!active || !userId || !client) return;
      runAsync('Could not update vaccination', async () => {
        const row = await db.upsertVaccination(client, userId, vax);
        setVaccinations((p) => p.map((v) => (v.id === row.id ? row : v)));
      });
    },
    [active, userId, client, runAsync],
  );

  const deleteVaccination = useCallback(
    (id: string) => {
      if (!active || !client) return;
      runAsync('Could not delete vaccination', async () => {
        await db.deleteVaccinationRow(client, id);
        setVaccinations((p) => p.filter((v) => v.id !== id));
      });
    },
    [active, client, runAsync],
  );

  const addPrescription = useCallback(
    (rx: Prescription) => {
      if (!active || !userId || !client) return;
      runAsync('Could not save prescription', async () => {
        const row = await db.upsertPrescription(client, userId, rx);
        setPrescriptions((p) => [...p.filter((x) => x.id !== row.id), row]);
      });
    },
    [active, userId, client, runAsync],
  );

  const updatePrescription = useCallback(
    (rx: Prescription) => {
      if (!active || !userId || !client) return;
      runAsync('Could not update prescription', async () => {
        const row = await db.upsertPrescription(client, userId, rx);
        setPrescriptions((p) => p.map((x) => (x.id === row.id ? row : x)));
      });
    },
    [active, userId, client, runAsync],
  );

  const deletePrescription = useCallback(
    (id: string) => {
      if (!active || !client) return;
      runAsync('Could not delete prescription', async () => {
        await db.deletePrescriptionRow(client, id);
        setPrescriptions((p) => p.filter((x) => x.id !== id));
      });
    },
    [active, client, runAsync],
  );

  const addDocument = useCallback(
    (doc: Document) => {
      if (!active || !userId || !client) return;
      if (!doc.fileData.startsWith('data:')) {
        toast.error('File must be uploaded from this device (cloud mode).');
        return;
      }
      runAsync('Could not upload document', async () => {
        const row = await db.insertDocument(client, userId, doc, doc.fileData, doc.fileType);
        setDocuments((p) => [...p, row]);
      });
    },
    [active, userId, client, runAsync],
  );

  const deleteDocument = useCallback(
    (id: string) => {
      if (!active || !client) return;
      runAsync('Could not delete document', async () => {
        await db.deleteDocumentRow(client, id);
        setDocuments((p) => p.filter((d) => d.id !== id));
      });
    },
    [active, client, runAsync],
  );

  const addBilling = useCallback(
    (bill: BillingRecord) => {
      if (!active || !userId || !client) return;
      runAsync('Could not save bill', async () => {
        const row = await db.upsertBilling(client, userId, bill);
        setBilling((p) => [...p.filter((x) => x.id !== row.id), row]);
      });
    },
    [active, userId, client, runAsync],
  );

  const updateBilling = useCallback(
    (bill: BillingRecord) => {
      if (!active || !userId || !client) return;
      runAsync('Could not update bill', async () => {
        const row = await db.upsertBilling(client, userId, bill);
        setBilling((p) => p.map((b) => (b.id === row.id ? row : b)));
      });
    },
    [active, userId, client, runAsync],
  );

  const deleteBilling = useCallback(
    (id: string) => {
      if (!active || !client) return;
      runAsync('Could not delete bill', async () => {
        await db.deleteBillingRow(client, id);
        setBilling((p) => p.filter((b) => b.id !== id));
      });
    },
    [active, client, runAsync],
  );

  const exportData = useCallback(() => {
    const data = { children, visits, vaccinations, prescriptions, documents, billing };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `babybloom-cloud-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [children, visits, vaccinations, prescriptions, documents, billing]);

  const importData = useCallback((_json: string) => {
    toast.message('JSON import is only available in local (offline) mode.');
    return false;
  }, []);

  if (!active || !userId || !client) {
    return empty;
  }

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
    refresh,
  };
}
