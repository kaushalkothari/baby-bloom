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

type ChildRow = Database['public']['Tables']['children']['Row'];
type VisitRow = Database['public']['Tables']['hospital_visits']['Row'];
type VaxRow = Database['public']['Tables']['vaccinations']['Row'];
type RxRow = Database['public']['Tables']['prescriptions']['Row'];
type RxMedRow = Database['public']['Tables']['prescription_medicines']['Row'];
type DocRow = Database['public']['Tables']['documents']['Row'];
type BillRow = Database['public']['Tables']['billing_records']['Row'];

export function mapChildRow(r: ChildRow): Child {
  return {
    id: r.id,
    name: r.name,
    dateOfBirth: r.date_of_birth,
    gender: r.gender as Child['gender'],
    bloodGroup: r.blood_group ?? undefined,
    photo: r.photo_url ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

export function mapVisitRow(r: VisitRow): HospitalVisit {
  return {
    id: r.id,
    childId: r.child_id,
    date: r.visit_date,
    hospitalName: r.hospital_name,
    doctorName: r.doctor_name,
    reason: r.reason,
    description: r.description,
    weight: r.weight_kg ?? undefined,
    height: r.height_cm ?? undefined,
    headCircumference: r.head_circumference_cm ?? undefined,
    temperature: r.temperature_f ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

export function mapVaxRow(r: VaxRow, signedCardUrl?: string): Vaccination {
  return {
    id: r.id,
    childId: r.child_id,
    vaccineName: r.vaccine_name,
    dueDate: r.due_date,
    completedDate: r.completed_date ?? undefined,
    batchNumber: r.batch_number ?? undefined,
    expiryDate: r.expiry_date ?? undefined,
    administeredBy: r.administered_by ?? undefined,
    location: r.location ?? undefined,
    notes: r.notes ?? undefined,
    cardPhoto: signedCardUrl ?? undefined,
    createdAt: r.created_at,
  };
}

export function mapRxRow(r: RxRow, medicines: Medicine[], signedImageUrl?: string): Prescription {
  return {
    id: r.id,
    childId: r.child_id,
    visitId: r.visit_id ?? undefined,
    medicineName: r.medicine_name ?? undefined,
    dosage: r.dosage ?? undefined,
    frequency: r.frequency ?? undefined,
    duration: r.duration ?? undefined,
    medicines: medicines.length ? medicines : undefined,
    prescribingDoctor: r.prescribing_doctor,
    date: r.prescription_date,
    active: r.active,
    notes: r.notes ?? undefined,
    prescriptionImage: signedImageUrl ?? undefined,
    createdAt: r.created_at,
  };
}

export function mapRxMedRow(r: RxMedRow): Medicine {
  return {
    id: r.id,
    name: r.name,
    dosage: r.dosage,
    frequency: r.frequency,
    duration: r.duration,
  };
}

export function mapDocRow(r: DocRow, signedFileUrl: string): Document {
  return {
    id: r.id,
    childId: r.child_id,
    visitId: r.visit_id ?? undefined,
    name: r.name,
    type: r.document_type as Document['type'],
    fileData: signedFileUrl,
    fileType: r.file_type,
    date: r.document_date,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

export function mapBillRow(r: BillRow, signedReceiptUrl?: string): BillingRecord {
  return {
    id: r.id,
    childId: r.child_id,
    visitId: r.visit_id ?? undefined,
    date: r.bill_date,
    amount: Number(r.amount),
    hospitalName: r.hospital_name,
    description: r.description,
    receiptImage: signedReceiptUrl ?? undefined,
    createdAt: r.created_at,
  };
}
