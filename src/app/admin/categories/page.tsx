import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminCategoryTable } from "@/components/admin/admin-category-table";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Category, Listing } from "@/types";

async function verifyAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();

  if (!profile?.is_admin) {
    throw new Error("Unauthorized");
  }
}

export default async function AdminCategoriesPage() {
  await verifyAdminAccess();

  const admin = createAdminClient();
  const [categoriesResult, listingsResult] = await Promise.all([
    admin.from("categories").select("*").order("sort_order", { ascending: true }),
    admin.from("listings").select("id, category_id"),
  ]);

  const categories = (categoriesResult.data ?? []) as Category[];
  const listings = (listingsResult.data ?? []) as Pick<Listing, "id" | "category_id">[];

  const rows = categories.map((category) => ({
    ...category,
    listingsCount: listings.filter((listing) => listing.category_id === category.id).length,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Categories"
        description="Manage category structure, ordering, and availability across the marketplace."
      />
      <AdminCategoryTable categories={rows} />
    </div>
  );
}
