import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface DateTimePickerProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  placeholder?: string;
  /** Disable days before today. Default true. */
  disablePast?: boolean;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const pad = (n: number) => n.toString().padStart(2, "0");

export default function DateTimePicker({
  value, onChange, placeholder = "Pick a date & time", disablePast = true, className,
}: DateTimePickerProps) {
  // Default the time portion to 09:00 when first picking a day.
  const withParts = (base: Date | null, patch: Partial<{ y: number; m: number; d: number; h: number; min: number }>) => {
    const d = base ? new Date(base) : new Date(new Date().setHours(9, 0, 0, 0));
    if (patch.y !== undefined) d.setFullYear(patch.y);
    if (patch.m !== undefined) d.setMonth(patch.m);
    if (patch.d !== undefined) d.setDate(patch.d);
    if (patch.h !== undefined) d.setHours(patch.h);
    if (patch.min !== undefined) d.setMinutes(patch.min);
    d.setSeconds(0, 0);
    return d;
  };

  const onDay = (day: Date | undefined) => {
    if (!day) return;
    onChange(withParts(value, { y: day.getFullYear(), m: day.getMonth(), d: day.getDate() }));
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("w-full justify-start font-normal", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon className="w-4 h-4 mr-2 shrink-0" />
          {value ? format(value, "EEE d MMM yyyy · HH:mm") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={onDay}
          disabled={disablePast ? { before: today } : undefined}
          initialFocus
        />
        <div className="flex items-center gap-2 border-t border-border/40 p-3">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select
            value={value ? String(value.getHours()) : undefined}
            onValueChange={(h) => onChange(withParts(value, { h: Number(h) }))}
          >
            <SelectTrigger className="flex-1"><SelectValue placeholder="HH" /></SelectTrigger>
            <SelectContent className="max-h-56">
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>{pad(h)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select
            value={value ? String(value.getMinutes() - (value.getMinutes() % 5)) : undefined}
            onValueChange={(m) => onChange(withParts(value, { min: Number(m) }))}
          >
            <SelectTrigger className="flex-1"><SelectValue placeholder="MM" /></SelectTrigger>
            <SelectContent className="max-h-56">
              {MINUTES.map((m) => (
                <SelectItem key={m} value={String(m)}>{pad(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
