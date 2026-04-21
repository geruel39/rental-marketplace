import { redirect } from "next/navigation";

import { getListingEligibility } from "@/actions/verification";
import { getCategories } from "@/actions/listings";
import { ListingForm } from "@/components/listings/listing-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function NewListingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const listingAccess = await getListingEligibility(user.id);

  if (!listingAccess.allowed) {
    const isPending = listingAccess.reason?.includes("pending");
    const isRejected = listingAccess.reason?.includes("rejected");

    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <Card className="w-full rounded-3xl border-border/70 bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl text-brand-navy">
              {isPending ? "Your verification is pending review" : "Verification Required"}
            </CardTitle>
            <CardDescription className="text-base">
              {listingAccess.message ||
                listingAccess.reason ||
                "Complete your verification requirements before creating listings."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isPending ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-medium">Expected review time: 1-3 business days</p>
                <p className="mt-1">We&apos;ll notify you as soon as your verification is approved.</p>
              </div>
            ) : null}

            {isRejected ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                Your last verification submission was rejected. Review the notes and resubmit the required documents.
              </div>
            ) : null}

            <details className="rounded-2xl border border-brand-navy/10 bg-brand-light p-4">
              <summary className="cursor-pointer list-none font-medium text-brand-navy">
                Why do I need verification?
              </summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Verification helps us protect renters and listers on the platform.
                Once your account is approved, you&apos;ll be able to publish listings
                and start earning from your items.
              </p>
            </details>

            <Button asChild className="bg-brand-navy text-white hover:bg-brand-steel">
              <Link href="/account/verify">Complete Verification</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const categories = await getCategories();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Create a New Listing
        </h1>
        <p className="text-sm text-muted-foreground">
          Add photos, pricing, stock, and policies so renters can book with
          confidence.
        </p>
      </div>
      <ListingForm categories={categories} />
    </main>
  );
}
