import Link from "next/link";
import { notFound } from "next/navigation";

import { ListingModerateDialog } from "@/components/admin/listing-moderate-dialog";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BookingWithDetails, ListingWithOwner, ReviewWithUsers } from "@/types";

const moderationTone: Record<string, string> = {
  approved: "bg-emerald-600 text-white hover:bg-emerald-600",
  pending: "bg-sky-600 text-white hover:bg-sky-600",
  rejected: "bg-red-600 text-white hover:bg-red-600",
  flagged: "bg-amber-500 text-black hover:bg-amber-500",
};

async function verifyAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();

  if (!profile?.is_admin) {
    throw new Error("Unauthorized");
  }
}

export default async function AdminListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifyAdminAccess();
  const { id } = await params;
  const admin = createAdminClient();

  const [listingResult, categoryResult, reviewsResult, bookingsResult, auditResult, inventoryResult] =
    await Promise.all([
      admin
        .from("listings")
        .select(
          `
            *,
            owner:profiles!listings_owner_id_fkey(*)
          `,
        )
        .eq("id", id)
        .maybeSingle(),
      admin.from("categories").select("id, name"),
      admin
        .from("reviews")
        .select(
          `
            *,
            reviewer:profiles!reviews_reviewer_id_fkey(*),
            reviewee:profiles!reviews_reviewee_id_fkey(*),
            listing:listings(*)
          `,
        )
        .eq("listing_id", id)
        .order("created_at", { ascending: false }),
      admin
        .from("bookings")
        .select(
          `
            *,
            listing:listings!bookings_listing_id_fkey(*),
            renter:profiles!bookings_renter_id_fkey(*),
            lister:profiles!bookings_lister_id_fkey(*)
          `,
        )
        .eq("listing_id", id)
        .order("created_at", { ascending: false }),
      admin
        .from("admin_audit_log")
        .select("*")
        .eq("target_type", "listing")
        .eq("target_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("inventory_movements")
        .select("*")
        .eq("listing_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  if (listingResult.error || !listingResult.data) {
    notFound();
  }

  const listing = listingResult.data as ListingWithOwner;
  const ownerName =
    listing.owner.display_name || listing.owner.full_name || listing.owner.email;
  const categories = Object.fromEntries(
    (categoryResult.data ?? []).map((category) => [category.id, category.name]),
  );
  const reviews = (reviewsResult.data ?? []) as ReviewWithUsers[];
  const bookings = (bookingsResult.data ?? []) as BookingWithDetails[];
  const auditEntries = (auditResult.data ?? []) as Array<{
    id: string;
    action: string;
    created_at: string;
    details: Record<string, unknown>;
  }>;
  const inventoryMovements = (inventoryResult.data ?? []) as Array<{
    id: string;
    movement_type: string;
    quantity_change: number;
    quantity_before: number;
    quantity_after: number;
    created_at: string;
  }>;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Listing Detail"
        description="Inspect the full listing record, apply moderation decisions, and review platform activity attached to this item."
        action={
          <Link
            className="inline-flex h-9 items-center justify-center rounded-md border border-orange-200 bg-white px-4 text-sm font-medium text-orange-700 shadow-xs transition-colors hover:bg-orange-50"
            href="/admin/listings"
          >
            Back to listings
          </Link>
        }
      />

      <Card className="border-orange-200/60 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Admin Toolbar</CardTitle>
          <CardDescription>Use moderation controls and review the latest admin actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={listing.status === "active" ? "default" : "secondary"}>
              {listing.status}
            </Badge>
            <Badge
              className={
                moderationTone[listing.moderation_status] ??
                "bg-muted text-foreground hover:bg-muted"
              }
            >
              {listing.moderation_status}
            </Badge>
            {listing.is_flagged ? (
              <Badge className="bg-red-600 text-white hover:bg-red-600">Flagged</Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <ListingModerateDialog
              action="approve"
              listing={listing}
              ownerName={ownerName}
              trigger={<Button className="bg-emerald-600 text-white hover:bg-emerald-700">Approve</Button>}
            />
            <ListingModerateDialog
              action="reject"
              listing={listing}
              ownerName={ownerName}
              trigger={<Button variant="destructive">Reject</Button>}
            />
            <ListingModerateDialog
              action="flag"
              listing={listing}
              ownerName={ownerName}
              trigger={<Button className="bg-amber-500 text-black hover:bg-amber-600">Flag</Button>}
            />
          </div>

          <div className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Moderation notes</p>
            <p className="mt-2">{listing.moderation_notes || "No moderation notes recorded."}</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Recent audit history</p>
            {auditEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admin actions logged for this listing yet.</p>
            ) : (
              auditEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-orange-100 bg-orange-50/20 p-4 text-sm"
                >
                  <p className="font-medium text-foreground">{entry.action.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-muted-foreground">{formatDate(entry.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="border-orange-200/60 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>{listing.title}</CardTitle>
            <CardDescription>
              {categories[listing.category_id ?? ""] ?? "Uncategorized"} · {listing.location}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {listing.images.map((image, index) => (
                <div key={`${image}-${index}`} className="overflow-hidden rounded-2xl bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={`${listing.title} ${index + 1}`} className="h-64 w-full object-cover" src={image} />
                </div>
              ))}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Description</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {listing.description}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailCard label="Price / day" value={listing.price_per_day ? formatCurrency(listing.price_per_day) : "-"} />
              <DetailCard label="Deposit" value={formatCurrency(listing.deposit_amount)} />
              <DetailCard label="Stock" value={`${listing.quantity_available}/${listing.quantity_total}`} />
              <DetailCard label="Views" value={listing.views_count.toLocaleString()} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-orange-200/60 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle>Owner Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium text-foreground">{ownerName}</p>
              <p className="text-muted-foreground">{listing.owner.email}</p>
              <Button asChild className="w-full" variant="outline">
                <Link href={`/admin/users/${listing.owner.id}`}>Open Admin User Profile</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-orange-200/60 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
              <CardDescription>Latest stock movements and listing inventory state.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Available: <span className="font-medium text-foreground">{listing.quantity_available}</span>
              </p>
              <p>
                Reserved: <span className="font-medium text-foreground">{listing.quantity_reserved}</span>
              </p>
              <p>
                Total: <span className="font-medium text-foreground">{listing.quantity_total}</span>
              </p>
              {inventoryMovements.slice(0, 5).map((movement) => (
                <div
                  key={movement.id}
                  className="rounded-2xl border border-orange-100 bg-orange-50/20 p-3"
                >
                  <p className="font-medium capitalize text-foreground">
                    {movement.movement_type.replaceAll("_", " ")}
                  </p>
                  <p className="text-muted-foreground">
                    {movement.quantity_before} → {movement.quantity_after} ({movement.quantity_change})
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs className="space-y-6" defaultValue="reviews">
        <TabsList className="flex-wrap" variant="line">
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews">
          <Card className="border-orange-200/60 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle>Listing Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Hidden</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.length === 0 ? (
                    <TableRow>
                      <TableCell className="py-8 text-center text-muted-foreground" colSpan={5}>
                        No reviews for this listing yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reviews.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell>
                          {review.reviewer.display_name ||
                            review.reviewer.full_name ||
                            review.reviewer.email}
                        </TableCell>
                        <TableCell>{review.overall_rating.toFixed(1)}</TableCell>
                        <TableCell className="max-w-[420px] whitespace-normal">
                          {review.comment || "-"}
                        </TableCell>
                        <TableCell>{review.is_hidden ? "Yes" : "No"}</TableCell>
                        <TableCell>{formatDate(review.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings">
          <Card className="border-orange-200/60 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle>Booking History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking</TableHead>
                    <TableHead>Renter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.length === 0 ? (
                    <TableRow>
                      <TableCell className="py-8 text-center text-muted-foreground" colSpan={5}>
                        No bookings recorded for this listing yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>{booking.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          {booking.renter.display_name ||
                            booking.renter.full_name ||
                            booking.renter.email}
                        </TableCell>
                        <TableCell>{booking.status}</TableCell>
                        <TableCell>
                          {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                        </TableCell>
                        <TableCell>{formatCurrency(booking.total_price)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-orange-50/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
