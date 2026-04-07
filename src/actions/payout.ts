"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createNotification } from "@/actions/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { kycUploadSchema, payoutMethodSchema } from "@/lib/validations";
import type {
  ActionResponse,
  AdminTargetType,
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

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
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

function revalidatePayoutViews() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/settings/payments");
  revalidatePath("/listings/new");
  revalidatePath("/dashboard/my-listings");
  revalidatePath("/admin");
  revalidatePath("/admin/users");
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
      kyc_status: getKycStatus(target),
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
    const { user, profile } = await requireAuthenticatedProfile();
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

    if (profile.payout_method && profile.payout_method !== parsed.data.method) {
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
          payout_bank_account: null,
          payout_email: null,
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
          payout_bank_account: null,
          payout_email: null,
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
          payout_bank_account: null,
          payout_email: null,
        };
        successMessage = "Maya account set up successfully!";
        break;
    }

    const { error } = await admin
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    if (error) {
      console.error("setupPayoutMethod update failed:", error);
      return { error: "Could not save your payout method. Please try again." };
    }

    await createNotification({
      userId: user.id,
      type: "payout_method_updated",
      title: "Payout method set up successfully!",
      body: "You can now create listings.",
      actionUrl: "/dashboard/settings/payments",
    });

    revalidatePayoutViews();
    return { success: successMessage };
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
    const fileBuffer = await documentFile.arrayBuffer();
    const admin = createAdminClient();

    const { error: uploadError } = await admin.storage
      .from(KYC_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: documentFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("uploadKYCDocument upload failed:", uploadError);
      return { error: "Could not upload your KYC document. Please try again." };
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
      return { error: "Could not save your KYC document. Please try again." };
    }

    await createNotification({
      userId: user.id,
      type: "kyc_uploaded",
      title: "KYC document uploaded",
      body: "KYC document uploaded. Awaiting admin verification.",
      actionUrl: "/dashboard/settings/verification",
    });

    const { data: adminUsers, error: adminUsersError } = await admin
      .from("profiles")
      .select("id")
      .eq("is_admin", true);

    if (adminUsersError) {
      console.error("uploadKYCDocument admin fetch failed:", adminUsersError);
    } else {
      await Promise.all(
        ((adminUsers ?? []) as Array<Pick<Profile, "id">>).map((adminUser) =>
          createNotification({
            userId: adminUser.id,
            type: "kyc_review_required",
            title: "New KYC document to review",
            body: `New KYC document to review from ${getUserDisplayName(profile)}`,
            fromUserId: user.id,
            actionUrl: `/admin/users/${user.id}`,
          }),
        ),
      );
    }

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

    await createNotification({
      userId,
      type: approved ? "kyc_verified" : "kyc_rejected",
      title: approved ? "KYC verified" : "KYC rejected",
      body: approved
        ? `Your KYC has been verified! Your ${targetProfile.bank_name || "bank"} account is ready for payouts.`
        : `Your KYC document was rejected. Please upload a new one. Reason: ${notes?.trim() || "No reason provided"}`,
      actionUrl: "/dashboard/settings/verification",
    });

    await logAdminAction({
      adminId,
      action: approved ? "kyc_verified" : "kyc_rejected",
      targetType: "user",
      targetId: userId,
      details: {
        approved,
        notes: notes?.trim() || null,
        previous_document_url: targetProfile.bank_kyc_document_url ?? null,
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
    const { requester, client } = await getAccessibleProfile(userId);

    if (requester.id !== userId && !requester.is_admin) {
      return { allowed: false, reason: "Unauthorized" };
    }

    const allowed = await callBooleanRpc(client, "can_user_create_listing", [
      { p_user_id: userId },
      { user_id: userId },
    ]);

    if (allowed) {
      return { allowed: true };
    }

    await getPayoutSetupStatus(userId);
    return {
      allowed: false,
      reason: "Please set up your payout method in Settings before creating a listing.",
    };
  } catch (error) {
    console.error("canCreateListing failed:", error);
    return {
      allowed: false,
      reason: "Please set up your payout method in Settings before creating a listing.",
    };
  }
}
