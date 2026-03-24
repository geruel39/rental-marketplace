import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { format } from "date-fns";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { InventoryMovement, StockMovementType } from "@/types";

interface StockMovementLogProps {
  movements: (InventoryMovement & { listing_title?: string })[];
  showListingName?: boolean;
}

const movementTypeStyles: Record<StockMovementType, string> = {
  booking_reserved: "border-blue-200 bg-blue-100 text-blue-800",
  booking_released: "border-emerald-200 bg-emerald-100 text-emerald-800",
  booking_returned: "border-emerald-200 bg-emerald-100 text-emerald-800",
  adjustment_add: "border-emerald-200 bg-emerald-100 text-emerald-800",
  adjustment_remove: "border-amber-200 bg-amber-100 text-amber-800",
  adjustment_set: "border-blue-200 bg-blue-100 text-blue-800",
  damaged: "border-rose-200 bg-rose-100 text-rose-800",
  lost: "border-rose-200 bg-rose-100 text-rose-800",
  initial: "border-slate-200 bg-slate-100 text-slate-700",
};

function getMovementLabel(type: StockMovementType) {
  return type.replaceAll("_", " ");
}

export function StockMovementLog({
  movements,
  showListingName = false,
}: StockMovementLogProps) {
  if (movements.length === 0) {
    return (
      <EmptyState
        description="Stock adjustments, reservations, and returns will appear here."
        icon={ClipboardList}
        title="No stock movements yet"
      />
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {showListingName ? <TableHead>Listing</TableHead> : null}
            <TableHead>Type</TableHead>
            <TableHead>Change</TableHead>
            <TableHead>Before</TableHead>
            <TableHead>After</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Booking Ref</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => (
            <TableRow key={movement.id}>
              <TableCell>{format(new Date(movement.created_at), "PPP p")}</TableCell>
              {showListingName ? (
                <TableCell className="max-w-[220px] whitespace-normal">
                  {movement.listing_title ?? "Untitled listing"}
                </TableCell>
              ) : null}
              <TableCell>
                <Badge
                  className={cn("border", movementTypeStyles[movement.movement_type])}
                  variant="outline"
                >
                  {getMovementLabel(movement.movement_type)}
                </Badge>
              </TableCell>
              <TableCell
                className={cn(
                  "font-medium",
                  movement.quantity_change >= 0 ? "text-emerald-700" : "text-rose-700",
                )}
              >
                {movement.quantity_change >= 0 ? "+" : ""}
                {movement.quantity_change}
              </TableCell>
              <TableCell>{movement.quantity_before}</TableCell>
              <TableCell>{movement.quantity_after}</TableCell>
              <TableCell className="max-w-[260px] truncate text-muted-foreground">
                {movement.reason || "No reason provided"}
              </TableCell>
              <TableCell>
                {movement.booking_id ? (
                  <Link
                    className="text-primary underline-offset-4 hover:underline"
                    href="/dashboard/requests"
                  >
                    {movement.booking_id.slice(0, 8)}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
