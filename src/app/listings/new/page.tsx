import { redirect } from "next/navigation";

import { getCategories } from "@/actions/listings";
import { ListingForm } from "@/components/listings/listing-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewListingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
