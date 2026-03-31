"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SchedulePickerProps {
  error?: string;
  label: string;
  minDate?: Date;
  onChange: (iso: string) => void;
  value?: string;
}

function buildTimeOptions() {
  const options: string[] = [];

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      options.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      );
    }
  }

  return options;
}

const TIME_OPTIONS = buildTimeOptions();

function parseValue(value?: string) {
  if (!value) {
    return {
      date: undefined as Date | undefined,
      time: "09:00",
    };
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return {
      date: undefined as Date | undefined,
      time: "09:00",
    };
  }

  return {
    date: parsed,
    time: `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`,
  };
}

function combineDateAndTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next.toISOString();
}

export function SchedulePicker({
  error,
  label,
  minDate,
  onChange,
  value,
}: SchedulePickerProps) {
  const [open, setOpen] = useState(false);
  const parsedValue = parseValue(value);
  const selectedDate = parsedValue.date;
  const selectedTime = parsedValue.time;
  const minDateTime = minDate ? new Date(minDate) : undefined;

  function commit(nextDate: Date | undefined, nextTime: string) {
    if (!nextDate) {
      return;
    }

    onChange(combineDateAndTime(nextDate, nextTime));
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverTrigger asChild>
            <Button
              className={cn(
                "justify-between",
                error && "border-destructive text-destructive hover:text-destructive",
              )}
              type="button"
              variant="outline"
            >
              <span className="truncate">
                {selectedDate ? format(selectedDate, "PPP") : "Select date"}
              </span>
              <CalendarClock className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              disabled={(date) => Boolean(minDateTime && date < minDateTime)}
              mode="single"
              onSelect={(date) => {
                if (date) {
                  commit(date, selectedTime);
                  setOpen(false);
                }
              }}
              selected={selectedDate}
            />
          </PopoverContent>
        </Popover>

        <Select
          onValueChange={(time) => commit(selectedDate, time)}
          value={selectedTime}
        >
          <SelectTrigger
            className={cn(error && "border-destructive focus-visible:ring-destructive/40")}
          >
            <SelectValue placeholder="Select time" />
          </SelectTrigger>
          <SelectContent>
            {TIME_OPTIONS.map((time) => (
              <SelectItem key={time} value={time}>
                {time}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedDate ? (
        <p className="text-xs text-muted-foreground">
          Selected: {format(new Date(combineDateAndTime(selectedDate, selectedTime)), "PPP p")}
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
