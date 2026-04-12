const HEIC_MIMES = new Set(['image/heic', 'image/heif']);
const HEIC_EXTS = ['.heic', '.heif'];

/** True when the file's MIME or extension indicates HEIC / HEIF. */
export function isHeic(mime: string, fileName?: string): boolean {
  if (HEIC_MIMES.has(mime)) return true;
  if (fileName) {
    const lower = fileName.toLowerCase();
    return HEIC_EXTS.some((ext) => lower.endsWith(ext));
  }
  return false;
}

/** Convert a Blob to a base64 data URL. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('FileReader did not produce a string'));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Try native Canvas decode (works on Safari, Chrome 120+ / macOS 14+).
 * Resolves with a JPEG data URL or rejects if the browser can't decode.
 */
function canvasConvertToJpeg(dataUrl: string, quality = 0.92): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No canvas context')); return; }
        ctx.drawImage(img, 0, 0);
        const jpeg = canvas.toDataURL('image/jpeg', quality);
        if (!jpeg || jpeg === 'data:,') { reject(new Error('Canvas produced empty output')); return; }
        resolve(jpeg);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Native decode failed'));
    img.src = dataUrl;
  });
}

/** Convert a base64 data URL string into a raw Blob. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Convert a HEIC/HEIF data URL to JPEG.
 * 1. Try native Canvas (zero-cost on browsers with HEIC support).
 * 2. Fall back to `heic-to` library (pure-JS libheif decoder).
 */
async function heicToJpegDataUrl(dataUrl: string, quality = 0.92): Promise<string> {
  try {
    return await canvasConvertToJpeg(dataUrl, quality);
  } catch {
    // Native decode failed — use heic-to library
  }

  const { heicTo } = await import('heic-to');
  const blob = dataUrlToBlob(dataUrl);
  const jpegBlob = await heicTo({ blob, type: 'image/jpeg' as const, quality });
  return blobToDataUrl(jpegBlob);
}

/**
 * If the data URL is HEIC/HEIF, convert to JPEG (native Canvas → heic-to fallback).
 * Otherwise return as-is.
 */
export async function normalizeImageDataUrl(
  dataUrl: string,
  fileName?: string,
): Promise<{ data: string; mime: string }> {
  const mimeMatch = dataUrl.match(/^data:([^;,]+)/);
  const originalMime = mimeMatch?.[1] || 'application/octet-stream';

  if (!isHeic(originalMime, fileName)) {
    return { data: dataUrl, mime: originalMime };
  }

  const data = await heicToJpegDataUrl(dataUrl);
  return { data, mime: 'image/jpeg' };
}
