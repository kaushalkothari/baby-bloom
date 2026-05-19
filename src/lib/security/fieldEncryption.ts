/**
 * BabyBloomCare
 * Copyright (c) 2026 Kaushal Kothari. All rights reserved.
 * Unauthorized copying, modification or distribution
 * of this software is strictly prohibited.
 */

import CryptoJS from 'crypto-js';

const FIELD_PREFIX = 'bbfld:v1:';

let _cachedDerivedKey: string | null = null;
let _cachedKeyInputs: string | null = null;

function getAppEncryptionSecret(): string {
  const secret = import.meta.env.VITE_FIELD_ENCRYPTION_KEY?.trim();
  if (!secret) {
    console.warn(
      '[BabyBloom] VITE_FIELD_ENCRYPTION_KEY is not set. Field encryption is disabled — sensitive data will be stored in plaintext.',
    );
  }
  return secret ?? '';
}

/**
 * Derive a per-user encryption key from the app secret + userId via PBKDF2.
 * The result is cached for the lifetime of the session to avoid repeated derivation.
 */
function deriveUserKey(userId: string): string {
  const appSecret = getAppEncryptionSecret();
  if (!appSecret) return '';

  const cacheKey = `${appSecret}::${userId}`;
  if (_cachedDerivedKey && _cachedKeyInputs === cacheKey) return _cachedDerivedKey;

  const derived = CryptoJS.PBKDF2(appSecret, userId, {
    keySize: 256 / 32,
    iterations: 1000,
  }).toString();

  _cachedDerivedKey = derived;
  _cachedKeyInputs = cacheKey;
  return derived;
}

export function isFieldEncryptionEnabled(): boolean {
  return Boolean(getAppEncryptionSecret());
}

export function encryptField(value: string, userId: string): string {
  if (!value) return value;
  const key = deriveUserKey(userId);
  if (!key) return value;
  const ciphertext = CryptoJS.AES.encrypt(value, key).toString();
  return `${FIELD_PREFIX}${ciphertext}`;
}

export function decryptField(value: string, userId: string): string {
  if (!value || !value.startsWith(FIELD_PREFIX)) return value;
  const key = deriveUserKey(userId);
  if (!key) return value;
  const payload = value.slice(FIELD_PREFIX.length);
  try {
    const bytes = CryptoJS.AES.decrypt(payload, key);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return plaintext || value;
  } catch {
    return value;
  }
}

export function encryptOptionalField(value: string | null | undefined, userId: string): string | null {
  if (value == null || value === '') return value as string | null;
  return encryptField(value, userId);
}

export function decryptOptionalField(value: string | null | undefined, userId: string): string | undefined {
  if (value == null || value === '') return value as string | undefined;
  return decryptField(value, userId);
}

// ---------------------------------------------------------------------------
// Sensitive-field registries per table — used by encrypt/decrypt row helpers
// ---------------------------------------------------------------------------

const CHILDREN_SENSITIVE: readonly string[] = [
  'name', 'blood_group', 'notes',
] as const;

const VISITS_SENSITIVE: readonly string[] = [
  'hospital_name', 'doctor_name', 'reason', 'description', 'notes',
] as const;

const VACCINATIONS_SENSITIVE: readonly string[] = [
  'vaccine_name', 'batch_number', 'administered_by',
  'location', 'location_city', 'location_state',
  'administration_site', 'vaccine_manufacturer', 'notes',
] as const;

const PRESCRIPTIONS_SENSITIVE: readonly string[] = [
  'medicine_name', 'dosage', 'frequency', 'duration',
  'prescribing_doctor', 'notes',
] as const;

const PRESCRIPTION_MEDICINES_SENSITIVE: readonly string[] = [
  'name', 'dosage', 'frequency', 'duration',
] as const;

const DOCUMENTS_SENSITIVE: readonly string[] = [
  'name', 'notes',
] as const;

const BILLING_SENSITIVE: readonly string[] = [
  'hospital_name', 'description',
] as const;

const PROFILES_SENSITIVE: readonly string[] = [
  'display_name',
] as const;

// ---------------------------------------------------------------------------
// Generic row encrypt / decrypt
// ---------------------------------------------------------------------------

type AnyRow = Record<string, unknown>;

function encryptRowFields<T extends AnyRow>(row: T, fields: readonly string[], userId: string): T {
  if (!isFieldEncryptionEnabled()) return row;
  const out = { ...row };
  for (const field of fields) {
    const val = out[field];
    if (typeof val === 'string' && val !== '') {
      (out as AnyRow)[field] = encryptField(val, userId);
    }
  }
  return out as T;
}

function decryptRowFields<T extends AnyRow>(row: T, fields: readonly string[], userId: string): T {
  if (!isFieldEncryptionEnabled()) return row;
  const out = { ...row };
  for (const field of fields) {
    const val = out[field];
    if (typeof val === 'string' && val.startsWith(FIELD_PREFIX)) {
      (out as AnyRow)[field] = decryptField(val, userId);
    }
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// Per-table helpers (public API for data-access + mappers)
// ---------------------------------------------------------------------------

export function encryptChildRow<T extends AnyRow>(row: T, userId: string): T {
  return encryptRowFields(row, CHILDREN_SENSITIVE, userId);
}
export function decryptChildRow<T extends AnyRow>(row: T, userId: string): T {
  return decryptRowFields(row, CHILDREN_SENSITIVE, userId);
}

export function encryptVisitRow<T extends AnyRow>(row: T, userId: string): T {
  return encryptRowFields(row, VISITS_SENSITIVE, userId);
}
export function decryptVisitRow<T extends AnyRow>(row: T, userId: string): T {
  return decryptRowFields(row, VISITS_SENSITIVE, userId);
}

export function encryptVaccinationRow<T extends AnyRow>(row: T, userId: string): T {
  return encryptRowFields(row, VACCINATIONS_SENSITIVE, userId);
}
export function decryptVaccinationRow<T extends AnyRow>(row: T, userId: string): T {
  return decryptRowFields(row, VACCINATIONS_SENSITIVE, userId);
}

export function encryptPrescriptionRow<T extends AnyRow>(row: T, userId: string): T {
  return encryptRowFields(row, PRESCRIPTIONS_SENSITIVE, userId);
}
export function decryptPrescriptionRow<T extends AnyRow>(row: T, userId: string): T {
  return decryptRowFields(row, PRESCRIPTIONS_SENSITIVE, userId);
}

export function encryptPrescriptionMedicineRow<T extends AnyRow>(row: T, userId: string): T {
  return encryptRowFields(row, PRESCRIPTION_MEDICINES_SENSITIVE, userId);
}
export function decryptPrescriptionMedicineRow<T extends AnyRow>(row: T, userId: string): T {
  return decryptRowFields(row, PRESCRIPTION_MEDICINES_SENSITIVE, userId);
}

export function encryptDocumentRow<T extends AnyRow>(row: T, userId: string): T {
  return encryptRowFields(row, DOCUMENTS_SENSITIVE, userId);
}
export function decryptDocumentRow<T extends AnyRow>(row: T, userId: string): T {
  return decryptRowFields(row, DOCUMENTS_SENSITIVE, userId);
}

export function encryptBillingRow<T extends AnyRow>(row: T, userId: string): T {
  return encryptRowFields(row, BILLING_SENSITIVE, userId);
}
export function decryptBillingRow<T extends AnyRow>(row: T, userId: string): T {
  return decryptRowFields(row, BILLING_SENSITIVE, userId);
}

export function encryptProfileRow<T extends AnyRow>(row: T, userId: string): T {
  return encryptRowFields(row, PROFILES_SENSITIVE, userId);
}
export function decryptProfileRow<T extends AnyRow>(row: T, userId: string): T {
  return decryptRowFields(row, PROFILES_SENSITIVE, userId);
}
