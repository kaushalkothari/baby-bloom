import type { Document, Prescription, Vaccination, Medicine } from '@/types';

export type LinkedDocumentRow =
  | { kind: 'upload'; doc: Document }
  | { kind: 'prescription'; rx: Prescription }
  | { kind: 'vaccination'; vax: Vaccination };

function medsFromRx(rx: Prescription): Medicine[] {
  if (rx.medicines && rx.medicines.length > 0) return rx.medicines;
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

function rowDate(row: LinkedDocumentRow): string {
  if (row.kind === 'upload') return row.doc.date;
  if (row.kind === 'prescription') return row.rx.date;
  return row.vax.completedDate || row.vax.dueDate;
}

function passesFilter(row: LinkedDocumentRow, filterType: string): boolean {
  if (filterType === 'all') return true;
  if (row.kind === 'upload') return row.doc.type === filterType;
  if (row.kind === 'prescription') return filterType === 'prescription';
  if (row.kind === 'vaccination') return filterType === 'vaccination_card';
  return false;
}

/** Merges uploaded documents with prescription images and vaccination card photos for one child. */
export function buildLinkedDocumentRows(
  childId: string,
  documents: Document[],
  prescriptions: Prescription[],
  vaccinations: Vaccination[],
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

  const merged = [...uploads, ...rxRows, ...vxRows].filter(r => passesFilter(r, filterType));

  merged.sort((a, b) => new Date(rowDate(b)).getTime() - new Date(rowDate(a)).getTime());

  return merged;
}

export function rowDisplayNotes(row: LinkedDocumentRow): string | undefined {
  if (row.kind === 'upload') return row.doc.notes;
  if (row.kind === 'prescription') return row.rx.notes;
  return row.vax.notes || row.vax.location;
}

export function rowPreview(row: LinkedDocumentRow): { name: string; fileData: string } {
  if (row.kind === 'upload') return { name: row.doc.name, fileData: row.doc.fileData };
  if (row.kind === 'prescription') {
    return { name: prescriptionImageTitle(row.rx), fileData: row.rx.prescriptionImage! };
  }
  return { name: vaccinationCardTitle(row.vax), fileData: row.vax.cardPhoto! };
}
