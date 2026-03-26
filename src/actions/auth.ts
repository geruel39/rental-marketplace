"use server";

import { redirect } from "next/navigation";

import { getAppUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, registerSchema } from "@/lib/validations";
import type { ActionResponse } from "@/types";

export async function registerWithEmail(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
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
      console.error("registerWithEmail failed:", error);
      return { error: "Could not create your account. Please try again." };
    }

    if (data.user && data.session) {
      redirect("/dashboard");
    }

    if (data.user && !data.session) {
      return { success: "Check your email" };
    }

    return { error: "Something went wrong. Please try again." };
  } catch (error) {
    console.error("registerWithEmail failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function loginWithEmail(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
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
      console.error("loginWithEmail failed:", error);
      return { error: "Invalid email or password." };
    }

    redirect("/dashboard");
  } catch (error) {
    console.error("loginWithEmail failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function loginWithGoogle(): Promise<ActionResponse | void> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getAppUrl()}/auth/callback`,
      },
    });

    if (error) {
      console.error("loginWithGoogle failed:", error);
      return { error: "Could not start Google sign-in. Please try again." };
    }

    if (data.url) {
      redirect(data.url);
    }

    return { error: "Something went wrong. Please try again." };
  } catch (error) {
    console.error("loginWithGoogle failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function sendPasswordResetEmail(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const supabase = await createClient();
    const parsed = forgotPasswordSchema.safeParse({
      email: formData.get("email"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid email" };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${getAppUrl()}/reset-password`,
    });

    if (error) {
      console.error("sendPasswordResetEmail failed:", error);
      return { error: "Could not send the reset email. Please try again." };
    }

    return { success: "Password reset link sent. Check your email." };
  } catch (error) {
    console.error("sendPasswordResetEmail failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function logout() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("logout failed:", error);
    }
  } catch (error) {
    console.error("logout failed:", error);
  }

  redirect("/");
}
