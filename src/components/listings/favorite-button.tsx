"use client";

import { startTransition, useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { toggleFavorite } from "@/actions/favorites";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  listingId: string;
  isFavorited?: boolean;
  currentUserId?: string;
  className?: string;
  onToggleFavorite?: (isFavorited: boolean) => void;
  refreshOnSuccess?: boolean;
  size?: "default" | "icon" | "sm" | "lg";
  variant?: "default" | "ghost" | "outline" | "secondary";
}

export function FavoriteButton({
  listingId,
  isFavorited = false,
  currentUserId,
  className,
  onToggleFavorite,
  refreshOnSuccess = false,
  size = "icon",
  variant = "outline",
}: FavoriteButtonProps) {
  const router = useRouter();
  const [optimisticFavorite, setOptimisticFavorite] = useState(isFavorited);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setOptimisticFavorite(isFavorited);
  }, [isFavorited]);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!currentUserId) {
      router.push(`/login?redirectedFrom=/listings/${listingId}`);
      return;
    }

    const nextValue = !optimisticFavorite;
    setOptimisticFavorite(nextValue);
    setIsPending(true);

    startTransition(async () => {
      const result = await toggleFavorite(listingId);

      if ("error" in result) {
        setOptimisticFavorite(!nextValue);
        setIsPending(false);

        if (result.error.toLowerCase().includes("logged in")) {
          router.push(`/login?redirectedFrom=/listings/${listingId}`);
          return;
        }

        toast.error(result.error);
        return;
      }

      setOptimisticFavorite(result.isFavorited);
      setIsPending(false);
      onToggleFavorite?.(result.isFavorited);

      if (refreshOnSuccess) {
        router.refresh();
      }
    });
  }

  return (
    <Button
      aria-label={optimisticFavorite ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "transition-colors",
        optimisticFavorite
          ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-500"
          : "",
        className,
      )}
      disabled={isPending}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
    >
      <Heart
        className={cn(
          "size-4 hover:text-red-500",
          optimisticFavorite && "fill-current text-red-500",
        )}
      />
    </Button>
  );
}
