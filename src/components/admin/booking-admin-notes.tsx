"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addBookingAdminNotes } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function BookingAdminNotes({
  bookingId,
  initialNotes,
}: {
  bookingId: string;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <Textarea
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Add internal booking notes for operations or dispute follow-up"
        rows={5}
        value={notes}
      />
      <div className="flex justify-end">
        <Button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await addBookingAdminNotes(bookingId, notes);
              router.refresh();
            })
          }
        >
          {isPending ? "Saving..." : "Save Notes"}
        </Button>
      </div>
    </div>
  );
}
