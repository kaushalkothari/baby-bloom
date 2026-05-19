/**
 * BabyBloomCare
 * Copyright (c) 2026 Kaushal Kothari. All rights reserved.
 * Unauthorized copying, modification or distribution
 * of this software is strictly prohibited.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Child, HospitalVisit, Vaccination, Prescription, Document, BillingRecord } from '@/types';
import { getSupabaseBrowserClient } from './client';
import * as db from './data-access';
import { ThinApiClient } from '@/lib/api/client';
import { isThinApiEnabled } from '@/lib/api/flags';
import { MAX_DOCUMENT_BYTES_REMOTE, validateClientDataUrl } from '@/lib/security/uploads';
import { writeAuditLog } from '@/lib/audit/auditLogger';

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
export function useCloudAppData(
  active: boolean,
  userId: string | null,
  accessToken: string | null,
): CloudAppData {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const useThinApi = isThinApiEnabled();
  const api = useMemo(() => new ThinApiClient('/api', () => accessToken), [accessToken]);

  const [children, setChildren] = useState<Child[]>([]);
  const [visits, setVisits] = useState<HospitalVisit[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [billing, setBilling] = useState<BillingRecord[]>([]);
  const [selectedChildId, setSelectedChildIdState] = useState<string | null>(null);
  const thinApiHealthCheckedRef = useRef(false);

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

  /** Awaitable async op with consistent error toasting (rethrows). */
  const runAsyncAwait = useCallback(async (fallbackError: string, op: () => Promise<void>): Promise<void> => {
    try {
      await op();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : fallbackError);
      throw e;
    }
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

  useEffect(() => {
    if (!useThinApi || !active || thinApiHealthCheckedRef.current) return;
    thinApiHealthCheckedRef.current = true;
    void (async () => {
      try {
        const res = await fetch('/api/health');
        const payload = await res.json();
        const configured = Boolean(payload?.ok && payload?.data?.supabaseConfigured);
        if (!configured) {
          toast.error('Thin API is enabled but server Supabase env is missing.');
        }
      } catch {
        toast.error('Thin API health check failed. Verify /api deployment.');
      }
    })();
  }, [useThinApi, active, thinApiHealthCheckedRef]);

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
      const ch = useThinApi ? await api.listChildren() : await db.fetchChildrenForUser(client, userId);
      setChildren(ch);
      const ids = ch.map((c) => c.id);
      const [v, vx, rx, doc, bill] = await Promise.all([
        useThinApi
          ? api.listVisits()
          : db.fetchVisitsForChildren(client, ids, userId),
        useThinApi
          ? api.listVaccinations()
          : db.fetchVaccinationsForChildren(client, ids, userId),
        useThinApi
          ? api.listPrescriptions()
          : db.fetchPrescriptionsForChildren(client, ids, userId),
        useThinApi
          ? api.listDocuments()
          : db.fetchDocumentsForChildren(client, ids, userId),
        useThinApi
          ? api.listBilling()
          : db.fetchBillingForChildren(client, ids, userId),
      ]);
      setVisits(v);
      setVaccinations(vx);
      setPrescriptions(rx);
      setDocuments(doc);
      setBilling(bill);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load data');
    }
  }, [active, userId, client, useThinApi, api]);

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
        const row = useThinApi ? await api.createChild(child) : await db.insertChild(client, userId, child);
        if (useThinApi) {
          void writeAuditLog(client, userId, {
            action: 'create',
            entityType: 'child',
            entityId: row.id,
            metadata: { name: row.name, gender: row.gender },
          });
        }
        setChildren((p) => [...p, row]);
        setSelectedChildId(row.id);
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not add child');
        return false;
      }
    },
    [active, userId, client, setSelectedChildId, useThinApi, api],
  );

  const updateChild = useCallback(
    (child: Child) => {
      if (!active || !userId || !client) return;
      runAsync('Could not update child', async () => {
        const row = useThinApi ? await api.updateChild(child) : await db.updateChildRow(client, child, userId);
        if (useThinApi) {
          void writeAuditLog(client, userId, {
            action: 'update',
            entityType: 'child',
            entityId: child.id,
            metadata: { name: row.name },
          });
        }
        setChildren((p) => p.map((c) => (c.id === row.id ? row : c)));
      });
    },
    [active, userId, client, runAsync, useThinApi, api],
  );

  const deleteChild = useCallback(
    (id: string) => {
      if (!active || !client) return;
      runAsync('Could not delete child', async () => {
        if (useThinApi) {
          await api.deleteChild(id);
          if (userId) {
            void writeAuditLog(client, userId, { action: 'delete', entityType: 'child', entityId: id });
          }
        } else await db.deleteChildRow(client, id, userId ?? undefined);
        setChildren((p) => p.filter((c) => c.id !== id));
        setVisits((p) => p.filter((v) => v.childId !== id));
        setVaccinations((p) => p.filter((v) => v.childId !== id));
        setPrescriptions((p) => p.filter((r) => r.childId !== id));
        setDocuments((p) => p.filter((d) => d.childId !== id));
        setBilling((p) => p.filter((b) => b.childId !== id));
        setSelectedChildIdState((cur) => (cur === id ? null : cur));
      });
    },
    [active, client, runAsync, useThinApi, api, userId],
  );

  const addVisit = useCallback(
    (visit: HospitalVisit) => {
      if (!active || !client) return;
      return runAsyncAwait('Could not save visit', async () => {
        const isNew = !visits.some((v) => v.id === visit.id);
        const row = useThinApi ? await api.upsertVisit(visit) : await db.upsertVisit(client, visit, userId ?? undefined);
        if (useThinApi && userId) {
          void writeAuditLog(client, userId, {
            action: isNew ? 'create' : 'update',
            entityType: 'hospital_visit',
            entityId: row.id,
            metadata: { hospitalName: row.hospitalName, reason: row.reason, childId: row.childId },
          });
        }
        setVisits((p) => [...p.filter((x) => x.id !== row.id), row]);
      });
    },
    [active, client, runAsyncAwait, useThinApi, api, userId, visits],
  );

  const updateVisit = useCallback(
    (visit: HospitalVisit) => {
      if (!active || !client) return;
      return runAsyncAwait('Could not update visit', async () => {
        const isNew = !visits.some((v) => v.id === visit.id);
        const row = useThinApi ? await api.upsertVisit(visit) : await db.upsertVisit(client, visit, userId ?? undefined);
        if (useThinApi && userId) {
          void writeAuditLog(client, userId, {
            action: isNew ? 'create' : 'update',
            entityType: 'hospital_visit',
            entityId: row.id,
            metadata: { hospitalName: row.hospitalName, reason: row.reason, childId: row.childId },
          });
        }
        setVisits((p) => p.map((v) => (v.id === row.id ? row : v)));
      });
    },
    [active, client, runAsyncAwait, useThinApi, api, userId, visits],
  );

  const deleteVisit = useCallback(
    (id: string) => {
      if (!active || !client) return;
      runAsync('Could not delete visit', async () => {
        if (useThinApi) {
          await api.deleteVisit(id);
          if (userId) {
            void writeAuditLog(client, userId, { action: 'delete', entityType: 'hospital_visit', entityId: id });
          }
        } else await db.deleteVisitRow(client, id, userId ?? undefined);
        setVisits((p) => p.filter((v) => v.id !== id));
      });
    },
    [active, client, runAsync, useThinApi, api, userId],
  );

  const addVaccination = useCallback(
    (vax: Vaccination) => {
      if (!active || !userId || !client) return;
      runAsync('Could not save vaccination', async () => {
        const isNew = !vaccinations.some((v) => v.id === vax.id);
        const row = useThinApi
          ? await api.upsertVaccination(vax)
          : await db.upsertVaccination(client, userId, vax);
        if (useThinApi) {
          void writeAuditLog(client, userId, {
            action: isNew ? 'create' : 'update',
            entityType: 'vaccination',
            entityId: row.id,
            metadata: { vaccineName: row.vaccineName, childId: row.childId },
          });
        }
        setVaccinations((p) => [...p.filter((x) => x.id !== row.id), row]);
      });
    },
    [active, userId, client, runAsync, useThinApi, api, vaccinations],
  );

  const updateVaccination = useCallback(
    (vax: Vaccination) => {
      if (!active || !userId || !client) return;
      runAsync('Could not update vaccination', async () => {
        const isNew = !vaccinations.some((v) => v.id === vax.id);
        const row = useThinApi
          ? await api.upsertVaccination(vax)
          : await db.upsertVaccination(client, userId, vax);
        if (useThinApi) {
          void writeAuditLog(client, userId, {
            action: isNew ? 'create' : 'update',
            entityType: 'vaccination',
            entityId: row.id,
            metadata: { vaccineName: row.vaccineName, childId: row.childId },
          });
        }
        setVaccinations((p) => p.map((v) => (v.id === row.id ? row : v)));
      });
    },
    [active, userId, client, runAsync, useThinApi, api, vaccinations],
  );

  const deleteVaccination = useCallback(
    (id: string) => {
      if (!active || !client) return;
      runAsync('Could not delete vaccination', async () => {
        if (useThinApi) {
          await api.deleteVaccination(id);
          if (userId) {
            void writeAuditLog(client, userId, { action: 'delete', entityType: 'vaccination', entityId: id });
          }
        } else await db.deleteVaccinationRow(client, id, userId ?? undefined);
        setVaccinations((p) => p.filter((v) => v.id !== id));
      });
    },
    [active, client, runAsync, useThinApi, api, userId],
  );

  const addPrescription = useCallback(
    (rx: Prescription) => {
      if (!active || !userId || !client) return;
      runAsync('Could not save prescription', async () => {
        const isNew = !prescriptions.some((p) => p.id === rx.id);
        const row = useThinApi
          ? await api.upsertPrescription(rx)
          : await db.upsertPrescription(client, userId, rx);
        if (useThinApi) {
          void writeAuditLog(client, userId, {
            action: isNew ? 'create' : 'update',
            entityType: 'prescription',
            entityId: row.id,
            metadata: {
              prescribingDoctor: row.prescribingDoctor,
              childId: row.childId,
              medicineCount: row.medicines?.length ?? 0,
            },
          });
        }
        setPrescriptions((p) => [...p.filter((x) => x.id !== row.id), row]);
      });
    },
    [active, userId, client, runAsync, useThinApi, api, prescriptions],
  );

  const updatePrescription = useCallback(
    (rx: Prescription) => {
      if (!active || !userId || !client) return;
      runAsync('Could not update prescription', async () => {
        const isNew = !prescriptions.some((p) => p.id === rx.id);
        const row = useThinApi
          ? await api.upsertPrescription(rx)
          : await db.upsertPrescription(client, userId, rx);
        if (useThinApi) {
          void writeAuditLog(client, userId, {
            action: isNew ? 'create' : 'update',
            entityType: 'prescription',
            entityId: row.id,
            metadata: {
              prescribingDoctor: row.prescribingDoctor,
              childId: row.childId,
              medicineCount: row.medicines?.length ?? 0,
            },
          });
        }
        setPrescriptions((p) => p.map((x) => (x.id === row.id ? row : x)));
      });
    },
    [active, userId, client, runAsync, useThinApi, api, prescriptions],
  );

  const deletePrescription = useCallback(
    (id: string) => {
      if (!active || !client) return;
      runAsync('Could not delete prescription', async () => {
        if (useThinApi) {
          await api.deletePrescription(id);
          if (userId) {
            void writeAuditLog(client, userId, { action: 'delete', entityType: 'prescription', entityId: id });
          }
        } else await db.deletePrescriptionRow(client, id, userId ?? undefined);
        setPrescriptions((p) => p.filter((x) => x.id !== id));
      });
    },
    [active, client, runAsync, useThinApi, api, userId],
  );

  const addDocument = useCallback(
    (doc: Document) => {
      if (!active || !userId || !client) return;
      if (!doc.fileData.startsWith('data:')) {
        toast.error('File must be uploaded from this device (cloud mode).');
        return;
      }
      const docErr = validateClientDataUrl(doc.fileData, MAX_DOCUMENT_BYTES_REMOTE, { allowPdf: true });
      if (docErr) {
        toast.error(docErr);
        return;
      }
      runAsync('Could not upload document', async () => {
        const row = useThinApi
          ? await api.createDocument({ document: doc, dataUrl: doc.fileData, fileType: doc.fileType })
          : await db.insertDocument(client, userId, doc, doc.fileData, doc.fileType);
        if (useThinApi) {
          void writeAuditLog(client, userId, {
            action: 'create',
            entityType: 'document',
            entityId: row.id,
            metadata: { name: row.name, documentType: row.type, childId: row.childId },
          });
        }
        setDocuments((p) => [...p, row]);
      });
    },
    [active, userId, client, runAsync, useThinApi, api],
  );

  const deleteDocument = useCallback(
    (id: string) => {
      if (!active || !client) return;
      runAsync('Could not delete document', async () => {
        if (useThinApi) {
          await api.deleteDocument(id);
          if (userId) {
            void writeAuditLog(client, userId, { action: 'delete', entityType: 'document', entityId: id });
          }
        } else await db.deleteDocumentRow(client, id, userId ?? undefined);
        setDocuments((p) => p.filter((d) => d.id !== id));
      });
    },
    [active, client, runAsync, useThinApi, api, userId],
  );

  const addBilling = useCallback(
    (bill: BillingRecord) => {
      if (!active || !userId || !client) return;
      runAsync('Could not save bill', async () => {
        const isNew = !billing.some((b) => b.id === bill.id);
        const row = useThinApi ? await api.upsertBilling(bill) : await db.upsertBilling(client, userId, bill);
        if (useThinApi) {
          void writeAuditLog(client, userId, {
            action: isNew ? 'create' : 'update',
            entityType: 'billing_record',
            entityId: row.id,
            metadata: { hospitalName: row.hospitalName, amount: row.amount, childId: row.childId },
          });
        }
        setBilling((p) => [...p.filter((x) => x.id !== row.id), row]);
      });
    },
    [active, userId, client, runAsync, useThinApi, api, billing],
  );

  const updateBilling = useCallback(
    (bill: BillingRecord) => {
      if (!active || !userId || !client) return;
      runAsync('Could not update bill', async () => {
        const isNew = !billing.some((b) => b.id === bill.id);
        const row = useThinApi ? await api.upsertBilling(bill) : await db.upsertBilling(client, userId, bill);
        if (useThinApi) {
          void writeAuditLog(client, userId, {
            action: isNew ? 'create' : 'update',
            entityType: 'billing_record',
            entityId: row.id,
            metadata: { hospitalName: row.hospitalName, amount: row.amount, childId: row.childId },
          });
        }
        setBilling((p) => p.map((b) => (b.id === row.id ? row : b)));
      });
    },
    [active, userId, client, runAsync, useThinApi, api, billing],
  );

  const deleteBilling = useCallback(
    (id: string) => {
      if (!active || !client) return;
      runAsync('Could not delete bill', async () => {
        if (useThinApi) {
          await api.deleteBilling(id);
          if (userId) {
            void writeAuditLog(client, userId, { action: 'delete', entityType: 'billing_record', entityId: id });
          }
        } else await db.deleteBillingRow(client, id, userId ?? undefined);
        setBilling((p) => p.filter((b) => b.id !== id));
      });
    },
    [active, client, runAsync, useThinApi, api, userId],
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
    if (client && userId) {
      void writeAuditLog(client, userId, {
        action: 'export_data',
        metadata: {
          childrenCount: children.length,
          visitsCount: visits.length,
          vaccinationsCount: vaccinations.length,
          prescriptionsCount: prescriptions.length,
          documentsCount: documents.length,
          billingCount: billing.length,
        },
      });
    }
  }, [children, visits, vaccinations, prescriptions, documents, billing, client, userId]);

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
