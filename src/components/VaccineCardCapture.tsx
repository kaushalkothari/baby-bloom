import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Upload, Loader2, ScanText, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

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
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB.');
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
        toast.success('Fields extracted from vaccine card!');
      } else {
        toast.info('Could not extract fields automatically. Photo saved — you can fill in manually.');
      }
      onOpenChange(false);
      setPreview(null);
    } catch (err) {
      console.error('OCR error:', err);
      toast.error('OCR processing failed. Photo saved without extraction.');
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
      toast.success('Vaccine card photo saved!');
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
            <Camera className="h-5 w-5 text-primary" /> Capture Vaccine Card
          </DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Take a photo or upload an image of the vaccine card. We'll try to extract details automatically.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-6 w-6 text-primary" />
                <span className="text-xs">Take Photo</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 text-primary" />
                <span className="text-xs">Upload Image</span>
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
              <img src={preview} alt="Vaccine card preview" className="w-full max-h-64 object-contain bg-muted" />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={runOcr}
                disabled={isProcessing}
                className="flex-1 gap-2"
              >
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  <><ScanText className="h-4 w-4" /> Scan &amp; Extract</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={saveWithoutOcr}
                disabled={isProcessing}
                className="gap-2"
              >
                <ImageIcon className="h-4 w-4" /> Save Only
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={reset} disabled={isProcessing} className="w-full">
              Retake / Choose Another
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

  // Try to find vaccine name - common patterns
  const vaccinePatterns = [
    /(?:vaccine|vaccination|immunization)[:\s]*(.+)/i,
    /(?:BCG|OPV|IPV|DPT|DTaP|Hep\s?[AB]|MMR|Rotavirus|PCV|Tdap|Varicella|HPV|Influenza|COVID)/i,
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

  // Try to find batch/lot number
  const batchPatterns = [
    /(?:batch|lot)\s*(?:no|number|#)?[:\s]*([A-Z0-9-]+)/i,
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

  // Try to find date
  const datePatterns = [
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
    /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
  ];
  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        try {
          const dateStr = match[1];
          const parsed = new Date(dateStr.replace(/\./g, '/'));
          if (!isNaN(parsed.getTime())) {
            result.completedDate = parsed.toISOString().split('T')[0];
            break;
          }
        } catch {}
      }
    }
    if (result.completedDate) break;
  }

  // Try to find doctor/administered by
  const doctorPatterns = [
    /(?:doctor|dr|physician|administered\s*by|given\s*by)[:\s]*(.+)/i,
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
