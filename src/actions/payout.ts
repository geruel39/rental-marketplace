"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createNotification } from "@/actions/notifications";
import {
  getAdminIds,
  notifyKYCRejected,
  notifyKYCSubmitted,
  notifyKYCVerified,
} from "@/lib/notifications";
import { getHitPayApiUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { kycUploadSchema, payoutMethodSchema } from "@/lib/validations";
import type {
  ActionResponse,
  AdminTargetType,
  BookingStatus,
  JsonObject,
  PayoutSetupStatus,
  Profile,
} from "@/types";

const KYC_BUCKET = "kyc-documents";
const MAX_KYC_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_KYC_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);
const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ["confirmed", "active", "returned"];
const FUTURE_PAYOUT_STATUSES = ["pending", "processing"] as const;

type HitPaySchemaOption = {
  label?: string;
  value?: string;
};

type HitPaySchemaField = {
  key?: string;
  options?: HitPaySchemaOption[];
};

type SupportedBankOption = {
  label: string;
  value: string;
};

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function normalizePhilippinePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("63")) {
    return `0${digits.slice(2)}`;
  }

  if (digits.startsWith("0")) {
    return digits;
  }

  return `0${digits}`;
}

function extractStoragePath(publicUrl: string) {
  const marker = `/storage/v1/object/public/${KYC_BUCKET}/`;
  const index = publicUrl.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return decodeURIComponent(publicUrl.slice(index + marker.length));
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

function getKycStatus(profile: Profile): PayoutSetupStatus["kyc_status"] {
  if (profile.payout_method !== "bank") {
    return undefined;
  }

  if (profile.bank_kyc_verified) {
    return "verified";
  }

  if (profile.bank_kyc_document_url) {
    return "pending";
  }

  return "not_submitted";
}

async function getLatestKycAudit(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_audit_log")
    .select("*")
    .eq("target_type", "user")
    .eq("target_id", userId)
    .in("action", ["kyc_verified", "kyc_rejected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      action: string;
      details: JsonObject;
      created_at: string;
    }>();

  if (error) {
    console.error("getLatestKycAudit failed:", error);
    return null;
  }

  return data ?? null;
}

async function getResolvedKycStatus(profile: Profile) {
  if (profile.payout_method !== "bank") {
    return undefined;
  }

  const baseStatus = getKycStatus(profile);
  if (baseStatus === "verified" || baseStatus === "pending") {
    return baseStatus;
  }

  const latestAudit = await getLatestKycAudit(profile.id);
  return latestAudit?.action === "kyc_rejected" ? "rejected" : baseStatus;
}

function getMissingFields(profile: Profile): string[] {
  if (!profile.payout_method) {
    return ["payout_method"];
  }

  switch (profile.payout_method) {
    case "bank": {
      const missingFields: string[] = [];

      if (!profile.bank_name) {
        missingFields.push("bank_name");
      }

      if (!profile.bank_account_number) {
        missingFields.push("bank_account_number");
      }

      if (!profile.bank_account_name) {
        missingFields.push("bank_account_name");
      }

      if (!profile.bank_kyc_document_url) {
        missingFields.push("bank_kyc_document_url");
      }

      return missingFields;
    }
    case "gcash":
      return profile.gcash_phone_number ? [] : ["gcash_phone_number"];
    case "maya":
      return profile.maya_phone_number ? [] : ["maya_phone_number"];
  }
}

function getUserDisplayName(profile: Pick<Profile, "display_name" | "full_name" | "email">) {
  return profile.display_name || profile.full_name || profile.email;
}

function getFileExtension(file: File): string {
  const sanitizedName = sanitizeFilename(file.name);
  const extension = sanitizedName.split(".").pop()?.toLowerCase();

  if (extension && extension !== sanitizedName.toLowerCase()) {
    return extension;
  }

  switch (file.type) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    default:
      return "bin";
  }
}

async function callBooleanRpc(
  client: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  fn: string,
  argsList: Record<string, unknown>[],
) {
  let lastError: Error | null = null;

  for (const args of argsList) {
    const { data, error } = await client.rpc(fn, args);

    if (!error) {
      return Boolean(data);
    }

    lastError = new Error(error.message);
  }

  throw lastError ?? new Error(`RPC ${fn} failed`);
}

async function requireAuthenticatedProfile() {
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
  const { user, profile } = await requireAuthenticatedProfile();

  if (!profile.is_admin) {
    throw new Error("Unauthorized");
  }

  return { adminId: user.id, adminProfile: profile };
}

async function getAccessibleProfile(userId: string) {
  const { supabase, user, profile } = await requireAuthenticatedProfile();

  if (user.id !== userId && !profile.is_admin) {
    throw new Error("Unauthorized");
  }

  if (user.id === userId) {
    return { requester: profile, target: profile, client: supabase };
  }

  const admin = createAdminClient();
  const { data: targetProfile, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (error || !targetProfile) {
    throw new Error("Profile not found");
  }

  return { requester: profile, target: targetProfile, client: admin };
}

async function logAdminAction(params: {
  adminId: string;
  action: string;
  targetType: AdminTargetType;
  targetId: string;
  details?: JsonObject;
}) {
  try {
    const admin = createAdminClient();
    const headerStore = await headers();
    const ipAddress = getRequestIp(headerStore);

    await admin.from("admin_audit_log").insert({
      admin_id: params.adminId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      details: params.details ?? {},
      ip_address: ipAddress,
    });
  } catch (error) {
    console.error("logAdminAction failed:", error);
  }
}

async function findConflictingPhoneOwner(
  field: "gcash_phone_number" | "maya_phone_number",
  phone: string,
  currentUserId: string,
) {
  const admin = createAdminClient();
  const normalizedPhone = normalizePhilippinePhone(phone);
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name, full_name, email")
    .neq("id", currentUserId)
    .eq(field, normalizedPhone)
    .limit(1)
    .maybeSingle<Pick<Profile, "id" | "display_name" | "full_name" | "email">>();

  if (error) {
    throw error;
  }

  return data;
}

async function getBlockingBookingCount(userId: string) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("lister_id", userId)
    .in("status", ACTIVE_BOOKING_STATUSES);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getPendingPayoutCount(userId: string) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("payouts")
    .select("id", { count: "exact", head: true })
    .eq("lister_id", userId)
    .in("status", [...FUTURE_PAYOUT_STATUSES]);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function updateFuturePayoutMethods(userId: string, method: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("payouts")
    .update({ payout_method: method })
    .eq("lister_id", userId)
    .in("status", [...FUTURE_PAYOUT_STATUSES]);

  if (error) {
    throw error;
  }
}

async function removeStoredKycDocument(publicUrl?: string | null) {
  if (!publicUrl) {
    return;
  }

  const path = extractStoragePath(publicUrl);
  if (!path) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.storage.from(KYC_BUCKET).remove([path]);

  if (error) {
    console.error("removeStoredKycDocument failed:", error);
  }
}

function revalidatePayoutViews() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/settings/payments");
  revalidatePath("/listings/new");
  revalidatePath("/dashboard/my-listings");
  revalidatePath("/admin");
  revalidatePath("/admin/users");
}

function normalizeForMatching(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function inferPayoutCountryCode(profile: Pick<Profile, "country">) {
  const country = (profile.country ?? "").trim().toLowerCase();

  if (country.includes("phil")) return "ph";
  if (country.includes("sing")) return "sg";
  if (country.includes("malay")) return "my";
  if (country.includes("bangla")) return "bd";
  if (country.includes("viet")) return "vn";
  if (country.includes("austr")) return "au";

  return "sg";
}

function getLocalCurrencyForCountry(countryCode: string) {
  switch (countryCode) {
    case "ph":
      return "php";
    case "my":
      return "myr";
    case "bd":
      return "bdt";
    case "vn":
      return "vnd";
    case "au":
      return "aud";
    case "sg":
    default:
      return "sgd";
  }
}

async function fetchHitPayBankOptions(profile: Pick<Profile, "account_type" | "country">) {
  const apiKey = process.env.HITPAY_API_KEY;
  if (!apiKey) {
    return [];
  }

  const country = inferPayoutCountryCode(profile);
  const currency = getLocalCurrencyForCountry(country);
  const holderType = profile.account_type === "business" ? "company" : "individual";
  const response = await fetch(`${getHitPayApiUrl()}/beneficiaries/schema`, {
    method: "POST",
    headers: {
      "X-BUSINESS-API-KEY": apiKey,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      country,
      transfer_method: "bank_transfer",
      transfer_type: "local",
      currency,
      holder_type: holderType,
    }),
    cache: "no-store",
  });

  const rawText = await response.text();
  if (!response.ok) {
    if (
      response.status === 403 &&
      /feature access denied|access denied/i.test(rawText)
    ) {
      console.warn("HitPay bank schema access denied; using local bank validation only.");
      return [];
    }

    throw new Error(rawText || "Could not load HitPay-supported banks.");
  }

  const schema = (rawText ? JSON.parse(rawText) : []) as HitPaySchemaField[];
  const bankField = schema.find(
    (field) =>
      typeof field.key === "string" &&
      Array.isArray(field.options) &&
      field.options.length > 0 &&
      /bank_(id|swift_code|code|branch_code)$/i.test(field.key),
  );

  return (bankField?.options ?? [])
    .map((option) => ({
      label: option.label?.trim() || option.value?.trim() || "",
      value: option.value?.trim() || option.label?.trim() || "",
    }))
    .filter((option) => option.label && option.value);
}

function resolveSupportedBankName(
  bankName: string,
  options: SupportedBankOption[],
) {
  const normalizedBankName = normalizeForMatching(bankName);
  const directMatch = options.find(
    (option) =>
      normalizeForMatching(option.label) === normalizedBankName ||
      normalizeForMatching(option.value) === normalizedBankName,
  );

  return directMatch?.label ?? null;
}

export async function getSupportedBankOptions(): Promise<SupportedBankOption[]> {
  const { profile } = await requireAuthenticatedProfile();
  return fetchHitPayBankOptions(profile);
}

async function ensureKycBucketExists(admin: ReturnType<typeof createAdminClient>) {
  const { error: getBucketError } = await admin.storage.getBucket(KYC_BUCKET);

  if (!getBucketError) {
    return null;
  }

  if (!/not found|does not exist/i.test(getBucketError.message)) {
    return getBucketError.message;
  }

  const { error: createBucketError } = await admin.storage.createBucket(KYC_BUCKET, {
    public: true,
    allowedMimeTypes: [...ALLOWED_KYC_MIME_TYPES],
    fileSizeLimit: MAX_KYC_FILE_SIZE,
  });

  return createBucketError?.message ?? null;
}

export async function getPayoutSetupStatus(
  userId: string,
): Promise<PayoutSetupStatus> {
  try {
    const { target, client } = await getAccessibleProfile(userId);
    const isComplete = await callBooleanRpc(client, "is_payout_setup_complete", [
      { p_user_id: userId },
      { user_id: userId },
    ]);

    return {
      is_complete: isComplete,
      current_method: target.payout_method,
      missing_fields: isComplete ? [] : getMissingFields(target),
      kyc_status: await getResolvedKycStatus(target),
    };
  } catch (error) {
    console.error("getPayoutSetupStatus failed:", error);
    return {
      is_complete: false,
      missing_fields: ["payout_method"],
    };
  }
}

export async function setupPayoutMethod(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const { supabase, user, profile } = await requireAuthenticatedProfile();
    const method = formData.get("method")?.toString().trim();
    const parsed = payoutMethodSchema.safeParse({
      method,
      bank_name: formData.get("bank_name")?.toString().trim() || undefined,
      bank_account_number:
        formData.get("bank_account_number")?.toString().trim() ||
        formData.get("account_number")?.toString().trim() ||
        undefined,
      bank_account_name:
        formData.get("bank_account_name")?.toString().trim() ||
        formData.get("account_holder")?.toString().trim() ||
        undefined,
      gcash_phone_number:
        formData.get("gcash_phone_number")?.toString().trim() || undefined,
      maya_phone_number:
        formData.get("maya_phone_number")?.toString().trim() || undefined,
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Invalid payout method details",
      };
    }

    const isMethodChange =
      Boolean(profile.payout_method) && profile.payout_method !== parsed.data.method;

    if (isMethodChange) {
      const blockingBookings = await getBlockingBookingCount(user.id);

      if (blockingBookings > 0) {
        return {
          error:
            "Cannot change payout method while you have active bookings. Please wait until they're completed.",
        };
      }
    }

    if (parsed.data.method === "gcash" && parsed.data.gcash_phone_number) {
      const normalizedPhone = normalizePhilippinePhone(parsed.data.gcash_phone_number);
      const existingOwner = await findConflictingPhoneOwner(
        "gcash_phone_number",
        normalizedPhone,
        user.id,
      );

      if (existingOwner) {
        return { error: "That GCash number is already being used by another account." };
      }

      parsed.data.gcash_phone_number = normalizedPhone;
    }

    if (parsed.data.method === "maya" && parsed.data.maya_phone_number) {
      const normalizedPhone = normalizePhilippinePhone(parsed.data.maya_phone_number);
      const existingOwner = await findConflictingPhoneOwner(
        "maya_phone_number",
        normalizedPhone,
        user.id,
      );

      if (existingOwner) {
        return { error: "That Maya number is already being used by another account." };
      }

      parsed.data.maya_phone_number = normalizedPhone;
    }

    if (parsed.data.method === "bank" && process.env.HITPAY_API_KEY) {
      let supportedBanks: SupportedBankOption[];
      try {
        supportedBanks = await fetchHitPayBankOptions(profile);
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Could not verify supported banks with HitPay.",
        };
      }

      if (supportedBanks.length > 0) {
        const supportedBankName = resolveSupportedBankName(
          parsed.data.bank_name ?? "",
          supportedBanks,
        );

        if (!supportedBankName) {
          return {
            error:
              "Select a bank from the supported HitPay bank list so payouts can be sent automatically.",
          };
        }

        parsed.data.bank_name = supportedBankName;
      }
    }

    if (isMethodChange) {
      const admin = createAdminClient();
      const { error: historyError } = await admin.from("payout_method_history").insert({
        user_id: user.id,
        previous_method: profile.payout_method,
        new_method: parsed.data.method,
      });

      if (historyError) {
        console.error("Failed to log payout method history:", historyError);
      }
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();
    let successMessage: string;
    let updatePayload: Record<string, unknown>;
    let fallbackPayload: Record<string, unknown>;
    let pendingPayoutWarning: string | null = null;

    if (isMethodChange) {
      const pendingPayouts = await getPendingPayoutCount(user.id);

      if (profile.payout_method === "bank" && pendingPayouts > 0) {
        pendingPayoutWarning =
          "You have pending payouts via bank. Future payouts will use the new method, but pending ones will still go to your bank account.";
      } else {
        await updateFuturePayoutMethods(user.id, parsed.data.method);
      }
    }

    switch (parsed.data.method) {
      case "bank":
        updatePayload = {
          payout_method: "bank",
          bank_name: parsed.data.bank_name,
          bank_account_number: parsed.data.bank_account_number,
          bank_account_name: parsed.data.bank_account_name,
          bank_kyc_verified: false,
          bank_kyc_document_url: null,
          bank_kyc_verified_at: null,
          gcash_phone_number: null,
          maya_phone_number: null,
          payout_setup_completed: false,
          payout_setup_completed_at: null,
        };
        fallbackPayload = {
          payout_method: "bank",
          bank_name: parsed.data.bank_name,
          bank_account_number: parsed.data.bank_account_number,
          bank_account_name: parsed.data.bank_account_name,
          gcash_phone_number: null,
          maya_phone_number: null,
          payout_setup_completed: false,
          payout_setup_completed_at: null,
        };
        successMessage =
          "Bank account saved. Please upload KYC document to complete setup.";
        break;
      case "gcash":
        updatePayload = {
          payout_method: "gcash",
          gcash_phone_number: parsed.data.gcash_phone_number,
          bank_name: null,
          bank_account_number: null,
          bank_account_name: null,
          bank_kyc_verified: false,
          bank_kyc_document_url: null,
          bank_kyc_verified_at: null,
          maya_phone_number: null,
          payout_setup_completed: true,
          payout_setup_completed_at: now,
        };
        fallbackPayload = {
          payout_method: "gcash",
          gcash_phone_number: parsed.data.gcash_phone_number,
          bank_name: null,
          bank_account_number: null,
          bank_account_name: null,
          maya_phone_number: null,
          payout_setup_completed: true,
          payout_setup_completed_at: now,
        };
        successMessage = "GCash account set up successfully!";
        break;
      case "maya":
        updatePayload = {
          payout_method: "maya",
          maya_phone_number: parsed.data.maya_phone_number,
          bank_name: null,
          bank_account_number: null,
          bank_account_name: null,
          bank_kyc_verified: false,
          bank_kyc_document_url: null,
          bank_kyc_verified_at: null,
          gcash_phone_number: null,
          payout_setup_completed: true,
          payout_setup_completed_at: now,
        };
        fallbackPayload = {
          payout_method: "maya",
          maya_phone_number: parsed.data.maya_phone_number,
          bank_name: null,
          bank_account_number: null,
          bank_account_name: null,
          gcash_phone_number: null,
          payout_setup_completed: true,
          payout_setup_completed_at: now,
        };
        successMessage = "Maya account set up successfully!";
        break;
    }

    let { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    if (error) {
      console.error("setupPayoutMethod update failed:", error);
      if (error.code === "23505") {
        return {
          error:
            parsed.data.method === "gcash"
              ? "That GCash number is already being used by another account."
              : parsed.data.method === "maya"
                ? "That Maya number is already being used by another account."
                : "That payout detail is already in use.",
        };
      }

      const fallbackResult = await supabase
        .from("profiles")
        .update(fallbackPayload)
        .eq("id", user.id);

      if (fallbackResult.error) {
        console.error("setupPayoutMethod fallback update failed:", fallbackResult.error);
        return {
          error:
            fallbackResult.error.message ||
            error.message ||
            "Could not save your payout method. Please try again.",
        };
      }
    }

    await createNotification({
      userId: user.id,
      type: "payout_method_updated",
      title: "Payout method set up successfully!",
      body:
        parsed.data.method === "bank"
          ? "Your bank details are saved. Upload your KYC document to finish setup."
          : "You can now create listings.",
      actionUrl: "/dashboard/settings/payments",
    });

    if (isMethodChange) {
      await createNotification({
        userId: user.id,
        type: "payout_method_changed",
        title: "Payout method changed",
        body: pendingPayoutWarning
          ? `${pendingPayoutWarning} Your future payouts will use ${parsed.data.method}.`
          : `Your payout method has been updated to ${parsed.data.method}.`,
        actionUrl: "/dashboard/settings/payments",
      });
    }

    revalidatePayoutViews();
    return {
      success: pendingPayoutWarning
        ? `${successMessage} ${pendingPayoutWarning}`
        : successMessage,
    };
  } catch (error) {
    console.error("setupPayoutMethod failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function uploadKYCDocument(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const { user, profile } = await requireAuthenticatedProfile();

    if (profile.payout_method !== "bank") {
      return { error: "KYC only required for bank payouts" };
    }

    const parsed = kycUploadSchema.safeParse({
      user_id: user.id,
      document_type: formData.get("document_type"),
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Invalid KYC document details",
      };
    }

    const documentFile = formData.get("kyc_document");

    if (!(documentFile instanceof File) || documentFile.size === 0) {
      return { error: "Please choose a KYC document to upload" };
    }

    if (!ALLOWED_KYC_MIME_TYPES.has(documentFile.type)) {
      return { error: "KYC document must be a PDF, JPG, or PNG file" };
    }

    if (documentFile.size > MAX_KYC_FILE_SIZE) {
      return { error: "KYC document must be 10MB or smaller" };
    }

    const extension = getFileExtension(documentFile);
    const filePath = `${user.id}/kyc-${parsed.data.document_type}-${crypto.randomUUID()}.${extension}`;
    const fileBuffer = Buffer.from(await documentFile.arrayBuffer());
    const admin = createAdminClient();
    const previousDocumentUrl = profile.bank_kyc_document_url ?? null;
    const bucketError = await ensureKycBucketExists(admin);

    if (bucketError) {
      console.error("uploadKYCDocument bucket check failed:", bucketError);
      return { error: `Could not prepare KYC storage: ${bucketError}` };
    }

    const { error: uploadError } = await admin.storage
      .from(KYC_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: documentFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("uploadKYCDocument upload failed:", uploadError);
      if (/fetch failed/i.test(uploadError.message)) {
        return {
          error:
            "Could not reach Supabase Storage from the app server. Please retry now that the dev server has restarted; if it persists, check the Supabase URL/network connection.",
        };
      }

      return { error: `Could not upload your KYC document: ${uploadError.message}` };
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(KYC_BUCKET).getPublicUrl(filePath);

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        bank_kyc_document_url: publicUrl,
        bank_kyc_verified: false,
        bank_kyc_verified_at: null,
        payout_setup_completed: false,
        payout_setup_completed_at: null,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("uploadKYCDocument profile update failed:", updateError);
      await admin.storage.from(KYC_BUCKET).remove([filePath]);
      return { error: "Could not save your KYC document. Please try again." };
    }

    await removeStoredKycDocument(previousDocumentUrl);

    const adminIds = await getAdminIds();
    void notifyKYCSubmitted({
      userId: user.id,
      adminIds,
      userName: getUserDisplayName(profile),
    }).catch((error) => {
      console.error("uploadKYCDocument notification failed:", error);
    });

    revalidatePayoutViews();
    return {
      success:
        "KYC document uploaded successfully. You'll be notified once verified.",
    };
  } catch (error) {
    console.error("uploadKYCDocument failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function verifyKYC(
  userId: string,
  approved: boolean,
  notes?: string,
): Promise<ActionResponse> {
  try {
    const { adminId } = await requireAdminProfile();
    const admin = createAdminClient();
    const { data: targetProfile, error } = await admin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle<Profile>();

    if (error || !targetProfile) {
      return { error: "User profile not found" };
    }

    const now = new Date().toISOString();
    const previousDocumentUrl = targetProfile.bank_kyc_document_url ?? null;
    const updatePayload = approved
      ? {
          bank_kyc_verified: true,
          bank_kyc_verified_at: now,
          payout_setup_completed: true,
          payout_setup_completed_at: now,
        }
      : {
          bank_kyc_verified: false,
          bank_kyc_document_url: null,
          bank_kyc_verified_at: null,
          payout_setup_completed: false,
          payout_setup_completed_at: null,
        };

    const { error: updateError } = await admin
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId);

    if (updateError) {
      console.error("verifyKYC update failed:", updateError);
      return { error: "Could not update KYC verification. Please try again." };
    }

    if (!approved) {
      await removeStoredKycDocument(previousDocumentUrl);
    }

    if (approved && targetProfile.payout_method === "bank") {
      const payoutCurrency = getLocalCurrencyForCountry(
        inferPayoutCountryCode(targetProfile),
      ).toUpperCase();
      const { error: revivePayoutError } = await admin
        .from("payouts")
        .update({
          status: "pending",
          failure_reason: null,
          can_retry: false,
          currency: payoutCurrency,
          notes: "Bank KYC approved. Payout is ready to process.",
        })
        .eq("lister_id", userId)
        .eq("status", "failed")
        .eq("payout_method", "bank")
        .eq("failure_reason", "Invalid payout details");

      if (revivePayoutError) {
        console.error("verifyKYC revive payouts failed:", revivePayoutError);
      }
    }

    if (approved) {
      void notifyKYCVerified({ userId }).catch((notificationError) => {
        console.error("verifyKYC approval notification failed:", notificationError);
      });
    } else {
      void notifyKYCRejected({
        userId,
        reason: notes?.trim() || "No reason provided",
      }).catch((notificationError) => {
        console.error("verifyKYC rejection notification failed:", notificationError);
      });
    }

    await logAdminAction({
      adminId,
      action: approved ? "kyc_verified" : "kyc_rejected",
      targetType: "user",
      targetId: userId,
      details: {
        approved,
        notes: notes?.trim() || null,
        previous_document_url: previousDocumentUrl,
      },
    });

    revalidatePayoutViews();
    return {
      success: approved
        ? "KYC verified successfully."
        : "KYC rejected and user notified.",
    };
  } catch (error) {
    console.error("verifyKYC failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function canCreateListing(
  userId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    console.log("[VERIFICATION] Checking listing eligibility for user:", userId);
    
    const { requester, client } = await getAccessibleProfile(userId);

    if (requester.id !== userId && !requester.is_admin) {
      console.log("[VERIFICATION] Unauthorized access attempt for user:", userId);
      return { allowed: false, reason: "Unauthorized" };
    }

    console.log("[VERIFICATION] Checking account verification status via RPC...");
    const allowed = await callBooleanRpc(client, "can_user_create_listing", [
      { p_user_id: userId },
      { user_id: userId },
    ]);

    if (allowed) {
      console.log("[VERIFICATION] ✓ User", userId, "is verified and can create listings");
      return { allowed: true };
    }

    console.log("[VERIFICATION] ✗ User", userId, "verification check returned false");

    const payoutStatus = await getPayoutSetupStatus(userId);
    const { target } = await getAccessibleProfile(userId);

    console.log("[VERIFICATION] Checking payout setup - Method:", target.payout_method, "KYC Status:", payoutStatus.kyc_status);

    if (target.payout_method === "bank" && payoutStatus.kyc_status === "pending") {
      console.log("[VERIFICATION] KYC verification is pending for user:", userId);
      return {
        allowed: false,
        reason:
          "Your KYC document is being reviewed. You'll be able to create listings once verified.",
      };
    }

    if (target.payout_method === "bank" && payoutStatus.kyc_status === "rejected") {
      console.log("[VERIFICATION] KYC verification was rejected for user:", userId);
      return {
        allowed: false,
        reason:
          "Your KYC document was rejected. Please upload a new document to complete payout setup.",
      };
    }

    console.log("[VERIFICATION] Payout setup incomplete for user:", userId);
    return {
      allowed: false,
      reason: "Please set up your payout method in Settings before creating a listing.",
    };
  } catch (error) {
    console.error("[VERIFICATION] canCreateListing failed for user", userId, ":", error);
    return {
      allowed: false,
      reason: "Please set up your payout method in Settings before creating a listing.",
    };
  }
}
