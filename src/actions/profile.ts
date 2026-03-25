"use server";

import { createClient } from "@/lib/supabase/server";
import {
  payoutSettingsSchema,
  profileUpdateSchema,
} from "@/lib/validations";
import type {
  ActionResponse,
  Listing,
  PaginatedResponse,
  Payout,
  Profile,
} from "@/types";

const USER_LISTINGS_PER_PAGE = 8;
const AVATARS_BUCKET = "avatars";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getPagination(page?: number, perPage = USER_LISTINGS_PER_PAGE) {
  const currentPage = Math.max(1, page ?? 1);
  const from = (currentPage - 1) * perPage;
  const to = from + perPage - 1;

  return { currentPage, from, to, perPage };
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function uploadAvatar(userId: string, file: File) {
  const supabase = await createClient();
  const filePath = `${userId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function getPublicProfile(userId: string): Promise<{
  profile: Profile;
  listingsCount: number;
  reviewsAsListerCount: number;
  reviewsAsRenterCount: number;
} | null> {
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    return null;
  }

  const [
    { count: listingsCount, error: listingsError },
    { count: reviewsAsListerCount, error: listerReviewsError },
    { count: reviewsAsRenterCount, error: renterReviewsError },
  ] = await Promise.all([
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("status", "active"),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("reviewee_id", userId)
      .eq("review_role", "as_renter"),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("reviewee_id", userId)
      .eq("review_role", "as_lister"),
  ]);

  if (listingsError || listerReviewsError || renterReviewsError) {
    throw new Error(
      listingsError?.message ||
        listerReviewsError?.message ||
        renterReviewsError?.message ||
        "Failed to load public profile stats",
    );
  }

  return {
    profile,
    listingsCount: listingsCount ?? 0,
    reviewsAsListerCount: reviewsAsListerCount ?? 0,
    reviewsAsRenterCount: reviewsAsRenterCount ?? 0,
  };
}

export async function getUserListings(
  userId: string,
  page?: number,
): Promise<PaginatedResponse<Listing>> {
  const supabase = await createClient();
  const { currentPage, from, to, perPage } = getPagination(page);

  const { data, error, count } = await supabase
    .from("listings")
    .select("*", { count: "exact" })
    .eq("owner_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return {
    data: (data ?? []) as Listing[],
    totalCount: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
    currentPage,
  };
}

export async function updateProfile(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be signed in" };
    }

    const avatarFile = formData.get("avatar");
    let avatarUrl: string | undefined;

    if (avatarFile instanceof File && avatarFile.size > 0) {
      avatarUrl = await uploadAvatar(user.id, avatarFile);
    }

    const parsed = profileUpdateSchema.safeParse({
      full_name: formData.get("full_name")?.toString().trim() || undefined,
      display_name: formData.get("display_name")?.toString().trim() || undefined,
      bio: formData.get("bio")?.toString().trim() || undefined,
      phone: formData.get("phone")?.toString().trim() || undefined,
      location: formData.get("location")?.toString().trim() || undefined,
      city: formData.get("city")?.toString().trim() || undefined,
      state: formData.get("state")?.toString().trim() || undefined,
      country: formData.get("country")?.toString().trim() || undefined,
      website_url: formData.get("website_url")?.toString().trim() || "",
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid profile data" };
    }

    const updatePayload = {
      full_name: parsed.data.full_name ?? null,
      display_name: parsed.data.display_name ?? null,
      bio: parsed.data.bio ?? null,
      phone: parsed.data.phone ?? null,
      location: parsed.data.location ?? null,
      city: parsed.data.city ?? null,
      state: parsed.data.state ?? null,
      country: parsed.data.country ?? null,
      website_url: parsed.data.website_url || null,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    };

    const { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    if (error) {
      return { error: error.message };
    }

    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: {
        avatar_url: avatarUrl ?? user.user_metadata.avatar_url ?? null,
        display_name:
          parsed.data.display_name ?? user.user_metadata.display_name ?? null,
        full_name: parsed.data.full_name ?? user.user_metadata.full_name ?? null,
      },
    });

    if (authUpdateError) {
      return { error: authUpdateError.message };
    }

    return { success: "Profile updated" };
  } catch (error) {
    return { error: getErrorMessage(error, "Failed to update profile") };
  }
}

export async function updatePayoutSettings(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be signed in" };
    }

    const payoutEmail = formData.get("payout_email")?.toString().trim() || undefined;
    const bankName = formData.get("bank_name")?.toString().trim();
    const accountNumber = formData.get("account_number")?.toString().trim();
    const routingNumber = formData.get("routing_number")?.toString().trim();
    const accountHolder = formData.get("account_holder")?.toString().trim();

    const hasBankAccountValues = Boolean(
      bankName || accountNumber || routingNumber || accountHolder,
    );

    const parsed = payoutSettingsSchema.safeParse({
      payout_email: payoutEmail,
      payout_bank_account: hasBankAccountValues
        ? {
            bank_name: bankName,
            account_number: accountNumber,
            routing_number: routingNumber,
            account_holder: accountHolder,
          }
        : undefined,
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Invalid payout settings",
      };
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        payout_email: parsed.data.payout_email ?? null,
        payout_bank_account: parsed.data.payout_bank_account ?? null,
      })
      .eq("id", user.id);

    if (error) {
      return { error: error.message };
    }

    return { success: "Payout settings saved" };
  } catch (error) {
    return { error: getErrorMessage(error, "Failed to save payout settings") };
  }
}

export async function sendVerificationEmail(): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return { error: "You must be signed in" };
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });

    if (error) {
      return { error: error.message };
    }

    return { success: "Verification email sent" };
  } catch (error) {
    return { error: getErrorMessage(error, "Failed to send verification email") };
  }
}

export async function getPayoutsForUser(userId: string): Promise<Payout[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payouts")
    .select("*")
    .eq("lister_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Payout[];
}
