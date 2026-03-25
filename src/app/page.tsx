import Link from "next/link";
import { DollarSign, PackagePlus, Search } from "lucide-react";

import { checkFavorites } from "@/actions/favorites";
import { ListingGrid } from "@/components/listings/listing-grid";
import { SearchBar } from "@/components/shared/search-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Category, ListingWithOwner } from "@/types";

const trustIndicators = ["10K+ Items", "Verified Users", "Secure Payments"];

const steps = [
  {
    title: "1. List Your Items",
    description: "Create a listing, upload photos, and set your rental terms.",
    icon: PackagePlus,
  },
  {
    title: "2. Browse & Book",
    description: "Search by category or location and send booking requests fast.",
    icon: Search,
  },
  {
    title: "3. Rent & Earn",
    description: "Collect bookings, manage inventory, and grow repeat renters.",
    icon: DollarSign,
  },
];

export default async function Home() {
  let categories: Category[] = [];
  let listings: ListingWithOwner[] = [];
  let favoritedIds: string[] = [];
  let isLoggedIn = false;
  let currentUserId: string | undefined;

  if (hasSupabaseEnv()) {
    const supabase = await createClient();

    const [
      {
        data: { user },
      },
      { data: categoryData },
      { data: listingData },
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("listings")
        .select("*, owner:profiles!listings_owner_id_fkey(*)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    isLoggedIn = Boolean(user);
    currentUserId = user?.id;
    categories = (categoryData ?? []) as Category[];
    listings = (listingData ?? []) as ListingWithOwner[];

    if (user && listings.length > 0) {
      favoritedIds = Array.from(
        await checkFavorites(
          listings.map((listing) => listing.id),
          user.id,
        ),
      );
    }
  }

  return (
    <div className="bg-background">
      <section className="bg-gradient-to-br from-sky-700 via-blue-700 to-violet-700 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
              Rent Anything From Anyone
            </h1>
            <p className="mt-4 text-lg text-blue-100 sm:text-xl">
              The peer-to-peer marketplace for renting everyday items.
            </p>
            <div className="mt-8">
              <SearchBar categories={categories} />
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-blue-100">
              {trustIndicators.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Browse by Category
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Discover the most popular rental categories on RentHub.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
          {categories.map((category) => (
            <Link
              key={category.id}
              className="rounded-2xl border border-border/70 bg-card p-4 text-center transition-colors hover:bg-muted/40"
              href={`/listings?category=${category.slug}`}
            >
              <div className="text-2xl">{category.icon ?? "📦"}</div>
              <div className="mt-3 text-sm font-medium">{category.name}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Recently Listed
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Fresh listings from trusted listers in the marketplace.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/listings">View All Listings</Link>
          </Button>
        </div>

        <ListingGrid
          currentUserId={currentUserId}
          emptyMessage="Once listings go live, they will show up here automatically."
          favoritedIds={favoritedIds}
          listings={listings}
        />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight">How It Works</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <Card key={step.title} className="border-border/70">
                <CardContent className="space-y-4 p-6">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border/70 bg-muted/40 px-6 py-12 text-center sm:px-10">
          <h2 className="text-3xl font-semibold tracking-tight">Ready to start?</h2>
          <p className="mt-3 text-muted-foreground">
            Build trust, manage rentals, and turn unused items into earnings.
          </p>
          <div className="mt-6">
            <Button asChild size="lg">
              <Link href={isLoggedIn ? "/dashboard" : "/register"}>
                {isLoggedIn ? "Go to Dashboard" : "Sign Up"}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
