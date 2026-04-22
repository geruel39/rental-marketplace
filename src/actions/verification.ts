"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createNotification } from "@/actions/notifications";
import { getAdminIds, sendNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  businessVerificationSchema,
  individualVerificationSchema,
} from "@/lib/validations";
import type {
  AccountType,
  ActionResponse,
  AdminTargetType,
  BusinessVerification,
  IndividualVerification,
  ListingEligibility,
  Profile,
  VerificationStep,
} from "@/types";

const MAX_INDIVIDUAL_FILE_BYTES = 10 * 1024 * 1024;
const MAX_BUSINESS_DOCUMENT_BYTES = 15 * 1024 * 1024;
const INDIVIDUAL_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const SELFIE_FILE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const businessDetailsSchema = businessVerificationSchema.pick({
  business_phone: true,
  business_address: true,
  tin: true,
});
const businessDocumentTypeSchema = businessVerificationSchema.pick({
  business_document_type: true,
});
const representativeIdTypeSchema = businessVerificationSchema.pick({
  rep_gov_id_type: true,
});

type AuthenticatedProfile = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: NonNullable<
    Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]>>["data"]["user"]
  >;
  profile: Profile;
};

type VerificationQueueRow =
  | (Profile & { verification: IndividualVerification })
  | (Profile & { verification: BusinessVerification });

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function getFileExtension(file: File): string {
  const sanitizedName = sanitizeFilename(file.name);
  const extension = sanitizedName.split(".").pop()?.toLowerCase();

  if (extension && extension !== sanitizedName.toLowerCase()) {
    return extension;
  }

  if (file.type === "application/pdf") {
    return "pdf";
  }

  if (file.type.includes("png")) {
    return "png";
  }

  if (file.type.includes("webp")) {
    return "webp";
  }

  return "jpg";
}

function getRequestIp(
  headerStore: Awaited<ReturnType<typeof headers>>,
): string | null {
  const forwardedFor = headerStore.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return (
    headerStore.get("x-real-ip") ??
    headerStore.get("cf-connecting-ip") ??
    null
  );
}

function getUserDisplayName(profile: Pick<Profile, "display_name" | "full_name" | "email">) {
  return profile.display_name || profile.full_name || profile.email;
}

function revalidateVerificationViews() {
  revalidatePath("/dashboard/settings/verification");
  revalidatePath("/dashboard/settings");
  revalidatePath("/listings/new");
  revalidatePath("/admin/kyc-verification");
}

function defaultIndividualVerification(userId: string, emailVerified = false): IndividualVerification {
  const now = new Date().toISOString();

  return {
    id: userId,
    user_id: userId,
    email_verified: emailVerified,
    email_verified_at: undefined,
    phone_number: undefined,
    phone_verified: false,
    phone_verified_at: undefined,
    gov_id_document_type: undefined,
    gov_id_front_url: undefined,
    gov_id_back_url: undefined,
    gov_id_submitted_at: undefined,
    gov_id_verified: false,
    gov_id_verified_at: undefined,
    gov_id_rejection_reason: undefined,
    selfie_url: undefined,
    selfie_submitted_at: undefined,
    selfie_verified: false,
    selfie_verified_at: undefined,
    selfie_rejection_reason: undefined,
    overall_status: "incomplete",
    overall_approved_at: undefined,
    overall_approved_by: undefined,
    overall_rejection_reason: undefined,
    created_at: now,
    updated_at: now,
  };
}

function defaultBusinessVerification(userId: string): BusinessVerification {
  const now = new Date().toISOString();

  return {
    id: userId,
    user_id: userId,
    business_phone: undefined,
    business_phone_verified: false,
    business_address: undefined,
    business_address_verified: false,
    tin: undefined,
    tin_verified: false,
    business_document_type: undefined,
    business_document_url: undefined,
    business_document_submitted_at: undefined,
    business_document_verified: false,
    business_document_verified_at: undefined,
    business_document_rejection_reason: undefined,
    rep_gov_id_type: undefined,
    rep_gov_id_front_url: undefined,
    rep_gov_id_back_url: undefined,
    rep_gov_id_submitted_at: undefined,
    rep_gov_id_verified: false,
    rep_gov_id_verified_at: undefined,
    rep_gov_id_rejection_reason: undefined,
    rep_selfie_url: undefined,
    rep_selfie_submitted_at: undefined,
    rep_selfie_verified: false,
    rep_selfie_verified_at: undefined,
    rep_selfie_rejection_reason: undefined,
    overall_status: "incomplete",
    overall_approved_at: undefined,
    overall_approved_by: undefined,
    overall_rejection_reason: undefined,
    created_at: now,
    updated_at: now,
  };
}

async function requireAuthenticatedProfile(): Promise<AuthenticatedProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (error || !profile) {
    throw new Error("Profile not found");
  }

  return { supabase, user, profile };
}

async function requireAdminProfile() {
  const auth = await requireAuthenticatedProfile();
  if (!auth.profile.is_admin) {
    throw new Error("Unauthorized");
  }

  return auth;
}

async function requireMatchingAccountType(accountType: AccountType) {
  const auth = await requireAuthenticatedProfile();
  if (auth.profile.account_type !== accountType) {
    throw new Error(`Only ${accountType} accounts can perform this action`);
  }

  return auth;
}

async function ensureIndividualVerificationRecord(
  userId: string,
  emailVerified = false,
): Promise<IndividualVerification> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("individual_verifications")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<IndividualVerification>();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data;
  }

  const payload = {
    user_id: userId,
    email_verified: emailVerified,
    overall_status: "incomplete",
  };
  const { data: inserted, error: insertError } = await admin
    .from("individual_verifications")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<IndividualVerification>();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return inserted ?? defaultIndividualVerification(userId, emailVerified);
}

async function ensureBusinessVerificationRecord(
  userId: string,
): Promise<BusinessVerification> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("business_verifications")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<BusinessVerification>();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data;
  }

  const { data: inserted, error: insertError } = await admin
    .from("business_verifications")
    .upsert(
      {
        user_id: userId,
        overall_status: "incomplete",
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<BusinessVerification>();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return inserted ?? defaultBusinessVerification(userId);
}

async function logAdminAction(params: {
  adminId: string;
  action: string;
  targetType: AdminTargetType;
  targetId: string;
  details?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    const headerStore = await headers();
    await admin.from("admin_audit_log").insert({
      admin_id: params.adminId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      details: params.details ?? {},
      ip_address: getRequestIp(headerStore),
    });
  } catch (error) {
    console.error("logAdminAction failed:", error);
  }
}

async function notifyAdminsOfVerification(params: {
  userId: string;
  accountType: AccountType;
  title: string;
  body: string;
}) {
  const adminIds = await getAdminIds();

  await Promise.all(
    adminIds.map((adminId) =>
      sendNotification({
        userId: adminId,
        type: "new_kyc_submission",
        title: params.title,
        body: params.body,
        actionUrl: "/admin/verifications",
        fromUserId: params.userId,
        previewItem: {
          text: params.title,
          created_at: new Date().toISOString(),
          related_title: params.accountType,
        },
      }),
    ),
  );
}

async function notifyVerificationApproved(userId: string) {
  await sendNotification({
    userId,
    type: "kyc_verified",
    title: "Your verification has been approved!",
    body: "You can now create listings.",
    actionUrl: "/dashboard/settings/verification",
  });
}

async function notifyVerificationRejected(params: {
  userId: string;
  reason: string;
  rejectedFields: string[];
}) {
  const fieldText =
    params.rejectedFields.length > 0
      ? ` Please resubmit: ${params.rejectedFields.join(", ")}.`
      : "";

  await sendNotification({
    userId: params.userId,
    type: "kyc_rejected",
    title: "Your verification needs updates",
    body: `${params.reason}.${fieldText}`.trim(),
    actionUrl: "/dashboard/settings/verification",
  });
}

async function getProfileById(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (error || !data) {
    throw new Error("Profile not found");
  }

  return data;
}

async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("getSignedUrl failed:", error);
    return null;
  }
}

void getSignedUrl;

async function uploadPrivateFile(params: {
  bucket: string;
  userId: string;
  folder: string;
  file: File;
  prefix: string;
}): Promise<string> {
  const admin = createAdminClient();
  const extension = getFileExtension(params.file);
  const path = `${params.userId}/${params.folder}/${params.prefix}-${crypto.randomUUID()}.${extension}`;
  const buffer = await params.file.arrayBuffer();
  const { error } = await admin.storage.from(params.bucket).upload(path, buffer, {
    contentType: params.file.type || undefined,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

function ensureFile(
  value: FormDataEntryValue | null,
  options: {
    allowedTypes: Set<string>;
    label: string;
    maxBytes: number;
    requirePdfOrImage?: boolean;
  },
): File {
  if (!(value instanceof File) || value.size === 0) {
    throw new Error(`${options.label} is required`);
  }

  if (value.size > options.maxBytes) {
    throw new Error(`${options.label} must be ${Math.floor(options.maxBytes / (1024 * 1024))}MB or smaller`);
  }

  if (!options.allowedTypes.has(value.type)) {
    throw new Error(
      options.requirePdfOrImage
        ? `${options.label} must be a PDF or image file`
        : `${options.label} must be an image file`,
    );
  }

  return value;
}

async function setProfileEmailVerification(userId: string, verified: boolean) {
  const admin = createAdminClient();
  const now = verified ? new Date().toISOString() : null;
  const { error } = await admin
    .from("profiles")
    .update({
      email_verified: verified,
      verification_status: verified ? "pending" : "incomplete",
      updated_at: new Date().toISOString(),
      email_verified_at: now,
    })
    .eq("id", userId);

  if (error && !/email_verified_at|schema cache|column/i.test(error.message)) {
    throw new Error(error.message);
  }
}

async function setProfilePhoneVerification(userId: string, verified: boolean) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      phone_verified: verified,
      verification_status: verified ? "pending" : "incomplete",
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

function getIndividualRejectionUpdate(field: string, notes?: string) {
  switch (field) {
    case "gov_id":
    case "gov_id_front":
    case "gov_id_back":
      return { gov_id_rejection_reason: notes ?? "Document requires resubmission" };
    case "selfie":
      return { selfie_rejection_reason: notes ?? "Selfie requires resubmission" };
    default:
      return {};
  }
}

function getBusinessRejectionUpdate(field: string, notes?: string) {
  switch (field) {
    case "business_address":
      return {};
    case "tin":
      return {};
    case "business_document":
      return {
        business_document_rejection_reason:
          notes ?? "Business document requires resubmission",
      };
    case "rep_gov_id":
    case "rep_gov_id_front":
    case "rep_gov_id_back":
      return {
        rep_gov_id_rejection_reason: notes ?? "Representative ID requires resubmission",
      };
    case "rep_selfie":
      return {
        rep_selfie_rejection_reason:
          notes ?? "Representative selfie requires resubmission",
      };
    default:
      return {};
  }
}

function hasIndividualSubmission(verification: IndividualVerification) {
  return Boolean(verification.gov_id_front_url && verification.gov_id_back_url && verification.selfie_url);
}

function hasBusinessSubmission(verification: BusinessVerification) {
  return Boolean(
    verification.business_address &&
      verification.tin &&
      verification.business_document_url &&
      verification.rep_gov_id_front_url &&
      verification.rep_gov_id_back_url &&
      verification.rep_selfie_url,
  );
}

function buildIndividualSteps(
  verification: IndividualVerification,
): VerificationStep[] {
  const govIdSubmitted = Boolean(verification.gov_id_front_url && verification.gov_id_back_url);
  const selfieSubmitted = Boolean(verification.selfie_url);

  return [
    {
      key: "gov_id",
      label: "Government ID",
      description: "Upload clear front and back photos of your government-issued ID",
      completed: govIdSubmitted && !verification.gov_id_rejection_reason,
      status: verification.gov_id_rejection_reason
        ? "rejected"
        : govIdSubmitted
          ? "complete"
          : "not_started",
      actionLabel: verification.gov_id_rejection_reason
        ? "Resubmit ID"
        : govIdSubmitted
          ? "Update ID"
          : "Upload ID",
      actionUrl: "/account/verify#government-id",
    },
    {
      key: "selfie",
      label: "Selfie Photo",
      description: "Take or upload a recent clear selfie photo",
      completed: selfieSubmitted && !verification.selfie_rejection_reason,
      status: verification.selfie_rejection_reason
        ? "rejected"
        : selfieSubmitted
          ? "complete"
          : "not_started",
      actionLabel: verification.selfie_rejection_reason
        ? "Resubmit Selfie"
        : selfieSubmitted
          ? "Update Selfie"
          : "Upload Selfie",
      actionUrl: "/account/verify#selfie-photo",
    },
    {
      key: "admin_approval",
      label: "Admin Review",
      description: "Our team reviews your documents (1-3 business days)",
      completed: verification.overall_status === "approved",
      status:
        verification.overall_status === "approved"
          ? "complete"
          : verification.overall_status === "rejected"
            ? "rejected"
            : verification.overall_status === "pending"
              ? "pending"
              : "not_started",
    },
  ];
}

function buildBusinessSteps(
  verification: BusinessVerification,
): VerificationStep[] {
  const businessInfoComplete = Boolean(verification.business_address && verification.tin);
  const businessDocumentSubmitted = Boolean(verification.business_document_url);
  const representativeIdSubmitted = Boolean(
    verification.rep_gov_id_front_url && verification.rep_gov_id_back_url,
  );
  const representativeSelfieSubmitted = Boolean(verification.rep_selfie_url);

  return [
    {
      key: "business_details",
      label: "Business Information",
      description: "Provide your business address and TIN",
      completed: businessInfoComplete,
      status: businessInfoComplete
        ? "complete"
        : verification.business_address || verification.tin
          ? "pending"
          : "not_started",
      actionLabel: "Save Business Information",
      actionUrl: "/account/verify#business-information",
    },
    {
      key: "business_document",
      label: "Business Registration Document",
      description: "Upload your DTI, SEC, or other registration document",
      completed: businessDocumentSubmitted && !verification.business_document_rejection_reason,
      status: verification.business_document_rejection_reason
        ? "rejected"
        : businessDocumentSubmitted
          ? "complete"
          : "not_started",
      actionLabel: verification.business_document_rejection_reason
        ? "Resubmit Document"
        : businessDocumentSubmitted
          ? "Update Document"
          : "Upload Document",
      actionUrl: "/account/verify#business-document",
    },
    {
      key: "rep_gov_id",
      label: "Representative Government ID",
      description: "Upload front and back of your government-issued ID",
      completed: representativeIdSubmitted && !verification.rep_gov_id_rejection_reason,
      status: verification.rep_gov_id_rejection_reason
        ? "rejected"
        : representativeIdSubmitted
          ? "complete"
          : "not_started",
      actionLabel: verification.rep_gov_id_rejection_reason
        ? "Resubmit ID"
        : representativeIdSubmitted
          ? "Update ID"
          : "Upload ID",
      actionUrl: "/account/verify#representative-id",
    },
    {
      key: "rep_selfie",
      label: "Representative Selfie",
      description: "Upload a recent photo of the account representative",
      completed: representativeSelfieSubmitted && !verification.rep_selfie_rejection_reason,
      status: verification.rep_selfie_rejection_reason
        ? "rejected"
        : representativeSelfieSubmitted
          ? "complete"
          : "not_started",
      actionLabel: verification.rep_selfie_rejection_reason
        ? "Resubmit Selfie"
        : representativeSelfieSubmitted
          ? "Update Selfie"
          : "Upload Selfie",
      actionUrl: "/account/verify#representative-selfie",
    },
    {
      key: "admin_approval",
      label: "Admin Review",
      description: "Our team reviews your submitted documents (1-3 business days)",
      completed: verification.overall_status === "approved",
      status:
        verification.overall_status === "approved"
          ? "complete"
          : verification.overall_status === "rejected"
            ? "rejected"
            : verification.overall_status === "pending"
              ? "pending"
              : "not_started",
    },
  ];
}

export async function getIndividualVerification(
  userId: string,
): Promise<IndividualVerification | null> {
  try {
    const auth = await requireAuthenticatedProfile();
    if (auth.user.id !== userId && !auth.profile.is_admin) {
      return null;
    }

    return await ensureIndividualVerificationRecord(userId, auth.profile.email_verified);
  } catch (error) {
    console.error("getIndividualVerification failed:", error);
    return null;
  }
}

export async function getIndividualVerificationSteps(
  userId: string,
): Promise<VerificationStep[]> {
  try {
    const auth = await requireAuthenticatedProfile();
    if (auth.user.id !== userId && !auth.profile.is_admin) {
      return [];
    }

    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle<Profile>();

    if (error || !profile) {
      return [];
    }

    const verification = await ensureIndividualVerificationRecord(
      userId,
      profile.email_verified,
    );

    return buildIndividualSteps({
      ...verification,
      email_verified: profile.email_verified || verification.email_verified,
    });
  } catch (error) {
    console.error("getIndividualVerificationSteps failed:", error);
    return [];
  }
}

export async function submitGovernmentID(
  prevState: unknown,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const auth = await requireMatchingAccountType("individual");
    await ensureIndividualVerificationRecord(auth.user.id, auth.profile.email_verified);

    const parsed = individualVerificationSchema.safeParse({
      phone_number: auth.profile.phone ?? "09123456789",
      gov_id_document_type: formData.get("gov_id_document_type"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid ID details" };
    }

    const frontFile = ensureFile(formData.get("front_photo"), {
      allowedTypes: INDIVIDUAL_FILE_TYPES,
      label: "Front ID photo",
      maxBytes: MAX_INDIVIDUAL_FILE_BYTES,
      requirePdfOrImage: true,
    });
    const backFile = ensureFile(formData.get("back_photo"), {
      allowedTypes: INDIVIDUAL_FILE_TYPES,
      label: "Back ID photo",
      maxBytes: MAX_INDIVIDUAL_FILE_BYTES,
      requirePdfOrImage: true,
    });

    const frontPath = await uploadPrivateFile({
      bucket: "id-documents",
      userId: auth.user.id,
      folder: "gov-id",
      file: frontFile,
      prefix: "front",
    });
    const backPath = await uploadPrivateFile({
      bucket: "id-documents",
      userId: auth.user.id,
      folder: "gov-id",
      file: backFile,
      prefix: "back",
    });

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin
      .from("individual_verifications")
      .update({
        gov_id_document_type: parsed.data.gov_id_document_type,
        gov_id_front_url: frontPath,
        gov_id_back_url: backPath,
        gov_id_submitted_at: now,
        gov_id_rejection_reason: null,
        gov_id_verified: false,
        gov_id_verified_at: null,
      })
      .eq("user_id", auth.user.id);

    if (error) {
      return { error: error.message };
    }

    await checkAndUpdateOverallStatus(auth.user.id);
    revalidateVerificationViews();
    return { success: "Government ID submitted for review." };
  } catch (error) {
    console.error("submitGovernmentID failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not submit government ID.",
    };
  }
}

export async function submitSelfie(
  prevState: unknown,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const auth = await requireMatchingAccountType("individual");
    await ensureIndividualVerificationRecord(auth.user.id, auth.profile.email_verified);

    const selfieFile = ensureFile(formData.get("selfie"), {
      allowedTypes: SELFIE_FILE_TYPES,
      label: "Selfie",
      maxBytes: MAX_INDIVIDUAL_FILE_BYTES,
    });

    const selfiePath = await uploadPrivateFile({
      bucket: "selfie-photos",
      userId: auth.user.id,
      folder: "selfie",
      file: selfieFile,
      prefix: "selfie",
    });

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin
      .from("individual_verifications")
      .update({
        selfie_url: selfiePath,
        selfie_submitted_at: now,
        selfie_rejection_reason: null,
        selfie_verified: false,
        selfie_verified_at: null,
      })
      .eq("user_id", auth.user.id);

    if (error) {
      return { error: error.message };
    }

    await checkAndUpdateOverallStatus(auth.user.id);
    revalidateVerificationViews();
    return { success: "Selfie submitted for review." };
  } catch (error) {
    console.error("submitSelfie failed:", error);
    return {
      error: error instanceof Error ? error.message : "Could not submit selfie.",
    };
  }
}

export async function checkAndUpdateOverallStatus(userId: string): Promise<void> {
  const admin = createAdminClient();
  const profile = await getProfileById(userId);
  const verification = await ensureIndividualVerificationRecord(userId, profile.email_verified);

  const allSubmitted = hasIndividualSubmission(verification);

  if (
    !allSubmitted ||
    verification.overall_status === "pending" ||
    verification.overall_status === "approved"
  ) {
    return;
  }

  const { error } = await admin
    .from("individual_verifications")
    .update({
      overall_status: "pending",
      overall_rejection_reason: null,
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  await notifyAdminsOfVerification({
    userId,
    accountType: "individual",
    title: `New verification ready for review: ${getUserDisplayName(profile)}`,
    body: "All required individual verification items have been submitted.",
  });
}

export async function getBusinessVerification(
  userId: string,
): Promise<BusinessVerification | null> {
  try {
    const auth = await requireAuthenticatedProfile();
    if (auth.user.id !== userId && !auth.profile.is_admin) {
      return null;
    }

    return await ensureBusinessVerificationRecord(userId);
  } catch (error) {
    console.error("getBusinessVerification failed:", error);
    return null;
  }
}

export async function getBusinessVerificationSteps(
  userId: string,
): Promise<VerificationStep[]> {
  try {
    const auth = await requireAuthenticatedProfile();
    if (auth.user.id !== userId && !auth.profile.is_admin) {
      return [];
    }

    const verification = await ensureBusinessVerificationRecord(userId);
    return buildBusinessSteps(verification);
  } catch (error) {
    console.error("getBusinessVerificationSteps failed:", error);
    return [];
  }
}

export async function submitBusinessDetails(
  prevState: unknown,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const auth = await requireMatchingAccountType("business");
    await ensureBusinessVerificationRecord(auth.user.id);
    const businessPhone = formData.get("business_phone");
    const businessAddress = formData.get("business_address");
    const tin = formData.get("tin");

    const parsed = businessDetailsSchema.safeParse({
      business_phone:
        typeof businessPhone === "string" && businessPhone.trim().length > 0
          ? businessPhone.trim()
          : undefined,
      business_address:
        typeof businessAddress === "string" ? businessAddress.trim() : businessAddress,
      tin: typeof tin === "string" ? tin.trim() : tin,
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Invalid business details",
      };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("business_verifications")
      .update({
        business_phone: parsed.data.business_phone,
        business_address: parsed.data.business_address,
        tin: parsed.data.tin,
        business_phone_verified: false,
        business_address_verified: false,
        tin_verified: false,
      })
      .eq("user_id", auth.user.id);

    if (error) {
      return { error: error.message };
    }

    await checkAndUpdateBusinessStatus(auth.user.id);
    revalidateVerificationViews();
    return { success: "Business details saved." };
  } catch (error) {
    console.error("submitBusinessDetails failed:", error);
    return {
      error:
        error instanceof Error ? error.message : "Could not save business details.",
    };
  }
}

export async function submitBusinessDocument(
  prevState: unknown,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const auth = await requireMatchingAccountType("business");
    await ensureBusinessVerificationRecord(auth.user.id);

    const typeParsed = businessDocumentTypeSchema.safeParse({
      business_document_type: formData.get("business_document_type"),
    });

    if (!typeParsed.success) {
      return {
        error:
          typeParsed.error.issues[0]?.message ?? "Invalid business document type",
      };
    }

    const documentFile = ensureFile(formData.get("document"), {
      allowedTypes: INDIVIDUAL_FILE_TYPES,
      label: "Business document",
      maxBytes: MAX_BUSINESS_DOCUMENT_BYTES,
      requirePdfOrImage: true,
    });

    const documentPath = await uploadPrivateFile({
      bucket: "business-documents",
      userId: auth.user.id,
      folder: "business-document",
      file: documentFile,
      prefix: "document",
    });

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin
      .from("business_verifications")
      .update({
        business_document_type: typeParsed.data.business_document_type,
        business_document_url: documentPath,
        business_document_submitted_at: now,
        business_document_rejection_reason: null,
        business_document_verified: false,
        business_document_verified_at: null,
      })
      .eq("user_id", auth.user.id);

    if (error) {
      return { error: error.message };
    }

    await checkAndUpdateBusinessStatus(auth.user.id);
    revalidateVerificationViews();
    return { success: "Business document submitted." };
  } catch (error) {
    console.error("submitBusinessDocument failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not submit business document.",
    };
  }
}

export async function submitRepresentativeID(
  prevState: unknown,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const auth = await requireMatchingAccountType("business");
    await ensureBusinessVerificationRecord(auth.user.id);

    const typeParsed = representativeIdTypeSchema.safeParse({
      rep_gov_id_type: formData.get("rep_gov_id_type"),
    });

    if (!typeParsed.success) {
      return { error: typeParsed.error.issues[0]?.message ?? "Invalid ID type" };
    }

    const frontFile = ensureFile(formData.get("front_photo"), {
      allowedTypes: INDIVIDUAL_FILE_TYPES,
      label: "Front representative ID",
      maxBytes: MAX_INDIVIDUAL_FILE_BYTES,
      requirePdfOrImage: true,
    });
    const backFile = ensureFile(formData.get("back_photo"), {
      allowedTypes: INDIVIDUAL_FILE_TYPES,
      label: "Back representative ID",
      maxBytes: MAX_INDIVIDUAL_FILE_BYTES,
      requirePdfOrImage: true,
    });

    const frontPath = await uploadPrivateFile({
      bucket: "id-documents",
      userId: auth.user.id,
      folder: "representative-id",
      file: frontFile,
      prefix: "front",
    });
    const backPath = await uploadPrivateFile({
      bucket: "id-documents",
      userId: auth.user.id,
      folder: "representative-id",
      file: backFile,
      prefix: "back",
    });

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin
      .from("business_verifications")
      .update({
        rep_gov_id_type: typeParsed.data.rep_gov_id_type,
        rep_gov_id_front_url: frontPath,
        rep_gov_id_back_url: backPath,
        rep_gov_id_submitted_at: now,
        rep_gov_id_rejection_reason: null,
        rep_gov_id_verified: false,
        rep_gov_id_verified_at: null,
      })
      .eq("user_id", auth.user.id);

    if (error) {
      return { error: error.message };
    }

    await checkAndUpdateBusinessStatus(auth.user.id);
    revalidateVerificationViews();
    return { success: "Representative ID submitted." };
  } catch (error) {
    console.error("submitRepresentativeID failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not submit representative ID.",
    };
  }
}

export async function submitRepresentativeSelfie(
  prevState: unknown,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const auth = await requireMatchingAccountType("business");
    await ensureBusinessVerificationRecord(auth.user.id);

    const selfieFile = ensureFile(formData.get("selfie"), {
      allowedTypes: SELFIE_FILE_TYPES,
      label: "Representative selfie",
      maxBytes: MAX_INDIVIDUAL_FILE_BYTES,
    });

    const selfiePath = await uploadPrivateFile({
      bucket: "selfie-photos",
      userId: auth.user.id,
      folder: "representative-selfie",
      file: selfieFile,
      prefix: "selfie",
    });

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin
      .from("business_verifications")
      .update({
        rep_selfie_url: selfiePath,
        rep_selfie_submitted_at: now,
        rep_selfie_rejection_reason: null,
        rep_selfie_verified: false,
        rep_selfie_verified_at: null,
      })
      .eq("user_id", auth.user.id);

    if (error) {
      return { error: error.message };
    }

    await checkAndUpdateBusinessStatus(auth.user.id);
    revalidateVerificationViews();
    return { success: "Representative selfie submitted." };
  } catch (error) {
    console.error("submitRepresentativeSelfie failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not submit representative selfie.",
    };
  }
}

export async function checkAndUpdateBusinessStatus(userId: string): Promise<void> {
  const admin = createAdminClient();
  const profile = await getProfileById(userId);
  const verification = await ensureBusinessVerificationRecord(userId);

  const allSubmitted = hasBusinessSubmission(verification);

  if (
    !allSubmitted ||
    verification.overall_status === "pending" ||
    verification.overall_status === "approved"
  ) {
    return;
  }

  const { error } = await admin
    .from("business_verifications")
    .update({
      overall_status: "pending",
      overall_rejection_reason: null,
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  await notifyAdminsOfVerification({
    userId,
    accountType: "business",
    title: `New verification ready for review: ${getUserDisplayName(profile)}`,
    body: "All required business verification items have been submitted.",
  });
}

export async function approveVerification(
  userId: string,
  accountType: AccountType,
): Promise<ActionResponse> {
  try {
    const { user } = await requireAdminProfile();
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const table =
      accountType === "individual"
        ? "individual_verifications"
        : "business_verifications";

    const { error } = await admin
      .from(table)
      .update({
        overall_status: "approved",
        overall_approved_at: now,
        overall_approved_by: user.id,
        overall_rejection_reason: null,
      })
      .eq("user_id", userId);

    if (error) {
      return { error: error.message };
    }

    await createNotification({
      userId,
      type: "kyc_verified",
      title: "Your verification has been approved!",
      body: "You can now create listings.",
      actionUrl: "/dashboard/settings/verification",
    });
    await notifyVerificationApproved(userId);
    await logAdminAction({
      adminId: user.id,
      action: "verification_approved",
      targetType: "user",
      targetId: userId,
      details: { account_type: accountType },
    });

    revalidateVerificationViews();
    return { success: "Verification approved." };
  } catch (error) {
    console.error("approveVerification failed:", error);
    return {
      error:
        error instanceof Error ? error.message : "Could not approve verification.",
    };
  }
}

export async function rejectVerification(
  userId: string,
  accountType: AccountType,
  reason: string,
  rejectedFields: string[],
): Promise<ActionResponse> {
  try {
    const { user } = await requireAdminProfile();
    const admin = createAdminClient();
    const trimmedReason = reason.trim();

    if (trimmedReason.length < 3) {
      return { error: "Rejection reason is required." };
    }

    if (accountType === "individual") {
      const updates: Record<string, unknown> = {
        overall_status: "rejected",
        overall_rejection_reason: trimmedReason,
      };

      for (const field of rejectedFields) {
        Object.assign(updates, getIndividualRejectionUpdate(field, trimmedReason));
      }

      const { error } = await admin
        .from("individual_verifications")
        .update(updates)
        .eq("user_id", userId);

      if (error) {
        return { error: error.message };
      }
    } else {
      const updates: Record<string, unknown> = {
        overall_status: "rejected",
        overall_rejection_reason: trimmedReason,
      };

      for (const field of rejectedFields) {
        Object.assign(updates, getBusinessRejectionUpdate(field, trimmedReason));
      }

      const { error } = await admin
        .from("business_verifications")
        .update(updates)
        .eq("user_id", userId);

      if (error) {
        return { error: error.message };
      }
    }

    await notifyVerificationRejected({
      userId,
      reason: trimmedReason,
      rejectedFields,
    });
    await logAdminAction({
      adminId: user.id,
      action: "verification_rejected",
      targetType: "user",
      targetId: userId,
      details: {
        account_type: accountType,
        reason: trimmedReason,
        rejected_fields: rejectedFields,
      },
    });

    revalidateVerificationViews();
    return { success: "Verification rejected." };
  } catch (error) {
    console.error("rejectVerification failed:", error);
    return {
      error:
        error instanceof Error ? error.message : "Could not reject verification.",
    };
  }
}

export async function verifyIndividualDocument(params: {
  userId: string;
  field: "gov_id" | "selfie" | "phone" | "email";
  approved: boolean;
  notes?: string;
}): Promise<ActionResponse> {
  try {
    const { user } = await requireAdminProfile();
    const admin = createAdminClient();
    const now = new Date().toISOString();
    let updates: Record<string, unknown>;

    switch (params.field) {
      case "gov_id":
        updates = {
          gov_id_verified: params.approved,
          gov_id_verified_at: params.approved ? now : null,
          gov_id_rejection_reason: params.approved ? null : params.notes ?? "ID not approved",
        };
        break;
      case "selfie":
        updates = {
          selfie_verified: params.approved,
          selfie_verified_at: params.approved ? now : null,
          selfie_rejection_reason:
            params.approved ? null : params.notes ?? "Selfie not approved",
        };
        break;
      case "phone":
        updates = {
          phone_verified: params.approved,
          phone_verified_at: params.approved ? now : null,
        };
        break;
      case "email":
        updates = {
          email_verified: params.approved,
          email_verified_at: params.approved ? now : null,
        };
        break;
    }

    const { error } = await admin
      .from("individual_verifications")
      .update(updates)
      .eq("user_id", params.userId);

    if (error) {
      return { error: error.message };
    }

    if (params.field === "email") {
      await setProfileEmailVerification(params.userId, params.approved);
    }

    if (params.field === "phone") {
      await setProfilePhoneVerification(params.userId, params.approved);
    }

    await logAdminAction({
      adminId: user.id,
      action: "individual_verification_field_updated",
      targetType: "user",
      targetId: params.userId,
      details: {
        field: params.field,
        approved: params.approved,
        notes: params.notes ?? null,
      },
    });

    revalidateVerificationViews();
    return { success: "Verification field updated." };
  } catch (error) {
    console.error("verifyIndividualDocument failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not update individual verification field.",
    };
  }
}

export async function verifyBusinessDocument(params: {
  userId: string;
  field:
    | "business_document"
    | "rep_gov_id"
    | "rep_selfie"
    | "business_phone"
    | "business_address"
    | "tin";
  approved: boolean;
  notes?: string;
}): Promise<ActionResponse> {
  try {
    const { user } = await requireAdminProfile();
    const admin = createAdminClient();
    const now = new Date().toISOString();
    let updates: Record<string, unknown>;

    switch (params.field) {
      case "business_document":
        updates = {
          business_document_verified: params.approved,
          business_document_verified_at: params.approved ? now : null,
          business_document_rejection_reason:
            params.approved ? null : params.notes ?? "Business document not approved",
        };
        break;
      case "rep_gov_id":
        updates = {
          rep_gov_id_verified: params.approved,
          rep_gov_id_verified_at: params.approved ? now : null,
          rep_gov_id_rejection_reason:
            params.approved ? null : params.notes ?? "Representative ID not approved",
        };
        break;
      case "rep_selfie":
        updates = {
          rep_selfie_verified: params.approved,
          rep_selfie_verified_at: params.approved ? now : null,
          rep_selfie_rejection_reason:
            params.approved ? null : params.notes ?? "Representative selfie not approved",
        };
        break;
      case "business_phone":
        updates = {
          business_phone_verified: params.approved,
        };
        break;
      case "business_address":
        updates = {
          business_address_verified: params.approved,
        };
        break;
      case "tin":
        updates = {
          tin_verified: params.approved,
        };
        break;
    }

    const { error } = await admin
      .from("business_verifications")
      .update(updates)
      .eq("user_id", params.userId);

    if (error) {
      return { error: error.message };
    }

    await logAdminAction({
      adminId: user.id,
      action: "business_verification_field_updated",
      targetType: "user",
      targetId: params.userId,
      details: {
        field: params.field,
        approved: params.approved,
        notes: params.notes ?? null,
      },
    });

    revalidateVerificationViews();
    return { success: "Verification field updated." };
  } catch (error) {
    console.error("verifyBusinessDocument failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not update business verification field.",
    };
  }
}

export async function getVerificationQueue(
  accountType?: AccountType,
): Promise<{ pending: VerificationQueueRow[]; count: number }> {
  try {
    await requireAdminProfile();
    const admin = createAdminClient();

    if (!accountType || accountType === "individual") {
      const { data, error } = await admin
        .from("individual_verifications")
        .select("*, profile:profiles!individual_verifications_user_id_fkey(*)")
        .eq("overall_status", "pending");

      if (error) {
        throw error;
      }

      const rows = (data ?? []).flatMap((row) => {
        const record = row as IndividualVerification & {
          profile: Profile | Profile[] | null;
        };
        const profile = Array.isArray(record.profile)
          ? record.profile[0]
          : record.profile;

        if (!profile || (accountType && profile.account_type !== accountType)) {
          return [];
        }

        return [{ ...profile, verification: record }];
      });

      if (accountType === "individual") {
        return { pending: rows, count: rows.length };
      }

      const { data: businessData, error: businessError } = await admin
        .from("business_verifications")
        .select("*, profile:profiles!business_verifications_user_id_fkey(*)")
        .eq("overall_status", "pending");

      if (businessError) {
        throw businessError;
      }

      const businessRows = (businessData ?? []).flatMap((row) => {
        const record = row as BusinessVerification & {
          profile: Profile | Profile[] | null;
        };
        const profile = Array.isArray(record.profile)
          ? record.profile[0]
          : record.profile;

        if (!profile) {
          return [];
        }

        return [{ ...profile, verification: record }];
      });

      return {
        pending: [...rows, ...businessRows],
        count: rows.length + businessRows.length,
      };
    }

    const { data, error } = await admin
      .from("business_verifications")
      .select("*, profile:profiles!business_verifications_user_id_fkey(*)")
      .eq("overall_status", "pending");

    if (error) {
      throw error;
    }

    const rows = (data ?? []).flatMap((row) => {
      const record = row as BusinessVerification & {
        profile: Profile | Profile[] | null;
      };
      const profile = Array.isArray(record.profile)
        ? record.profile[0]
        : record.profile;

      if (!profile) {
        return [];
      }

      return [{ ...profile, verification: record }];
    });

    return { pending: rows, count: rows.length };
  } catch (error) {
    console.error("getVerificationQueue failed:", error);
    return { pending: [], count: 0 };
  }
}

export async function getListingEligibility(
  userId: string,
): Promise<ListingEligibility> {
  try {
    console.log("[LISTING_ELIGIBILITY] Checking eligibility for user:", userId);
    
    const auth = await requireAuthenticatedProfile();
    if (auth.user.id !== userId && !auth.profile.is_admin) {
      console.log("[LISTING_ELIGIBILITY] Unauthorized access attempt for user:", userId);
      return {
        allowed: false,
        reason: "unauthorized",
        message: "You are not allowed to view this eligibility status.",
      };
    }

    const admin = createAdminClient();
    const rpcAttempts = [{ p_user_id: userId }, { user_id: userId }];
    let result: unknown = null;
    let lastError: Error | null = null;

    console.log("[LISTING_ELIGIBILITY] Calling can_user_create_listing RPC for user:", userId);
    for (const args of rpcAttempts) {
      const { data, error } = await admin.rpc("can_user_create_listing", args);
      if (!error) {
        result = data;
        lastError = null;
        console.log("[LISTING_ELIGIBILITY] RPC returned:", result);
        break;
      }

      console.log("[LISTING_ELIGIBILITY] RPC attempt failed with args", args, "error:", error.message);
      lastError = new Error(error.message);
    }

    if (lastError) {
      console.log("[LISTING_ELIGIBILITY] All RPC attempts failed, throwing error");
      throw lastError;
    }

    if (typeof result === "boolean") {
      console.log("[LISTING_ELIGIBILITY] Result is boolean:", result);
      return result
        ? { allowed: true }
        : {
            allowed: false,
            reason: "requirements_incomplete",
            message: "Complete your verification requirements before creating listings.",
          };
    }

    if (Array.isArray(result) && result.length > 0) {
      const row = result[0] as Record<string, unknown>;
      console.log("[LISTING_ELIGIBILITY] Result is array, first row:", row);
      return {
        allowed: Boolean(row.allowed ?? row.can_create_listing ?? false),
        reason:
          typeof row.reason === "string" ? row.reason : undefined,
        message:
          typeof row.message === "string" ? row.message : undefined,
      };
    }

    if (result && typeof result === "object") {
      const row = result as Record<string, unknown>;
      console.log("[LISTING_ELIGIBILITY] Result is object:", row);
      return {
        allowed: Boolean(row.allowed ?? row.can_create_listing ?? false),
        reason: typeof row.reason === "string" ? row.reason : undefined,
        message: typeof row.message === "string" ? row.message : undefined,
      };
    }

    console.log("[LISTING_ELIGIBILITY] Unexpected result type, defaulting to not allowed");
    return { allowed: false, reason: "unknown" };
  } catch (error) {
    console.error("[LISTING_ELIGIBILITY] getListingEligibility failed:", error);
    return {
      allowed: false,
      reason: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not determine listing eligibility.",
    };
  }
}
