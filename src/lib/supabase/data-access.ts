import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import type { Child, HospitalVisit, Vaccination, Prescription, Medicine, Document, BillingRecord } from '@/types';
import {
  mapChildRow,
  mapVisitRow,
  mapVaxRow,
  mapRxRow,
  mapRxMedRow,
  mapDocRow,
  mapBillRow,
} from './mappers';
import { getSignedUrl, uploadDataUrl, mimeFromDataUrl, extForMime } from './storage';

type Client = SupabaseClient<Database>;
type PrescriptionMedicineRow = Database['public']['Tables']['prescription_medicines']['Row'];

function embeddedPrescriptionMedicines(
  embedded: PrescriptionMedicineRow | PrescriptionMedicineRow[] | null | undefined,
): PrescriptionMedicineRow[] {
  if (embedded == null) return [];
  return Array.isArray(embedded) ? embedded : [embedded];
}

/** Only http(s) URLs are stored on the child row; data URLs are uploaded separately. */
function httpPhotoUrlForDb(photo: string | undefined): string | null {
  if (!photo?.startsWith('http://') && !photo?.startsWith('https://')) return null;
  return photo;
}

/** Signed URL when path exists and signing succeeds; otherwise undefined (callers map without URL). */
async function tryGetSignedUrl(
  client: Client,
  storagePath: string | null | undefined,
): Promise<string | undefined> {
  if (storagePath == null || storagePath === '') return undefined;
  try {
    return await getSignedUrl(client, storagePath);
  } catch {
    return undefined;
  }
}

export async function fetchChildrenForUser(client: Client, userId: string): Promise<Child[]> {
  const { data, error } = await client
    .from('children')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapChildRow);
}

export async function fetchVisitsForChildren(client: Client, childIds: string[]): Promise<HospitalVisit[]> {
  if (childIds.length === 0) return [];
  const { data, error } = await client
    .from('hospital_visits')
    .select('*')
    .in('child_id', childIds)
    .order('visit_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapVisitRow);
}

export async function fetchVaccinationsForChildren(client: Client, childIds: string[]): Promise<Vaccination[]> {
  if (childIds.length === 0) return [];
  const { data, error } = await client
    .from('vaccinations')
    .select('*')
    .in('child_id', childIds)
    .order('due_date', { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  return Promise.all(
    rows.map(async (r) => {
      const url = await tryGetSignedUrl(client, r.card_photo_storage_path);
      return mapVaxRow(r, url);
    }),
  );
}

export async function fetchPrescriptionsForChildren(client: Client, childIds: string[]): Promise<Prescription[]> {
  if (childIds.length === 0) return [];
  const { data, error } = await client
    .from('prescriptions')
    .select('*, prescription_medicines(*)')
    .in('child_id', childIds)
    .order('prescription_date', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  return Promise.all(
    rows.map(async (r) => {
      const meds = embeddedPrescriptionMedicines(r.prescription_medicines)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(mapRxMedRow);
      const img = await tryGetSignedUrl(client, r.prescription_image_storage_path);
      const { prescription_medicines: _, ...row } = r;
      return mapRxRow(row as Database['public']['Tables']['prescriptions']['Row'], meds, img);
    }),
  );
}

export async function fetchDocumentsForChildren(client: Client, childIds: string[]): Promise<Document[]> {
  if (childIds.length === 0) return [];
  const { data, error } = await client
    .from('documents')
    .select('*')
    .in('child_id', childIds)
    .order('document_date', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  return Promise.all(
    rows.map(async (r) => {
      const url = await getSignedUrl(client, r.storage_path);
      return mapDocRow(r, url);
    }),
  );
}

export async function fetchBillingForChildren(client: Client, childIds: string[]): Promise<BillingRecord[]> {
  if (childIds.length === 0) return [];
  const { data, error } = await client
    .from('billing_records')
    .select('*')
    .in('child_id', childIds)
    .order('bill_date', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  return Promise.all(
    rows.map(async (r) => {
      const url = await tryGetSignedUrl(client, r.receipt_image_storage_path);
      return mapBillRow(r, url);
    }),
  );
}

export async function insertChild(
  client: Client,
  userId: string,
  child: Omit<Child, 'createdAt'> & { createdAt?: string },
): Promise<Child> {
  const photoUrl = httpPhotoUrlForDb(child.photo);
  const row = {
    id: child.id,
    user_id: userId,
    name: child.name,
    date_of_birth: child.dateOfBirth,
    gender: child.gender,
    blood_group: child.bloodGroup ?? null,
    photo_url: photoUrl,
    notes: child.notes ?? null,
    created_at: child.createdAt ?? new Date().toISOString(),
  };
  const { data, error } = await client.from('children').insert(row).select('*').single();
  if (error) throw error;
  return mapChildRow(data);
}

export async function updateChildRow(client: Client, child: Child): Promise<Child> {
  const photoUrl = httpPhotoUrlForDb(child.photo);
  const { data, error } = await client
    .from('children')
    .update({
      name: child.name,
      date_of_birth: child.dateOfBirth,
      gender: child.gender,
      blood_group: child.bloodGroup ?? null,
      photo_url: photoUrl,
      notes: child.notes ?? null,
    })
    .eq('id', child.id)
    .select('*')
    .single();
  if (error) throw error;
  return mapChildRow(data);
}

export async function deleteChildRow(client: Client, id: string): Promise<void> {
  const { error } = await client.from('children').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertVisit(client: Client, v: HospitalVisit): Promise<HospitalVisit> {
  const row = {
    id: v.id,
    child_id: v.childId,
    visit_date: v.date,
    hospital_name: v.hospitalName,
    doctor_name: v.doctorName,
    reason: v.reason,
    description: v.description,
    weight_kg: v.weight ?? null,
    height_cm: v.height ?? null,
    head_circumference_cm: v.headCircumference ?? null,
    temperature_f: v.temperature ?? null,
    notes: v.notes ?? null,
    created_at: v.createdAt,
  };
  const { data, error } = await client.from('hospital_visits').upsert(row, { onConflict: 'id' }).select('*').single();
  if (error) throw error;
  return mapVisitRow(data);
}

export async function deleteVisitRow(client: Client, id: string): Promise<void> {
  const { error } = await client.from('hospital_visits').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertVaccination(client: Client, userId: string, v: Vaccination): Promise<Vaccination> {
  const { data: prev } = await client
    .from('vaccinations')
    .select('card_photo_storage_path')
    .eq('id', v.id)
    .maybeSingle();
  let cardPath = prev?.card_photo_storage_path ?? null;
  if (v.cardPhoto?.startsWith('data:')) {
    const mime = mimeFromDataUrl(v.cardPhoto, 'image/jpeg');
    const up = await uploadDataUrl(client, userId, v.childId, 'vaccinations', `card${extForMime(mime) || '.jpg'}`, v.cardPhoto, mime);
    cardPath = up.path;
  } else if (!v.cardPhoto) {
    cardPath = null;
  }

  const row = {
    id: v.id,
    child_id: v.childId,
    vaccine_name: v.vaccineName,
    due_date: v.dueDate,
    completed_date: v.completedDate ?? null,
    batch_number: v.batchNumber ?? null,
    expiry_date: v.expiryDate ?? null,
    administered_by: v.administeredBy ?? null,
    location: v.location ?? null,
    administration_site: v.administrationSite ?? null,
    vaccine_manufacturer: v.vaccineManufacturer ?? null,
    manufacturing_date: v.manufacturingDate ?? null,
    notes: v.notes ?? null,
    card_photo_storage_path: cardPath,
    created_at: v.createdAt,
  };

  const { data, error } = await client.from('vaccinations').upsert(row, { onConflict: 'id' }).select('*').single();
  if (error) throw error;
  if (data.card_photo_storage_path) {
    const url = await getSignedUrl(client, data.card_photo_storage_path);
    return mapVaxRow(data, url);
  }
  return mapVaxRow(data);
}

export async function deleteVaccinationRow(client: Client, id: string): Promise<void> {
  const { error } = await client.from('vaccinations').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertPrescription(client: Client, userId: string, p: Prescription): Promise<Prescription> {
  const { data: prev } = await client
    .from('prescriptions')
    .select('id, prescription_image_storage_path')
    .eq('id', p.id)
    .maybeSingle();
  let imagePath = prev?.prescription_image_storage_path ?? null;
  if (p.prescriptionImage?.startsWith('data:')) {
    const mime = mimeFromDataUrl(p.prescriptionImage, 'image/jpeg');
    const up = await uploadDataUrl(
      client,
      userId,
      p.childId,
      'prescriptions',
      `rx${extForMime(mime) || '.jpg'}`,
      p.prescriptionImage,
      mime,
    );
    imagePath = up.path;
  } else if (!p.prescriptionImage) {
    imagePath = null;
  }

  const row = {
    id: p.id,
    child_id: p.childId,
    visit_id: p.visitId ?? null,
    medicine_name: p.medicineName ?? null,
    dosage: p.dosage ?? null,
    frequency: p.frequency ?? null,
    duration: p.duration ?? null,
    prescribing_doctor: p.prescribingDoctor,
    prescription_date: p.date,
    active: p.active,
    notes: p.notes ?? null,
    prescription_image_storage_path: imagePath,
    created_at: p.createdAt,
  };

  if (prev) {
    const { data, error } = await client.from('prescriptions').update(row).eq('id', p.id).select('*').single();
    if (error) throw error;
    if (!data) throw new Error('Prescription update returned no row');
    await client.from('prescription_medicines').delete().eq('prescription_id', p.id);
    await insertMedicines(client, p.id, p);
    return loadPrescriptionById(client, data.id);
  }

  const { data, error } = await client.from('prescriptions').insert(row).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('Prescription insert returned no row');
  await insertMedicines(client, p.id, p);
  return loadPrescriptionById(client, data.id);
}

async function insertMedicines(client: Client, prescriptionId: string, p: Prescription): Promise<void> {
  const meds = p.medicines?.filter((m) => m.name.trim()) ?? [];
  if (meds.length === 0) return;
  const rows = meds.map((m, i) => ({
    id: crypto.randomUUID(),
    prescription_id: prescriptionId,
    name: m.name,
    dosage: m.dosage,
    frequency: m.frequency,
    duration: m.duration,
    sort_order: i,
  }));
  const { error } = await client.from('prescription_medicines').insert(rows);
  if (error) throw error;
}

async function loadPrescriptionById(client: Client, id: string): Promise<Prescription> {
  const { data, error } = await client.from('prescriptions').select('*, prescription_medicines(*)').eq('id', id).single();
  if (error) throw error;
  if (!data) throw new Error('Prescription not found');
  const meds = embeddedPrescriptionMedicines(data.prescription_medicines)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(mapRxMedRow);
  const img = await tryGetSignedUrl(client, data.prescription_image_storage_path);
  const { prescription_medicines: _, ...row } = data;
  return mapRxRow(row as Database['public']['Tables']['prescriptions']['Row'], meds, img);
}

export async function deletePrescriptionRow(client: Client, id: string): Promise<void> {
  const { error } = await client.from('prescriptions').delete().eq('id', id);
  if (error) throw error;
}

export async function insertDocument(
  client: Client,
  userId: string,
  d: Document,
  dataUrl: string,
  fileType: string,
): Promise<Document> {
  const { path, size } = await uploadDataUrl(client, userId, d.childId, 'documents', d.name, dataUrl, fileType);
  const row = {
    id: d.id,
    child_id: d.childId,
    visit_id: d.visitId ?? null,
    name: d.name,
    document_type: d.type,
    storage_path: path,
    file_type: fileType,
    file_size_bytes: size,
    document_date: d.date,
    notes: d.notes ?? null,
    created_at: d.createdAt,
  };
  const { data, error } = await client.from('documents').insert(row).select('*').single();
  if (error) throw error;
  const url = await getSignedUrl(client, data.storage_path);
  return mapDocRow(data, url);
}

export async function deleteDocumentRow(client: Client, id: string): Promise<void> {
  const { error } = await client.from('documents').delete().eq('id', id);
  if (error) throw error;
}

type BillRow = Database['public']['Tables']['billing_records']['Row'];

async function mapBillRowWithSignedReceipt(client: Client, data: BillRow): Promise<BillingRecord> {
  if (!data.receipt_image_storage_path) return mapBillRow(data);
  const url = await getSignedUrl(client, data.receipt_image_storage_path);
  return mapBillRow(data, url);
}

export async function upsertBilling(client: Client, userId: string, b: BillingRecord): Promise<BillingRecord> {
  const { data: existing } = await client
    .from('billing_records')
    .select('id, receipt_image_storage_path')
    .eq('id', b.id)
    .maybeSingle();
  let receiptPath = existing?.receipt_image_storage_path ?? null;
  if (b.receiptImage?.startsWith('data:')) {
    const mime = mimeFromDataUrl(b.receiptImage, 'image/jpeg');
    const up = await uploadDataUrl(client, userId, b.childId, 'billing', `receipt${extForMime(mime) || '.jpg'}`, b.receiptImage, mime);
    receiptPath = up.path;
  } else if (!b.receiptImage) {
    receiptPath = null;
  }

  const row = {
    id: b.id,
    child_id: b.childId,
    visit_id: b.visitId ?? null,
    bill_date: b.date,
    amount: b.amount,
    hospital_name: b.hospitalName,
    description: b.description,
    receipt_image_storage_path: receiptPath,
    created_at: b.createdAt,
  };

  const query = existing
    ? client.from('billing_records').update(row).eq('id', b.id)
    : client.from('billing_records').insert(row);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return mapBillRowWithSignedReceipt(client, data);
}

export async function deleteBillingRow(client: Client, id: string): Promise<void> {
  const { error } = await client.from('billing_records').delete().eq('id', id);
  if (error) throw error;
}
