import { Camera, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function VerificationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Verification</h1>
        <p className="text-sm text-muted-foreground">
          Complete your document review requirements before creating listings.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <div className="space-y-1">
            <p className="flex items-center gap-2 font-medium">
              <ShieldCheck className="size-4" />
              Government ID
            </p>
            <p className="text-sm text-muted-foreground">
              Upload the front and back of your government-issued ID for admin review.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <div className="space-y-1">
            <p className="flex items-center gap-2 font-medium">
              <Camera className="size-4" />
              Selfie
            </p>
            <p className="text-sm text-muted-foreground">
              Upload a current selfie so the admin team can match it with your ID.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <div className="space-y-1">
            <p className="font-medium">Manual admin confirmation</p>
            <p className="text-sm text-muted-foreground">
              Once both documents are submitted, an admin reviews and approves your account for listing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
