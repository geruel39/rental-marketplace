import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StockLevelBadgeProps {
  quantityAvailable: number;
  lowStockThreshold: number | null;
  trackInventory: boolean;
  size?: "sm" | "md";
}

export function StockLevelBadge({
  quantityAvailable,
  lowStockThreshold,
  trackInventory,
  size = "sm",
}: StockLevelBadgeProps) {
  if (!trackInventory) {
    return null;
  }

  const sizeClass = size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  const threshold = lowStockThreshold ?? 1;

  if (quantityAvailable === 0) {
    return (
      <Badge className={cn("shadow-sm", sizeClass)} variant="destructive">
        Out of Stock
      </Badge>
    );
  }

  if (quantityAvailable <= threshold) {
    return (
      <Badge
        className={cn(
          "border-amber-200 bg-amber-100 text-amber-800 shadow-sm",
          sizeClass,
        )}
        variant="outline"
      >
        Low Stock ({quantityAvailable} left)
      </Badge>
    );
  }

  return (
    <Badge
      className={cn(
        "border-emerald-200 bg-emerald-100 text-emerald-800 shadow-sm",
        sizeClass,
      )}
      variant="outline"
    >
      {size === "md" ? `${quantityAvailable} available` : "In Stock"}
    </Badge>
  );
}
