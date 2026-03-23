import { redirect } from "next/navigation";

import { getCategories, getListing } from "@/actions/listings";
import { ListingForm } from "@/components/listings/listing-form";
import { createClient } from "@/lib/supabase/server";

interface EditListingPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditListingPage({
  params,
}: EditListingPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [listing, categories] = await Promise.all([
    getListing(id),
    getCategories(),
  ]);

  if (!listing || listing.owner_id !== user.id) {
    redirect("/dashboard/my-listings");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Edit Listing</h1>
        <p className="text-sm text-muted-foreground">
          Update pricing, inventory, photos, and rental policies.
        </p>
      </div>
      <ListingForm categories={categories} listing={listing} />
    </div>
  );
}
