/**
 * BabyBloomCare
 * Copyright (c) 2026 Kaushal Kothari. All rights reserved.
 * Unauthorized copying, modification or distribution
 * of this software is strictly prohibited.
 */

import type {
  Child,
  HospitalVisit,
  Vaccination,
  Prescription,
  Medicine,
  Document,
  BillingRecord,
} from '@/types';
import type { Database } from './database.types';
import {
  decryptChildRow,
  decryptVisitRow,
  decryptVaccinationRow,
  decryptPrescriptionRow,
  decryptPrescriptionMedicineRow,
  decryptDocumentRow,
  decryptBillingRow,
} from '@/lib/security/fieldEncryption';

type ChildRow = Database['public']['Tables']['children']['Row'];
type VisitRow = Database['public']['Tables']['hospital_visits']['Row'];
type VaxRow = Database['public']['Tables']['vaccinations']['Row'];
type RxRow = Database['public']['Tables']['prescriptions']['Row'];
type RxMedRow = Database['public']['Tables']['prescription_medicines']['Row'];
type DocRow = Database['public']['Tables']['documents']['Row'];
type BillRow = Database['public']['Tables']['billing_records']['Row'];

export function mapChildRow(r: ChildRow, userId?: string): Child {
  const d = userId ? decryptChildRow(r as Record<string, unknown>, userId) as unknown as ChildRow : r;
  return {
    id: d.id,
    name: d.name,
    dateOfBirth: d.date_of_birth,
    gender: d.gender,
    bloodGroup: d.blood_group ?? undefined,
    avatarId: d.avatar_id ?? undefined,
    photo: d.photo_url ?? undefined,
    notes: d.notes ?? undefined,
    createdAt: d.created_at,
  };
}

export function mapVisitRow(r: VisitRow, userId?: string): HospitalVisit {
  const d = userId ? decryptVisitRow(r as Record<string, unknown>, userId) as unknown as VisitRow : r;
  return {
    id: d.id,
    childId: d.child_id,
    date: d.visit_date,
    hospitalName: d.hospital_name,
    doctorName: d.doctor_name,
    reason: d.reason,
    description: d.description,
    linkedVisitId: d.linked_visit_id ?? undefined,
    weight: d.weight_kg ?? undefined,
    height: d.height_cm ?? undefined,
    headCircumference: d.head_circumference_cm ?? undefined,
    temperature: d.temperature_f ?? undefined,
    notes: d.notes ?? undefined,
    createdAt: d.created_at,
  };
}

export function mapVaxRow(r: VaxRow, signedCardUrl?: string, userId?: string): Vaccination {
  const d = userId ? decryptVaccinationRow(r as Record<string, unknown>, userId) as unknown as VaxRow : r;
  return {
    id: d.id,
    childId: d.child_id,
    vaccineName: d.vaccine_name,
    dueDate: d.due_date,
    completedDate: d.completed_date ?? undefined,
    batchNumber: d.batch_number ?? undefined,
    expiryDate: d.expiry_date ?? undefined,
    administeredBy: d.administered_by ?? undefined,
    location: d.location ?? undefined,
    locationCity: d.location_city ?? undefined,
    locationState: d.location_state ?? undefined,
    administrationSite: d.administration_site ?? undefined,
    vaccineManufacturer: d.vaccine_manufacturer ?? undefined,
    manufacturingDate: d.manufacturing_date ?? undefined,
    notes: d.notes ?? undefined,
    cardPhoto: signedCardUrl ?? undefined,
    createdAt: d.created_at,
  };
}

export function mapRxRow(r: RxRow, medicines: Medicine[], signedImageUrl?: string, userId?: string): Prescription {
  const d = userId ? decryptPrescriptionRow(r as Record<string, unknown>, userId) as unknown as RxRow : r;
  return {
    id: d.id,
    childId: d.child_id,
    visitId: d.visit_id ?? undefined,
    medicineName: d.medicine_name ?? undefined,
    dosage: d.dosage ?? undefined,
    frequency: d.frequency ?? undefined,
    duration: d.duration ?? undefined,
    medicines: medicines.length ? medicines : undefined,
    prescribingDoctor: d.prescribing_doctor,
    date: d.prescription_date,
    active: d.active,
    notes: d.notes ?? undefined,
    prescriptionImage: signedImageUrl ?? undefined,
    createdAt: d.created_at,
  };
}

export function mapRxMedRow(r: RxMedRow, userId?: string): Medicine {
  const d = userId ? decryptPrescriptionMedicineRow(r as Record<string, unknown>, userId) as unknown as RxMedRow : r;
  return {
    id: d.id,
    name: d.name,
    dosage: d.dosage,
    frequency: d.frequency,
    duration: d.duration,
  };
}

export function mapDocRow(r: DocRow, signedFileUrl: string, userId?: string): Document {
  const d = userId ? decryptDocumentRow(r as Record<string, unknown>, userId) as unknown as DocRow : r;
  return {
    id: d.id,
    childId: d.child_id,
    visitId: d.visit_id ?? undefined,
    name: d.name,
    type: d.document_type as Document['type'],
    fileData: signedFileUrl,
    fileType: d.file_type,
    date: d.document_date,
    notes: d.notes ?? undefined,
    createdAt: d.created_at,
  };
}

export function mapBillRow(r: BillRow, signedReceiptUrl?: string, userId?: string): BillingRecord {
  const d = userId ? decryptBillingRow(r as Record<string, unknown>, userId) as unknown as BillRow : r;
  return {
    id: d.id,
    childId: d.child_id,
    visitId: d.visit_id ?? undefined,
    date: d.bill_date,
    amount: Number(d.amount),
    hospitalName: d.hospital_name,
    description: d.description,
    receiptImage: signedReceiptUrl ?? undefined,
    createdAt: d.created_at,
  };
}
