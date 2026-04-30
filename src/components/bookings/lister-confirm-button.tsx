"use client";

import { useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { listerConfirmBooking } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ListerConfirmButtonProps {
  bookingId: string;
  className?: string;
}

export function ListerConfirmButton({
  bookingId,
  className,
}: ListerConfirmButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await listerConfirmBooking(bookingId);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Booking confirmed.");
      router.refresh();
    });
  }

  return (
    <Button
      className={cn(
        "h-10 w-full rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700",
        className,
      )}
      disabled={isPending}
      onClick={handleClick}
      type="button"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Check className="size-4" />
      )}
      {isPending ? "Confirming..." : "Confirm"}
    </Button>
  );
}
