import type { Document, Prescription, Vaccination, Medicine, BillingRecord } from '@/types';

export type LinkedDocumentRow =
  | { kind: 'upload'; doc: Document }
  | { kind: 'prescription'; rx: Prescription }
  | { kind: 'vaccination'; vax: Vaccination }
  | { kind: 'billing'; bill: BillingRecord };

const MED_META_SENTINEL = '\n__bb_meta__:';

function stripMedMeta(m: Medicine): Medicine {
  const raw = m.duration || '';
  const idx = raw.indexOf(MED_META_SENTINEL);
  if (idx === -1) return m;
  const displayDuration = raw.slice(0, idx).trim();
  const metaRaw = raw.slice(idx + MED_META_SENTINEL.length).trim();
  try {
    const meta = JSON.parse(metaRaw) as Partial<Medicine>;
    return {
      ...m,
      ...meta,
      duration: displayDuration,
      instructions: meta.instructions ?? m.instructions,
    };
  } catch {
    return { ...m, duration: displayDuration };
  }
}

/** Resolves a prescription's medicines, falling back to legacy single-medicine columns. */
export function medsFromRx(rx: Prescription): Medicine[] {
  if (rx.medicines && rx.medicines.length > 0) return rx.medicines.map(stripMedMeta);
  if (rx.medicineName) {
    return [{ id: 'legacy', name: rx.medicineName, dosage: rx.dosage || '', frequency: rx.frequency || '', duration: rx.duration || '' }];
  }
  return [];
}

/** Title for a prescription image card (e.g. “Prescription - Paracetamol”). */
export function prescriptionImageTitle(rx: Prescription): string {
  const meds = medsFromRx(rx).filter(m => m.name.trim());
  if (meds.length === 1) return `Prescription - ${meds[0].name}`;
  if (meds.length > 1) return `Prescription - ${meds.length} medicines`;
  return 'Prescription';
}

export function vaccinationCardTitle(vax: Vaccination): string {
  return `Vaccination card - ${vax.vaccineName}`;
}

export function billingReceiptTitle(bill: BillingRecord): string {
  return `Receipt - ${bill.hospitalName}`;
}

export function isRenderableImage(src: string | undefined): boolean {
  if (!src) return false;
  return src.startsWith('data:image/') || src.startsWith('http://') || src.startsWith('https://');
}

export function imageMimeFromSrc(src: string): string {
  if (src.startsWith('data:')) {
    const m = src.match(/^data:([^;,]+)/);
    return m?.[1] || 'image/jpeg';
  }
  return 'image/jpeg';
}

/** Stable React list key for a row. */
export function rowKey(row: LinkedDocumentRow): string {
  if (row.kind === 'upload') return row.doc.id;
  if (row.kind === 'prescription') return `rx-img-${row.rx.id}`;
  if (row.kind === 'vaccination') return `vax-card-${row.vax.id}`;
  return `bill-rcpt-${row.bill.id}`;
}

/** Display title for a row (uploaded file name, or derived title for a linked image). */
export function rowTitle(row: LinkedDocumentRow): string {
  if (row.kind === 'upload') return row.doc.name;
  if (row.kind === 'prescription') return prescriptionImageTitle(row.rx);
  if (row.kind === 'vaccination') return vaccinationCardTitle(row.vax);
  return billingReceiptTitle(row.bill);
}

/** Date shown next to a row (completedDate preferred for vaccinations, else scheduled due). */
export function rowDate(row: LinkedDocumentRow): string {
  if (row.kind === 'upload') return row.doc.date;
  if (row.kind === 'prescription') return row.rx.date;
  if (row.kind === 'vaccination') return row.vax.completedDate || row.vax.dueDate;
  return row.bill.date;
}

/** Raw file data for a row (base64 / URL). */
export function rowFileData(row: LinkedDocumentRow): string {
  return row.kind === 'upload' ? row.doc.fileData : rowPreview(row).fileData;
}

/** Human-friendly type label; uploads resolve via caller-provided `docTypes` table. */
export function rowTypeLabel(
  row: LinkedDocumentRow,
  docTypes: { value: string; label: string }[],
): string | undefined {
  if (row.kind === 'upload') return docTypes.find((t) => t.value === row.doc.type)?.label;
  if (row.kind === 'prescription') return 'Prescription';
  if (row.kind === 'vaccination') return 'Vaccination Card';
  return 'Receipt';
}

function passesFilter(row: LinkedDocumentRow, filterType: string): boolean {
  if (filterType === 'all') return true;
  if (row.kind === 'upload') return row.doc.type === filterType;
  if (row.kind === 'prescription') return filterType === 'prescription';
  if (row.kind === 'vaccination') return filterType === 'vaccination_card';
  if (row.kind === 'billing') return filterType === 'receipt';
  return false;
}

/** Merges uploaded documents with linked images from prescriptions, vaccinations, and billing. */
export function buildLinkedDocumentRows(
  childId: string,
  documents: Document[],
  prescriptions: Prescription[],
  vaccinations: Vaccination[],
  billing: BillingRecord[],
  filterType: string,
): LinkedDocumentRow[] {
  const uploads: LinkedDocumentRow[] = documents
    .filter(d => d.childId === childId)
    .map(doc => ({ kind: 'upload' as const, doc }));

  const rxRows: LinkedDocumentRow[] = prescriptions
    .filter(p => p.childId === childId && isRenderableImage(p.prescriptionImage))
    .map(rx => ({ kind: 'prescription' as const, rx }));

  const vxRows: LinkedDocumentRow[] = vaccinations
    .filter(v => v.childId === childId && isRenderableImage(v.cardPhoto))
    .map(vax => ({ kind: 'vaccination' as const, vax }));

  const billRows: LinkedDocumentRow[] = billing
    .filter(b => b.childId === childId && isRenderableImage(b.receiptImage))
    .map(bill => ({ kind: 'billing' as const, bill }));

  const merged = [...uploads, ...rxRows, ...vxRows, ...billRows].filter(r => passesFilter(r, filterType));

  merged.sort((a, b) => new Date(rowDate(b)).getTime() - new Date(rowDate(a)).getTime());

  return merged;
}

export function rowDisplayNotes(row: LinkedDocumentRow): string | undefined {
  if (row.kind === 'upload') return row.doc.notes;
  if (row.kind === 'prescription') return row.rx.notes;
  if (row.kind === 'vaccination') return row.vax.notes || row.vax.location;
  const b = row.bill;
  const parts = [`₹${b.amount.toLocaleString('en-IN')}`];
  if (b.description?.trim()) parts.push(b.description.trim().replace(/\$/g, '₹'));
  return parts.join(' · ');
}

export function rowPreview(row: LinkedDocumentRow): { name: string; fileData: string } {
  if (row.kind === 'upload') return { name: row.doc.name, fileData: row.doc.fileData };
  if (row.kind === 'prescription') {
    return { name: prescriptionImageTitle(row.rx), fileData: row.rx.prescriptionImage! };
  }
  if (row.kind === 'vaccination') {
    return { name: vaccinationCardTitle(row.vax), fileData: row.vax.cardPhoto! };
  }
  return { name: billingReceiptTitle(row.bill), fileData: row.bill.receiptImage! };
}
