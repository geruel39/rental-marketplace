"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { DisputeResolveDialog } from "@/components/admin/dispute-resolve-dialog";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BookingWithDetails } from "@/types";

function getPaymentStatus(booking: BookingWithDetails) {
  return booking.hitpay_payment_status || booking.hitpay_payment_id || (booking.paid_at ? "paid" : "unpaid");
}

export function AdminBookingTable({
  bookings,
  currentPage,
  totalPages,
}: {
  bookings: BookingWithDetails[];
  currentPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFilter = searchParams.get("filter") ?? "all";

  function updateFilter(filter: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") {
      params.delete("filter");
      params.delete("status");
      params.delete("disputed");
    } else if (filter === "disputed") {
      params.set("filter", filter);
      params.set("disputed", "true");
      params.delete("status");
    } else if (filter === "cancelled") {
      params.set("filter", filter);
      params.delete("disputed");
      params.delete("status");
    } else {
      params.set("filter", filter);
      params.set("status", filter);
      params.delete("disputed");
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-orange-200/60 bg-white/90 p-2">
        {[
          "all",
          "pending",
          "awaiting_payment",
          "confirmed",
          "out_for_delivery",
          "active",
          "returned",
          "completed",
          "disputed",
        ].map((tab) => (
          <Button
            key={tab}
            onClick={() => updateFilter(tab)}
            size="sm"
            type="button"
            variant={activeFilter === tab ? "default" : "ghost"}
          >
            {tab.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())}
          </Button>
        ))}
      </div>

      <div className="rounded-3xl border border-orange-200/60 bg-white/90 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking ID</TableHead>
              <TableHead>Listing</TableHead>
              <TableHead>Renter</TableHead>
              <TableHead>Lister</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Fulfillment</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-center text-muted-foreground" colSpan={11}>
                  No bookings matched this filter.
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>{booking.id.slice(0, 8)}</TableCell>
                  <TableCell className="whitespace-normal">{booking.listing.title}</TableCell>
                  <TableCell>
                    <Link href={`/admin/users/${booking.renter.id}`}>
                      {booking.renter.display_name || booking.renter.full_name || booking.renter.email}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/users/${booking.lister.id}`}>
                      {booking.lister.display_name || booking.lister.full_name || booking.lister.email}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {booking.fulfillment_type === "delivery" ? "Delivery" : "Pickup"}
                    </Badge>
                  </TableCell>
                  <TableCell>{booking.quantity}</TableCell>
                  <TableCell>{formatCurrency(booking.total_price)}</TableCell>
                  <TableCell>
                    <BookingStatusBadge status={booking.status} />
                  </TableCell>
                  <TableCell>{getPaymentStatus(booking)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/bookings/${booking.id}`}>View Details</Link>
                      </Button>
                      {booking.status === "disputed" ? (
                        <DisputeResolveDialog
                          booking={booking}
                          onComplete={() => router.refresh()}
                          trigger={
                            <Button className="bg-orange-600 text-white hover:bg-orange-700" size="sm">
                              Resolve Dispute
                            </Button>
                          }
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Pagination currentPage={currentPage} totalPages={totalPages} />
      </div>
    </div>
  );
}
