import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export default async function AccountProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (error || !profile) {
    redirect("/listings");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {!profile.payout_setup_completed ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTitle>Complete your payout setup to start listing items.</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Finish your payout method setup so you can receive earnings and publish listings.
            </span>
            <Button asChild className="bg-brand-navy text-white hover:bg-brand-steel" size="sm">
              <Link href="/lister/settings/payments">Go to Payment Settings</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Account Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your public profile, avatar, and personal contact details.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
        <ProfileSettingsForm profile={profile} />
      </div>
    </div>
  );
}
