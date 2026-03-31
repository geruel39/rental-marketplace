"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { expireUnpaidBookings } from "@/actions/bookings";
import { Button } from "@/components/ui/button";

export function ExpireUnpaidBookingsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await expireUnpaidBookings();

          if (result.error) {
            toast.error(result.error);
            return;
          }

          toast.success(result.success ?? "Expired unpaid bookings.");
          router.refresh();
        });
      }}
      type="button"
      variant="outline"
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
      Expire Unpaid Bookings
    </Button>
  );
}
