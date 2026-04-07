import Link from "next/link";
import { notFound } from "next/navigation";

import { getAdminUserDetail } from "@/actions/admin";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminUserDetailActions } from "@/components/admin/admin-user-detail-actions";
import { PayoutDetailsDisplay } from "@/components/payout/payout-details-display";
import { PayoutMethodBadge } from "@/components/payout/payout-method-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";

function statusBadgeClass(active: boolean) {
  return active
    ? "bg-emerald-600 text-white hover:bg-emerald-600"
    : "bg-red-600 text-white hover:bg-red-600";
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let detail;
  try {
    detail = await getAdminUserDetail(id);
  } catch {
    notFound();
  }

  const { profile, listings, bookings, reviews, reports, payouts } = detail;
  const displayName = profile.display_name || profile.full_name || profile.email;
  const receivedReviews = reviews.filter((review) => review.reviewee_id === profile.id);
  const writtenReviews = reviews.filter((review) => review.reviewer_id === profile.id);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="User Detail"
        description="Inspect this account, review platform activity, and apply moderation controls when needed."
        action={
          <ButtonLink href="/admin/users" label="Back to users" />
        }
      />

      <Card className="border-border/70 bg-white shadow-sm">
        <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <Avatar className="size-20" size="lg">
              {profile.avatar_url ? (
                <AvatarImage alt={displayName} src={profile.avatar_url} />
              ) : null}
              <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 space-y-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {displayName}
                  </h1>
                  <Badge variant="secondary">
                    {profile.account_type === "business" ? "Business" : "Individual"}
                  </Badge>
                  <Badge className={statusBadgeClass(!profile.is_suspended)}>
                    {profile.is_suspended ? "Suspended" : "Active"}
                  </Badge>
                  {profile.is_admin ? (
                    <Badge className="bg-brand-sky text-brand-dark hover:bg-brand-sky">
                      Admin
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>

              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Member since:</span>{" "}
                  {formatDate(profile.created_at)}
                </div>
                <div>
                  <span className="font-medium text-foreground">Verification:</span>{" "}
                  {profile.verification_status}
                </div>
                <div>
                  <span className="font-medium text-foreground">Response rate:</span>{" "}
                  {profile.response_rate}%
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-brand-navy/10 bg-brand-light p-4 text-sm text-muted-foreground lg:w-[360px]">
            {profile.is_suspended ? (
              <p>
                Suspended reason: {profile.suspended_reason ?? "No reason recorded"}
              </p>
            ) : (
              <p>No active suspension on this account.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Admin Actions</CardTitle>
          <CardDescription>Moderate this account and keep internal notes in sync.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminUserDetailActions user={profile} />
        </CardContent>
      </Card>

      <Tabs className="space-y-6" defaultValue="overview">
        <TabsList className="flex-wrap" variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/70 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Profile Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow label="Full name" value={profile.full_name || "-"} />
                <DetailRow label="Display name" value={profile.display_name || "-"} />
                <DetailRow label="Phone" value={profile.phone || "-"} />
                <DetailRow label="Location" value={profile.location || "-"} />
                <DetailRow label="Business name" value={profile.business_name || "-"} />
                <DetailRow label="Website" value={profile.website_url || "-"} />
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Trust & Reputation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow
                  label="Verification status"
                  value={profile.verification_status}
                />
                <DetailRow label="ID verified" value={profile.id_verified ? "Yes" : "No"} />
                <DetailRow
                  label="Email verified"
                  value={profile.email_verified ? "Yes" : "No"}
                />
                <DetailRow
                  label="Phone verified"
                  value={profile.phone_verified ? "Yes" : "No"}
                />
                <DetailRow
                  label="Lister rating"
                  value={`${profile.rating_as_lister.toFixed(1)} (${profile.total_reviews_as_lister} reviews)`}
                />
                <DetailRow
                  label="Renter rating"
                  value={`${profile.rating_as_renter.toFixed(1)} (${profile.total_reviews_as_renter} reviews)`}
                />
                <DetailRow
                  label="Response time"
                  value={`${profile.response_time_hours} hour(s)`}
                />
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-white shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle>Payout Information</CardTitle>
                <CardDescription>
                  Review the user&apos;s active payout destination and KYC status.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.payout_method ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <PayoutMethodBadge method={profile.payout_method} />
                      {profile.payout_setup_completed ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          Ready for payouts
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                          Setup incomplete
                        </Badge>
                      )}
                    </div>

                    <PayoutDetailsDisplay
                      masked={false}
                      payoutDetails={{
                        method: profile.payout_method,
                        bank_name: profile.bank_name ?? undefined,
                        bank_account_name: profile.bank_account_name ?? undefined,
                        bank_account_number: profile.bank_account_number ?? undefined,
                        bank_kyc_verified: profile.bank_kyc_verified ?? undefined,
                        gcash_phone_number: profile.gcash_phone_number ?? undefined,
                        maya_phone_number: profile.maya_phone_number ?? undefined,
                      }}
                      showCopyButtons
                    />

                    {profile.payout_method === "bank" ? (
                      <div className="rounded-2xl border border-brand-navy/10 bg-brand-light p-4 text-sm">
                        {profile.bank_kyc_verified ? (
                          <div className="space-y-2">
                            <p className="font-medium text-foreground">KYC verified</p>
                            <p className="text-muted-foreground">
                              Verified on {profile.bank_kyc_verified_at ? formatDate(profile.bank_kyc_verified_at) : "Unknown date"}
                            </p>
                            {profile.bank_kyc_document_url ? (
                              <ButtonLink
                                external
                                href={profile.bank_kyc_document_url}
                                label="View KYC Document"
                              />
                            ) : null}
                          </div>
                        ) : profile.bank_kyc_document_url ? (
                          <div className="space-y-3">
                            <p className="font-medium text-foreground">KYC pending review</p>
                            <div className="flex flex-wrap gap-2">
                              <ButtonLink
                                external
                                href={profile.bank_kyc_document_url}
                                label="View KYC Document"
                              />
                              <ButtonLink
                                href="/admin/kyc-verification"
                                label="Review KYC"
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No KYC submitted</p>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No payout method configured.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="listings">
          <DataTableCard
            description="All listings owned by this user, including paused and archived records."
            emptyMessage="No listings found for this user."
            hasData={listings.length > 0}
            title="Listings"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Moderation</TableHead>
                  <TableHead>Flagged</TableHead>
                  <TableHead>Price / day</TableHead>
                  <TableHead>Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((listing) => (
                  <TableRow key={listing.id}>
                    <TableCell className="whitespace-normal">
                      <Link className="font-medium hover:underline" href={`/listings/${listing.id}`}>
                        {listing.title}
                      </Link>
                    </TableCell>
                    <TableCell>{listing.status}</TableCell>
                    <TableCell>{listing.moderation_status}</TableCell>
                    <TableCell>{listing.is_flagged ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      {listing.price_per_day ? formatCurrency(listing.price_per_day) : "-"}
                    </TableCell>
                    <TableCell>{listing.quantity_total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableCard>
        </TabsContent>

        <TabsContent value="bookings">
          <DataTableCard
            description="Bookings where this user participated as either renter or lister."
            emptyMessage="No bookings found for this user."
            hasData={bookings.length > 0}
            title="Bookings"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>{booking.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      {booking.renter_id === profile.id ? "Renter" : "Lister"}
                    </TableCell>
                    <TableCell>{booking.status}</TableCell>
                    <TableCell>{formatDate(booking.start_date)}</TableCell>
                    <TableCell>{formatDate(booking.end_date)}</TableCell>
                    <TableCell>{formatCurrency(booking.total_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableCard>
        </TabsContent>

        <TabsContent value="reviews">
          <div className="grid gap-6 xl:grid-cols-2">
            <DataTableCard
              description="Reviews written about this user."
              emptyMessage="No reviews received."
              hasData={receivedReviews.length > 0}
              title="Received Reviews"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rating</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Hidden</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivedReviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>{review.overall_rating.toFixed(1)}</TableCell>
                      <TableCell>{review.review_role}</TableCell>
                      <TableCell className="max-w-[320px] whitespace-normal">
                        {review.comment || "-"}
                      </TableCell>
                      <TableCell>{review.is_hidden ? "Yes" : "No"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTableCard>

            <DataTableCard
              description="Reviews this user left for others."
              emptyMessage="No reviews written."
              hasData={writtenReviews.length > 0}
              title="Written Reviews"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rating</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {writtenReviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>{review.overall_rating.toFixed(1)}</TableCell>
                      <TableCell>{review.review_role}</TableCell>
                      <TableCell className="max-w-[320px] whitespace-normal">
                        {review.comment || "-"}
                      </TableCell>
                      <TableCell>{formatDate(review.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTableCard>
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <DataTableCard
            description="Reports involving this user as either reporter or reported party."
            emptyMessage="No reports found."
            hasData={reports.length > 0}
            title="Reports"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{report.report_type}</TableCell>
                    <TableCell>{report.status}</TableCell>
                    <TableCell>
                      {report.reporter_id === profile.id ? "Reporter" : "Reported user"}
                    </TableCell>
                    <TableCell className="max-w-[360px] whitespace-normal">
                      {report.description}
                    </TableCell>
                    <TableCell>{formatDate(report.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableCard>
        </TabsContent>

        <TabsContent value="payouts">
          <DataTableCard
            description="Payout history for this user as a lister."
            emptyMessage="No payouts found."
            hasData={payouts.length > 0}
            title="Payouts"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>{formatDate(payout.created_at)}</TableCell>
                    <TableCell>{payout.status}</TableCell>
                    <TableCell>{formatCurrency(payout.amount, payout.currency)}</TableCell>
                    <TableCell>
                      {profile.payout_method ? (
                        <div className="space-y-2">
                          <PayoutMethodBadge method={profile.payout_method} size="sm" />
                          <PayoutDetailsDisplay
                            className="md:grid-cols-1"
                            masked
                            payoutDetails={{
                              method: profile.payout_method,
                              bank_name: profile.bank_name ?? undefined,
                              bank_account_name: profile.bank_account_name ?? undefined,
                              bank_account_number: profile.bank_account_number ?? undefined,
                              gcash_phone_number: profile.gcash_phone_number ?? undefined,
                              maya_phone_number: profile.maya_phone_number ?? undefined,
                            }}
                          />
                        </div>
                      ) : (
                        payout.payout_method || "-"
                      )}
                    </TableCell>
                    <TableCell>{payout.reference_number || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brand-navy/10 pb-3 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function DataTableCard({
  children,
  title,
  description,
  emptyMessage,
  hasData,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  emptyMessage: string;
  hasData: boolean;
}) {
  return (
    <Card className="border-border/70 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? children : <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
      </CardContent>
    </Card>
  );
}

function ButtonLink({
  href,
  label,
  external = false,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <Link
      className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-medium text-brand-navy shadow-xs transition-colors hover:bg-brand-light"
      href={href}
      rel={external ? "noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {label}
    </Link>
  );
}

