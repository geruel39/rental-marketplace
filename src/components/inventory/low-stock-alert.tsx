"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  TriangleAlert,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Listing } from "@/types";

interface LowStockAlertProps {
  listings: Listing[];
}

export function LowStockAlert({ listings }: LowStockAlertProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const affectedListings = useMemo(
    () =>
      listings.filter(
        (listing) => listing.quantity_available <= (listing.low_stock_threshold ?? 1),
      ),
    [listings],
  );

  if (affectedListings.length === 0 || isDismissed) {
    return null;
  }

  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-950">
      <TriangleAlert className="text-amber-700" />
      <div className="col-start-2 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <AlertTitle className="text-amber-950">
            You have {affectedListings.length} listing
            {affectedListings.length === 1 ? "" : "s"} with low or no stock
          </AlertTitle>
          <AlertDescription className="text-amber-900/80">
            Review affected listings before they miss new bookings.
          </AlertDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button
            className="text-amber-900 hover:bg-amber-100"
            onClick={() => setIsExpanded((value) => !value)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {isExpanded ? (
              <>
                Hide list
                <ChevronUp className="size-4" />
              </>
            ) : (
              <>
                View list
                <ChevronDown className="size-4" />
              </>
            )}
          </Button>
          <Button
            className="text-amber-900 hover:bg-amber-100"
            onClick={() => setIsDismissed(true)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
            <span className="sr-only">Dismiss alert</span>
          </Button>
        </div>
      </div>

      {isExpanded ? (
        <div className="col-start-2 mt-4 w-full space-y-2">
          {affectedListings.map((listing) => (
            <div
              key={listing.id}
              className="flex flex-col gap-3 rounded-xl border border-amber-200/80 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-amber-950">{listing.title}</p>
                <p className="text-sm text-amber-900/80">
                  {listing.quantity_available} left
                </p>
              </div>
              <Button
                asChild
                className="self-start text-amber-950 hover:bg-amber-100 sm:self-auto"
                size="sm"
                variant="outline"
              >
                <Link href={`/dashboard/inventory/${listing.id}`}>
                  Adjust Stock
                </Link>
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </Alert>
  );
}
