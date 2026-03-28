"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

const statusTone: Record<string, string> = {
  active: "bg-sky-600 text-white hover:bg-sky-600",
  confirmed: "bg-blue-600 text-white hover:bg-blue-600",
  completed: "bg-emerald-600 text-white hover:bg-emerald-600",
  disputed: "bg-red-600 text-white hover:bg-red-600",
  cancelled_by_lister: "bg-muted text-foreground hover:bg-muted",
  cancelled_by_renter: "bg-muted text-foreground hover:bg-muted",
  pending: "bg-amber-500 text-black hover:bg-amber-500",
};

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
        {["all", "active", "disputed", "completed", "cancelled"].map((tab) => (
          <Button
            key={tab}
            onClick={() => updateFilter(tab)}
            size="sm"
            type="button"
            variant={activeFilter === tab ? "default" : "ghost"}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                <TableCell className="py-8 text-center text-muted-foreground" colSpan={10}>
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
                  <TableCell>{booking.quantity}</TableCell>
                  <TableCell>{formatCurrency(booking.total_price)}</TableCell>
                  <TableCell>
                    <Badge className={statusTone[booking.status] ?? "bg-muted text-foreground hover:bg-muted"}>
                      {booking.status}
                    </Badge>
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
