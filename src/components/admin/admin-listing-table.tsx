"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, MoreHorizontal, OctagonX, ShieldAlert, ShieldOff } from "lucide-react";

import { moderateListing, unflagListing } from "@/actions/admin";
import { ListingModerateDialog } from "@/components/admin/listing-moderate-dialog";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ListingWithOwner } from "@/types";

type AdminListingTableProps = {
  listings: ListingWithOwner[];
  categories?: Record<string, string>;
  totalCount?: number;
  currentPage?: number;
  totalPages?: number;
};

const moderationTone: Record<string, string> = {
  approved: "bg-emerald-600 text-white hover:bg-emerald-600",
  pending: "bg-sky-600 text-white hover:bg-sky-600",
  rejected: "bg-red-600 text-white hover:bg-red-600",
  flagged: "bg-amber-500 text-black hover:bg-amber-500",
};

export function AdminListingTable({
  listings,
  categories = {},
  totalCount = listings.length,
  currentPage = 1,
  totalPages = 0,
}: AdminListingTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("search") ?? "");
  const [isPending, startTransition] = useTransition();
  const activeFilter = searchParams.get("filter") ?? "all";

  function updateParams(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleSearch() {
    updateParams((params) => {
      if (searchValue.trim()) {
        params.set("search", searchValue.trim());
      } else {
        params.delete("search");
      }
      params.delete("page");
    });
  }

  function handleFilter(value: string) {
    updateParams((params) => {
      if (value === "all") {
        params.delete("filter");
      } else {
        params.set("filter", value);
      }
      params.delete("page");
    });
  }

  function runAction(task: () => Promise<void>) {
    startTransition(async () => {
      await task();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 gap-2">
          <Input
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSearch();
              }
            }}
            placeholder="Search by listing title"
            value={searchValue}
          />
          <Button onClick={handleSearch} type="button" variant="outline">
            Search
          </Button>
        </div>

        <Tabs onValueChange={handleFilter} value={activeFilter}>
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto" variant="line">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending Review</TabsTrigger>
            <TabsTrigger value="flagged">Flagged</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-3xl border border-border/70 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price/day</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Moderation</TableHead>
              <TableHead>Flagged</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-center text-muted-foreground" colSpan={11}>
                  No listings matched the current filters.
                </TableCell>
              </TableRow>
            ) : (
              listings.map((listing) => {
                const ownerName =
                  listing.owner.display_name || listing.owner.full_name || listing.owner.email;

                return (
                  <TableRow key={listing.id}>
                    <TableCell>
                      <div className="size-14 overflow-hidden rounded-xl bg-muted">
                        {listing.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={listing.title}
                            className="h-full w-full object-cover"
                            src={listing.images[0]}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Link className="font-medium hover:underline" href={`/admin/listings/${listing.id}`}>
                        {listing.title}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Link
                        className="text-sm text-brand-sky hover:text-brand-navy hover:underline"
                        href={`/admin/users/${listing.owner.id}`}
                      >
                        {ownerName}
                      </Link>
                    </TableCell>
                    <TableCell>{categories[listing.category_id ?? ""] ?? "-"}</TableCell>
                    <TableCell>
                      {listing.price_per_day ? formatCurrency(listing.price_per_day) : "-"}
                    </TableCell>
                    <TableCell>
                      {listing.quantity_available}/{listing.quantity_total}
                    </TableCell>
                    <TableCell>
                      <Badge variant={listing.status === "active" ? "default" : "secondary"}>
                        {listing.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          moderationTone[listing.moderation_status] ??
                          "bg-muted text-foreground hover:bg-muted"
                        }
                      >
                        {listing.moderation_status}
                      </Badge>
                    </TableCell>
                    <TableCell>{listing.is_flagged ? "🚩" : "-"}</TableCell>
                    <TableCell>{formatDate(listing.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/listings/${listing.id}`}>View</Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <ListingModerateDialog
                            action="approve"
                            listing={listing}
                            onComplete={() => router.refresh()}
                            ownerName={ownerName}
                            trigger={
                              <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                                <CheckCircle2 className="size-4" />
                                Approve
                              </DropdownMenuItem>
                            }
                          />
                          <ListingModerateDialog
                            action="reject"
                            listing={listing}
                            onComplete={() => router.refresh()}
                            ownerName={ownerName}
                            trigger={
                              <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                                <OctagonX className="size-4" />
                                Reject
                              </DropdownMenuItem>
                            }
                          />
                          {listing.is_flagged ? (
                            <DropdownMenuItem
                              onClick={() =>
                                runAction(async () => {
                                  await unflagListing(listing.id);
                                })
                              }
                            >
                              <ShieldOff className="size-4" />
                              Unflag
                            </DropdownMenuItem>
                          ) : (
                            <ListingModerateDialog
                              action="flag"
                              listing={listing}
                              onComplete={() => router.refresh()}
                              ownerName={ownerName}
                              trigger={
                                <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                                  <ShieldAlert className="size-4" />
                                  Flag
                                </DropdownMenuItem>
                              }
                            />
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={isPending}
                            onClick={() =>
                              runAction(async () => {
                                await moderateListing(
                                  listing.id,
                                  "reject",
                                  "Archived by admin from listing moderation",
                                );
                              })
                            }
                          >
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {listings.length} of {totalCount.toLocaleString()} listings
        </p>
        <Pagination currentPage={currentPage} totalPages={totalPages} />
      </div>
    </div>
  );
}

