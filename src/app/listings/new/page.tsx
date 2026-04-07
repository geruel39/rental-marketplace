import { redirect } from "next/navigation";

import { canCreateListing } from "@/actions/payout";
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

  const listingAccess = await canCreateListing(user.id);

  if (!listingAccess.allowed) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <Card className="w-full rounded-3xl border-border/70 bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl text-brand-navy">
              Payout Setup Required
            </CardTitle>
            <CardDescription className="text-base">
              You must set up your payout method before creating listings. This
              ensures you can receive payments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <details className="rounded-2xl border border-brand-navy/10 bg-brand-light p-4">
              <summary className="cursor-pointer list-none font-medium text-brand-navy">
                Why do I need payout setup?
              </summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                To ensure you can receive payments from renters, you must configure
                your payout method. This is a one-time setup. Choose from bank
                transfer, GCash, or Maya.
              </p>
            </details>

            <div className="overflow-hidden rounded-2xl border border-border/70">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-light text-brand-navy">
                  <tr>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Setup Time</th>
                    <th className="px-4 py-3 font-medium">Verification</th>
                    <th className="px-4 py-3 font-medium">Payout Speed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  <tr>
                    <td className="px-4 py-3">Bank</td>
                    <td className="px-4 py-3">2-3 days</td>
                    <td className="px-4 py-3">KYC Required</td>
                    <td className="px-4 py-3">1-2 days</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">GCash</td>
                    <td className="px-4 py-3">Instant</td>
                    <td className="px-4 py-3">None</td>
                    <td className="px-4 py-3">Instant</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Maya</td>
                    <td className="px-4 py-3">Instant</td>
                    <td className="px-4 py-3">None</td>
                    <td className="px-4 py-3">Instant</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Button asChild className="bg-brand-navy text-white hover:bg-brand-steel">
              <Link href="/dashboard/settings/payments">Set Up Payout Now</Link>
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
