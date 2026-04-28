"use server";

import { redirect } from "next/navigation";

import { sendWelcomeEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  businessRegisterSchema,
  forgotPasswordSchema,
  individualRegisterSchema,
} from "@/lib/validations";
import type { ActionResponse } from "@/types";

function getTermsAgreementValue(value: FormDataEntryValue | null) {
  return value === "true" || value === "on";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function registerIndividual(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const supabase = await createClient();
    const raw = {
      first_name: formData.get("first_name"),
      last_name: formData.get("last_name"),
      display_name: formData.get("display_name"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirm_password: formData.get("confirm_password"),
      terms_agreed: getTermsAgreementValue(formData.get("terms_agreed")),
    };

    const validated = individualRegisterSchema.safeParse(raw);
    if (!validated.success) {
      return { error: validated.error.issues[0]?.message ?? "Invalid input" };
    }

    const fullName = `${validated.data.first_name} ${validated.data.last_name}`;
    const { data, error } = await supabase.auth.signUp({
      email: validated.data.email,
      password: validated.data.password,
      options: {
        data: {
          account_type: "individual",
          first_name: validated.data.first_name,
          last_name: validated.data.last_name,
          full_name: fullName,
          display_name: validated.data.display_name,
          terms_agreed: true,
          terms_version: "1.0",
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      void sendWelcomeEmail({
        to: validated.data.email,
        displayName:
          validated.data.display_name || validated.data.first_name || "User",
        accountType: "individual",
      });
    }

    if (data.session) {
      redirect("/listings");
    }

    return { success: "Account created! Check your email to continue." };
  } catch (error) {
    console.error("registerIndividual failed:", error);
    return { error: getErrorMessage(error, "Something went wrong. Please try again.") };
  }
}

export async function registerBusiness(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const supabase = await createClient();
    const raw = {
      representative_first_name: formData.get("representative_first_name"),
      representative_last_name: formData.get("representative_last_name"),
      display_name: formData.get("display_name"),
      business_name: formData.get("business_name"),
      business_registration: formData.get("business_registration"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirm_password: formData.get("confirm_password"),
      terms_agreed: getTermsAgreementValue(formData.get("terms_agreed")),
    };

    const validated = businessRegisterSchema.safeParse(raw);
    if (!validated.success) {
      return { error: validated.error.issues[0]?.message ?? "Invalid input" };
    }

    const fullName = `${validated.data.representative_first_name} ${validated.data.representative_last_name}`;
    const { data, error } = await supabase.auth.signUp({
      email: validated.data.email,
      password: validated.data.password,
      options: {
        data: {
          account_type: "business",
          first_name: validated.data.representative_first_name,
          last_name: validated.data.representative_last_name,
          representative_first_name: validated.data.representative_first_name,
          representative_last_name: validated.data.representative_last_name,
          full_name: fullName,
          display_name: validated.data.display_name,
          business_name: validated.data.business_name,
          business_registration: validated.data.business_registration,
          terms_agreed: true,
          terms_version: "1.0",
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      void sendWelcomeEmail({
        to: validated.data.email,
        displayName:
          validated.data.display_name ||
          validated.data.business_name ||
          validated.data.representative_first_name ||
          "User",
        accountType: "business",
      });
    }

    if (data.session) {
      redirect("/listings");
    }

    return { success: "Account created! Check your email to continue." };
  } catch (error) {
    console.error("registerBusiness failed:", error);
    return { error: getErrorMessage(error, "Something went wrong. Please try again.") };
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
      return { error: error.message };
    }

    redirect("/listings");
  } catch (error) {
    console.error("loginWithEmail failed:", error);
    return { error: getErrorMessage(error, "Something went wrong. Please try again.") };
  }
}

export async function loginWithGoogle(): Promise<ActionResponse | void> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getAppUrl()}/callback`,
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data.url) {
      redirect(data.url);
    }

    return { error: "Something went wrong. Please try again." };
  } catch (error) {
    console.error("loginWithGoogle failed:", error);
    return { error: getErrorMessage(error, "Something went wrong. Please try again.") };
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
      return { error: error.message };
    }

    return { success: "Password reset link sent. Check your email." };
  } catch (error) {
    console.error("sendPasswordResetEmail failed:", error);
    return { error: getErrorMessage(error, "Something went wrong. Please try again.") };
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

// Deprecated compatibility export retained while old register UI is phased out.
export const registerWithEmail = registerIndividual;
