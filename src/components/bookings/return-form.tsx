"use client";

import { ReturnDialog } from "@/components/bookings/return-dialog";
import type { BookingWithDetails } from "@/types";

interface ReturnFormProps {
  booking: BookingWithDetails;
}

export function ReturnForm({ booking }: ReturnFormProps) {
  return <ReturnDialog booking={booking} />;
}
