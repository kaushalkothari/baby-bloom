export interface Child {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  bloodGroup?: string;
  /** Preset avatar id (see `CHILD_AVATAR_OPTIONS`); shown in UI alongside optional photo URL. */
  avatarId?: string;
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
  expiryDate?: string;
  administeredBy?: string;
  /** Hospital or clinic where the dose was given */
  location?: string;
  /** City of the facility (optional) */
  locationCity?: string;
  /** State or region of the facility (optional) */
  locationState?: string;
  /** Actual injection/administration site used (may differ from schedule recommendation) */
  administrationSite?: string;
  vaccineManufacturer?: string;
  manufacturingDate?: string;
  notes?: string;
  cardPhoto?: string; // base64 image of vaccine card
  createdAt: string;
}

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  /** Optional structured fields (stored client-side; may be encoded in `duration`). */
  dosageMl?: number;
  dosageValue?: number;
  dosageUnit?: 'ml' | 'drops' | 'mg' | 'g' | 'tsp' | 'tbsp' | 'puffs' | 'tablets' | 'capsules' | 'units' | 'other';
  timesOfDay?: Array<'morning' | 'afternoon' | 'night'>;
  mealTiming?:
    | 'before_breakfast'
    | 'after_breakfast'
    | 'before_food'
    | 'after_food'
    | 'before_lunch'
    | 'after_lunch'
    | 'before_dinner'
    | 'after_dinner';
  route?: 'oral' | 'iv' | 'im' | 'sc' | 'inhalation' | 'topical' | 'other';
  durationValue?: number;
  durationUnit?: 'days' | 'weeks' | 'months' | 'years';
  instructions?: string;
}

export interface Prescription {
  id: string;
  childId: string;
  visitId?: string;
  // Legacy single-medicine fields (kept for backward compat)
  medicineName?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  // New: array of medicines
  medicines?: Medicine[];
  prescribingDoctor: string;
  date: string;
  active: boolean;
  /** New UI fields (stored in `notes` as text for backward compat). */
  chiefComplaint?: string;
  condition?: string;
  notes?: string;
  prescriptionImage?: string; // base64 image
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
  /** e.g. "0.5 mL", "2 drops" */
  dose?: string;
  /** e.g. "IM", "Oral", "ID", "SC" */
  route?: string;
  /** e.g. "Anterolateral thigh", "Left upper arm" */
  site?: string;
  remarks?: string;
  sideEffects?: string[];
}
