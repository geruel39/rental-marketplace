"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (val: number) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
}

const sizeClasses = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
} as const;

export function StarRating({
  value,
  onChange,
  size = "md",
  readOnly = false,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value;
  const starClassName = sizeClasses[size];

  const stars = useMemo(() => Array.from({ length: 5 }, (_, index) => index + 1), []);

  return (
    <div className="flex items-center gap-1">
      {stars.map((star) => {
        const fillPercentage = Math.max(0, Math.min(1, displayValue - (star - 1))) * 100;

        if (readOnly) {
          return (
            <span key={star} className="relative inline-flex">
              <Star className={cn(starClassName, "text-amber-400")} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercentage}%` }}>
                <Star className={cn(starClassName, "fill-amber-400 text-amber-400")} />
              </span>
            </span>
          );
        }

        return (
          <button
            key={star}
            className="inline-flex"
            onClick={() => onChange?.(star)}
            onMouseEnter={() => setHoverValue(star)}
            onMouseLeave={() => setHoverValue(null)}
            type="button"
          >
            <Star
              className={cn(
                starClassName,
                star <= displayValue
                  ? "fill-amber-400 text-amber-400"
                  : "text-amber-400",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
