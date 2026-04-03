import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getInitials } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function verifyAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();
  if (!profile?.is_admin) throw new Error("Unauthorized");
}

function getStockStatus(listing: {
  track_inventory: boolean;
  quantity_available: number;
  low_stock_threshold: number | null;
}) {
  if (!listing.track_inventory) return "Not tracked";
  if (listing.quantity_available === 0) return "Out of stock";
  if (listing.quantity_available <= (listing.low_stock_threshold ?? 1)) return "Low stock";
  return "Healthy";
}

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await verifyAdminAccess();
  const resolvedSearchParams = await searchParams;
  const filter = getSingleValue(resolvedSearchParams.filter) ?? "all";
  const admin = createAdminClient();

  const { data } = await admin
    .from("listings")
    .select(
      `
        *,
        owner:profiles!listings_owner_id_fkey(*)
      `,
    )
    .order("quantity_available", { ascending: true });

  const listings = (data ?? []) as Array<{
    id: string;
    title: string;
    sku: string | null;
    quantity_total: number;
    quantity_available: number;
    quantity_reserved: number;
    track_inventory: boolean;
    low_stock_threshold: number | null;
    owner: {
      id: string;
      avatar_url: string | null;
      display_name: string;
      full_name: string;
      email: string;
    };
  }>;

  const filteredListings = listings.filter((listing) => {
    if (filter === "out") return listing.track_inventory && listing.quantity_available === 0;
    if (filter === "low") {
      return (
        listing.track_inventory &&
        listing.quantity_available > 0 &&
        listing.quantity_available <= (listing.low_stock_threshold ?? 1)
      );
    }
    return true;
  });

  const totalItems = listings.reduce((sum, listing) => sum + listing.quantity_total, 0);
  const rentedOut = listings.reduce((sum, listing) => sum + listing.quantity_reserved, 0);
  const zeroStock = listings.filter((listing) => listing.track_inventory && listing.quantity_available === 0).length;
  const lowStock = listings.filter(
    (listing) =>
      listing.track_inventory &&
      listing.quantity_available > 0 &&
      listing.quantity_available <= (listing.low_stock_threshold ?? 1),
  ).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Inventory"
        description="Monitor platform-wide stock health and identify supply risk across every listing."
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total items", value: totalItems },
          { label: "Items rented out", value: rentedOut },
          { label: "Zero stock listings", value: zeroStock },
          { label: "Low stock listings", value: lowStock },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/70 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight text-foreground">{stat.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-white p-2">
        <LinkTab href="/admin/inventory" isActive={filter === "all"} label="All" />
        <LinkTab href="/admin/inventory?filter=out" isActive={filter === "out"} label="Out of Stock" />
        <LinkTab href="/admin/inventory?filter=low" isActive={filter === "low"} label="Low Stock" />
      </div>

      <div className="rounded-3xl border border-border/70 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Owner</TableHead>
              <TableHead>Listing title</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Reserved</TableHead>
              <TableHead>Track Inventory</TableHead>
              <TableHead>Stock Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredListings.map((listing) => {
              const ownerName = listing.owner.display_name || listing.owner.full_name || listing.owner.email;
              const stockStatus = getStockStatus(listing);
              return (
                <TableRow key={listing.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        {listing.owner.avatar_url ? (
                          <AvatarImage alt={ownerName} src={listing.owner.avatar_url} />
                        ) : null}
                        <AvatarFallback>{getInitials(ownerName)}</AvatarFallback>
                      </Avatar>
                      <span>{ownerName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{listing.title}</TableCell>
                  <TableCell>{listing.sku || "-"}</TableCell>
                  <TableCell>{listing.quantity_total}</TableCell>
                  <TableCell>{listing.quantity_available}</TableCell>
                  <TableCell>{listing.quantity_reserved}</TableCell>
                  <TableCell>{listing.track_inventory ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        stockStatus === "Out of stock"
                          ? "bg-red-600 text-white hover:bg-red-600"
                          : stockStatus === "Low stock"
                            ? "bg-amber-500 text-black hover:bg-amber-500"
                            : stockStatus === "Healthy"
                              ? "bg-emerald-600 text-white hover:bg-emerald-600"
                              : "bg-muted text-foreground hover:bg-muted"
                      }
                    >
                      {stockStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function LinkTab({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      className={`inline-flex h-8 items-center rounded-md px-3 text-sm ${isActive ? "bg-brand-navy text-white" : "text-foreground hover:bg-accent"}`}
      href={href}
    >
      {label}
    </Link>
  );
}

