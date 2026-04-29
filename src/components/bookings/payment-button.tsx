"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { createPaymentForBooking } from "@/actions/payments";
import { Button } from "@/components/ui/button";

interface PaymentButtonProps {
  bookingId: string;
  paymentUrl?: string | null;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function PaymentButton({
  bookingId,
  paymentUrl,
  className,
  variant = "default",
}: PaymentButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function redirectToPayment(url: string) {
    window.location.assign(url);
  }

  function handleClick() {
    if (paymentUrl) {
      redirectToPayment(paymentUrl);
      return;
    }

    startTransition(async () => {
      const result = await createPaymentForBooking(bookingId);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Redirecting to payment...");
      router.refresh();
      redirectToPayment(result.paymentUrl);
    });
  }

  return (
    <Button
      className={className}
      disabled={isPending}
      onClick={handleClick}
      type="button"
      variant={variant}
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
      {isPending ? "Preparing payment..." : "Pay Now"}
    </Button>
  );
}
