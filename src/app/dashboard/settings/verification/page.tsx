import { Mail, Phone, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { sendVerificationEmail } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

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

  async function handleSendVerificationEmail() {
    "use server";
    await sendVerificationEmail();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Verification</h1>
        <p className="text-sm text-muted-foreground">
          Review your current verification status and complete any available steps.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-medium">
                <Mail className="size-4" />
                Email
              </p>
              <p className="text-sm text-muted-foreground">
                {profile.email_verified ? "Verified" : "Not verified"}
              </p>
            </div>
            {!profile.email_verified ? (
              <form action={handleSendVerificationEmail}>
                <Button type="submit" variant="outline">
                  Send Verification Email
                </Button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <div className="space-y-1">
            <p className="flex items-center gap-2 font-medium">
              <Phone className="size-4" />
              Phone
            </p>
            <p className="text-sm text-muted-foreground">Coming Soon</p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <div className="space-y-1">
            <p className="flex items-center gap-2 font-medium">
              <ShieldCheck className="size-4" />
              ID
            </p>
            <p className="text-sm text-muted-foreground">Coming Soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
