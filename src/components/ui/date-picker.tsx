import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { CalendarProps } from '@/components/ui/calendar';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDialogPortalContainer } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

function parseStoredDate(value: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = parseISO(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export interface DatePickerProps {
  id?: string;
  /** ISO date string `yyyy-MM-dd` */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: CalendarProps['disabled'];
  /** Month/year dropdowns; set both for sensible ranges */
  fromYear?: number;
  toYear?: number;
  defaultMonth?: Date;
  captionLayout?: CalendarProps['captionLayout'];
  /** Optional fields: clear selection */
  allowClear?: boolean;
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder,
  className,
  disabled,
  fromYear,
  toYear,
  defaultMonth,
  captionLayout = 'dropdown',
  allowClear,
}: DatePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const dialogPortalContainer = useDialogPortalContainer();
  const selected = parseStoredDate(value);
  const y = new Date().getFullYear();
  const from = fromYear ?? y - 120;
  const to = toYear ?? y + 15;
  const month = selected ?? defaultMonth ?? new Date();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal h-10 px-3',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          {selected ? format(selected, 'PPP') : (placeholder ?? t('ui.pickADate'))}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-auto p-0"
        align="start"
        container={dialogPortalContainer}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            onChange(d ? format(d, 'yyyy-MM-dd') : '');
            setOpen(false);
          }}
          disabled={disabled}
          defaultMonth={month}
          captionLayout={captionLayout}
          fromYear={from}
          toYear={to}
        />
        {allowClear && value ? (
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              {t('common.clearDates')}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
