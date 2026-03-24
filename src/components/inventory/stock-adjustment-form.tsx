"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Loader2, PackagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { adjustStock } from "@/actions/inventory";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResponse, Listing, StockMovementType } from "@/types";

interface StockAdjustmentFormProps {
  listing: Listing;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode | null;
}

const initialState: ActionResponse | null = null;

const adjustmentOptions: {
  value: Extract<
    StockMovementType,
    "adjustment_add" | "adjustment_remove" | "adjustment_set" | "damaged" | "lost"
  >;
  label: string;
  quantityLabel: string;
}[] = [
  {
    value: "adjustment_add",
    label: "Add Stock",
    quantityLabel: "Items to add",
  },
  {
    value: "adjustment_remove",
    label: "Remove Stock",
    quantityLabel: "Items to remove",
  },
  {
    value: "adjustment_set",
    label: "Set Total Stock",
    quantityLabel: "Set total to",
  },
  {
    value: "damaged",
    label: "Mark as Damaged",
    quantityLabel: "Items damaged",
  },
  {
    value: "lost",
    label: "Mark as Lost",
    quantityLabel: "Items lost",
  },
];

export function StockAdjustmentForm({
  listing,
  onSuccess,
  open: openProp,
  onOpenChange,
  trigger,
}: StockAdjustmentFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(adjustStock, initialState);
  const [internalOpen, setInternalOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] =
    useState<(typeof adjustmentOptions)[number]["value"]>("adjustment_add");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const open = openProp ?? internalOpen;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (openProp === undefined) {
        setInternalOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [onOpenChange, openProp],
  );

  const selectedOption = useMemo(
    () =>
      adjustmentOptions.find((option) => option.value === adjustmentType) ??
      adjustmentOptions[0],
    [adjustmentType],
  );

  const clientError = useMemo(() => {
    const parsedQuantity = Number(quantity);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      return "Quantity must be at least 1.";
    }

    if (reason.trim().length < 3) {
      return "Reason is required.";
    }

    if (
      (adjustmentType === "adjustment_remove" ||
        adjustmentType === "damaged" ||
        adjustmentType === "lost") &&
      parsedQuantity > listing.quantity_available
    ) {
      return `You cannot remove more than ${listing.quantity_available} available item${listing.quantity_available === 1 ? "" : "s"}.`;
    }

    if (
      adjustmentType === "adjustment_set" &&
      parsedQuantity < listing.quantity_reserved
    ) {
      return `Total stock cannot be lower than ${listing.quantity_reserved} reserved item${listing.quantity_reserved === 1 ? "" : "s"}.`;
    }

    return null;
  }, [
    adjustmentType,
    listing.quantity_available,
    listing.quantity_reserved,
    quantity,
    reason,
  ]);

  useEffect(() => {
    if (!state?.success) {
      return;
    }

    toast.success(state.success);
    const timeoutId = window.setTimeout(() => {
      router.refresh();
      setOpen(false);
      setAdjustmentType("adjustment_add");
      setQuantity("1");
      setReason("");
      onSuccess?.();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [onSuccess, router, setOpen, state?.success]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (clientError) {
      toast.error(clientError);
      return;
    }

    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {trigger === null ? null : (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" type="button">
              <PackagePlus className="size-4" />
              Adjust Stock
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Update inventory for {listing.title} and leave a clear audit note.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <input name="listing_id" type="hidden" value={listing.id} />
          <input name="adjustment_type" type="hidden" value={adjustmentType} />

          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
            <p className="font-medium text-foreground">Current stock</p>
            <p className="mt-1 text-muted-foreground">
              Total: {listing.quantity_total} | Available: {listing.quantity_available} |
              {" "}Reserved: {listing.quantity_reserved}
            </p>
          </div>

          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="adjustment-type">Adjustment type</Label>
            <Select onValueChange={(value) => setAdjustmentType(value as typeof adjustmentType)} value={adjustmentType}>
              <SelectTrigger className="w-full" id="adjustment-type">
                <SelectValue placeholder="Select adjustment type" />
              </SelectTrigger>
              <SelectContent>
                {adjustmentOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">{selectedOption.quantityLabel}</Label>
            <Input
              id="quantity"
              inputMode="numeric"
              min={1}
              name="quantity"
              onChange={(event) => setQuantity(event.target.value)}
              type="number"
              value={quantity}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              name="reason"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why you are making this stock adjustment"
              required
              rows={4}
              value={reason}
            />
          </div>

          {clientError ? (
            <p className="text-sm text-destructive">{clientError}</p>
          ) : null}

          <DialogFooter>
            <Button disabled={isPending} type="submit">
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save adjustment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
