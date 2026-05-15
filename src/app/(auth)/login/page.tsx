import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Login — RentHub",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle<{ is_admin: boolean }>();

    redirect(profile?.is_admin ? "/admin" : "/listings");
  }

  return (
    <div className="w-full bg-brand-light">
      <LoginForm />
    </div>
  );
}
