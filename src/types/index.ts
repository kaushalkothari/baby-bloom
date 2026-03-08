export interface Child {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  bloodGroup?: string;
  photo?: string;
  notes?: string;
  createdAt: string;
}

export interface HospitalVisit {
  id: string;
  childId: string;
  date: string;
  hospitalName: string;
  doctorName: string;
  reason: string;
  description: string;
  weight?: number;
  height?: number;
  headCircumference?: number;
  temperature?: number;
  notes?: string;
  createdAt: string;
}

export interface Vaccination {
  id: string;
  childId: string;
  vaccineName: string;
  dueDate: string;
  completedDate?: string;
  batchNumber?: string;
  administeredBy?: string;
  location?: string;
  notes?: string;
  cardPhoto?: string; // base64 image of vaccine card
  createdAt: string;
}

export interface Prescription {
  id: string;
  childId: string;
  visitId?: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  prescribingDoctor: string;
  date: string;
  active: boolean;
  notes?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  childId: string;
  visitId?: string;
  name: string;
  type: 'receipt' | 'lab_report' | 'discharge_summary' | 'prescription' | 'vaccination_card' | 'other';
  fileData: string; // base64
  fileType: string;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface BillingRecord {
  id: string;
  childId: string;
  visitId?: string;
  date: string;
  amount: number;
  hospitalName: string;
  description: string;
  receiptImage?: string; // base64
  createdAt: string;
}

export type VaccinationStatus = 'completed' | 'upcoming' | 'overdue';

export interface VaccineScheduleItem {
  name: string;
  ageInWeeks: number;
  description: string;
}
