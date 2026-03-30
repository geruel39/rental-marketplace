"use server";

import { createNotification } from "@/actions/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResponse, Report } from "@/types";

export async function submitReport(formData: FormData): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be signed in to submit a report." };
    }

    const reportType = formData.get("report_type")?.toString().trim();
    const description = formData.get("description")?.toString().trim();
    const reportedUserId = formData.get("reported_user_id")?.toString().trim() || null;
    const reportedListingId = formData.get("reported_listing_id")?.toString().trim() || null;
    const reportedReviewId = formData.get("reported_review_id")?.toString().trim() || null;

    if (!reportType || !description || description.length < 10) {
      return { error: "Please provide a report type and at least 10 characters of detail." };
    }

    if (!reportedUserId && !reportedListingId && !reportedReviewId) {
      return { error: "A report target is required." };
    }

    const admin = createAdminClient();
    const { error } = await admin.from("reports").insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId,
      reported_listing_id: reportedListingId,
      reported_review_id: reportedReviewId,
      report_type: reportType,
      description,
      status: "open",
    });

    if (error) {
      throw error;
    }

    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("is_admin", true);

    await Promise.all(
      (admins ?? []).map((adminProfile) =>
        createNotification({
          userId: adminProfile.id,
          type: "new_report",
          title: `New report submitted: ${reportType}`,
          body: description.slice(0, 140),
          fromUserId: user.id,
          actionUrl: "/admin/reports",
        }),
      ),
    );

    return { success: "Report submitted. We'll review it shortly." };
  } catch (error) {
    console.error("submitReport failed:", error);
    return { error: "Could not submit your report. Please try again." };
  }
}

export async function getMyReports(userId: string): Promise<Report[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== userId) {
      throw new Error("Unauthorized");
    }

    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("reporter_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []) as Report[];
  } catch (error) {
    console.error("getMyReports failed:", error);
    return [];
  }
}
