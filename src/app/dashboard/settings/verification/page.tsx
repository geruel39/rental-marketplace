import {
  Building2,
  Camera,
  CheckCircle2,
  CircleAlert,
  FileBadge2,
  FileText,
  ShieldCheck,
  UserSquare2,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getBusinessVerification,
  getBusinessVerificationSteps,
  getIndividualVerification,
  getIndividualVerificationSteps,
  submitBusinessDetails,
  submitBusinessDocument,
  submitRepresentativeID,
  submitRepresentativeSelfie,
} from "@/actions/verification";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type {
  BusinessDocumentType,
  BusinessVerification,
  GovernmentIDType,
  Profile,
  VerificationStep,
} from "@/types";

const governmentIdOptions: Array<{ value: GovernmentIDType; label: string }> = [
  { value: "national_id", label: "National ID" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "passport", label: "Passport" },
  { value: "voter_id", label: "Voter ID" },
];

const businessDocumentOptions: Array<{ value: BusinessDocumentType; label: string }> = [
  { value: "dti_certificate", label: "DTI Certificate" },
  { value: "sec_registration", label: "SEC Registration" },
  { value: "mayors_permit", label: "Mayor's Permit" },
  { value: "bir_certificate", label: "BIR Certificate" },
  { value: "business_permit", label: "Business Permit" },
  { value: "other", label: "Other" },
];

function getStepStatusLabel(step: VerificationStep["status"]) {
  switch (step) {
    case "complete":
      return "Complete";
    case "pending":
      return "Pending";
    case "rejected":
      return "Needs update";
    default:
      return "Not started";
  }
}

function getStepStatusClass(step: VerificationStep["status"]) {
  switch (step) {
    case "complete":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function getStepAnchor(stepKey: VerificationStep["key"]) {
  switch (stepKey) {
    case "gov_id":
      return "government-id";
    case "selfie":
      return "selfie-photo";
    case "business_details":
      return "business-information";
    case "business_document":
      return "business-document";
    case "rep_gov_id":
      return "representative-id";
    case "rep_selfie":
      return "representative-selfie";
    default:
      return undefined;
  }
}

function renderStepCards(steps: VerificationStep[]) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {steps.map((step, index) => (
        <div
          key={step.key}
          id={getStepAnchor(step.key)}
          className="rounded-3xl border border-border bg-background p-5 shadow-sm"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Step {index + 1}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{step.label}</h2>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${getStepStatusClass(step.status)}`}
            >
              {getStepStatusLabel(step.status)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{step.description}</p>
          {step.actionUrl ? (
            <div className="mt-4">
              <Link
                href={step.actionUrl}
                className="text-sm font-medium text-foreground underline underline-offset-4"
              >
                {step.actionLabel ?? "Open"}
              </Link>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function renderSectionBadge(complete: boolean) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        complete
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      {complete ? "Complete" : "Required"}
    </span>
  );
}

function renderBusinessStatusBanner(verification: BusinessVerification) {
  if (verification.overall_status === "pending") {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        <p className="font-semibold">Documents submitted and under review</p>
        <p className="mt-1">
          Our team will review your business verification within 1-3 business days.
        </p>
      </div>
    );
  }

  if (verification.overall_status === "approved") {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        <p className="font-semibold">Business verification approved</p>
        <p className="mt-1">Your account is ready to create listings.</p>
      </div>
    );
  }

  if (verification.overall_status === "rejected" && verification.overall_rejection_reason) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
        <p className="font-semibold">Verification needs updates</p>
        <p className="mt-1">{verification.overall_rejection_reason}</p>
      </div>
    );
  }

  return null;
}

export default async function VerificationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile) {
    redirect("/dashboard/settings");
  }

  if (profile.account_type === "business") {
    const [verification, steps] = await Promise.all([
      getBusinessVerification(user.id),
      getBusinessVerificationSteps(user.id),
    ]);

    const submitBusinessDetailsAction = submitBusinessDetails.bind(null, null);
    const submitBusinessDocumentAction = submitBusinessDocument.bind(null, null);
    const submitRepresentativeIDAction = submitRepresentativeID.bind(null, null);
    const submitRepresentativeSelfieAction = submitRepresentativeSelfie.bind(null, null);

    if (!verification) {
      redirect("/dashboard/settings");
    }

    const businessInfoComplete = Boolean(verification.business_address && verification.tin);
    const businessDocumentComplete = Boolean(verification.business_document_url);
    const representativeIdComplete = Boolean(
      verification.rep_gov_id_front_url && verification.rep_gov_id_back_url,
    );
    const representativeSelfieComplete = Boolean(verification.rep_selfie_url);

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Business Verification</h1>
          <p className="text-sm text-muted-foreground">
            Submit your business information and supporting documents for admin review.
          </p>
        </div>

        {renderBusinessStatusBanner(verification)}

        {renderStepCards(steps)}

        <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <details className="rounded-2xl border border-border bg-muted/50 p-4" open>
            <summary className="cursor-pointer text-sm font-medium">
              Why do we need this?
            </summary>
            <div className="mt-3 space-y-3 text-sm text-muted-foreground">
              <p>
                Business verification confirms your company is legitimately registered
                and operating. We require:
              </p>
              <ul className="space-y-2">
                <li>• Business address and TIN for identification</li>
                <li>• Registration documents to confirm legal status</li>
                <li>• Representative ID and selfie for accountability</li>
              </ul>
              <p>This builds trust with renters and protects all parties.</p>
            </div>
          </details>
        </div>

        <section
          id="business-information"
          className="rounded-3xl border border-border bg-background p-6 shadow-sm"
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="size-4" />
                Section 1
              </p>
              <h2 className="text-xl font-semibold">Business Information</h2>
              <p className="text-sm text-muted-foreground">
                Business address and TIN are required. Business phone is optional.
              </p>
            </div>
            {renderSectionBadge(businessInfoComplete)}
          </div>

          <form action={submitBusinessDetailsAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="business_phone" className="text-sm font-medium">
                Business Phone (Optional)
              </label>
              <input
                id="business_phone"
                name="business_phone"
                type="tel"
                defaultValue={verification.business_phone ?? ""}
                placeholder="0917XXXXXXX"
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="business_address" className="text-sm font-medium">
                Business Address
              </label>
              <textarea
                id="business_address"
                name="business_address"
                required
                defaultValue={verification.business_address ?? ""}
                placeholder="Enter your complete registered business address"
                className="min-h-28 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="tin" className="text-sm font-medium">
                TIN
              </label>
              <input
                id="tin"
                name="tin"
                type="text"
                required
                pattern="\d{3}-\d{3}-\d{3}-\d{3}"
                defaultValue={verification.tin ?? ""}
                placeholder="123-456-789-000"
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">Format: XXX-XXX-XXX-XXX</p>
            </div>

            <Button type="submit">Save Business Information</Button>
          </form>
        </section>

        <section
          id="business-document"
          className="rounded-3xl border border-border bg-background p-6 shadow-sm"
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="size-4" />
                Section 2
              </p>
              <h2 className="text-xl font-semibold">Business Registration Document</h2>
              <p className="text-sm text-muted-foreground">
                Upload your DTI, SEC, mayor&apos;s permit, or other valid registration file.
              </p>
            </div>
            {renderSectionBadge(businessDocumentComplete)}
          </div>

          <form action={submitBusinessDocumentAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="business_document_type" className="text-sm font-medium">
                Document Type
              </label>
              <select
                id="business_document_type"
                name="business_document_type"
                required
                defaultValue={verification.business_document_type ?? ""}
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>
                  Select a document type
                </option>
                {businessDocumentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="document" className="text-sm font-medium">
                Upload Document
              </label>
              <input
                id="document"
                name="document"
                type="file"
                required
                accept=".pdf,image/jpeg,image/jpg,image/png,image/webp"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground"
              />
            </div>

            <Button type="submit">Upload Business Document</Button>
          </form>
        </section>

        <section
          id="representative-id"
          className="rounded-3xl border border-border bg-background p-6 shadow-sm"
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileBadge2 className="size-4" />
                Section 3
              </p>
              <h2 className="text-xl font-semibold">Representative Government ID</h2>
              <p className="text-sm text-muted-foreground">
                Upload front and back photos of the representative&apos;s government-issued ID.
              </p>
            </div>
            {renderSectionBadge(representativeIdComplete)}
          </div>

          <form action={submitRepresentativeIDAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="rep_gov_id_type" className="text-sm font-medium">
                ID Type
              </label>
              <select
                id="rep_gov_id_type"
                name="rep_gov_id_type"
                required
                defaultValue={verification.rep_gov_id_type ?? ""}
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>
                  Select an ID type
                </option>
                {governmentIdOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="front_photo" className="text-sm font-medium">
                  Front Photo
                </label>
                <input
                  id="front_photo"
                  name="front_photo"
                  type="file"
                  required
                  accept=".pdf,image/jpeg,image/jpg,image/png,image/webp"
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="back_photo" className="text-sm font-medium">
                  Back Photo
                </label>
                <input
                  id="back_photo"
                  name="back_photo"
                  type="file"
                  required
                  accept=".pdf,image/jpeg,image/jpg,image/png,image/webp"
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground"
                />
              </div>
            </div>

            <Button type="submit">Upload Representative ID</Button>
          </form>
        </section>

        <section
          id="representative-selfie"
          className="rounded-3xl border border-border bg-background p-6 shadow-sm"
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Camera className="size-4" />
                Section 4
              </p>
              <h2 className="text-xl font-semibold">Representative Selfie</h2>
              <p className="text-sm text-muted-foreground">
                Upload a current selfie of the representative for identity matching.
              </p>
            </div>
            {renderSectionBadge(representativeSelfieComplete)}
          </div>

          <form action={submitRepresentativeSelfieAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="selfie" className="text-sm font-medium">
                Selfie Upload
              </label>
              <input
                id="selfie"
                name="selfie"
                type="file"
                required
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground"
              />
            </div>

            <Button type="submit">Upload Representative Selfie</Button>
          </form>
        </section>
      </div>
    );
  }

  const [verification, steps] = await Promise.all([
    getIndividualVerification(user.id),
    getIndividualVerificationSteps(user.id),
  ]);

  if (!verification) {
    redirect("/dashboard/settings");
  }

  const documentsSubmitted = Number(
    Boolean(verification.gov_id_front_url && verification.gov_id_back_url),
  ) + Number(Boolean(verification.selfie_url));
  const missingDocuments: string[] = [];

  if (!(verification.gov_id_front_url && verification.gov_id_back_url)) {
    missingDocuments.push("Government ID (front and back photos)");
  }

  if (!verification.selfie_url) {
    missingDocuments.push("Selfie photo");
  }

  const progressValue = (documentsSubmitted / 2) * 100;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Verification</h1>
        <p className="text-sm text-muted-foreground">
          Complete your identity check before creating listings.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="size-4" />
              Individual Verification
            </p>
            <h2 className="text-xl font-semibold">3-step identity review</h2>
            <p className="text-sm text-muted-foreground">
              {documentsSubmitted} of 2 documents submitted
            </p>
          </div>
          <div className="w-full max-w-sm">
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {renderStepCards(steps)}

      {verification.overall_status === "incomplete" ? (
        <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-5 text-amber-600" />
            <div className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Documents still needed</h2>
                <p className="text-sm text-muted-foreground">
                  Submit the remaining documents to start admin review.
                </p>
              </div>

              <ul className="space-y-2 text-sm">
                {missingDocuments.map((document) => (
                  <li key={document} className="rounded-2xl bg-muted px-4 py-3">
                    {document}
                  </li>
                ))}
              </ul>

              <details className="rounded-2xl border border-border bg-muted/50 p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Why do we need this?
                </summary>
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <p>
                    Identity verification helps us maintain a safe and trustworthy
                    marketplace for everyone. We require:
                  </p>
                  <ul className="space-y-2">
                    <li>• Government-issued ID to confirm your identity</li>
                    <li>• A selfie to match your ID photo</li>
                  </ul>
                  <p>
                    Your documents are stored securely and only reviewed by our admin
                    team. This is a one-time process.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </div>
      ) : null}

      {verification.overall_status === "pending" ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="flex items-start gap-3 text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-5" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Documents submitted - under review</h2>
              <p className="text-sm">
                Our team will review your documents within 1-3 business days.
                You&apos;ll receive a notification once approved.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {verification.overall_status === "approved" ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-emerald-800">
              <CheckCircle2 className="mt-0.5 size-5" />
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">
                  Identity Verified - You can create listings!
                </h2>
                <p className="text-sm">
                  Your identity verification is complete and your account is ready to
                  publish listings.
                </p>
              </div>
            </div>
            <Button asChild>
              <Link href="/lister/listings/new">Create First Listing</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {verification.overall_status === "rejected" && verification.overall_rejection_reason ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <div className="flex items-start gap-3 text-rose-800">
            <UserSquare2 className="mt-0.5 size-5" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Verification needs updates</h2>
              <p className="text-sm">{verification.overall_rejection_reason}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
