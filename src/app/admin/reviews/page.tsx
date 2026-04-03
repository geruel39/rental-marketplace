import { getAdminReviews } from "@/actions/admin";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminReviewTable } from "@/components/admin/admin-review-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const flagged = getSingleValue(resolvedSearchParams.flagged) === "true" ? true : undefined;
  const hidden = getSingleValue(resolvedSearchParams.hidden) === "true" ? true : undefined;
  const page = getPage(getSingleValue(resolvedSearchParams.page));

  const [reviewsResult, total, flaggedCount, hiddenCount] = await Promise.all([
    getAdminReviews({ flagged, hidden, page }),
    getAdminReviews({ perPage: 1 }),
    getAdminReviews({ flagged: true, perPage: 1 }),
    getAdminReviews({ hidden: true, perPage: 1 }),
  ]);

  const stats = [
    { label: "Total", value: total.totalCount },
    { label: "Flagged", value: flaggedCount.totalCount },
    { label: "Hidden", value: hiddenCount.totalCount },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reviews"
        description="Moderate community feedback, hide harmful content, and keep trust signals accurate."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border/70 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {stat.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AdminReviewTable
        currentPage={reviewsResult.currentPage}
        reviews={reviewsResult.data}
        totalPages={reviewsResult.totalPages}
      />
    </div>
  );
}

