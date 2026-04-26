import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Upload, Loader2, ScanText, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface OcrResult {
  vaccineName?: string;
  batchNumber?: string;
  completedDate?: string;
  expiryDate?: string;
  administeredBy?: string;
}

interface VaccineCardCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPhotoCapture: (photo: string) => void;
  onOcrResult: (result: OcrResult) => void;
}

export function VaccineCardCapture({ open, onOpenChange, onPhotoCapture, onOcrResult }: VaccineCardCaptureProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(t('vaccineCardCapture.errorNotImage'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('vaccineCardCapture.errorSize'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const runOcr = async () => {
    if (!preview) return;
    setIsProcessing(true);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(preview);
      await worker.terminate();

      const result = parseVaccineText(text);
      onPhotoCapture(preview);
      onOcrResult(result);

      if (result.vaccineName || result.batchNumber || result.completedDate) {
        toast.success(t('vaccineCardCapture.successExtracted'));
      } else {
        toast.info(t('vaccineCardCapture.infoNoExtract'));
      }
      onOpenChange(false);
      setPreview(null);
    } catch (err) {
      console.error('OCR error:', err);
      toast.error(t('vaccineCardCapture.ocrFailed'));
      onPhotoCapture(preview);
      onOpenChange(false);
      setPreview(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveWithoutOcr = () => {
    if (preview) {
      onPhotoCapture(preview);
      toast.success(t('vaccineCardCapture.photoSaved'));
    }
    onOpenChange(false);
    setPreview(null);
  };

  const reset = () => {
    setPreview(null);
    setIsProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> {t('vaccineCardCapture.title')}
          </DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('vaccineCardCapture.intro')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-6 w-6 text-primary" />
                <span className="text-xs">{t('vaccineCardCapture.takePhoto')}</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 text-primary" />
                <span className="text-xs">{t('vaccineCardCapture.uploadImage')}</span>
              </Button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleInputChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img src={preview} alt={t('vaccineCardCapture.previewAlt')} className="w-full max-h-64 object-contain bg-muted" />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={runOcr}
                disabled={isProcessing}
                className="flex-1 gap-2"
              >
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {t('vaccineCardCapture.processing')}</>
                ) : (
                  <><ScanText className="h-4 w-4" /> {t('vaccineCardCapture.scanExtract')}</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={saveWithoutOcr}
                disabled={isProcessing}
                className="gap-2"
              >
                <ImageIcon className="h-4 w-4" /> {t('vaccineCardCapture.saveOnly')}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={reset} disabled={isProcessing} className="w-full">
              {t('vaccineCardCapture.retake')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function parseVaccineText(text: string): OcrResult {
  const result: OcrResult = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = lines.join(' ');

  // Try to find vaccine name - common patterns (Indian immunisation chart + international)
  const vaccinePatterns = [
    /(?:vaccine|vaccination|immunization)[:\s]*(.+)/i,
    /(BCG|OPV\s*\d*|IPV\s*[-\d]*|DPT\s*\/?\.?\s*DTaP?\s*\d*|Hep(?:atitis)?\s*[AB]\s*[-\d]*|MMR\s*\d*|MMRV|Rotavirus|PCV\s*(?:Booster)?|Tdap|Varicella[-\s]*\d*|HPV\s*\d*|Influenza\s*\d*|COVID|HIB\s*\d*|Typhoid|Meningococcal|Japanese\s*Encephalitis|Pneumococcal|Prevnar|Menactra|Rotasii?l)/i,
  ];
  for (const line of lines) {
    for (const pattern of vaccinePatterns) {
      const match = line.match(pattern);
      if (match) {
        result.vaccineName = match[1]?.trim() || match[0].trim();
        break;
      }
    }
    if (result.vaccineName) break;
  }

  // Try to find batch/lot number (including Indian sticker formats like "B.No", "Lot:", "LA6683")
  const batchPatterns = [
    /(?:batch|lot|b\.?\s*no\.?)\s*[:\s]*([A-Z0-9][-A-Z0-9]+)/i,
    /(?:Loc|Lot)[:\s]*([A-Z0-9][-A-Z0-9]+)/i,
  ];
  for (const line of lines) {
    for (const pattern of batchPatterns) {
      const match = line.match(pattern);
      if (match) {
        result.batchNumber = match[1].trim();
        break;
      }
    }
    if (result.batchNumber) break;
  }

  // Collect all dates found in the text
  const datePatterns = [
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,
    /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/g,
    /(\d{1,2}[\/\-\.]\d{2,4})/g,
  ];
  const allDates: { raw: string; parsed: Date }[] = [];
  for (const pattern of datePatterns) {
    const matches = fullText.matchAll(pattern);
    for (const m of matches) {
      try {
        const dateStr = m[1];
        // Try common Indian formats: dd/mm/yy, dd/mm/yyyy
        const parts = dateStr.split(/[\/\-\.]/);
        let parsed: Date | null = null;
        if (parts.length === 3) {
          const [a, b, c] = parts.map(Number);
          if (c > 100) {
            // dd/mm/yyyy
            parsed = new Date(c, b - 1, a);
          } else if (a > 100) {
            // yyyy/mm/dd
            parsed = new Date(a, b - 1, c);
          } else {
            // dd/mm/yy
            const year = c < 50 ? 2000 + c : 1900 + c;
            parsed = new Date(year, b - 1, a);
          }
        } else if (parts.length === 2) {
          const [a, b] = parts.map(Number);
          if (b > 100) {
            parsed = new Date(b, a - 1, 1);
          } else {
            const year = b < 50 ? 2000 + b : 1900 + b;
            parsed = new Date(year, a - 1, 1);
          }
        }
        if (parsed && !isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
          allDates.push({ raw: dateStr, parsed });
        }
      } catch {}
    }
  }

  // Look for expiry date near keywords
  const expiryKeywords = /(?:exp\.?|expiry|expires?|exp\s*date|EXP)[:\s]*/i;
  const mfgKeywords = /(?:mfg\.?|mfd\.?|manufacturing|mfg\s*date|MFG)[:\s]*/i;
  
  for (const line of lines) {
    if (expiryKeywords.test(line) && !result.expiryDate) {
      const dateMatch = line.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
      const monthYearMatch = line.match(/(\d{1,2}[\/\-\.]?\s*(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\w*[\/\-\.]?\s*\d{2,4})/i);
      const simpleMatch = line.match(/(?:exp\.?|EXP)[:\s]*(\d{1,2}[\/\-\.]\d{2,4})/i);
      if (dateMatch) {
        result.expiryDate = parseDateStr(dateMatch[1]);
      } else if (monthYearMatch) {
        result.expiryDate = monthYearMatch[1].trim();
      } else if (simpleMatch) {
        result.expiryDate = parseDateStr(simpleMatch[1]);
      }
    }
  }

  // Look for "Given Date" column - dates near "given" keyword
  const givenKeywords = /(?:given\s*date|date\s*given|administered|vaccinated|done)[:\s]*/i;
  for (const line of lines) {
    if (givenKeywords.test(line) && !result.completedDate) {
      const dateMatch = line.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
      if (dateMatch) {
        result.completedDate = parseDateStr(dateMatch[1]);
      }
    }
  }

  // If no given date found via keywords, use the most recent past date
  if (!result.completedDate && allDates.length > 0) {
    const now = new Date();
    const pastDates = allDates.filter(d => d.parsed <= now);
    if (pastDates.length > 0) {
      pastDates.sort((a, b) => b.parsed.getTime() - a.parsed.getTime());
      result.completedDate = pastDates[0].parsed.toISOString().split('T')[0];
    }
  }

  // If no expiry found via keywords, use the most future date
  if (!result.expiryDate && allDates.length > 0) {
    const now = new Date();
    const futureDates = allDates.filter(d => d.parsed > now);
    if (futureDates.length > 0) {
      futureDates.sort((a, b) => a.parsed.getTime() - b.parsed.getTime());
      result.expiryDate = futureDates[0].parsed.toISOString().split('T')[0];
    }
  }

  // Try to find doctor/administered by
  const doctorPatterns = [
    /(?:doctor|dr\.?|physician|administered\s*by|given\s*by)[:\s]*(.+)/i,
  ];
  for (const line of lines) {
    for (const pattern of doctorPatterns) {
      const match = line.match(pattern);
      if (match) {
        result.administeredBy = match[1].trim();
        break;
      }
    }
    if (result.administeredBy) break;
  }

  return result;
}

function parseDateStr(dateStr: string): string {
  const parts = dateStr.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    let d: Date;
    if (c > 100) {
      d = new Date(c, b - 1, a);
    } else if (a > 100) {
      d = new Date(a, b - 1, c);
    } else {
      const year = c < 50 ? 2000 + c : 1900 + c;
      d = new Date(year, b - 1, a);
    }
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } else if (parts.length === 2) {
    const [a, b] = parts.map(Number);
    const year = b < 50 ? 2000 + b : (b > 100 ? b : 1900 + b);
    const d = new Date(year, a - 1, 1);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return dateStr;
}
