"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteListing, setListingStatus } from "@/actions/listings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Listing } from "@/types";

interface MyListingActionsProps {
  listing: Listing;
}

export function MyListingActions({ listing }: MyListingActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggleStatus() {
    startTransition(async () => {
      const result = await setListingStatus(
        listing.id,
        listing.status === "active" ? "paused" : "active",
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Listing updated");
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteListing(listing.id);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Listing deleted");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Open listing actions"
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          disabled={isPending}
          type="button"
        >
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open listing actions</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/my-listings/${listing.id}/edit`}>Edit</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            handleToggleStatus();
          }}
        >
          {listing.status === "active" ? "Pause" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            handleDelete();
          }}
          variant="destructive"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
