"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { flagReview, hideReview, unflagReview, unhideReview } from "@/actions/admin";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StarRating } from "@/components/reviews/star-rating";
import { formatDate } from "@/lib/utils";
import type { ReviewWithUsers } from "@/types";

export function AdminReviewTable({
  reviews,
  currentPage,
  totalPages,
}: {
  reviews: ReviewWithUsers[];
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
      params.delete("flagged");
      params.delete("hidden");
      params.delete("filter");
    } else if (filter === "flagged") {
      params.set("flagged", "true");
      params.delete("hidden");
      params.set("filter", filter);
    } else {
      params.set("hidden", "true");
      params.delete("flagged");
      params.set("filter", filter);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  async function runAction(task: () => Promise<void>) {
    await task();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-white p-2">
        {["all", "flagged", "hidden"].map((filter) => (
          <Button
            key={filter}
            onClick={() => updateFilter(filter)}
            size="sm"
            type="button"
            variant={activeFilter === filter ? "default" : "ghost"}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </Button>
        ))}
      </div>

      <div className="rounded-3xl border border-border/70 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reviewer</TableHead>
              <TableHead>Reviewee</TableHead>
              <TableHead>Listing</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Flagged</TableHead>
              <TableHead>Hidden</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-center text-muted-foreground" colSpan={10}>
                  No reviews matched this filter.
                </TableCell>
              </TableRow>
            ) : (
              reviews.map((review) => (
                <TableRow key={review.id}>
                  <TableCell>{formatDate(review.created_at)}</TableCell>
                  <TableCell>{review.reviewer.display_name || review.reviewer.full_name || review.reviewer.email}</TableCell>
                  <TableCell>{review.reviewee.display_name || review.reviewee.full_name || review.reviewee.email}</TableCell>
                  <TableCell className="whitespace-normal">{review.listing?.title || "-"}</TableCell>
                  <TableCell><StarRating readOnly size="sm" value={review.overall_rating} /></TableCell>
                  <TableCell>{review.review_role}</TableCell>
                  <TableCell>{review.is_flagged ? "🚩" : "-"}</TableCell>
                  <TableCell>{review.is_hidden ? "Yes" : "No"}</TableCell>
                  <TableCell className="max-w-[260px] whitespace-normal text-muted-foreground">
                    {review.comment?.slice(0, 100) || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/reviews?focus=${review.id}`}>View</Link>
                      </Button>
                      {review.is_hidden ? (
                        <Button
                          onClick={() => void runAction(async () => { await unhideReview(review.id); })}
                          size="sm"
                          variant="outline"
                        >
                          Unhide
                        </Button>
                      ) : (
                        <Button
                          onClick={() => void runAction(async () => { await hideReview(review.id, "Hidden by admin"); })}
                          size="sm"
                          variant="outline"
                        >
                          Hide
                        </Button>
                      )}
                      {review.is_flagged ? (
                        <Button
                          onClick={() => void runAction(async () => { await unflagReview(review.id); })}
                          size="sm"
                          variant="outline"
                        >
                          Unflag
                        </Button>
                      ) : (
                        <Button
                          onClick={() => void runAction(async () => { await flagReview(review.id, "Flagged by admin"); })}
                          size="sm"
                          variant="outline"
                        >
                          Flag
                        </Button>
                      )}
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

