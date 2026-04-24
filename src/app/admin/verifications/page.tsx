import { format } from "date-fns";
import Link from "next/link";
import { FileCheck2, ShieldCheck, ShieldX } from "lucide-react";

import { approveVerification, getVerificationQueue } from "@/actions/verification";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DocumentViewerModalRoute } from "@/components/admin/document-viewer-modal-route";
import { VerificationDecisionDialog } from "@/components/admin/verification-decision-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInitials } from "@/lib/utils";
import type {
  AccountType,
  BusinessVerification,
  IndividualVerification,
  Profile,
  VerificationStatus,
} from "@/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type TabKey = "individual" | "business" | "approved" | "rejected";
type IndividualQueueRow = Profile & { verification: IndividualVerification };
type BusinessQueueRow = Profile & { verification: BusinessVerification };
type QueueRow = IndividualQueueRow | BusinessQueueRow;

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "individual", label: "Individual" },
  { key: "business", label: "Business" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getActiveTab(value?: string): TabKey {
  return tabs.some((tab) => tab.key === value) ? (value as TabKey) : "individual";
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  return format(new Date(value), "PPP");
}

function getDocumentHref(
  currentTab: TabKey,
  key: string,
  bucket: string,
  path: string,
  label: string,
) {
  const params = new URLSearchParams({
    tab: currentTab,
    doc_key: key,
    doc_bucket: bucket,
    doc_path: path,
    doc_label: label,
  });

  return `/admin/verifications?${params.toString()}`;
}

function getCloseHref(currentTab: TabKey) {
  return `/admin/verifications?tab=${currentTab}`;
}

function AccountTypeBadge({ accountType }: { accountType: AccountType }) {
  return (
    <Badge className="capitalize" variant="secondary">
      {accountType}
    </Badge>
  );
}

function IndividualVerificationCard({
  row,
  currentTab,
}: {
  row: IndividualQueueRow;
  currentTab: TabKey;
}) {
  const name = row.display_name || row.full_name || row.email;
  const v = row.verification;

  const documentRows = [
    {
      key: "gov-front",
      label: "Government ID Front",
      value: v.gov_id_front_url ? (
        <Button asChild size="sm" type="button" variant="outline">
          <Link
            href={getDocumentHref(
              currentTab,
              `${row.id}-gov-front`,
              "id-documents",
              v.gov_id_front_url,
              "Government ID Front",
            )}
          >
            View
          </Link>
        </Button>
      ) : (
        <span className="text-sm text-muted-foreground">Not submitted</span>
      ),
      field: "gov_id" as const,
    },
    {
      key: "gov-back",
      label: "Government ID Back",
      value: v.gov_id_back_url ? (
        <Button asChild size="sm" type="button" variant="outline">
          <Link
            href={getDocumentHref(
              currentTab,
              `${row.id}-gov-back`,
              "id-documents",
              v.gov_id_back_url,
              "Government ID Back",
            )}
          >
            View
          </Link>
        </Button>
      ) : (
        <span className="text-sm text-muted-foreground">Not submitted</span>
      ),
      field: "gov_id" as const,
    },
    {
      key: "selfie",
      label: "Selfie",
      value: v.selfie_url ? (
        <Button asChild size="sm" type="button" variant="outline">
          <Link
            href={getDocumentHref(
              currentTab,
              `${row.id}-selfie`,
              "selfie-photos",
              v.selfie_url,
              "Selfie",
            )}
          >
            View
          </Link>
        </Button>
      ) : (
        <span className="text-sm text-muted-foreground">Not submitted</span>
      ),
      field: "selfie" as const,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage alt={name ?? "User"} src={row.avatar_url ?? undefined} />
            <AvatarFallback>{getInitials(name ?? "User")}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg">{name}</CardTitle>
            <p className="text-sm text-muted-foreground">Email: {row.email}</p>
          </div>
        </div>
        <div className="space-y-2 text-right">
          <AccountTypeBadge accountType={row.account_type} />
          <p className="text-xs text-muted-foreground">
            Submitted: {formatDate(v.selfie_submitted_at ?? v.gov_id_submitted_at ?? v.created_at)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Documents to Review
          </p>
        </div>

        <div className="grid gap-3">
          {documentRows.map((item) => (
            <div
              className="flex flex-col gap-3 rounded-xl border border-border/70 p-3 md:flex-row md:items-center md:justify-between"
              key={item.key}
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">{item.label}</p>
                <div>{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border/70 pt-4">
          <p className="w-full text-sm font-medium">Overall Decision</p>
          <form
            action={
              approveVerification.bind(
                null,
                row.id,
                "individual",
              ) as unknown as (formData: FormData) => Promise<void>
            }
          >
            <Button type="submit">Approve All</Button>
          </form>
          <VerificationDecisionDialog
            accountType="individual"
            userId={row.id}
            userName={name ?? "User"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function BusinessVerificationCard({
  row,
  currentTab,
}: {
  row: BusinessQueueRow;
  currentTab: TabKey;
}) {
  const name = row.display_name || row.full_name || row.email;
  const v = row.verification;

  const documentRows = [
    {
      key: "business-document",
      label: "Business Document",
      value: v.business_document_url ? (
        <Button asChild size="sm" type="button" variant="outline">
          <Link
            href={getDocumentHref(
              currentTab,
              `${row.id}-business-document`,
              "business-documents",
              v.business_document_url,
              "Business Document",
            )}
          >
            View
          </Link>
        </Button>
      ) : (
        <span className="text-sm text-muted-foreground">Not submitted</span>
      ),
      field: "business_document" as const,
    },
    {
      key: "rep-id-front",
      label: "Rep Gov ID Front",
      value: v.rep_gov_id_front_url ? (
        <Button asChild size="sm" type="button" variant="outline">
          <Link
            href={getDocumentHref(
              currentTab,
              `${row.id}-rep-id-front`,
              "id-documents",
              v.rep_gov_id_front_url,
              "Representative ID Front",
            )}
          >
            View
          </Link>
        </Button>
      ) : (
        <span className="text-sm text-muted-foreground">Not submitted</span>
      ),
      field: "rep_gov_id" as const,
    },
    {
      key: "rep-id-back",
      label: "Rep Gov ID Back",
      value: v.rep_gov_id_back_url ? (
        <Button asChild size="sm" type="button" variant="outline">
          <Link
            href={getDocumentHref(
              currentTab,
              `${row.id}-rep-id-back`,
              "id-documents",
              v.rep_gov_id_back_url,
              "Representative ID Back",
            )}
          >
            View
          </Link>
        </Button>
      ) : (
        <span className="text-sm text-muted-foreground">Not submitted</span>
      ),
      field: "rep_gov_id" as const,
    },
    {
      key: "rep-selfie",
      label: "Rep Selfie",
      value: v.rep_selfie_url ? (
        <Button asChild size="sm" type="button" variant="outline">
          <Link
            href={getDocumentHref(
              currentTab,
              `${row.id}-rep-selfie`,
              "selfie-photos",
              v.rep_selfie_url,
              "Representative Selfie",
            )}
          >
            View
          </Link>
        </Button>
      ) : (
        <span className="text-sm text-muted-foreground">Not submitted</span>
      ),
      field: "rep_selfie" as const,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage alt={name ?? "Business"} src={row.avatar_url ?? undefined} />
            <AvatarFallback>{getInitials(name ?? "Business")}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg">{name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Rep: {row.full_name || row.display_name || row.email} | Email: {row.email}
            </p>
          </div>
        </div>
        <div className="space-y-2 text-right">
          <AccountTypeBadge accountType={row.account_type} />
          <p className="text-xs text-muted-foreground">
            Submitted: {formatDate(
              v.business_document_submitted_at ?? v.rep_selfie_submitted_at ?? v.created_at,
            )}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3 rounded-xl border border-border/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Business Info
          </p>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Address:</span>{" "}
              <span className="text-muted-foreground">{v.business_address ?? "Not provided"}</span>
            </p>
            <p className="text-sm">
              <span className="font-medium">TIN:</span>{" "}
              <span className="text-muted-foreground">{v.tin ?? "Not provided"}</span>
            </p>
            {v.business_phone ? (
              <p className="text-sm">
                <span className="font-medium">Phone:</span>{" "}
                <span className="text-muted-foreground">{v.business_phone} (optional)</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Documents to Review
          </p>
        </div>

        <div className="grid gap-3">
          {documentRows.map((item) => (
            <div
              className="flex flex-col gap-3 rounded-xl border border-border/70 p-3 md:flex-row md:items-center md:justify-between"
              key={item.key}
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">{item.label}</p>
                <div>{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border/70 pt-4">
          <p className="w-full text-sm font-medium">Overall Decision</p>
          <form
            action={
              approveVerification.bind(
                null,
                row.id,
                "business",
              ) as unknown as (formData: FormData) => Promise<void>
            }
          >
            <Button type="submit">Approve All</Button>
          </form>
          <VerificationDecisionDialog
            accountType="business"
            userId={row.id}
            userName={name ?? "Business"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CompletedVerificationCard({
  row,
  status,
}: {
  row: QueueRow;
  status: VerificationStatus;
}) {
  const name = row.display_name || row.full_name || row.email;
  const rejectionReason = row.verification.overall_rejection_reason;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage alt={name ?? "User"} src={row.avatar_url ?? undefined} />
            <AvatarFallback>{getInitials(name ?? "User")}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{name}</p>
            <p className="text-sm text-muted-foreground">{row.email}</p>
            <p className="text-xs text-muted-foreground">
              Reviewed {formatDate(row.verification.overall_approved_at ?? row.verification.updated_at)}
            </p>
          </div>
        </div>
        <div className="space-y-2 text-left md:text-right">
          <div className="flex items-center gap-2 md:justify-end">
            <AccountTypeBadge accountType={row.account_type} />
            <Badge variant={status === "approved" ? "secondary" : "destructive"}>
              {status}
            </Badge>
          </div>
          {rejectionReason ? (
            <p className="max-w-md text-sm text-muted-foreground">{rejectionReason}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

async function getVerificationRowsByStatus(status: "approved" | "rejected") {
  const admin = createAdminClient();

  const [individualResult, businessResult] = await Promise.all([
    admin
      .from("individual_verifications")
      .select("*, profile:profiles!individual_verifications_user_id_fkey(*)")
      .eq("overall_status", status),
    admin
      .from("business_verifications")
      .select("*, profile:profiles!business_verifications_user_id_fkey(*)")
      .eq("overall_status", status),
  ]);

  if (individualResult.error) {
    throw individualResult.error;
  }
  if (businessResult.error) {
    throw businessResult.error;
  }

  const individualRows = (individualResult.data ?? []).flatMap((row) => {
    const record = row as IndividualVerification & { profile: Profile | Profile[] | null };
    const profile = Array.isArray(record.profile) ? record.profile[0] : record.profile;
    return profile ? [{ ...profile, verification: record } satisfies IndividualQueueRow] : [];
  });

  const businessRows = (businessResult.data ?? []).flatMap((row) => {
    const record = row as BusinessVerification & { profile: Profile | Profile[] | null };
    const profile = Array.isArray(record.profile) ? record.profile[0] : record.profile;
    return profile ? [{ ...profile, verification: record } satisfies BusinessQueueRow] : [];
  });

  return [...individualRows, ...businessRows].sort((a, b) =>
    new Date(b.verification.updated_at).getTime() -
    new Date(a.verification.updated_at).getTime(),
  );
}

async function getSignedDocumentUrl(bucket?: string, path?: string) {
  if (!bucket || !path) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeTab = getActiveTab(getSingleValue(resolvedSearchParams.tab));

  const [individualQueue, businessQueue, approvedRows, rejectedRows] = await Promise.all([
    getVerificationQueue("individual"),
    getVerificationQueue("business"),
    getVerificationRowsByStatus("approved"),
    getVerificationRowsByStatus("rejected"),
  ]);

  const pendingIndividual = individualQueue.pending as IndividualQueueRow[];
  const pendingBusiness = businessQueue.pending as BusinessQueueRow[];

  const currentRows =
    activeTab === "individual"
      ? pendingIndividual
      : activeTab === "business"
        ? pendingBusiness
        : activeTab === "approved"
          ? approvedRows
          : rejectedRows;

  const docBucket = getSingleValue(resolvedSearchParams.doc_bucket);
  const docPath = getSingleValue(resolvedSearchParams.doc_path);
  const docLabel = getSingleValue(resolvedSearchParams.doc_label);
  const signedUrl = await getSignedDocumentUrl(docBucket, docPath);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        description="Review listing verification submissions, approve valid accounts, and send clear resubmission feedback."
        title="Verification Queue"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Pending Individual</p>
            <p className="mt-2 text-3xl font-semibold">{pendingIndividual.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Pending Business</p>
            <p className="mt-2 text-3xl font-semibold">{pendingBusiness.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Pending</p>
            <p className="mt-2 text-3xl font-semibold">
              {pendingIndividual.length + pendingBusiness.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-background p-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            asChild
            className={activeTab === tab.key ? "bg-brand-navy text-white hover:bg-brand-steel" : ""}
            size="sm"
            variant={activeTab === tab.key ? "default" : "ghost"}
          >
            <Link href={`/admin/verifications?tab=${tab.key}`}>{tab.label}</Link>
          </Button>
        ))}
      </div>

      {currentRows.length === 0 ? (
        <EmptyState
          description={
            activeTab === "approved"
              ? "No approved verifications yet."
              : activeTab === "rejected"
                ? "No rejected verifications yet."
                : "No pending verification submissions in this queue."
          }
          icon={activeTab === "rejected" ? ShieldX : activeTab === "approved" ? ShieldCheck : FileCheck2}
          title="Nothing to review"
        />
      ) : (
        <div className="space-y-4">
          {activeTab === "individual"
            ? pendingIndividual.map((row) => (
                <IndividualVerificationCard currentTab={activeTab} key={row.id} row={row} />
              ))
            : activeTab === "business"
              ? pendingBusiness.map((row) => (
                  <BusinessVerificationCard currentTab={activeTab} key={row.id} row={row} />
                ))
              : (currentRows as QueueRow[]).map((row) => (
                  <CompletedVerificationCard
                    key={`${activeTab}-${row.id}`}
                    row={row}
                    status={activeTab}
                  />
                ))}
        </div>
      )}

      {signedUrl && docLabel ? (
        <DocumentViewerModalRoute
          closeHref={getCloseHref(activeTab)}
          documentType={docLabel}
          signedUrl={signedUrl}
        />
      ) : null}
    </div>
  );
}
