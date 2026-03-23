"use server";

import { redirect } from "next/navigation";

import { getAppUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { registerSchema } from "@/lib/validations";
import type { ActionResponse } from "@/types";

export async function registerWithEmail(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;
  const supabase = await createClient();

  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    full_name: formData.get("full_name"),
    display_name: formData.get("display_name") || undefined,
    account_type: formData.get("account_type") || "individual",
    business_name: formData.get("business_name") || undefined,
    business_registration: formData.get("business_registration") || undefined,
  };

  const validated = registerSchema.safeParse(raw);

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data, error } = await supabase.auth.signUp({
    email: validated.data.email,
    password: validated.data.password,
    options: {
      data: {
        full_name: validated.data.full_name || "",
        display_name:
          validated.data.display_name || validated.data.full_name || "",
        account_type:
          validated.data.account_type === "business"
            ? "business"
            : "individual",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user && data.session) {
    redirect("/dashboard");
  }

  if (data.user && !data.session) {
    return { success: "Check your email" };
  }

  return { error: "Something went wrong" };
}

export async function loginWithEmail(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;
  const supabase = await createClient();
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    email.length === 0 ||
    typeof password !== "string" ||
    password.length === 0
  ) {
    return { error: "Email and password are required" };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function loginWithGoogle(): Promise<ActionResponse | void> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getAppUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { error: "Something went wrong" };
}

export async function logout() {
  const supabase = await createClient();

  await supabase.auth.signOut();
  redirect("/");
}
