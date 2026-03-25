import Link from "next/link";
import { PackageSearch } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ListingNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="rounded-full bg-muted p-5">
        <PackageSearch className="size-10 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Listing Not Found</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        This listing may have been removed, archived, or is no longer available.
      </p>
      <Button asChild className="mt-6">
        <Link href="/listings">Browse Listings</Link>
      </Button>
    </div>
  );
}
